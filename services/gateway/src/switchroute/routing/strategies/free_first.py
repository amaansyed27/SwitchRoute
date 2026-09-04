from switchroute.routing.context import PlanCandidate


def _rank(item: PlanCandidate) -> tuple[int, int]:
    tier = item.candidate.billing_tier
    if tier == "free":
        return 0, item.candidate.position
    if tier == "free_capable" and item.state.quota.has_known_capacity:
        return 1, item.candidate.position
    if tier == "free_capable":
        return 2, item.candidate.position
    return 3, item.candidate.position


def order(candidates: list[PlanCandidate]) -> list[PlanCandidate]:
    return sorted(candidates, key=_rank)
