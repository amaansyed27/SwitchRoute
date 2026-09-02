from pathlib import Path
import sys

# Deployment marker: keeps Vercel's monorepo affected-project detection explicit for the gateway.
sys.path.insert(0, str(Path(__file__).parent / "src"))

from switchroute.main import app  # noqa: E402,F401
