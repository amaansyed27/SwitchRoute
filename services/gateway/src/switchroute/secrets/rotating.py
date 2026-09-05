from switchroute.errors import CONFIGURATION_ERROR, SwitchRouteError
from switchroute.secrets.base import SecretStore


class RotatingSecretStore:
    """Encrypt with one active key while retaining explicitly configured decrypt-only keys."""

    def __init__(self, active_key_id: str, stores: dict[str, SecretStore]) -> None:
        if active_key_id not in stores:
            raise SwitchRouteError(CONFIGURATION_ERROR, "Active credential key is unavailable.", 503)
        self._active_key_id = active_key_id
        self._stores = stores

    def encrypt(self, plaintext: str) -> tuple[str, str]:
        return self._stores[self._active_key_id].encrypt(plaintext)

    def decrypt(self, ciphertext: str, key_id: str) -> str:
        store = self._stores.get(key_id)
        if store is None:
            raise SwitchRouteError(CONFIGURATION_ERROR, "Credential key version is unavailable.", 503)
        return store.decrypt(ciphertext, key_id)
