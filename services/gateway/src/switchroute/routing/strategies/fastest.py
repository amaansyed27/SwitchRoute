from switchroute.routing.context import PlanCandidate


def _rank(item: PlanCandidate) -> tuple[int, float, int]:
    latency = item.state.health.latency_ewma_ms
    if latency is None:
        return 1, 0.0, item.candidate.position
    return 0, latency, item.candidate.position


def order(candidates: list[PlanCandidate]) -> list[PlanCandidate]:
    return sorted(candidates, key=_rank)
