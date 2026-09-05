# switchroute

Thin typed Python client for SwitchRoute. The standard OpenAI Python SDK remains fully supported; use this package when you want SwitchRoute-native errors and a small dependency surface.

```bash
pip install switchroute
```

```python
from switchroute import SwitchRoute

client = SwitchRoute(api_key="sr_live_...")
response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello"}],
)
```

Streaming:

```python
stream = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True,
)
for chunk in stream:
    print(chunk)
```

Async usage is available through `AsyncSwitchRoute`.

No open-source software license has been selected for SwitchRoute. See the repository for the current distribution terms/status.
