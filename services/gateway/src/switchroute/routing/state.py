import asyncio
import copy
import time
from dataclasses import dataclass, field
from typing import Protocol
from uuid import uuid4

from switchroute.domain import Candidate
from switchroute.health.circuit_breaker import CircuitBreaker, CircuitState, HealthSnapshot, ewma
from switchroute.quota.models import QuotaMetric, QuotaObservation, QuotaSnapshot


@dataclass(slots=True)
class TargetState:
    quota: QuotaSnapshot = field(default_factory=QuotaSnapshot)
    health: HealthSnapshot = field(default_factory=HealthSnapshot)


@dataclass(slots=True)
class CapacityReservation:
    id: str
    target_key: str
    route_key: str
    expected_tokens: int
    expected_cost_microusd: int | None
    paid: bool
    expires_at: float
    tracked: bool = True


def target_key(candidate: Candidate) -> str:
    return f"{candidate.provider_connection_id}:{candidate.model_id}"


class RoutingState(Protocol):
    available: bool

    async def close(self) -> None: ...
    async def snapshot(self, key: str) -> TargetState: ...
    async def reserve(
        self,
        *,
        key: str,
        route_key: str,
        expected_tokens: int,
        expected_cost_microusd: int | None,
        paid: bool,
        daily_paid_cap_microusd: int | None,
        durable_paid_spend_microusd: int,
        ttl_seconds: int = 120,
    ) -> CapacityReservation | None: ...
    async def reconcile(
        self,
        reservation: CapacityReservation,
        *,
        attempted: bool,
        actual_tokens: int | None,
        actual_cost_microusd: int | None,
    ) -> None: ...
    async def observe_quota(self, key: str, observations: list[QuotaObservation]) -> None: ...
    async def observe_success(self, key: str, latency_ms: int, ttft_ms: int | None = None) -> None: ...
    async def observe_failure(self, key: str, error_category: str) -> None: ...


@dataclass(slots=True)
class _ReservationState:
    reservation: CapacityReservation


