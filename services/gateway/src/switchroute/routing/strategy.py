from operator import attrgetter

from switchroute.domain import Candidate


FREE_RANK = {"free": 0, "free_capable": 1, "unknown": 2, "paid": 3}


def order_candidates(candidates: list[Candidate], strategy: str) -> list[Candidate]:
    enabled = sorted(candidates, key=attrgetter("position"))
    if strategy == "free_first":
        return sorted(enabled, key=lambda item: (FREE_RANK.get(item.billing_tier, 2), item.position))
    return enabled
