# Contributing

SwitchRoute uses small, responsibility-focused modules and conventional commits.

## Before opening a change

- Work on a focused branch.
- Do not commit secrets, provider keys, Supabase secret keys, captured prompts, or model output.
- Prefer domain modules over generic catch-all `utils` or `services` files.
- Keep TS/TSX and Python source files near 250 lines where practical; reconsider structure above 300 lines.
- Add tests for behavior and authorization changes.
- Update architecture/security docs when boundaries change.

## Checks

Run web formatting/lint/typecheck/tests/build, gateway Ruff/Pyright/Pytest, Supabase tests, OpenAPI drift validation, and the file-size check before requesting review.

See `docs/development/local-windows.md` for exact commands.
