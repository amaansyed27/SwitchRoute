import base64
import json

from switchroute.config import Settings
from switchroute.secrets.factory import build_secret_store


def encoded_key(byte: int) -> str:
    return base64.urlsafe_b64encode(bytes([byte]) * 32).decode()


def test_environment_key_ring_reads_previous_ciphertexts_and_writes_active_key() -> None:
    old_settings = Settings(
        switchroute_secret_key=encoded_key(1),
        switchroute_secret_key_id="old-v1",
    )
    old_store = build_secret_store(old_settings)
    ciphertext, old_key_id = old_store.encrypt("provider-secret")

    settings = Settings(
        switchroute_secret_key=encoded_key(2),
        switchroute_secret_key_id="new-v2",
        switchroute_previous_secret_keys_json=json.dumps({"old-v1": encoded_key(1)}),
    )
    store = build_secret_store(settings)
    assert store.decrypt(ciphertext, old_key_id) == "provider-secret"
    _new_ciphertext, new_key_id = store.encrypt("new-secret")
    assert new_key_id == "new-v2"


def test_kms_backend_unwraps_active_key_once_per_store_build(monkeypatch) -> None:
    calls = []

    class Kms:
        def decrypt(self, *, CiphertextBlob):
            calls.append(CiphertextBlob)
            return {"Plaintext": bytes([7]) * 32}

    monkeypatch.setattr("switchroute.secrets.factory.boto3.client", lambda *args, **kwargs: Kms())
    wrapped = base64.b64encode(b"wrapped-key").decode()
    store = build_secret_store(
        Settings(
            switchroute_secret_backend="aws_kms",
            switchroute_secret_key_id="kms-v1",
            switchroute_kms_wrapped_key=wrapped,
            switchroute_kms_region="ap-south-1",
        )
    )
    ciphertext, key_id = store.encrypt("provider-secret")
    assert store.decrypt(ciphertext, key_id) == "provider-secret"
    assert calls == [b"wrapped-key"]
