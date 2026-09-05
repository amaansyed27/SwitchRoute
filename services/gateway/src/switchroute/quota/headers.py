import re
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta

from switchroute.quota.models import QuotaObservation

_DURATION = re.compile(r"(?:(?P<h>\d+)h)?(?:(?P<m>\d+)m)?(?:(?P<s>\d+(?:\.\d+)?)s)?$")


def _int(headers: Mapping[str, str], key: str) -> int | None:
    value = headers.get(key)
    if value is None:
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def _reset(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    try:
        numeric = float(value)
        if numeric > 10_000_000_000:
            numeric /= 1000
        if numeric > 1_000_000_000:
            return datetime.fromtimestamp(numeric, UTC).isoformat()
    except ValueError:
        pass
    match = _DURATION.fullmatch(value.lower())
    if match:
        seconds = (
            int(match.group("h") or 0) * 3600
            + int(match.group("m") or 0) * 60
            + float(match.group("s") or 0)
        )
        return (datetime.now(UTC) + timedelta(seconds=seconds)).isoformat()
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.astimezone(UTC).isoformat()
    except ValueError:
        return None


def _triple(
    headers: Mapping[str, str],
    metric: str,
    limit_key: str,
    remaining_key: str,
    reset_key: str,
) -> QuotaObservation | None:
    limit = _int(headers, limit_key)
    remaining = _int(headers, remaining_key)
    reset = _reset(headers.get(reset_key))
    if limit is None and remaining is None and reset is None:
        return None
    return QuotaObservation(metric=metric, limit=limit, remaining=remaining, reset_at=reset)  # type: ignore[arg-type]


def parse_rate_limit_headers(provider_kind: str, raw_headers: Mapping[str, str]) -> list[QuotaObservation]:
    """Parse only whitelisted routing headers. Raw headers are never persisted."""
    headers = {str(key).lower(): str(value) for key, value in raw_headers.items()}
    observations: list[QuotaObservation] = []

    if provider_kind == "anthropic":
        mappings = (
            ("rpm", "anthropic-ratelimit-requests-limit", "anthropic-ratelimit-requests-remaining", "anthropic-ratelimit-requests-reset"),
            ("tpm", "anthropic-ratelimit-tokens-limit", "anthropic-ratelimit-tokens-remaining", "anthropic-ratelimit-tokens-reset"),
        )
    else:
        mappings = (
            ("rpm", "x-ratelimit-limit-requests", "x-ratelimit-remaining-requests", "x-ratelimit-reset-requests"),
            ("tpm", "x-ratelimit-limit-tokens", "x-ratelimit-remaining-tokens", "x-ratelimit-reset-tokens"),
            ("rpd", "x-ratelimit-limit-requests-day", "x-ratelimit-remaining-requests-day", "x-ratelimit-reset-requests-day"),
            ("tpd", "x-ratelimit-limit-tokens-day", "x-ratelimit-remaining-tokens-day", "x-ratelimit-reset-tokens-day"),
        )

    for mapping in mappings:
        observation = _triple(headers, *mapping)
        if observation:
            observations.append(observation)
    return observations


def safe_headers(value: object) -> dict[str, str]:
    """Extract an upstream header mapping without returning arbitrary provider metadata."""
    candidates: list[object] = []
    hidden = getattr(value, "_hidden_params", None)
    if hidden is not None:
        candidates.append(hidden)
    response = getattr(value, "response", None)
    if response is not None:
        candidates.append(getattr(response, "headers", None))
    if isinstance(value, dict):
        candidates.append(value.get("_hidden_params"))
    for candidate in candidates:
        if isinstance(candidate, Mapping):
            nested = candidate.get("additional_headers") or candidate.get("headers")
            mapping = nested if isinstance(nested, Mapping) else candidate
            return {str(key): str(val) for key, val in mapping.items()}
    return {}
