from dataclasses import dataclass, field

from switchroute.domain import Candidate
from switchroute.routing.state import CapacityReservation, TargetState


@dataclass(slots=True)
class PlanCandidate:
    candidate: Candidate
    state: TargetState
    expected_input_tokens: int
    expected_output_tokens: int
    expected_cost_microusd: int | None
    paid: bool
    reason: str = "eligible"

    @property
    def expected_tokens(self) -> int:
        return self.expected_input_tokens + self.expected_output_tokens


@dataclass(slots=True)
class ExcludedCandidate:
    provider_kind: str
    model_id: str
    reason: str


@dataclass(slots=True)
class RoutingPlan:
    requested_strategy: str
    effective_strategy: str
    candidates: list[PlanCandidate]
    excluded: list[ExcludedCandidate] = field(default_factory=list)
    degraded_reason: str | None = None
    durable_paid_spend_microusd: int = 0


@dataclass(slots=True)
class Attempt:
    candidate: PlanCandidate
    reservation: CapacityReservation
