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
> Using another address (e.g. Radmin VPN `26.x.x.x`)? It's already allowed in `frontend/next.config.ts`
> (`allowedDevOrigins`); add yours there if it's different, and restart `npm run dev`.

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

## 3. Logins and Race Control

- Everyone starts at `/login`. **Admin:** username `funprogp`, password `helloWorld`
  (change with `$env:ADMIN_USERNAME` / `$env:ADMIN_PASSWORD` before starting the backend, especially if the repo is public).
- Anyone else types their **full name** (spaces allowed) and a password. A new name gets a second step:
  pick a unique **3-letter driver code** (suggestions like KIM / ANT) and a **team** from the logo dropdown.
  Logging in again needs the same name and password. Team logos live in `frontend/public/teams/`.
- The admin lands on **Race Control** (`/admin`) and never sees the coding page. From there:
  - **Start the race** for Q1, then Q2, then Q3. Every driver's screen runs the same five red lights and
    goes out at the same moment; the session clock starts at lights out.
  - **+1 min / −1 min** and **End session now** (chequered flag for everyone).
  - Live problem stats, live standings, **Remove** a driver (duplicates/test accounts), **Reset** after the dry run.
- Drivers just wait on the Paddock: when Race Control starts a session they're taken to the lights automatically.

## 4. Scoring and timing rules

- One clock per session for everyone: Q1 25 min, Q2 27 min, Q3 32 min (edit `backend/app/config.py`).
- **Points:** each problem has 10 hidden tests; every passed test is worth 1/10 of the problem
  (Q1 10, Q2 20, Q3 30 pts per problem = 250). The best submission counts.
- **Fastest-lap bonus:** the single fastest lap of each session earns **+2 (Q1), +5 (Q2), +7 (Q3)** = 264 max.
  It moves live if someone beats it.
- **Lap time** = time the driver had that problem open until it passed 10/10.
- **Colours are live** and separate for each session:
  - 🟣 purple: the one fastest lap of the session, by anyone
  - 🟢 green: the driver's personal best of the session (exactly one per driver)
  - 🟡 yellow: the driver's other laps
  
  If someone beats the purple lap, the old one turns green (or yellow) on every screen within ~3 seconds.
- **Time:** for each session, from lights out to the submission that reached the driver's final score there;
  the TIME column adds Q1 + Q2 + Q3 (e.g. `1:25:03`). Hover it to see each session.
- **Standings:** total points (incl. fastest-lap bonus), and on equal points the **lower TIME** is ahead.
  The fastest-lap holder of a session shows a purple badge with the lap time.

## 5. The contest problems

The problem set is in `backend/contest/` (`q1`, `q2`, `q3`, plus reference `solutions/`). It only uses what
weeks 1–9 of Fundamentals of Programming covered, and every statement explains the racing idea, so no F1
knowledge is needed:

| Session | Problems | Python used |
|---|---|---|
| Q1 · 6 easy | Lap Time Display, Driver Code, Fuel Check, Podium, Season Points, Grid Penalty | `//` `%` `:02d`, slicing, `if/elif`, `sorted` + `index`, a `for` loop, `pop`/`insert` |
| Q2 · 5 medium | Personal Best, Tyre Stint, DRS Train, Places Gained, Theoretical Best Lap | loops with a running best / streak, `while`, `enumerate`, small functions |
| Q3 · 3 hard | Championship Table, Pit Lane Log, Race Classification | dictionaries, tuples, `sorted(key=lambda …)`, `divmod` |

Targets: about 3–4 min per Q1 problem, 5–6 min per Q2 problem and 10 min per Q3 problem for a strong student.
The old example set in `backend/problems/` is no longer used and can be deleted.

To change a problem, edit its JSON (only the test **inputs** are needed), update its solution in
`contest/solutions/<id>.py`, then regenerate the outputs and restart the backend:

```powershell
cd backend
python tools/fill_outputs.py --all
```

## 6. Reset before the event

Use **Reset results** (keeps accounts) or **Reset everything** on the Race Control page. Or stop the backend
and delete `backend/funprogp.db` (plus `-wal`/`-shm`). A database from an older version is moved aside
automatically as `funprogp.old-<time>.db`. On a shared PC, students use **Log out** in the top bar.

## Pages

| URL | What |
|---|---|
| `/login` | Login for drivers and Race Control |
| `/admin` | Race Control (admin only) |
| `/admin/podium` | Podium ceremony: reveal P3, P2, P1 with team-livery drivers; P4+ below (admin only) |
| `/` | Driver's Paddock (session cards) |
| `/race/1`, `/race/2`, `/race/3` | Synchronised lights → coding workspace → session report |
| `/results` | A driver's own report: points, time, laps (no positions; the ranking stays secret) |
| `/standings` | Full live standings (admin only, for the projector) |
