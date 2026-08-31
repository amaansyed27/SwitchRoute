from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status

from switchroute.api.deps import WorkspaceContext, workspace_context
from switchroute.api.schemas import KeyCreate, ProviderCreate, ProviderCredential, RouteWrite
from switchroute.auth.virtual_keys import create_virtual_key

router = APIRouter(prefix="/manage", tags=["Product management"])


def _models(models) -> list[dict]:
    return [
        {
            "id": item.id,
            "name": item.name,
            "billing_tier": item.billing_tier,
            "capabilities": item.capabilities,
        }
        for item in models
    ]


@router.get("/bootstrap")
async def bootstrap(request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    repo = request.app.state.services.repository
    providers = await repo.list_providers(ctx.workspace_id)
    routes = await repo.list_routes(ctx.workspace_id)
    keys = await repo.list_keys(ctx.workspace_id)
    return {
        "workspace": ctx.workspace,
        "providers": providers,
        "routes": routes,
        "keys": keys,
        "onboarding_complete": bool(providers and routes and keys),
    }


@router.post("/providers/validate")
async def validate_provider(body: ProviderCredential, request: Request, _: WorkspaceContext = Depends(workspace_context)):
    services = request.app.state.services
    if body.provider_kind == "test" and not services.settings.enable_test_provider:
        return Response(status_code=status.HTTP_404_NOT_FOUND)
    models = await services.providers.get(body.provider_kind).validate_and_discover(body.api_key)
    return {"provider_kind": body.provider_kind, "status": "healthy", "models": _models(models)}


@router.get("/providers")
async def list_providers(request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    return await request.app.state.services.repository.list_providers(ctx.workspace_id)


@router.post("/providers", status_code=201)
async def create_provider(body: ProviderCreate, request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    services = request.app.state.services
    if body.provider_kind == "test" and not services.settings.enable_test_provider:
        return Response(status_code=status.HTTP_404_NOT_FOUND)
    models = await services.providers.get(body.provider_kind).validate_and_discover(body.api_key)
    encrypted, key_id = services.secrets.encrypt(body.api_key)
    return await services.repository.create_provider(
        ctx.workspace_id,
        body.provider_kind,
        body.display_name,
        {"models": _models(models)},
        encrypted,
        key_id,
    )


@router.post("/providers/{provider_id}/test")
async def test_provider(provider_id: UUID, request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    services = request.app.state.services
    kind, encrypted, key_id = await services.repository.provider_secret(ctx.workspace_id, provider_id)
    secret = services.secrets.decrypt(encrypted, key_id)
    models = await services.providers.get(kind).validate_and_discover(secret)
    metadata = {"models": _models(models)}
    await services.repository.update_provider_health(ctx.workspace_id, provider_id, "healthy", metadata)
    return {"status": "healthy", "models": metadata["models"]}


@router.delete("/providers/{provider_id}", status_code=204)
async def delete_provider(provider_id: UUID, request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    await request.app.state.services.repository.delete_provider(ctx.workspace_id, provider_id)


@router.get("/routes")
async def list_routes(request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    return await request.app.state.services.repository.list_routes(ctx.workspace_id)


@router.post("/routes", status_code=201)
async def create_route(body: RouteWrite, request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    return await request.app.state.services.repository.create_route(
        ctx.workspace_id, body.name, body.slug, body.strategy, body.enabled,
        [item.model_dump(mode="json") for item in body.targets],
    )


@router.put("/routes/{route_id}")
async def update_route(route_id: UUID, body: RouteWrite, request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    return await request.app.state.services.repository.update_route(
        ctx.workspace_id, route_id, body.name, body.slug, body.strategy, body.enabled,
        [item.model_dump(mode="json") for item in body.targets],
    )


@router.delete("/routes/{route_id}", status_code=204)
async def delete_route(route_id: UUID, request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    await request.app.state.services.repository.delete_route(ctx.workspace_id, route_id)


@router.get("/keys")
async def list_keys(request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    return await request.app.state.services.repository.list_keys(ctx.workspace_id)


@router.post("/keys", status_code=201)
async def create_key(body: KeyCreate, request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    services = request.app.state.services
    raw, prefix, key_hash = create_virtual_key(body.environment, services.settings.switchroute_key_pepper)
    record = await services.repository.create_key(
        ctx.workspace_id, body.route_id, body.environment, body.name, prefix, key_hash, body.expires_at
    )
    return {**record, "key": raw, "shown_once": True}


@router.delete("/keys/{key_id}", status_code=204)
async def revoke_key(key_id: UUID, request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    await request.app.state.services.repository.revoke_key(ctx.workspace_id, key_id)


@router.get("/activity")
async def activity(request: Request, limit: int = 50, ctx: WorkspaceContext = Depends(workspace_context)):
    return await request.app.state.services.repository.activity(ctx.workspace_id, limit)


@router.get("/dashboard")
async def dashboard(request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    services = request.app.state.services
    summary = await services.repository.dashboard(ctx.workspace_id)
    summary["recent_activity"] = await services.repository.activity(ctx.workspace_id, 8)
    summary["providers"] = await services.repository.list_providers(ctx.workspace_id)
    return summary
