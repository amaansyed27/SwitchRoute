# ADR 0002: Replaceable encrypted SecretStore

Status: Accepted for Slice 1

Provider credentials are encrypted in the gateway with AES-256-GCM using an environment-provided 32-byte key and versioned key ID. Ciphertext is stored in a private Postgres schema that is not exposed by the Supabase Data API.

Application code depends on a `SecretStore` interface. A later KMS/envelope-encryption implementation can replace the Slice 1 AES-GCM implementation without changing provider or routing modules.

The encryption key never belongs in the browser or database. Rotation is supported by key IDs; automated re-encryption is deferred.
