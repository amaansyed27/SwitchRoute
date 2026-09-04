from switchroute.routing.context import PlanCandidate


def _rank(item: PlanCandidate) -> tuple[int, float, int]:
    ratio = item.state.quota.usable_ratio()
    if ratio is None:
        return 1, 0.0, item.candidate.position
    return 0, -ratio, item.candidate.position


def order(candidates: list[PlanCandidate]) -> list[PlanCandidate]:
    return sorted(candidates, key=_rank)
