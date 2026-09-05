import json
import logging
from typing import Any

_logger = logging.getLogger("switchroute.request")


def emit_request_event(**fields: Any) -> None:
    """Emit bounded operational metadata only. Never pass request/response content here."""
    safe: dict[str, Any] = {}
    for key, value in fields.items():
        if value is None or isinstance(value, (str, int, float, bool)):
            safe[key] = value
    _logger.info(json.dumps(safe, separators=(",", ":"), sort_keys=True))
