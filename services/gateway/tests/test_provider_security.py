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
    endpoint = await provider_http.resolve_public_https_url("https://models.example/v1/")
    assert endpoint.url == "https://models.example/v1"
    assert endpoint.addresses == ("93.184.216.34",)


@pytest.mark.asyncio
async def test_custom_endpoint_request_uses_prevalidated_addresses(monkeypatch) -> None:
    monkeypatch.setattr(
        provider_http.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(2, 1, 6, "", ("93.184.216.34", 443))],
    )
    seen = []

    async def pinned(method, endpoint, **kwargs):
        seen.append(endpoint)
        return provider_http.PinnedResponse(200, None, {"data": []}, True)

    monkeypatch.setattr(provider_http, "_request_pinned", pinned)
    status, _ = await provider_http.safe_cloud_json("GET", "https://models.example/v1/models")
    assert status == 200
    assert seen[0].hostname == "models.example"
    assert seen[0].addresses == ("93.184.216.34",)


@pytest.mark.asyncio
async def test_custom_endpoint_validates_redirect_target(monkeypatch) -> None:
    monkeypatch.setattr(
        provider_http.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(2, 1, 6, "", ("93.184.216.34", 443))],
    )

    async def redirect(method, endpoint, **kwargs):
        return provider_http.PinnedResponse(302, "http://127.0.0.1/admin", None, False)

    monkeypatch.setattr(provider_http, "_request_pinned", redirect)
    with pytest.raises(SwitchRouteError):
        await provider_http.safe_cloud_json("GET", "https://models.example/v1/models")


@pytest.mark.asyncio
async def test_custom_endpoint_limits_redirects(monkeypatch) -> None:
    monkeypatch.setattr(
        provider_http.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(2, 1, 6, "", ("93.184.216.34", 443))],
    )
    calls = 0

    async def redirect(method, endpoint, **kwargs):
        nonlocal calls
        calls += 1
        return provider_http.PinnedResponse(302, f"https://models.example/{calls}", None, False)

    monkeypatch.setattr(provider_http, "_request_pinned", redirect)
    with pytest.raises(SwitchRouteError, match="redirect limit"):
        await provider_http.safe_cloud_json(
            "GET", "https://models.example/v1/models", max_redirects=1
        )
