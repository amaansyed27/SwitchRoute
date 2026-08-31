from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from switchroute.api.management import router as management_router
from switchroute.api.public import router as public_router
from switchroute.config import get_settings
from switchroute.errors import SwitchRouteError
from switchroute.services import build_services
from switchroute.storage.postgres import PostgresRepository


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    repository = PostgresRepository(settings.supabase_db_url)
    await repository.connect()
    app.state.services = build_services(settings, repository)
    yield
    await repository.close()


app = FastAPI(
    title="SwitchRoute Gateway",
    version="0.1.0",
    description="OpenAI-compatible routing gateway for SwitchRoute Cloud Core.",
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
)


@app.exception_handler(SwitchRouteError)
async def switchroute_error_handler(_: Request, exc: SwitchRouteError):
    return ORJSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.message, "type": exc.code, "code": exc.code}},
    )


@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok", "service": "switchroute-gateway"}


app.include_router(public_router)
app.include_router(management_router)
