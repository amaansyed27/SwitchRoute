from switchroute.errors import (
    PROVIDER_AUTH_ERROR,
    PROVIDER_RATE_LIMITED,
    PROVIDER_TIMEOUT,
    PROVIDER_UNAVAILABLE,
    classify_provider_error,
)


class StatusError(RuntimeError):
    def __init__(self, status_code: int) -> None:
        super().__init__("upstream error")
        self.status_code = status_code


class ExampleTimeoutError(RuntimeError):
    pass


def test_provider_auth_errors_are_normalized() -> None:
    assert classify_provider_error(StatusError(401)).code == PROVIDER_AUTH_ERROR


def test_provider_rate_limits_are_normalized() -> None:
    assert classify_provider_error(StatusError(429)).code == PROVIDER_RATE_LIMITED


def test_provider_timeouts_are_normalized() -> None:
    assert classify_provider_error(ExampleTimeoutError()).code == PROVIDER_TIMEOUT


def test_unknown_provider_failures_are_sanitized() -> None:
    error = classify_provider_error(RuntimeError("raw upstream body containing prompt"))
    assert error.code == PROVIDER_UNAVAILABLE
    assert "prompt" not in error.message.lower()
