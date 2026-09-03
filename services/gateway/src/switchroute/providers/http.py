import asyncio
import ipaddress
import socket
from typing import Any
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

from switchroute.errors import INVALID_REQUEST, SwitchRouteError, classify_provider_error


class ProviderResponseError(RuntimeError):
    def __init__(self, status_code: int) -> None:
        super().__init__("provider request failed")
        self.status_code = status_code


async def checked_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    params: dict[str, str] | None = None,
) -> Any:
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            response = await client.get(url, headers=headers, params=params)
        return _response_json(response)
    except SwitchRouteError:
        raise
    except Exception as exc:
        raise classify_provider_error(exc) from None


def _response_json(response: httpx.Response) -> Any:
    if response.status_code in (401, 403, 498):
        raise SwitchRouteError("provider_auth_error", "Provider rejected this credential.", 400)
    if response.status_code >= 400 or 300 <= response.status_code < 400:
        raise classify_provider_error(ProviderResponseError(response.status_code))
    try:
        return response.json()
    except Exception as exc:
        raise SwitchRouteError(
            "provider_unavailable", "Provider returned an invalid JSON response.", 502
        ) from exc


_BLOCKED_HOSTS = {
    "localhost",
    "metadata.google.internal",
    "metadata.aws.internal",
    "instance-data",
}
_BLOCKED_IPS = {
    ipaddress.ip_address("169.254.169.254"),
    ipaddress.ip_address("100.100.100.200"),
}


def _validate_ip(value: str) -> None:
    try:
        address = ipaddress.ip_address(value.split("%", 1)[0])
    except ValueError as exc:
        raise SwitchRouteError(INVALID_REQUEST, "Custom endpoint resolved to an invalid IP.", 400) from exc
    if address in _BLOCKED_IPS or not address.is_global:
        raise SwitchRouteError(
            INVALID_REQUEST,
            "Custom cloud endpoints must resolve only to public internet addresses.",
            400,
        )


async def validate_public_https_url(url: str) -> str:
    try:
        parsed = urlsplit(url.strip())
        port = parsed.port or 443
    except ValueError as exc:
        raise SwitchRouteError(INVALID_REQUEST, "Custom endpoint URL is invalid.", 400) from exc
    if parsed.scheme.lower() != "https":
        raise SwitchRouteError(INVALID_REQUEST, "Custom cloud endpoints must use HTTPS.", 400)
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise SwitchRouteError(
            INVALID_REQUEST,
            "Custom endpoint must be an HTTPS base URL without credentials, query, or fragment.",
            400,
        )
    hostname = parsed.hostname.rstrip(".").lower()
    if hostname in _BLOCKED_HOSTS or hostname.endswith(".localhost"):
        raise SwitchRouteError(INVALID_REQUEST, "Local or metadata endpoints are not allowed.", 400)
    try:
        literal = ipaddress.ip_address(hostname.split("%", 1)[0])
    except ValueError:
        literal = None
    if literal is not None:
        _validate_ip(str(literal))
    else:
        try:
            results = await asyncio.to_thread(
                socket.getaddrinfo, hostname, port, type=socket.SOCK_STREAM
            )
        except OSError as exc:
            raise SwitchRouteError(INVALID_REQUEST, "Custom endpoint DNS lookup failed.", 400) from exc
        addresses = {str(item[4][0]) for item in results}
        if not addresses:
            raise SwitchRouteError(INVALID_REQUEST, "Custom endpoint DNS lookup returned no address.", 400)
        for address in addresses:
            _validate_ip(address)
    normalized_netloc = hostname if parsed.port is None else f"{hostname}:{parsed.port}"
    path = parsed.path.rstrip("/")
    return urlunsplit(("https", normalized_netloc, path, "", ""))


async def safe_cloud_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    json: dict[str, Any] | None = None,
    allowed_statuses: set[int] | None = None,
    max_redirects: int = 3,
) -> tuple[int, Any | None]:
    current = url
    allowed = allowed_statuses or set()
    for redirect_count in range(max_redirects + 1):
        current = await validate_public_https_url(current)
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
                response = await client.request(method, current, headers=headers, json=json)
        except Exception as exc:
            raise classify_provider_error(exc) from None
        if 300 <= response.status_code < 400:
            location = response.headers.get("location")
            if not location or redirect_count >= max_redirects:
                raise SwitchRouteError(
                    "provider_unavailable", "Custom endpoint exceeded the redirect limit.", 502
                )
            current = urljoin(current, location)
            continue
        if response.status_code in allowed:
            return response.status_code, None
        if response.status_code in (401, 403, 498):
            raise SwitchRouteError("provider_auth_error", "Provider rejected this credential.", 400)
        if response.status_code >= 400:
            raise classify_provider_error(ProviderResponseError(response.status_code))
        try:
            return response.status_code, response.json()
        except Exception as exc:
            raise SwitchRouteError(
                "provider_unavailable", "Custom endpoint returned invalid JSON.", 502
            ) from exc
    raise SwitchRouteError("provider_unavailable", "Custom endpoint redirect failed.", 502)
