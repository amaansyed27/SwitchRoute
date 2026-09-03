import pytest

from switchroute.errors import SwitchRouteError
from switchroute.providers import http as provider_http


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "url",
    [
        "http://public.example/v1",
        "https://localhost/v1",
        "https://127.0.0.1/v1",
        "https://10.0.0.1/v1",
        "https://169.254.169.254/latest/meta-data",
        "https://metadata.google.internal/computeMetadata/v1",
        "https://[::1]/v1",
    ],
)
async def test_custom_endpoint_rejects_non_public_destinations(monkeypatch, url: str) -> None:
    monkeypatch.setattr(
        provider_http.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(2, 1, 6, "", ("93.184.216.34", 443))],
    )
    with pytest.raises(SwitchRouteError):
        await provider_http.validate_public_https_url(url)


@pytest.mark.asyncio
async def test_custom_endpoint_rejects_private_dns_resolution(monkeypatch) -> None:
    monkeypatch.setattr(
        provider_http.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(2, 1, 6, "", ("192.168.1.20", 443))],
    )
    with pytest.raises(SwitchRouteError, match="public internet"):
        await provider_http.validate_public_https_url("https://models.example/v1")


@pytest.mark.asyncio
async def test_custom_endpoint_accepts_public_https_resolution(monkeypatch) -> None:
    monkeypatch.setattr(
        provider_http.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(2, 1, 6, "", ("93.184.216.34", 443))],
    )
    assert (
        await provider_http.validate_public_https_url("https://models.example/v1/")
        == "https://models.example/v1"
    )


class _Response:
    def __init__(self, status: int, location: str | None = None, data=None):
        self.status_code = status
        self.headers = {"location": location} if location else {}
        self._data = data or {}

    def json(self):
        return self._data


class _Client:
    def __init__(self, responses):
        self.responses = responses

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def request(self, *args, **kwargs):
        return self.responses.pop(0)


@pytest.mark.asyncio
async def test_custom_endpoint_validates_redirect_target(monkeypatch) -> None:
    monkeypatch.setattr(
        provider_http.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(2, 1, 6, "", ("93.184.216.34", 443))],
    )
    responses = [_Response(302, "http://127.0.0.1/admin")]
    monkeypatch.setattr(
        provider_http.httpx, "AsyncClient", lambda **kwargs: _Client(responses)
    )
    with pytest.raises(SwitchRouteError):
        await provider_http.safe_cloud_json("GET", "https://models.example/v1/models")


@pytest.mark.asyncio
async def test_custom_endpoint_limits_redirects(monkeypatch) -> None:
    monkeypatch.setattr(
        provider_http.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(2, 1, 6, "", ("93.184.216.34", 443))],
    )
    responses = [
        _Response(302, "https://models.example/next"),
        _Response(302, "https://models.example/final"),
    ]
    monkeypatch.setattr(
        provider_http.httpx, "AsyncClient", lambda **kwargs: _Client(responses)
    )
    with pytest.raises(SwitchRouteError, match="redirect limit"):
        await provider_http.safe_cloud_json(
            "GET", "https://models.example/v1/models", max_redirects=1
        )
