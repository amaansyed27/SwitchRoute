# Load and reliability tests

`gateway.js` is a k6 suite for the public gateway. It contains independent completion/model scenarios plus an exported streaming scenario.

Use only a deterministic test provider/mock or a Route whose upstream cost is explicitly acceptable. CI does not call paid model APIs.

Example:

```powershell
$env:SWITCHROUTE_BASE_URL="http://127.0.0.1:8000"
$env:SWITCHROUTE_API_KEY="sr_test_..."
$env:VUS="10"
$env:DURATION="30s"
k6 run tests/load/gateway.js
```

Streaming-only run:

```powershell
k6 run -e SWITCHROUTE_BASE_URL=http://127.0.0.1:8000 -e SWITCHROUTE_API_KEY=sr_test_... --exec stream tests/load/gateway.js
```

When reporting results, record CPU/RAM, operating system, gateway process count, Redis topology, Postgres/Supabase topology, test provider behavior, k6 VUs/rate/duration, and exact commit SHA. Do not compare or publish throughput numbers without that context.

The checked-in thresholds are release smoke thresholds, not performance claims.
