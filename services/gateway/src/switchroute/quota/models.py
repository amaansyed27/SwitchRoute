from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

QuotaSource = Literal["exact", "observed", "estimated", "catalog", "unknown"]
QuotaMetricName = Literal["rpm", "tpm", "rpd", "tpd", "concurrency"]
QuotaCapacity = Literal["free", "account", "unknown"]

_SOURCE_RANK: dict[QuotaSource, int] = {
    "exact": 5,
    "observed": 4,
    "estimated": 3,
    "catalog": 2,
    "unknown": 1,
}


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


@dataclass(slots=True)
class QuotaMetric:
    limit: int | None = None
    remaining: int | None = None
    reset_at: str | None = None
    window_seconds: int | None = None
    source: QuotaSource = "unknown"
    capacity: QuotaCapacity = "unknown"
    observed_at: str = field(default_factory=utc_now_iso)
    confidence: float | None = None

    @property
    def known(self) -> bool:
        return self.limit is not None or self.remaining is not None

    @property
    def exhausted(self) -> bool:
        return self.remaining is not None and self.remaining <= 0

    @property
    def confirmed_free_available(self) -> bool:
        return (
            self.capacity == "free"
            and self.remaining is not None
            and self.remaining > 0
        )

    def ratio(self) -> float | None:
        if self.remaining is None or self.limit is None or self.limit <= 0:
            return None
        return max(0.0, min(1.0, self.remaining / self.limit))

    def reset_elapsed(self, now: datetime | None = None) -> bool:
        if not self.reset_at:
            return False
        try:
            parsed = datetime.fromisoformat(self.reset_at.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=UTC)
        except ValueError:
            return False
        return parsed.astimezone(UTC) <= (now or datetime.now(UTC))

    def clear_expired_remaining(self, now: datetime | None = None) -> None:
        if self.reset_elapsed(now):
            # A passed reset invalidates the old remaining count. Do not assume the
            # provider reset to the full limit; make it unknown until re-observed.
            self.remaining = None
            self.reset_at = None


@dataclass(slots=True)
class QuotaSnapshot:
    rpm: QuotaMetric = field(default_factory=QuotaMetric)
    tpm: QuotaMetric = field(default_factory=QuotaMetric)
    rpd: QuotaMetric = field(default_factory=QuotaMetric)
    tpd: QuotaMetric = field(default_factory=QuotaMetric)
    concurrency: QuotaMetric = field(default_factory=QuotaMetric)

    def metrics(self) -> tuple[QuotaMetric, ...]:
        return (self.rpm, self.tpm, self.rpd, self.tpd, self.concurrency)

    def clear_expired(self, now: datetime | None = None) -> None:
        for metric in self.metrics():
            metric.clear_expired_remaining(now)

    @property
    def exhausted(self) -> bool:
        return any(metric.exhausted for metric in self.metrics())

    @property
    def has_known_capacity(self) -> bool:
        return any(metric.known for metric in self.metrics())

    @property
    def has_confirmed_free_capacity(self) -> bool:
        return any(metric.confirmed_free_available for metric in self.metrics())

    def usable_ratio(self) -> float | None:
        ratios: list[float] = []
        for metric in self.metrics():
            ratio = metric.ratio()
            if ratio is not None:
                ratios.append(ratio)
        return min(ratios) if ratios else None

    def strongest_source(self) -> QuotaSource:
        sources: list[QuotaSource] = [
            metric.source for metric in self.metrics() if metric.known
        ]
        if not sources:
            return "unknown"
        return max(sources, key=_SOURCE_RANK.__getitem__)

    def confidence(self) -> float | None:
        values: list[float] = [
            metric.confidence
            for metric in self.metrics()
            if metric.confidence is not None
        ]
        return min(values) if values else None


@dataclass(slots=True)
class QuotaObservation:
    metric: QuotaMetricName
    limit: int | None = None
    remaining: int | None = None
    reset_at: str | None = None
    window_seconds: int | None = None
    source: QuotaSource = "observed"
    capacity: QuotaCapacity = "unknown"
    confidence: float = 0.9
