from switchroute.routing.context import PlanCandidate


def _rank(item: PlanCandidate) -> tuple[int, int, int]:
    cost = item.expected_cost_microusd
    if cost is None:
        return 1, 0, item.candidate.position
    return 0, cost, item.candidate.position


def order(candidates: list[PlanCandidate]) -> list[PlanCandidate]:
    return sorted(candidates, key=_rank)