class MemoryRoutingState:
    available = True

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._targets: dict[str, TargetState] = {}
        self._reservations: dict[str, _ReservationState] = {}
        self._paid_spend: dict[str, int] = {}
        self._breaker = CircuitBreaker()

    async def close(self) -> None:
        return None

    async def snapshot(self, key: str) -> TargetState:
        async with self._lock:
            state = self._targets.setdefault(key, TargetState())
            self._breaker.before_probe(state.health)
            return copy.deepcopy(state)

    def _cleanup(self, now: float) -> None:
        expired = [
            rid
            for rid, item in self._reservations.items()
            if item.reservation.expires_at <= now
        ]
        for rid in expired:
            self._reservations.pop(rid, None)

    def _reserved_for(self, key: str) -> tuple[int, int]:
        items = [
            item.reservation
            for item in self._reservations.values()
            if item.reservation.target_key == key
        ]
        return len(items), sum(item.expected_tokens for item in items)

    def _reserved_budget(self, route_key: str) -> int:
        return sum(
            item.reservation.expected_cost_microusd or 0
            for item in self._reservations.values()
            if item.reservation.route_key == route_key and item.reservation.paid
        )

    async def reserve(
        self,
        *,
        key: str,
        route_key: str,
        expected_tokens: int,
        expected_cost_microusd: int | None,
        paid: bool,
        daily_paid_cap_microusd: int | None,
        durable_paid_spend_microusd: int,
        ttl_seconds: int = 120,
    ) -> CapacityReservation | None:
        async with self._lock:
            now = time.time()
            self._cleanup(now)
            state = self._targets.setdefault(key, TargetState())
            self._breaker.before_probe(state.health)
            if state.health.circuit_state is CircuitState.OPEN:
                return None
            reserved_requests, reserved_tokens = self._reserved_for(key)
            if state.health.circuit_state is CircuitState.HALF_OPEN and reserved_requests:
                return None
            for metric in (state.quota.rpm, state.quota.rpd):
                if metric.remaining is not None and metric.remaining - reserved_requests < 1:
                    return None
            for metric in (state.quota.tpm, state.quota.tpd):
                if metric.remaining is not None and metric.remaining - reserved_tokens < expected_tokens:
                    return None
            concurrency = state.quota.concurrency
            if concurrency.remaining is not None and concurrency.remaining - reserved_requests < 1:
                return None
            if paid and daily_paid_cap_microusd is not None:
                if expected_cost_microusd is None:
                    return None
                spend = max(
                    durable_paid_spend_microusd, self._paid_spend.get(route_key, 0)
                )
                if (
                    spend + self._reserved_budget(route_key) + expected_cost_microusd
                    > daily_paid_cap_microusd
                ):
                    return None
            reservation = CapacityReservation(
                id=uuid4().hex,
                target_key=key,
                route_key=route_key,
                expected_tokens=expected_tokens,
                expected_cost_microusd=expected_cost_microusd,
                paid=paid,
                expires_at=now + ttl_seconds,
            )
            self._reservations[reservation.id] = _ReservationState(reservation)
            return reservation

    async def reconcile(
        self,
        reservation: CapacityReservation,
        *,
        attempted: bool,
        actual_tokens: int | None,
        actual_cost_microusd: int | None,
    ) -> None:
        async with self._lock:
            self._reservations.pop(reservation.id, None)
            if not attempted:
                return
            state = self._targets.setdefault(reservation.target_key, TargetState())
            used_tokens = (
                actual_tokens
                if actual_tokens is not None
                else reservation.expected_tokens
            )
            for metric in (state.quota.rpm, state.quota.rpd, state.quota.concurrency):
                if metric.remaining is not None:
                    metric.remaining = max(0, metric.remaining - 1)
            for metric in (state.quota.tpm, state.quota.tpd):
                if metric.remaining is not None:
                    metric.remaining = max(0, metric.remaining - used_tokens)
            if reservation.paid:
                cost = actual_cost_microusd
                if cost is None:
                    cost = reservation.expected_cost_microusd
                if cost is not None:
                    self._paid_spend[reservation.route_key] = (
                        self._paid_spend.get(reservation.route_key, 0) + cost
                    )

    async def observe_quota(
        self, key: str, observations: list[QuotaObservation]
    ) -> None:
        async with self._lock:
            state = self._targets.setdefault(key, TargetState())
            for observation in observations:
                setattr(
                    state.quota,
                    observation.metric,
                    QuotaMetric(
                        limit=observation.limit,
                        remaining=observation.remaining,
                        reset_at=observation.reset_at,
                        window_seconds=observation.window_seconds,
                        source=observation.source,
                        capacity=observation.capacity,
                        confidence=observation.confidence,
                    ),
                )

    async def observe_success(
        self, key: str, latency_ms: int, ttft_ms: int | None = None
    ) -> None:
        async with self._lock:
            state = self._targets.setdefault(key, TargetState())
            self._breaker.after_success(state.health)
            state.health.latency_ewma_ms = ewma(
                state.health.latency_ewma_ms, float(latency_ms)
            )
            state.health.latency_samples += 1
            if ttft_ms is not None:
                state.health.ttft_ewma_ms = ewma(
                    state.health.ttft_ewma_ms, float(ttft_ms)
                )
                state.health.ttft_samples += 1

    async def observe_failure(self, key: str, error_category: str) -> None:
        async with self._lock:
            state = self._targets.setdefault(key, TargetState())
            self._breaker.after_failure(state.health, error_category)


class UnavailableRoutingState:
    available = False

    async def close(self) -> None:
        return None

    async def snapshot(self, key: str) -> TargetState:
        return TargetState()

    async def reserve(self, **kwargs) -> CapacityReservation | None:  # type: ignore[no-untyped-def]
        return CapacityReservation(
            id=uuid4().hex,
            target_key=str(kwargs["key"]),
            route_key=str(kwargs["route_key"]),
            expected_tokens=int(kwargs["expected_tokens"]),
            expected_cost_microusd=kwargs.get("expected_cost_microusd"),
            paid=bool(kwargs.get("paid")),
            expires_at=time.time() + int(kwargs.get("ttl_seconds", 120)),
            tracked=False,
        )

    async def reconcile(
        self, reservation: CapacityReservation, **kwargs
    ) -> None:  # type: ignore[no-untyped-def]
        return None

    async def observe_quota(
        self, key: str, observations: list[QuotaObservation]
    ) -> None:
        return None

    async def observe_success(
        self, key: str, latency_ms: int, ttft_ms: int | None = None
    ) -> None:
        return None

    async def observe_failure(self, key: str, error_category: str) -> None:
        return None
