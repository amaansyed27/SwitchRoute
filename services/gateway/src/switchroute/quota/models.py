from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

QuotaSource = Literal["exact", "observed", "estimated", "catalog", "unknown"]
QuotaMetricName = Literal["rpm", "tpm", "rpd", "tpd", "concurrency"]


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


@dataclass(slots=True)
class QuotaMetric:
    limit: int | None = None
    remaining: int | None = None
    reset_at: str | None = None
    window_seconds: int | None = None
    source: QuotaSource = "unknown"
    observed_at: str = field(default_factory=utc_now_iso)
    confidence: float | None = None

    @property
    def known(self) -> bool:
        return self.limit is not None or self.remaining is not None

    @property
    def exhausted(self) -> bool:
        return self.remaining is not None and self.remaining <= 0

    def ratio(self) -> float | None:
        if self.remaining is None or self.limit is None or self.limit <= 0:
            return None
        return max(0.0, min(1.0, self.remaining / self.limit))


@dataclass(slots=True)
class QuotaSnapshot:
    rpm: QuotaMetric = field(default_factory=QuotaMetric)
    tpm: QuotaMetric = field(default_factory=QuotaMetric)
    rpd: QuotaMetric = field(default_factory=QuotaMetric)
    tpd: QuotaMetric = field(default_factory=QuotaMetric)
    concurrency: QuotaMetric = field(default_factory=QuotaMetric)

    def metrics(self) -> tuple[QuotaMetric, ...]:
        return (self.rpm, self.tpm, self.rpd, self.tpd, self.concurrency)

    @property
    def exhausted(self) -> bool:
        return any(metric.exhausted for metric in self.metrics())

    @property
    def has_known_capacity(self) -> bool:
        return any(metric.known for metric in self.metrics())

    def usable_ratio(self) -> float | None:
        ratios = [metric.ratio() for metric in self.metrics() if metric.ratio() is not None]
        return min(ratios) if ratios else None

    def strongest_source(self) -> QuotaSource:
        rank = {"exact": 5, "observed": 4, "estimated": 3, "catalog": 2, "unknown": 1}
        sources = [metric.source for metric in self.metrics() if metric.known]
        return max(sources, key=lambda source: rank[source], default="unknown")

    def confidence(self) -> float | None:
        values = [metric.confidence for metric in self.metrics() if metric.confidence is not None]
        return min(values) if values else None


@dataclass(slots=True)
class QuotaObservation:
    metric: QuotaMetricName
    limit: int | None = None
    remaining: int | None = None
    reset_at: str | None = None
    window_seconds: int | None = None
    source: QuotaSource = "observed"
    confidence: float = 0.9
