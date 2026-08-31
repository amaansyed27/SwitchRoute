from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent / "src"))

from switchroute.main import app  # noqa: E402,F401
