from switchroute.auth.virtual_keys import create_virtual_key, hash_virtual_key


def test_virtual_key_is_identifiable_and_hashed() -> None:
    raw, prefix, digest = create_virtual_key("live", "pepper")
    assert raw.startswith("sr_live_")
    assert prefix == raw[:18]
    assert raw not in digest
    assert digest == hash_virtual_key(raw, "pepper")


def test_hash_changes_with_pepper() -> None:
    assert hash_virtual_key("sr_test_example", "one") != hash_virtual_key("sr_test_example", "two")
