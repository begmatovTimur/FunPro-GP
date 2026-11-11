# FunPro GP 🏁

An F1-themed coding contest: three qualifying sessions (Q1 Easy, Q2 Medium, Q3 Hard), a LeetCode-style Python editor, live timing colours and a championship table.

```
funprogp/
├── backend/    FastAPI + SQLite + Judge0 client   (port 8000)
└── frontend/   Next.js 16                          (port 3000)
```

## 1. Run it (Windows, PowerShell)

**Backend**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Frontend** (second terminal)

```powershell
cd frontend
npm install
npm run dev            # while developing
# on event day:  npm run build  then  npm start -- -H 0.0.0.0
```

Open http://localhost:3000. Students in the lab open `http://<organiser-laptop-IP>:3000` (find the IP with `ipconfig`).
The site automatically talks to the backend on port 8000 of the same machine.

> Allow **ports 3000 and 8000** through Windows Firewall, and test from one lab PC before the event.

## 2. Code execution: Judge0 vs. local runner

Set `JUDGE_MODE` before starting the backend (`$env:JUDGE_MODE="judge0"` in PowerShell):

| Mode | What it does |
|---|---|
| `auto` (default) | Uses Judge0 at `JUDGE0_URL`; if it's unreachable, runs the code locally with a time limit |
| `judge0` | Judge0 only (recommended on event day) |
| `local` | Runs `python` on this machine with a timeout. Good for development; **not sandboxed** |

**Judge0 on Windows:** Judge0 1.13.x needs Linux with cgroup v1. Inside Docker Desktop / WSL2 the
containers start, but submissions fail (WSL's kernel is cgroup v2 and can't be switched).
Free option: an **Ubuntu 22.04 VM in VirtualBox** with a *bridged* network adapter:

1. In the VM: edit `/etc/default/grub` → `GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=0"`, run `sudo update-grub`, reboot.
2. Install Docker, then follow the official install from the [Judge0 v1.13.1 release](https://github.com/judge0/judge0/releases/tag/v1.13.1)
   (`docker-compose up -d db redis`, wait ~10 s, `docker-compose up -d`).
3. On the laptop: `$env:JUDGE0_URL="http://<vm-ip>:2358"; $env:JUDGE_MODE="judge0"`, then start the backend.
4. Check: http://localhost:8000/api/health should show `"judge0_reachable": true`.

Python on Judge0 CE is language id **71 (Python 3.8)**, so avoid 3.10+ syntax like `match`. Change with `JUDGE0_PYTHON_ID`.

## 3. Rules implemented

- Each session has **one clock** for all its problems: Q1 25 min, Q2 27 min, Q3 32 min (edit `backend/app/config.py`).
- The clock starts at **lights out** (5 red lights, random hold, lights out), separately for each driver.
- Drivers can jump between problems freely. The next session unlocks only when the current one is over:
  time runs out, all problems are solved, or the driver presses **Box box** (end early).
- **Points:** each problem has 10 hidden tests; every passed test is worth 1/10 of the problem
  (Q1 10 pts, Q2 20 pts, Q3 30 pts per problem → 60 + 100 + 90 = 250). The best submission counts.
- **Lap time** = time the driver had that problem open until it passed 10/10.
- **Colours** (decided at the moment of solving, per session):
  - 🟣 purple: faster than every lap in this session by anyone
  - 🟢 green: faster than the driver's own previous laps in this session
  - 🟡 yellow: slower than the driver's own best
  
  To compare purple per problem instead of across the whole session, set `PURPLE_SCOPE=problem`.
- **Standings:** points, then lower total lap time, then faster best lap.

## 4. Adding or editing problems

Problems are JSON files in `backend/problems/q1`, `q2`, `q3` (file order = problem order).
Copy an existing one and change it. You only need to write the **inputs** of examples and tests;
put a reference solution in `backend/problems/solutions/<id>.py` and generate the outputs:

```powershell
cd backend
python tools/fill_outputs.py --all
```

Restart the backend after changing problems. Make the 10 tests cover edge cases and at least
one large input, so slow solutions get partial points instead of full marks.

## 5. Reset before the event

Stop the backend and delete `backend/funprogp.db` (plus `-wal`/`-shm` files). Students' code drafts live
in each browser's localStorage; a different driver on the same PC uses "Switch driver" on the Paddock page.

## Pages

| URL | What |
|---|---|
| `/` | Registration, then the Paddock (session cards) |
| `/race/1`, `/race/2`, `/race/3` | Lights-out sequence → coding workspace → session report |
| `/results` | Final board: position, total and per-session points, best lap, standings |
| `/standings` | Live drivers' standings (good for the projector) |
