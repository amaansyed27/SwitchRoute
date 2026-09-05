# Production deployment

## Architecture

Deploy the web and gateway as independent projects. Edge is distributed as a user-installed binary and must not be forced into Vercel.

Target domains:

- `switchroute.dawnlightlabs.com` → web project
- `api.switchroute.dawnlightlabs.com` → gateway project

## Environment separation

Never share preview secrets with production by convenience. Configure production values separately for Supabase, database access, Redis, virtual-key pepper, credential encryption, and allowed web origins.

The browser receives only publishable Supabase configuration. Database URLs, Redis credentials, provider encryption keys/data keys, KMS configuration, and key peppers are server-only.

## Credential backend

Local/dev may use `SWITCHROUTE_SECRET_KEY` + key ID.

Production should use the KMS-wrapped data-key backend when available. Keep previous key material configured as decrypt-only during rotation until all credential rows have been re-encrypted or retired. Losing historical decrypt key material makes existing provider ciphertext unrecoverable.

## Pre-promotion verification

1. CI is fully green for the exact commit.
2. Preview web and gateway deployments are READY.
3. `GET /health` succeeds and routing state reports the expected status.
4. Sign-in and auth callback work on the preview host.
5. Connect a deterministic/test provider in a non-production workspace where possible.
6. Create Route → create key → `/v1/models` → chat completion → streaming completion.
7. Verify Activity contains only operational metadata.
8. Verify no Authorization headers/provider credentials appear in runtime logs.
9. Review Supabase Security Advisor and Vercel runtime/build errors.
10. Attach/promote production only after review.

## Rollback

Web and gateway roll back independently to the previous verified deployment. Do not delete or rewrite unrelated Dawnlight projects. Database migrations must remain backward-compatible with the previous application version; restore from database backups only for actual data/schema recovery, not as a normal application rollback.

## Domains

Attach the requested custom domain to the matching project only after the deployment is verified. Configure DNS according to Vercel's domain instructions, wait for verification/TLS issuance, then verify both HTTPS endpoints before announcing release.

## Signing

Edge archives and SHA-256 checksums can be released without code-signing credentials, but release notes must clearly say when Windows binaries are unsigned and when macOS artifacts are not notarized. Add signing/notarization only when the required credentials are available; never claim it preemptively.
