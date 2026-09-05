from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum


class CircuitState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


TRANSIENT_ERRORS = {"provider_rate_limited", "provider_timeout", "provider_unavailable"}


@dataclass(slots=True)
class HealthSnapshot:
    circuit_state: CircuitState = CircuitState.CLOSED
    consecutive_failures: int = 0
    opened_at: str | None = None
    retry_at: str | None = None
    last_error: str | None = None
    latency_ewma_ms: float | None = None
    latency_samples: int = 0
    ttft_ewma_ms: float | None = None
    ttft_samples: int = 0

    @property
    def latency_confidence(self) -> str:
        if self.latency_samples >= 8:
            return "high"
        if self.latency_samples >= 3:
            return "medium"
        return "low"

    def routable(self, now: datetime | None = None) -> bool:
        if self.circuit_state is not CircuitState.OPEN:
            return True
        if not self.retry_at:
            return False
        current = now or datetime.now(UTC)
        return current >= datetime.fromisoformat(self.retry_at)


class CircuitBreaker:
    def __init__(self, threshold: int = 3, cooldown_seconds: int = 30) -> None:
        self.threshold = threshold
        self.cooldown_seconds = cooldown_seconds

    def after_success(self, snapshot: HealthSnapshot) -> HealthSnapshot:
        snapshot.circuit_state = CircuitState.CLOSED
        snapshot.consecutive_failures = 0
        snapshot.opened_at = None
        snapshot.retry_at = None
        snapshot.last_error = None
        return snapshot

    def after_failure(self, snapshot: HealthSnapshot, error_category: str) -> HealthSnapshot:
        snapshot.last_error = error_category
        if error_category not in TRANSIENT_ERRORS:
            return snapshot
        snapshot.consecutive_failures += 1
        if snapshot.consecutive_failures >= self.threshold:
            now = datetime.now(UTC)
            snapshot.circuit_state = CircuitState.OPEN
            snapshot.opened_at = now.isoformat()
            snapshot.retry_at = (now + timedelta(seconds=self.cooldown_seconds)).isoformat()
        return snapshot

    def before_probe(self, snapshot: HealthSnapshot, now: datetime | None = None) -> HealthSnapshot:
        current = now or datetime.now(UTC)
        if (
            snapshot.circuit_state is CircuitState.OPEN
            and snapshot.retry_at
            and current >= datetime.fromisoformat(snapshot.retry_at)
        ):
            snapshot.circuit_state = CircuitState.HALF_OPEN
        return snapshot


def ewma(previous: float | None, value: float, alpha: float = 0.25) -> float:
    return value if previous is None else alpha * value + (1 - alpha) * previous
