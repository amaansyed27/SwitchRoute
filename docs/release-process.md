# Release process

`VERSION` is the release source of truth. Normal development happens on reviewed branches; publishing/release tags happen only after the candidate is approved and merged.

## Candidate validation

Run the complete CI suite and confirm:

- web lint/typecheck/tests/build/file-size/dependency audit
- gateway Ruff/Pyright/pytest/OpenAPI drift/dependency audit
- Supabase migrations and pgTAP/RLS/privacy tests
- Edge fmt/clippy/tests/build on Windows, Linux, macOS plus Rust dependency audit
- Python SDK typing/tests/build/wheel install smoke
- JavaScript SDK type/build/tests/package smoke
- official OpenAI Python/JavaScript SDK compatibility checks
- version consistency, zero-retention check, gitleaks

Run k6 scenarios against a deterministic non-paid environment separately and record the machine/runtime/configuration when publishing benchmark results. Do not publish benchmark numbers that were not measured.

## SDK publishing

SDK publishing is guarded by the SDK release workflow. A release operator must explicitly enable publishing and provide the registry credentials/trusted publisher configuration. A branch push alone must never publish packages.

## Edge release

Edge releases are built from native GitHub-hosted runners for Windows x64, Linux x64, macOS arm64, and macOS x64 when practical. The workflow creates versioned archives and SHA-256 checksums.

Signing/notarization is a separate credentialed step. Unsigned artifacts must be described as unsigned.

## Tags

Use SemVer tags matching `VERSION`, for example `v0.4.0`. Release workflows must reject tags that do not match the repository version.

## Compatibility

Update `CHANGELOG.md`, public docs, and `docs/compatibility.md` with every release. Do not add `/v1/responses` or any other compatibility claim until the runtime and tests genuinely support it.
