import hashlib
import hmac
import secrets

from switchroute.errors import CONFIGURATION_ERROR, SwitchRouteError


def create_virtual_key(environment: str, pepper: str | None) -> tuple[str, str, str]:
    if environment not in {"live", "test"}:
        raise ValueError("environment must be live or test")
    raw = f"sr_{environment}_{secrets.token_urlsafe(32)}"
    return raw, raw[:18], hash_virtual_key(raw, pepper)


def hash_virtual_key(raw_key: str, pepper: str | None) -> str:
    if not pepper:
        raise SwitchRouteError(CONFIGURATION_ERROR, "Virtual-key hashing is not configured.", 503)
    return hmac.new(pepper.encode(), raw_key.encode(), hashlib.sha256).hexdigest()
