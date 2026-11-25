"""Event configuration. Change values here (or via environment variables)."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
# The contest problem set (q1, q2, q3 + solutions). The old example set in problems/ is no longer used.
PROBLEMS_DIR = Path(os.getenv("PROBLEMS_DIR", BASE_DIR / "contest"))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'funprogp.db'}")

# Qualifying sessions: duration is for the WHOLE session, not per problem.
SESSIONS = {
    1: {"name": "Q1", "label": "Easy", "duration_min": 25, "points_per_problem": 10},
    2: {"name": "Q2", "label": "Medium", "duration_min": 27, "points_per_problem": 20},
    3: {"name": "Q3", "label": "Hard", "duration_min": 32, "points_per_problem": 30},
}

# Extra championship points for the single fastest lap of each session (live: moves if someone beats it).
FASTEST_LAP_BONUS = {1: 2, 2: 5, 3: 7}

# Teams drivers can pick at registration (logos: frontend/public/teams/<id>.png).
TEAMS = {
    "alpine": {"name": "Alpine", "color": "#0093cc"},
    "aston-martin": {"name": "Aston Martin", "color": "#229971"},
    "audi": {"name": "Audi", "color": "#f50537"},
    "cadillac": {"name": "Cadillac", "color": "#c9c9c9"},
    "ferrari": {"name": "Ferrari", "color": "#e8002d"},
    "haas": {"name": "Haas", "color": "#b6babd"},
    "mclaren": {"name": "McLaren", "color": "#ff8000"},
    "mercedes": {"name": "Mercedes", "color": "#27f4d2"},
    "racing-bulls": {"name": "Racing Bulls", "color": "#6692ff"},
    "red-bull-racing": {"name": "Red Bull Racing", "color": "#3671c6"},
    "williams": {"name": "Williams", "color": "#37bedd"},
}

# Race Control login. Anyone else who logs in gets a driver account created automatically.
# If your repository is public, override the password on event day: $env:ADMIN_PASSWORD="..."
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "funprogp")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "helloWorld")

# Start sequence: lights begin this many seconds after the admin presses Start (so every screen
# catches it), five lights 1 s apart, then a random hold before lights out.
LIGHTS_LEAD_SEC = 2.0
LIGHTS_HOLD_SEC = (1.0, 3.0)

# Grace period for submissions that were sent just before the chequered flag (seconds).
SUBMIT_GRACE_SEC = 3

# ---------- Code execution ----------
# JUDGE_MODE:
#   "judge0" -> always use Judge0 (recommended on event day)
#   "local"  -> run Python directly on this machine with a timeout (development only, not sandboxed)
#   "auto"   -> try Judge0, fall back to local if Judge0 is unreachable
# Browsers allowed to call the API. "*" = any (fine on a lab network). Comma-separated list to restrict,
# e.g. CORS_ORIGINS=http://26.162.208.170:3000,http://localhost:3000
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

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
