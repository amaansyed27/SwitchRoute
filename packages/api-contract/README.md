# API contract

`openapi.json` is generated from the FastAPI application and must not be hand-edited.

```bash
python scripts/export_openapi.py
python scripts/export_openapi.py --check
```

CI rejects contract drift after generation.
