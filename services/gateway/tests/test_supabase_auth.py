from uuid import UUID

import pytest

from switchroute.auth import supabase as module
from switchroute.auth.supabase import SupabaseAuthenticator
from switchroute.errors import SwitchRouteError


class Response:
    def __init__(self, status: int) -> None:
        self.status_code = status

    def json(self):
        return {"id": "11111111-1111-1111-1111-111111111111", "email": "dev@example.com"}


class Client:
    response = Response(200)

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def get(self, *args, **kwargs):
        return self.response


@pytest.mark.asyncio
async def test_supabase_auth_verifies_user(monkeypatch) -> None:
    monkeypatch.setattr(module.httpx, "AsyncClient", Client)
    identity = await SupabaseAuthenticator("https://example.supabase.co", "publishable").verify("jwt")
    assert identity.user_id == UUID("11111111-1111-1111-1111-111111111111")


@pytest.mark.asyncio
async def test_supabase_auth_rejects_bad_session(monkeypatch) -> None:
    Client.response = Response(401)
    monkeypatch.setattr(module.httpx, "AsyncClient", Client)
    with pytest.raises(SwitchRouteError) as error:
        await SupabaseAuthenticator("https://example.supabase.co", "publishable").verify("bad")
    assert error.value.code == "authentication_error"
    Client.response = Response(200)
