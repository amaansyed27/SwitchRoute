from dataclasses import dataclass


@dataclass(slots=True)
class SwitchRouteError(Exception):
    code: str
    message: str
    status_code: int = 400


AUTHENTICATION_ERROR = "authentication_error"
ROUTE_NOT_FOUND = "route_not_found"
ROUTE_UNAVAILABLE = "route_unavailable"
NO_ELIGIBLE_TARGET = "no_eligible_target"
PROVIDER_AUTH_ERROR = "provider_auth_error"
PROVIDER_RATE_LIMITED = "provider_rate_limited"
PROVIDER_TIMEOUT = "provider_timeout"
PROVIDER_UNAVAILABLE = "provider_unavailable"
QUOTA_EXHAUSTED = "quota_exhausted"
BUDGET_EXCEEDED = "budget_exceeded"
UNSUPPORTED_CAPABILITY = "unsupported_capability"
MALFORMED_UPSTREAM_RESPONSE = "malformed_upstream_response"
INVALID_REQUEST = "invalid_request"
CONFIGURATION_ERROR = "configuration_error"


def classify_provider_error(exc: Exception) -> SwitchRouteError:
    status = getattr(exc, "status_code", None)
    name = exc.__class__.__name__.lower()
    if status in (401, 403, 498):
        return SwitchRouteError(PROVIDER_AUTH_ERROR, "Upstream provider rejected its credential.", 502)
    if status == 429:
        return SwitchRouteError(PROVIDER_RATE_LIMITED, "Upstream provider is rate limited.", 429)
    if "timeout" in name or status == 408:
        return SwitchRouteError(PROVIDER_TIMEOUT, "Upstream provider timed out.", 504)
    return SwitchRouteError(PROVIDER_UNAVAILABLE, "Upstream provider is unavailable.", 502)
