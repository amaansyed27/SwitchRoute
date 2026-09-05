from typing import Any

import httpx


class SwitchRouteError(Exception):
    def __init__(self, message: str, *, code: str = "api_error", status_code: int | None = None, request_id: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.request_id = request_id


class AuthenticationError(SwitchRouteError):
    pass


class RateLimitError(SwitchRouteError):
    pass


class RequestTimeoutError(SwitchRouteError):
    pass


def error_from_response(response: httpx.Response) -> SwitchRouteError:
    message = "SwitchRoute request failed."
    code = "api_error"
    try:
        payload: Any = response.json()
        error = payload.get("error", {}) if isinstance(payload, dict) else {}
        if isinstance(error, dict):
            if isinstance(error.get("message"), str):
                message = error["message"]
            candidate = error.get("code") or error.get("type")
            if isinstance(candidate, str):
                code = candidate
    except Exception:
        # Never include an arbitrary raw response body in an exception.
        pass
    request_id = response.headers.get("x-switchroute-request-id") or response.headers.get("x-request-id")
    kwargs = {"code": code, "status_code": response.status_code, "request_id": request_id}
    if response.status_code in (401, 403):
        return AuthenticationError(message, **kwargs)
    if response.status_code == 429:
        return RateLimitError(message, **kwargs)
    if response.status_code in (408, 504):
        return RequestTimeoutError(message, **kwargs)
    return SwitchRouteError(message, **kwargs)
