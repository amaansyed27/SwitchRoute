import json
from typing import cast
from uuid import UUID

import pytest

from switchroute.budget.cost import cost_microusd
from switchroute.domain import Candidate, UsageRecord, VirtualKeyContext
from switchroute.routing.activity import RoutingActivity
from switchroute.routing.context import PlanCandidate, RoutingPlan
from switchroute.routing.state import TargetState
from switchroute.storage.contracts import Repository


class CaptureRepo:
    def __init__(self) -> None:
        self.records: list[UsageRecord] = []

    async def record_usage(self, record: UsageRecord) -> None:
        self.records.append(record)


def candidate() -> Candidate:
    return Candidate(
        target_id=UUID(int=1),
        provider_connection_id=UUID(int=2),
        provider_kind="openai",
        model_id="example",
        billing_tier="paid",
        position=0,
        input_price_per_million_usd=2.0,
        output_price_per_million_usd=3.0,
    )


def context() -> VirtualKeyContext:
    return VirtualKeyContext(
        key_id=UUID(int=3),
        workspace_id=UUID(int=4),
        route_id=UUID(int=5),
        route_name="Production",
        route_slug="production",
        strategy="balanced",
        route_enabled=True,
        candidates=[candidate()],
    )


def test_estimated_cost_uses_normalized_per_million_prices() -> None:
    assert cost_microusd(candidate(), 100, 50) == 350


@pytest.mark.asyncio
async def test_activity_is_bounded_metadata_and_never_request_content() -> None:
    repo = CaptureRepo()
    activity = RoutingActivity(cast(Repository, repo))
    item = PlanCandidate(
        candidate=candidate(),
        state=TargetState(),
        expected_input_tokens=100,
        expected_output_tokens=50,
        expected_cost_microusd=350,
        paid=True,
    )
    plan = RoutingPlan(
        requested_strategy="balanced",
        effective_strategy="balanced",
        candidates=[item],
    )
    path = [{"provider": "openai", "model": "example", "outcome": "selected"}]
    decision = activity.decision(plan, item, path, 0)
    secret_content = "DO_NOT_PERSIST_THIS_PROMPT_OR_RESPONSE"

    await activity.record(
        request_id=UUID(int=6),
        context=context(),
        item=item,
        latency_ms=120,
        status="success",
        fallback_count=0,
        input_tokens=100,
        output_tokens=50,
        error_category=None,
        ttft_ms=40,
        decision=decision,
    )

    record = repo.records[0]
    assert record.estimated_cost_microusd == 350
    assert record.paid_routing is True
    assert secret_content not in json.dumps(record.routing_decision)
    assert not hasattr(record, "messages")
    assert not hasattr(record, "response")
