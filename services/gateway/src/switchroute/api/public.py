import time

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from switchroute.api.deps import virtual_key_context
from switchroute.api.schemas import ChatCompletionRequest
from switchroute.domain import VirtualKeyContext
from switchroute.routing.orchestrator import RouteOrchestrator

router = APIRouter(prefix="/v1", tags=["OpenAI compatible"])


@router.post("/chat/completions")
async def chat_completions(
    body: ChatCompletionRequest,
    request: Request,
    context: VirtualKeyContext = Depends(virtual_key_context),
):
    orchestrator = RouteOrchestrator(request.app.state.services)
    payload = body.model_dump(exclude_none=True)
    if body.stream:
        return StreamingResponse(
            orchestrator.stream(context, payload),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    return JSONResponse(await orchestrator.complete(context, payload))


@router.get("/models")
async def models(context: VirtualKeyContext = Depends(virtual_key_context)):
    created = int(time.time())
    return {
        "object": "list",
        "data": [
            {"id": "auto", "object": "model", "created": created, "owned_by": "switchroute"},
            {"id": context.route_slug, "object": "model", "created": created, "owned_by": "switchroute"},
        ],
    }
