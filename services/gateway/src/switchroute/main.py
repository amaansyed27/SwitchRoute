import time
from contextlib import asynccontextmanager
from uuid import UUID, uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from switchroute.api.management import router as management_router
from switchroute.api.public import router as public_router
from switchroute.config import get_settings
from switchroute.errors import SwitchRouteError
from switchroute.observability import emit_request_event
from switchroute.routing.redis_state import create_routing_state
from switchroute.services import build_services
from switchroute.storage.postgres import PostgresRepository


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    repository = PostgresRepository(settings.supabase_db_url)
    await repository.connect()
    routing_state = await create_routing_state(settings.redis_url)
    app.state.services = build_services(settings, repository, routing_state)
    yield
    await routing_state.close()
    await repository.close()


app = FastAPI(
    title="SwitchRoute Gateway",
    version="0.4.0",
    description="OpenAI-compatible intelligent capacity router for SwitchRoute.",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-SwitchRoute-Request-ID", "X-SwitchRoute-Route"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    incoming = request.headers.get("x-request-id")
    try:
        request_id = UUID(incoming) if incoming else uuid4()
    except ValueError:
        request_id = uuid4()
    request.state.switchroute_request_id = request_id
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-SwitchRoute-Request-ID"] = str(request_id)
    emit_request_event(
        event="http_request",
        request_id=str(request_id),
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        latency_ms=int((time.perf_counter() - started) * 1000),
    )
    return response


@app.exception_handler(SwitchRouteError)
async def switchroute_error_handler(request: Request, exc: SwitchRouteError):
    request_id = getattr(request.state, "switchroute_request_id", uuid4())
    return ORJSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.message, "type": exc.code, "code": exc.code}},
        headers={"X-SwitchRoute-Request-ID": str(request_id)},
    )


@app.get("/health", include_in_schema=False)
async def health(request: Request):
    services = request.app.state.services
    return {
        "status": "ok" if services.routing_state.available else "degraded",
        "service": "switchroute-gateway",
        "routing_state": "available" if services.routing_state.available else "degraded",
    }


app.include_router(public_router)
app.include_router(management_router)
