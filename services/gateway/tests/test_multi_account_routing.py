from uuid import uuid4

import pytest

from switchroute.domain import Candidate
from switchroute.quota.models import QuotaObservation
from switchroute.routing.state import MemoryRoutingState, target_key


def _candidate(connection_id, *, position: int) -> Candidate:
    return Candidate(
        target_id=uuid4(),
        provider_connection_id=connection_id,
        provider_kind="groq",
        model_id="llama-test",
        billing_tier="free_capable",
        position=position,
    )


@pytest.mark.asyncio
async def test_same_provider_connections_have_independent_routing_state() -> None:
    first = _candidate(uuid4(), position=0)
    second = _candidate(uuid4(), position=1)

    first_key = target_key(first)
    second_key = target_key(second)
    assert first_key != second_key

    state = MemoryRoutingState()
    await state.observe_quota(
        first_key,
        [QuotaObservation(metric="rpm", limit=10, remaining=0, capacity="free")],
    )
    await state.observe_failure(first_key, "provider_unavailable")

    first_snapshot = await state.snapshot(first_key)
    second_snapshot = await state.snapshot(second_key)

    assert first_snapshot.quota.rpm.remaining == 0
    assert first_snapshot.health.consecutive_failures == 1
    assert second_snapshot.quota.rpm.remaining is None
    assert second_snapshot.health.consecutive_failures == 0
