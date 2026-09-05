import base64
import json
from typing import Any

import boto3

from switchroute.config import Settings
from switchroute.errors import CONFIGURATION_ERROR, SwitchRouteError
from switchroute.secrets.aes_gcm import AesGcmSecretStore
from switchroute.secrets.base import SecretStore
from switchroute.secrets.rotating import RotatingSecretStore


def _json_map(value: str, label: str) -> dict[str, str]:
    try:
        parsed: Any = json.loads(value or "{}")
    except json.JSONDecodeError as exc:
        raise SwitchRouteError(CONFIGURATION_ERROR, f"{label} must be a JSON object.", 503) from exc
    if not isinstance(parsed, dict) or not all(
        isinstance(key, str) and isinstance(item, str) for key, item in parsed.items()
    ):
        raise SwitchRouteError(CONFIGURATION_ERROR, f"{label} must map key IDs to strings.", 503)
    return parsed


def _unwrap_kms_key(ciphertext_b64: str, region: str) -> str:
    try:
        blob = base64.b64decode(ciphertext_b64, validate=True)
    except Exception as exc:
        raise SwitchRouteError(CONFIGURATION_ERROR, "Invalid KMS wrapped data key.", 503) from exc
    try:
        response = boto3.client("kms", region_name=region).decrypt(CiphertextBlob=blob)
        plaintext = response.get("Plaintext")
    except Exception as exc:
        raise SwitchRouteError(CONFIGURATION_ERROR, "KMS could not unwrap the credential data key.", 503) from exc
    if not isinstance(plaintext, bytes) or len(plaintext) != 32:
        raise SwitchRouteError(CONFIGURATION_ERROR, "KMS data key must be exactly 32 bytes.", 503)
    return base64.urlsafe_b64encode(plaintext).decode()


def build_secret_store(settings: Settings) -> SecretStore:
    stores: dict[str, SecretStore] = {}
    backend = settings.switchroute_secret_backend.strip().lower()
    active_id = settings.switchroute_secret_key_id

    if backend == "environment":
        stores[active_id] = AesGcmSecretStore(settings.switchroute_secret_key, active_id)
        previous = _json_map(
            settings.switchroute_previous_secret_keys_json,
            "SWITCHROUTE_PREVIOUS_SECRET_KEYS_JSON",
        )
        for key_id, encoded_key in previous.items():
            if key_id != active_id:
                stores[key_id] = AesGcmSecretStore(encoded_key, key_id)
    elif backend == "aws_kms":
        if not settings.switchroute_kms_wrapped_key or not settings.switchroute_kms_region:
            raise SwitchRouteError(
                CONFIGURATION_ERROR,
                "AWS KMS secret backend requires SWITCHROUTE_KMS_WRAPPED_KEY and SWITCHROUTE_KMS_REGION.",
                503,
            )
        stores[active_id] = AesGcmSecretStore(
            _unwrap_kms_key(settings.switchroute_kms_wrapped_key, settings.switchroute_kms_region),
            active_id,
        )
        previous = _json_map(
            settings.switchroute_kms_previous_wrapped_keys_json,
            "SWITCHROUTE_KMS_PREVIOUS_WRAPPED_KEYS_JSON",
        )
        for key_id, wrapped_key in previous.items():
            if key_id != active_id:
                stores[key_id] = AesGcmSecretStore(
                    _unwrap_kms_key(wrapped_key, settings.switchroute_kms_region),
                    key_id,
                )
    else:
        raise SwitchRouteError(
            CONFIGURATION_ERROR,
            "SWITCHROUTE_SECRET_BACKEND must be 'environment' or 'aws_kms'.",
            503,
        )

    return RotatingSecretStore(active_id, stores)
