from typing import Protocol


class SecretStore(Protocol):
    def encrypt(self, plaintext: str) -> tuple[str, str]: ...

    def decrypt(self, ciphertext: str, key_id: str) -> str: ...
