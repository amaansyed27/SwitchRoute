from dataclasses import dataclass
from typing import Literal

from switchroute.domain import Candidate

PaidFallback = Literal["never", "after_free", "allowed"]


@dataclass(frozen=True, slots=True)
class BudgetPolicy:
    paid_fallback: PaidFallback = "after_free"
    daily_paid_cap_microusd: int | None = None


def is_free_candidate(candidate: Candidate) -> bool:
    return candidate.billing_tier in {"free", "free_capable"}


def paid_policy_reason(candidate: Candidate, policy: BudgetPolicy) -> str | None:
    if policy.paid_fallback == "never" and not is_free_candidate(candidate):
        return "paid_fallback_disabled"
    return None
