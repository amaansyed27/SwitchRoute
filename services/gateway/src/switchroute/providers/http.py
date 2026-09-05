import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlsplit, urlunsplit

import aiohttp
import httpx
from aiohttp.abc import AbstractResolver, ResolveResult

from switchroute.errors import (
    INVALID_REQUEST,
    MALFORMED_UPSTREAM_RESPONSE,
    SwitchRouteError,
    classify_provider_error,
)


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
            MALFORMED_UPSTREAM_RESPONSE,
            "Provider returned an invalid JSON response.",
            502,
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


@dataclass(frozen=True, slots=True)
class ResolvedPublicEndpoint:
    url: str
    hostname: str
    port: int
    addresses: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class PinnedResponse:
    status: int
    location: str | None
    data: Any | None
    json_valid: bool


class _StaticResolver(AbstractResolver):
    def __init__(self, endpoint: ResolvedPublicEndpoint) -> None:
        self.endpoint = endpoint

    async def resolve(
        self,
        host: str,
        port: int = 0,
        family: socket.AddressFamily = socket.AF_INET,
    ) -> list[ResolveResult]:
        if host.rstrip(".").lower() != self.endpoint.hostname:
            raise OSError("resolver host mismatch")
        results: list[ResolveResult] = []
        for address in self.endpoint.addresses:
            parsed = ipaddress.ip_address(address.split("%", 1)[0])
            result_family = socket.AF_INET6 if parsed.version == 6 else socket.AF_INET
            if family not in (socket.AF_UNSPEC, result_family):
                continue
            results.append(
                ResolveResult(
                    hostname=host,
                    host=address,
                    port=port or self.endpoint.port,
                    family=result_family,
                    proto=0,
                    flags=0,
                )
            )
        if not results:
            raise OSError("no pinned address for requested family")
        return results

    async def close(self) -> None:
        return None


def _validate_ip(value: str) -> None:
    try:
        address = ipaddress.ip_address(value.split("%", 1)[0])
    except ValueError as exc:
        raise SwitchRouteError(
            INVALID_REQUEST, "Custom endpoint resolved to an invalid IP.", 400
        ) from exc
    if address in _BLOCKED_IPS or not address.is_global:
        raise SwitchRouteError(
            INVALID_REQUEST,
            "Custom cloud endpoints must resolve only to public internet addresses.",
            400,
        )


async def resolve_public_https_url(url: str) -> ResolvedPublicEndpoint:
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
    addresses: set[str]
    try:
        literal = ipaddress.ip_address(hostname.split("%", 1)[0])
    except ValueError:
        literal = None
    if literal is not None:
        addresses = {str(literal)}
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
    normalized = urlunsplit(("https", normalized_netloc, path, "", ""))
    return ResolvedPublicEndpoint(normalized, hostname, port, tuple(sorted(addresses)))


async def validate_public_https_url(url: str) -> str:
    return (await resolve_public_https_url(url)).url


async def _request_pinned(
    method: str,
    endpoint: ResolvedPublicEndpoint,
    *,
    headers: dict[str, str] | None = None,
    json: dict[str, Any] | None = None,
) -> PinnedResponse:
    resolver = _StaticResolver(endpoint)
    connector = aiohttp.TCPConnector(resolver=resolver, use_dns_cache=False, ttl_dns_cache=0)
    timeout = aiohttp.ClientTimeout(total=10)
    try:
        async with aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            trust_env=False,
        ) as client:
            async with client.request(
                method,
                endpoint.url,
                headers=headers,
                json=json,
                allow_redirects=False,
            ) as response:
                location = response.headers.get("location")
                try:
                    data = await response.json(content_type=None)
                    valid = True
                except Exception:
                    data = None
                    valid = False
                return PinnedResponse(response.status, location, data, valid)
    except SwitchRouteError:
        raise
    except Exception as exc:
        raise classify_provider_error(exc) from None


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
        endpoint = await resolve_public_https_url(current)
        response = await _request_pinned(method, endpoint, headers=headers, json=json)
        if 300 <= response.status < 400:
            if not response.location or redirect_count >= max_redirects:
                raise SwitchRouteError(
                    "provider_unavailable", "Custom endpoint exceeded the redirect limit.", 502
                )
            current = urljoin(endpoint.url, response.location)
            continue
        if response.status in allowed:
            return response.status, None
        if response.status in (401, 403, 498):
            raise SwitchRouteError("provider_auth_error", "Provider rejected this credential.", 400)
        if response.status >= 400:
            raise classify_provider_error(ProviderResponseError(response.status))
        if not response.json_valid:
            raise SwitchRouteError(
                MALFORMED_UPSTREAM_RESPONSE,
                "Custom endpoint returned invalid JSON.",
                502,
            )
        return response.status, response.data
    raise SwitchRouteError("provider_unavailable", "Custom endpoint redirect failed.", 502)


async def safe_cloud_stream(
    url: str,
    *,
    headers: dict[str, str],
    json: dict[str, Any],
    max_redirects: int = 3,
):
    current = url
    for redirect_count in range(max_redirects + 1):
        endpoint = await resolve_public_https_url(current)
        resolver = _StaticResolver(endpoint)
        connector = aiohttp.TCPConnector(resolver=resolver, use_dns_cache=False, ttl_dns_cache=0)
        timeout = aiohttp.ClientTimeout(total=60)
        client = aiohttp.ClientSession(connector=connector, timeout=timeout, trust_env=False)
        try:
            response = await client.post(
                endpoint.url,
                headers=headers,
                json=json,
                allow_redirects=False,
            )
            if 300 <= response.status < 400:
                location = response.headers.get("location")
                response.release()
                await client.close()
                if not location or redirect_count >= max_redirects:
                    raise SwitchRouteError(
                        "provider_unavailable", "Custom endpoint exceeded the redirect limit.", 502
                    )
                current = urljoin(endpoint.url, location)
                continue
            if response.status in (401, 403, 498):
                response.release()
                raise SwitchRouteError("provider_auth_error", "Provider rejected this credential.", 400)
            if response.status >= 400:
                status = response.status
                response.release()
                raise classify_provider_error(ProviderResponseError(status))
            data_lines: list[str] = []
            async for raw_line in response.content:
                for line in (
                    raw_line.decode("utf-8", errors="strict").replace("\r\n", "\n").split("\n")
                ):
                    if not line:
                        if data_lines:
                            data = "\n".join(data_lines)
                            data_lines.clear()
                            if data.strip() == "[DONE]":
                                return
                            try:
                                import json as json_module

                                value = json_module.loads(data)
                            except Exception as exc:
                                raise SwitchRouteError(
                                    MALFORMED_UPSTREAM_RESPONSE,
                                    "Custom endpoint returned a malformed stream.",
                                    502,
                                ) from exc
                            if isinstance(value, dict):
                                yield value
                        continue
                    if line.startswith("data:"):
                        data_lines.append(line[5:].lstrip())
            if data_lines:
                raise SwitchRouteError(
                    MALFORMED_UPSTREAM_RESPONSE,
                    "Custom endpoint stream ended mid-event.",
                    502,
                )
            return
        except SwitchRouteError:
            raise
        except Exception as exc:
            raise classify_provider_error(exc) from None
        finally:
            if not client.closed:
                await client.close()
    raise SwitchRouteError("provider_unavailable", "Custom endpoint redirect failed.", 502)
