from __future__ import annotations

import ast
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FORBIDDEN = {
    "prompt",
    "prompts",
    "message",
    "messages",
    "completion",
    "completions",
    "system_prompt",
    "tool_payload",
    "upload",
    "uploads",
    "raw_response",
    "raw_error",
    "authorization",
}

ALLOWED_USAGE_FIELDS = {
    "request_id",
    "workspace_id",
    "route_id",
    "virtual_key_id",
    "provider_connection_id",
    "provider_kind",
    "model_id",
    "input_tokens",
    "output_tokens",
    "latency_ms",
    "status",
    "fallback_count",
    "error_category",
    "estimated_cost_microusd",
    "ttft_ms",
    "paid_routing",
    "routing_decision",
}


def dataclass_fields(path: Path, class_name: str) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            return {
                item.target.id
                for item in node.body
                if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name)
            }
    raise SystemExit(f"{class_name} not found in {path}")


def request_usage_columns() -> set[str]:
    migration_text = "\n".join(
        path.read_text(encoding="utf-8") for path in sorted((ROOT / "supabase/migrations").glob("*.sql"))
    )
    match = re.search(
        r"create\s+table\s+public\.request_usage\s*\((.*?)\);",
        migration_text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        raise SystemExit("public.request_usage definition not found")
    columns: set[str] = set()
    for raw in match.group(1).splitlines():
        line = raw.strip().rstrip(",")
        if not line or line.lower().startswith(("constraint ", "primary ", "foreign ", "unique ", "check ")):
            continue
        name = line.split()[0].strip('"')
        columns.add(name)
    return columns


def main() -> None:
    usage_fields = dataclass_fields(
        ROOT / "services/gateway/src/switchroute/domain.py", "UsageRecord"
    )
    unexpected = usage_fields - ALLOWED_USAGE_FIELDS
    if unexpected:
        raise SystemExit(f"UsageRecord contains non-operational fields: {sorted(unexpected)}")
    forbidden_usage = usage_fields & FORBIDDEN
    if forbidden_usage:
        raise SystemExit(f"UsageRecord contains retained content fields: {sorted(forbidden_usage)}")

    columns = request_usage_columns()
    forbidden_columns = columns & FORBIDDEN
    if forbidden_columns:
        raise SystemExit(
            f"public.request_usage contains retained content columns: {sorted(forbidden_columns)}"
        )

    source_root = ROOT / "services/gateway/src/switchroute"
    risky_logging = re.compile(
        r"(?:logger|logging)\.[a-z]+\([^\n]*(?:prompt|messages|completion|authorization|api_key)",
        re.IGNORECASE,
    )
    failures: list[str] = []
    for path in source_root.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        if risky_logging.search(text):
            failures.append(str(path.relative_to(ROOT)))
    if failures:
        raise SystemExit("Potential content/credential logging found in: " + ", ".join(failures))

    print("zero-retention contract: ok")


if __name__ == "__main__":
    main()
