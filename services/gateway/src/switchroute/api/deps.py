from dataclasses import dataclass
from uuid import UUID

from fastapi import Header, Request

from switchroute.auth.supabase import UserIdentity
from switchroute.auth.virtual_keys import hash_virtual_key
from switchroute.domain import VirtualKeyContext
from switchroute.errors import AUTHENTICATION_ERROR, ROUTE_UNAVAILABLE, SwitchRouteError
from switchroute.services import Services


@dataclass(slots=True)
class WorkspaceContext:
    identity: UserIdentity
    workspace_id: UUID
    workspace: dict


def services_from(request: Request) -> Services:
    return request.app.state.services


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise SwitchRouteError(AUTHENTICATION_ERROR, "A bearer token is required.", 401)
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise SwitchRouteError(AUTHENTICATION_ERROR, "A bearer token is required.", 401)
    return token


async def workspace_context(
    request: Request,
    authorization: str | None = Header(default=None),
) -> WorkspaceContext:
    services = services_from(request)
    identity = await services.user_auth.verify(_bearer(authorization))
    workspace = await services.repository.default_workspace(identity.user_id)
    return WorkspaceContext(identity=identity, workspace_id=workspace["id"], workspace=workspace)


async def virtual_key_context(
    request: Request,
    authorization: str | None = Header(default=None),
) -> VirtualKeyContext:
    services = services_from(request)
    raw_key = _bearer(authorization)
    if not raw_key.startswith(("sr_live_", "sr_test_")):
        raise SwitchRouteError(AUTHENTICATION_ERROR, "Invalid SwitchRoute API key.", 401)
    key_hash = hash_virtual_key(raw_key, services.settings.switchroute_key_pepper)
    context = await services.repository.resolve_virtual_key(key_hash)
    if not context:
        raise SwitchRouteError(AUTHENTICATION_ERROR, "Invalid or revoked SwitchRoute API key.", 401)
    if not context.route_enabled:
        raise SwitchRouteError(ROUTE_UNAVAILABLE, "The Route bound to this key is disabled.", 503)
    return context
