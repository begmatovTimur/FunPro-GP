"""Event configuration. Change values here (or via environment variables)."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
PROBLEMS_DIR = Path(os.getenv("PROBLEMS_DIR", BASE_DIR / "problems"))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'funprogp.db'}")

# Qualifying sessions: duration is for the WHOLE session, not per problem.
SESSIONS = {
    1: {"name": "Q1", "label": "Easy", "duration_min": 25, "points_per_problem": 10},
    2: {"name": "Q2", "label": "Medium", "duration_min": 27, "points_per_problem": 20},
    3: {"name": "Q3", "label": "Hard", "duration_min": 32, "points_per_problem": 30},
}

# Who a lap is compared against for PURPLE:
#   "session" -> fastest lap by anyone on ANY problem of this session (the F1 "fastest lap" model)
#   "problem" -> fastest solve of THIS problem by anyone (the F1 "purple sector" model)
PURPLE_SCOPE = os.getenv("PURPLE_SCOPE", "session")

# Grace period for submissions that were sent just before the chequered flag (seconds).
SUBMIT_GRACE_SEC = 3

# ---------- Code execution ----------
# JUDGE_MODE:
#   "judge0" -> always use Judge0 (recommended on event day)
#   "local"  -> run Python directly on this machine with a timeout (development only, not sandboxed)
#   "auto"   -> try Judge0, fall back to local if Judge0 is unreachable
JUDGE_MODE = os.getenv("JUDGE_MODE", "auto")
JUDGE0_URL = os.getenv("JUDGE0_URL", "http://localhost:2358").rstrip("/")
JUDGE0_AUTH_TOKEN = os.getenv("JUDGE0_AUTH_TOKEN", "")  # X-Auth-Token if your Judge0 has AUTHN enabled
JUDGE0_RAPIDAPI_KEY = os.getenv("JUDGE0_RAPIDAPI_KEY", "")  # only if you use the hosted RapidAPI Judge0
JUDGE0_RAPIDAPI_HOST = os.getenv("JUDGE0_RAPIDAPI_HOST", "judge0-ce.p.rapidapi.com")
# 71 = "Python (3.8.1)" on Judge0 CE 1.13.x. Check GET {JUDGE0_URL}/languages for your install.
JUDGE0_PYTHON_ID = int(os.getenv("JUDGE0_PYTHON_ID", "71"))

DEFAULT_TIME_LIMIT_SEC = 2.0
MAX_OUTPUT_CHARS = 2_000_000
MAX_CODE_CHARS = 50_000
