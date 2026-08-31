from dataclasses import dataclass
from uuid import UUID

import httpx

from switchroute.errors import AUTHENTICATION_ERROR, CONFIGURATION_ERROR, SwitchRouteError


@dataclass(slots=True)
class UserIdentity:
    user_id: UUID
    email: str | None


class SupabaseAuthenticator:
    def __init__(self, url: str | None, publishable_key: str | None) -> None:
        self._url = url
        self._key = publishable_key

    async def verify(self, bearer_token: str) -> UserIdentity:
        if not self._url or not self._key:
            raise SwitchRouteError(CONFIGURATION_ERROR, "Supabase authentication is not configured.", 503)
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                f"{self._url.rstrip('/')}/auth/v1/user",
                headers={"Authorization": f"Bearer {bearer_token}", "apikey": self._key},
            )
        if response.status_code != 200:
            raise SwitchRouteError(AUTHENTICATION_ERROR, "Invalid or expired session.", 401)
        data = response.json()
        return UserIdentity(user_id=UUID(data["id"]), email=data.get("email"))
