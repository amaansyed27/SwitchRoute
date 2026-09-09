from typing import Any

from switchroute.providers.model_metadata import billing, number


def test_free_requires_both_prices_and_invalid_prices_stay_unknown():
    assert billing(0, None) == "unknown"
    assert billing(None, 0) == "unknown"
    assert billing(0, 0) == "free"
    assert billing(0, 1) == "paid"
    assert billing(None, 1) == "paid"
    for value in ("NaN", "Infinity", -1, True, "garbage"):
        assert number(value) is None


def test_stored_target_label_cannot_grant_free_access(monkeypatch):
    from switchroute.storage import postgres_keys

    monkeypatch.setattr(postgres_keys, "record_dict", lambda row: dict(row))
    row: Any = dict(target_id="t", provider_connection_id="p", provider_kind="groq",
               model_id="m", position=0, connection_status="healthy", billing_tier="free",
               metadata={"models": []})
    assert postgres_keys._candidate(row).billing_tier == "unknown"
    row["metadata"] = {"models": [{"id": "m", "billing_tier": "free",
                                  "input_price_per_million_usd": 0}]}
    assert postgres_keys._candidate(row).billing_tier == "unknown"
    row["metadata"]["models"][0]["output_price_per_million_usd"] = 2
    assert postgres_keys._candidate(row).billing_tier == "paid"
