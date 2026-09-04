from switchroute.routing.context import PlanCandidate


def _rank(item: PlanCandidate) -> tuple[int, int]:
    if not item.paid and item.candidate.billing_tier == "free":
        return 0, item.candidate.position
    if not item.paid:
        return 1, item.candidate.position
    return 2, item.candidate.position


def order(candidates: list[PlanCandidate]) -> list[PlanCandidate]:
    return sorted(candidates, key=_rank)
