import base64
import os

from switchroute.secrets.aes_gcm import AesGcmSecretStore


def test_provider_secret_round_trip_without_plaintext_ciphertext() -> None:
    key = base64.urlsafe_b64encode(os.urandom(32)).decode()
    store = AesGcmSecretStore(key, "test-v1")
    ciphertext, key_id = store.encrypt("gsk_super_secret")
    assert "gsk_super_secret" not in ciphertext
    assert store.decrypt(ciphertext, key_id) == "gsk_super_secret"
