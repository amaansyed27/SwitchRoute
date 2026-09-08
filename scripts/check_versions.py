from __future__ import annotations

import json
import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise SystemExit(f"VERSION is not SemVer: {version}")

    gateway = tomllib.loads((ROOT / "services/gateway/pyproject.toml").read_text(encoding="utf-8"))
    python_sdk = tomllib.loads((ROOT / "sdk/python/pyproject.toml").read_text(encoding="utf-8"))
    js_sdk = json.loads((ROOT / "sdk/javascript/package.json").read_text(encoding="utf-8"))
    edge = tomllib.loads((ROOT / "crates/switchroute-edge/Cargo.toml").read_text(encoding="utf-8"))

    observed = {
        "gateway": gateway["project"]["version"],
        "python-sdk": python_sdk["project"]["version"],
        "javascript-sdk": js_sdk["version"],
        "edge": edge["package"]["version"],
    }
    drift = {name: value for name, value in observed.items() if value != version}
    if drift:
        raise SystemExit(f"release version drift: VERSION={version}, mismatches={drift}")

    build_rs = (ROOT / "crates/switchroute-edge/build.rs").read_text(encoding="utf-8")
    if "../../VERSION" not in build_rs or "SWITCHROUTE_VERSION" not in build_rs:
        raise SystemExit("Edge CLI must derive its distributable version from root VERSION")

    print(f"release version: {version}")


if __name__ == "__main__":
    main()
