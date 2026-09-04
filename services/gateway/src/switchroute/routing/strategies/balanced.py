from switchroute.routing.context import PlanCandidate


def _normalize(values: list[float | None], invert: bool = False) -> list[float]:
    known = [value for value in values if value is not None]
    if not known:
        return [0.5 for _ in values]
    low, high = min(known), max(known)
    span = high - low
    result: list[float] = []
    for value in values:
        if value is None:
            score = 0.35
        elif span == 0:
            score = 1.0
        else:
            score = (value - low) / span
        result.append(1 - score if invert and value is not None else score)
    return result


def order(candidates: list[PlanCandidate]) -> list[PlanCandidate]:
    quota = [item.state.quota.usable_ratio() for item in candidates]
    latency = _normalize([item.state.health.latency_ewma_ms for item in candidates], invert=True)
    price = _normalize(
        [float(item.expected_cost_microusd) if item.expected_cost_microusd is not None else None for item in candidates],
        invert=True,
    )
    quota_score = [value if value is not None else 0.35 for value in quota]
    scored: list[tuple[float, int, PlanCandidate]] = []
    for index, item in enumerate(candidates):
        health_score = 1.0 if item.state.health.consecutive_failures == 0 else max(0.2, 1 - item.state.health.consecutive_failures * 0.2)
        score = 0.35 * health_score + 0.30 * quota_score[index] + 0.20 * latency[index] + 0.15 * price[index]
        scored.append((-score, item.candidate.position, item))
    return [item for _, _, item in sorted(scored, key=lambda value: (value[0], value[1]))]
