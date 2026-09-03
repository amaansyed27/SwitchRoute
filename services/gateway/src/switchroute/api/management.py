from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status

from switchroute.api.deps import WorkspaceContext, workspace_context
from switchroute.api.schemas import KeyCreate, ProviderCreate, ProviderCredential, RouteWrite
from switchroute.auth.virtual_keys import create_virtual_key

router = APIRouter(prefix="/manage", tags=["Product management"])


def _models(models) -> list[dict[str, Any]]:
    return [
        {
            "id": item.id,
            "name": item.name,
            "billing_tier": item.billing_tier,
            "input_price_per_million_usd": item.input_price_per_million_usd,
            "output_price_per_million_usd": item.output_price_per_million_usd,
            "context_window": item.context_window,
            "max_output_tokens": item.max_output_tokens,
            "capabilities": item.capabilities,
            "metadata_provenance": item.metadata_provenance,
            "discovered_at": item.discovered_at,
        }
        for item in models
    ]


def _connection(body: ProviderCredential, adapter) -> dict[str, Any]:
    raw = body.connection.model_dump(exclude_none=True) if body.connection else None
    return adapter.normalize_connection_config(raw)


@router.get("/provider-catalog")
async def provider_catalog(request: Request, _: WorkspaceContext = Depends(workspace_context)):
    return request.app.state.services.providers.public_catalog()


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
async def validate_provider(
    body: ProviderCredential,
    request: Request,
    _: WorkspaceContext = Depends(workspace_context),
):
    services = request.app.state.services
    if body.provider_kind == "test" and not services.settings.enable_test_provider:
        return Response(status_code=status.HTTP_404_NOT_FOUND)
    adapter = services.providers.get(body.provider_kind)
    connection = _connection(body, adapter)
    models = await adapter.validate_and_discover(body.api_key, connection)
    return {"provider_kind": body.provider_kind, "status": "healthy", "models": _models(models)}


@router.get("/providers")
async def list_providers(request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    return await request.app.state.services.repository.list_providers(ctx.workspace_id)


@router.post("/providers", status_code=201)
async def create_provider(
    body: ProviderCreate,
    request: Request,
    ctx: WorkspaceContext = Depends(workspace_context),
):
    services = request.app.state.services
    if body.provider_kind == "test" and not services.settings.enable_test_provider:
        return Response(status_code=status.HTTP_404_NOT_FOUND)
    adapter = services.providers.get(body.provider_kind)
    connection = _connection(body, adapter)
    models = await adapter.validate_and_discover(body.api_key, connection)
    encrypted, key_id = services.secrets.encrypt(body.api_key)
    return await services.repository.create_provider(
        ctx.workspace_id,
        body.provider_kind,
        body.display_name,
        {"models": _models(models), "connection": connection},
        encrypted,
        key_id,
    )


@router.post("/providers/{provider_id}/test")
async def test_provider(
    provider_id: UUID,
    request: Request,
    ctx: WorkspaceContext = Depends(workspace_context),
):
    services = request.app.state.services
    kind, encrypted, key_id, metadata = await services.repository.provider_secret(
        ctx.workspace_id, provider_id
    )
    secret = services.secrets.decrypt(encrypted, key_id)
    connection = metadata.get("connection") if isinstance(metadata, dict) else None
    adapter = services.providers.get(kind)
    models = await adapter.validate_and_discover(secret, connection)
    next_metadata = dict(metadata) if isinstance(metadata, dict) else {}
    next_metadata["models"] = _models(models)
    await services.repository.update_provider_health(
        ctx.workspace_id, provider_id, "healthy", next_metadata
    )
    return {"status": "healthy", "models": next_metadata["models"]}


@router.delete("/providers/{provider_id}", status_code=204)
async def delete_provider(
    provider_id: UUID,
    request: Request,
    ctx: WorkspaceContext = Depends(workspace_context),
):
    await request.app.state.services.repository.delete_provider(ctx.workspace_id, provider_id)


@router.get("/routes")
async def list_routes(request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    return await request.app.state.services.repository.list_routes(ctx.workspace_id)


@router.post("/routes", status_code=201)
async def create_route(body: RouteWrite, request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    return await request.app.state.services.repository.create_route(
        ctx.workspace_id,
        body.name,
        body.slug,
        body.strategy,
        body.enabled,
        [item.model_dump(mode="json") for item in body.targets],
    )


@router.put("/routes/{route_id}")
async def update_route(
    route_id: UUID,
    body: RouteWrite,
    request: Request,
    ctx: WorkspaceContext = Depends(workspace_context),
):
    return await request.app.state.services.repository.update_route(
        ctx.workspace_id,
        route_id,
        body.name,
        body.slug,
        body.strategy,
        body.enabled,
        [item.model_dump(mode="json") for item in body.targets],
    )


@router.delete("/routes/{route_id}", status_code=204)
async def delete_route(
    route_id: UUID,
    request: Request,
    ctx: WorkspaceContext = Depends(workspace_context),
):
    await request.app.state.services.repository.delete_route(ctx.workspace_id, route_id)


@router.get("/keys")
async def list_keys(request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    return await request.app.state.services.repository.list_keys(ctx.workspace_id)


@router.post("/keys", status_code=201)
async def create_key(body: KeyCreate, request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    services = request.app.state.services
    raw, prefix, key_hash = create_virtual_key(
        body.environment, services.settings.switchroute_key_pepper
    )
    record = await services.repository.create_key(
        ctx.workspace_id,
        body.route_id,
        body.environment,
        body.name,
        prefix,
        key_hash,
        body.expires_at,
    )
    return {**record, "key": raw, "shown_once": True}


@router.delete("/keys/{key_id}", status_code=204)
async def revoke_key(
    key_id: UUID,
    request: Request,
    ctx: WorkspaceContext = Depends(workspace_context),
):
    await request.app.state.services.repository.revoke_key(ctx.workspace_id, key_id)


@router.get("/activity")
async def activity(
    request: Request,
    limit: int = 50,
    ctx: WorkspaceContext = Depends(workspace_context),
):
    return await request.app.state.services.repository.activity(ctx.workspace_id, limit)


@router.get("/dashboard")
async def dashboard(request: Request, ctx: WorkspaceContext = Depends(workspace_context)):
    services = request.app.state.services
    summary = await services.repository.dashboard(ctx.workspace_id)
    summary["recent_activity"] = await services.repository.activity(ctx.workspace_id, 8)
    summary["providers"] = await services.repository.list_providers(ctx.workspace_id)
    return summary
