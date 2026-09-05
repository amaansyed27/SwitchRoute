import time
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from switchroute.api.deps import virtual_key_context
from switchroute.api.schemas import ChatCompletionRequest
from switchroute.domain import VirtualKeyContext
from switchroute.errors import INVALID_REQUEST, SwitchRouteError
from switchroute.routing.orchestrator import RouteOrchestrator

router = APIRouter(prefix="/v1", tags=["OpenAI compatible"])


def _validate_model(requested: str, context: VirtualKeyContext) -> None:
    if requested not in {"auto", context.route_slug}:
        raise SwitchRouteError(INVALID_REQUEST, "Use model='auto' or the Route slug bound to this key.", 400)


def _request_uuid(request: Request) -> UUID:
    value = getattr(request.state, "switchroute_request_id", None)
    return value if isinstance(value, UUID) else uuid4()


@router.post("/chat/completions")
async def chat_completions(
    body: ChatCompletionRequest,
    request: Request,
    context: VirtualKeyContext = Depends(virtual_key_context),
):
    _validate_model(body.model, context)
    orchestrator = RouteOrchestrator(request.app.state.services)
    payload = body.model_dump(exclude_none=True)
    headers = {"X-SwitchRoute-Route": context.route_slug}
    if body.stream:
        return StreamingResponse(
            orchestrator.stream(context, payload, request_id=_request_uuid(request)),
            media_type="text/event-stream",
            headers={
                **headers,
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )
    return JSONResponse(
        await orchestrator.complete(context, payload, request_id=_request_uuid(request)),
        headers=headers,
    )


@router.get("/models")
async def models(context: VirtualKeyContext = Depends(virtual_key_context)):
    created = int(time.time())
    return JSONResponse(
        {
            "object": "list",
            "data": [
                {"id": "auto", "object": "model", "created": created, "owned_by": "switchroute"},
                {"id": context.route_slug, "object": "model", "created": created, "owned_by": "switchroute"},
            ],
        },
        headers={"X-SwitchRoute-Route": context.route_slug},
    )
