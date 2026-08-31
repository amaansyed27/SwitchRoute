# Web Agent Guide

Follow the root `AGENTS.md` first. This file scopes additional rules to `apps/web`.

## Architecture

- Keep the Next.js App Router structure thin: route files should compose feature modules rather than accumulate product logic.
- Preserve the existing Supabase SSR/session flow and the same-origin `/api/manage/[...path]` BFF boundary. Do not bypass gateway management APIs from browser code.
- Keep shared product types/contracts aligned with the gateway and generated OpenAPI contract.
- Prefer reusable primitives from `packages/ui` and tokens from `packages/design-tokens` over local one-off styling systems.

## UI implementation

- Keep components responsibility-focused; split large forms, lists, and interaction logic into feature-level components/hooks rather than growing monoliths.
- Every visible control must perform a real action. No fake buttons, placeholder toggles, or decorative controls presented as interactive.
- Preserve keyboard access, semantic labels, focus behavior, readable contrast, and meaningful loading/error/empty states.
- Treat responsive behavior as required. Verify changed flows at representative mobile and desktop widths; avoid overlap, clipping, inaccessible fixed elements, or desktop-only assumptions.
- Do not hard-code visual values when an existing design token or shared primitive is appropriate.

## Validation

For meaningful web changes, run:

```bash
npm run lint
npm run typecheck
npm run test:web
npm run build:web
npm run check:files
```

Browser-verify the changed interaction when possible, including keyboard behavior and responsive layouts. If a change affects management API payloads or responses, preserve the existing contract or update the gateway/tests/OpenAPI deliberately in the same scoped change.
