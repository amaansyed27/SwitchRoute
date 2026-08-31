import base64
import json
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from switchroute.errors import CONFIGURATION_ERROR, SwitchRouteError


class AesGcmSecretStore:
    def __init__(self, encoded_key: str | None, key_id: str) -> None:
        self._key_id = key_id
        self._key = self._decode_key(encoded_key)

    @staticmethod
    def _decode_key(encoded_key: str | None) -> bytes | None:
        if not encoded_key:
            return None
        try:
            key = base64.urlsafe_b64decode(encoded_key)
        except Exception as exc:  # pragma: no cover - defensive config path
            raise SwitchRouteError(CONFIGURATION_ERROR, "Invalid secret-store key.", 503) from exc
        if len(key) != 32:
            raise SwitchRouteError(CONFIGURATION_ERROR, "Secret-store key must decode to 32 bytes.", 503)
        return key

    def _require_key(self) -> bytes:
        if self._key is None:
            raise SwitchRouteError(CONFIGURATION_ERROR, "Provider secret storage is not configured.", 503)
        return self._key

    def encrypt(self, plaintext: str) -> tuple[str, str]:
        nonce = os.urandom(12)
        encrypted = AESGCM(self._require_key()).encrypt(nonce, plaintext.encode(), None)
        payload = {
            "v": 1,
            "nonce": base64.urlsafe_b64encode(nonce).decode(),
            "ciphertext": base64.urlsafe_b64encode(encrypted).decode(),
        }
        return json.dumps(payload, separators=(",", ":")), self._key_id

    def decrypt(self, ciphertext: str, key_id: str) -> str:
        if key_id != self._key_id:
            raise SwitchRouteError(CONFIGURATION_ERROR, "Credential key version is unavailable.", 503)
        payload = json.loads(ciphertext)
        nonce = base64.urlsafe_b64decode(payload["nonce"])
        encrypted = base64.urlsafe_b64decode(payload["ciphertext"])
        return AESGCM(self._require_key()).decrypt(nonce, encrypted, None).decode()
