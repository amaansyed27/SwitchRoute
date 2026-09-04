from dataclasses import dataclass
from typing import Literal

from switchroute.domain import Candidate
from switchroute.quota.models import QuotaSnapshot

PaidFallback = Literal["never", "after_free", "allowed"]


@dataclass(frozen=True, slots=True)
class BudgetPolicy:
    paid_fallback: PaidFallback = "after_free"
    daily_paid_cap_microusd: int | None = None


def is_free_candidate(candidate: Candidate, quota: QuotaSnapshot | None = None) -> bool:
    if candidate.billing_tier == "free":
        return True
    return bool(
        candidate.billing_tier == "free_capable"
        and quota is not None
        and quota.has_confirmed_free_capacity
    )


def paid_policy_reason(
    candidate: Candidate, policy: BudgetPolicy, quota: QuotaSnapshot | None = None
) -> str | None:
    if policy.paid_fallback == "never" and not is_free_candidate(candidate, quota):
        return "paid_fallback_disabled"
    return None
