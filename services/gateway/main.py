from pathlib import Path
import sys

import redis.asyncio as _redis_asyncio  # noqa: F401

# Deployment marker: keeps Vercel's monorepo affected-project detection explicit for the gateway.
# The direct Redis import also keeps the optional hot-state runtime in Vercel's optimized bundle.
sys.path.insert(0, str(Path(__file__).parent / "src"))

from switchroute.main import app  # noqa: E402,F401
