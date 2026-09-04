import json
import time
from dataclasses import asdict
from datetime import UTC, datetime

from redis.asyncio import Redis
from redis.exceptions import RedisError

from switchroute.health.circuit_breaker import CircuitBreaker, CircuitState, HealthSnapshot, ewma
from switchroute.quota.models import QuotaMetric, QuotaObservation, QuotaSnapshot
from switchroute.routing.state import CapacityReservation, RoutingState, TargetState, UnavailableRoutingState


class RedisRoutingState:
    available = True

    def __init__(self, client: Redis) -> None:
        self._redis = client
        self._breaker = CircuitBreaker()

    async def close(self) -> None:
        await self._redis.aclose()

    def _state_key(self, key: str) -> str:
        return f"switchroute:state:{key}"

    def _target_res(self, key: str) -> str:
        return f"switchroute:reservations:{key}"

    def _target_tokens(self, key: str) -> str:
        return f"switchroute:reservation_tokens:{key}"

    def _route_res(self, route_key: str) -> str:
        return f"switchroute:budget_reservations:{route_key}:{datetime.now(UTC).date()}"

    def _route_costs(self, route_key: str) -> str:
        return f"switchroute:budget_costs:{route_key}:{datetime.now(UTC).date()}"

    def _spend_key(self, route_key: str) -> str:
        return f"switchroute:paid_spend:{route_key}:{datetime.now(UTC).date()}"

    async def _load(self, key: str) -> TargetState:
        raw = await self._redis.get(self._state_key(key))
        if not raw:
            return TargetState()
        data = json.loads(raw)
        quota_data = data.get("quota", {})
        quota = QuotaSnapshot(
            **{
                name: QuotaMetric(**quota_data.get(name, {}))
                for name in ("rpm", "tpm", "rpd", "tpd", "concurrency")
            }
        )
        health = HealthSnapshot(**data.get("health", {}))
        return TargetState(quota=quota, health=health)

    async def _save(self, key: str, state: TargetState) -> None:
        await self._redis.set(self._state_key(key), json.dumps(asdict(state)), ex=900)

    async def snapshot(self, key: str) -> TargetState:
        try:
            state = await self._load(key)
            self._breaker.before_probe(state.health)
            return state
        except (RedisError, ValueError, TypeError) as exc:
            self.available = False
            raise RuntimeError("Redis routing state is unavailable") from exc

    async def _cleanup(self, zset: str, hash_key: str, now: float) -> None:
        expired = await self._redis.zrangebyscore(zset, 0, now)
        if expired:
            pipe = self._redis.pipeline(transaction=True)
            pipe.zrem(zset, *expired)
            pipe.hdel(hash_key, *expired)
            await pipe.execute()

    async def _active_sum(self, zset: str, hash_key: str) -> tuple[int, int]:
        active = await self._redis.zrange(zset, 0, -1)
        if not active:
            return 0, 0
        values = await self._redis.hmget(hash_key, active)
        return len(active), sum(int(value or 0) for value in values)

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
        from uuid import uuid4

        now = time.time()
        rid = uuid4().hex
        route_lock = self._redis.lock(f"switchroute:lock:route:{route_key}", timeout=5, blocking_timeout=2)
        target_lock = self._redis.lock(f"switchroute:lock:target:{key}", timeout=5, blocking_timeout=2)
        try:
            async with route_lock:
                async with target_lock:
                    state = await self._load(key)
                    self._breaker.before_probe(state.health)
                    if state.health.circuit_state is CircuitState.OPEN:
                        return None
                    target_zset = self._target_res(key)
                    target_tokens = self._target_tokens(key)
                    route_zset = self._route_res(route_key)
                    route_costs = self._route_costs(route_key)
                    await self._cleanup(target_zset, target_tokens, now)
                    await self._cleanup(route_zset, route_costs, now)
                    reserved_requests, reserved_tokens = await self._active_sum(target_zset, target_tokens)
                    for metric in (state.quota.rpm, state.quota.rpd):
                        if metric.remaining is not None and metric.remaining - reserved_requests < 1:
                            return None
                    for metric in (state.quota.tpm, state.quota.tpd):
                        if metric.remaining is not None and metric.remaining - reserved_tokens < expected_tokens:
                            return None
                    if state.quota.concurrency.remaining is not None and state.quota.concurrency.remaining - reserved_requests < 1:
                        return None
                    if paid and daily_paid_cap_microusd is not None:
                        if expected_cost_microusd is None:
                            return None
                        _, reserved_cost = await self._active_sum(route_zset, route_costs)
                        hot_spend = int(await self._redis.get(self._spend_key(route_key)) or 0)
                        if max(hot_spend, durable_paid_spend_microusd) + reserved_cost + expected_cost_microusd > daily_paid_cap_microusd:
                            return None
                    expires = now + ttl_seconds
                    pipe = self._redis.pipeline(transaction=True)
                    pipe.zadd(target_zset, {rid: expires})
                    pipe.hset(target_tokens, rid, expected_tokens)
                    pipe.expire(target_zset, ttl_seconds * 3)
                    pipe.expire(target_tokens, ttl_seconds * 3)
                    if paid:
                        pipe.zadd(route_zset, {rid: expires})
                        pipe.hset(route_costs, rid, expected_cost_microusd or 0)
                        pipe.expire(route_zset, 172800)
                        pipe.expire(route_costs, 172800)
                    await pipe.execute()
                    return CapacityReservation(
                        id=rid,
                        target_key=key,
                        route_key=route_key,
                        expected_tokens=expected_tokens,
                        expected_cost_microusd=expected_cost_microusd,
                        paid=paid,
                        expires_at=expires,
                    )
        except RedisError as exc:
            self.available = False
            raise RuntimeError("Redis routing state is unavailable") from exc

    async def reconcile(
        self,
        reservation: CapacityReservation,
        *,
        attempted: bool,
        actual_tokens: int | None,
        actual_cost_microusd: int | None,
    ) -> None:
        try:
            pipe = self._redis.pipeline(transaction=True)
            pipe.zrem(self._target_res(reservation.target_key), reservation.id)
            pipe.hdel(self._target_tokens(reservation.target_key), reservation.id)
            if reservation.paid:
                pipe.zrem(self._route_res(reservation.route_key), reservation.id)
                pipe.hdel(self._route_costs(reservation.route_key), reservation.id)
                if attempted:
                    cost = actual_cost_microusd if actual_cost_microusd is not None else reservation.expected_cost_microusd
                    if cost is not None:
                        pipe.incrby(self._spend_key(reservation.route_key), cost)
                        pipe.expire(self._spend_key(reservation.route_key), 172800)
            await pipe.execute()
        except RedisError:
            self.available = False

    async def observe_quota(self, key: str, observations: list[QuotaObservation]) -> None:
        if not observations:
            return
        try:
            async with self._redis.lock(f"switchroute:lock:target:{key}", timeout=5, blocking_timeout=2):
                state = await self._load(key)
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
                            confidence=observation.confidence,
                        ),
                    )
                await self._save(key, state)
        except RedisError:
            self.available = False

    async def observe_success(self, key: str, latency_ms: int, ttft_ms: int | None = None) -> None:
        try:
            async with self._redis.lock(f"switchroute:lock:target:{key}", timeout=5, blocking_timeout=2):
                state = await self._load(key)
                self._breaker.after_success(state.health)
                state.health.latency_ewma_ms = ewma(state.health.latency_ewma_ms, float(latency_ms))
                state.health.latency_samples += 1
                if ttft_ms is not None:
                    state.health.ttft_ewma_ms = ewma(state.health.ttft_ewma_ms, float(ttft_ms))
                    state.health.ttft_samples += 1
                await self._save(key, state)
        except RedisError:
            self.available = False

    async def observe_failure(self, key: str, error_category: str) -> None:
        try:
            async with self._redis.lock(f"switchroute:lock:target:{key}", timeout=5, blocking_timeout=2):
                state = await self._load(key)
                self._breaker.after_failure(state.health, error_category)
                await self._save(key, state)
        except RedisError:
            self.available = False


async def create_routing_state(redis_url: str | None) -> RoutingState:
    if not redis_url:
        from switchroute.routing.state import MemoryRoutingState

        return MemoryRoutingState()
    client = Redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=1, socket_timeout=2)
    try:
        await client.ping()
        return RedisRoutingState(client)
    except RedisError:
        await client.aclose()
        return UnavailableRoutingState()
