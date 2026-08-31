# Slice 1 threat model

Primary assets are provider credentials, SwitchRoute virtual keys, workspace configuration, and operational metadata.

Primary controls:

- Supabase Auth verifies user identity; workspace authorization is explicit in both RLS and gateway repository queries.
- Provider credentials are write-only and encrypted before database persistence.
- Virtual keys are bearer credentials, shown once and stored only as keyed hashes.
- Public tables use RLS; credential ciphertext lives in a non-exposed schema.
- Gateway errors/logs are sanitized to avoid prompt/credential echoes.
- CORS is restricted to configured product origins.

Out of scope for Slice 1: enterprise SSO/RBAC, KMS-managed envelope keys, Edge agents, and Redis-based live quota state.
