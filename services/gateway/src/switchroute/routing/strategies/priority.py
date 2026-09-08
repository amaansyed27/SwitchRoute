from switchroute.routing.context import PlanCandidate


def order(candidates: list[PlanCandidate]) -> list[PlanCandidate]:
    return sorted(candidates, key=lambda item: item.candidate.position)
