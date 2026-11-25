import logging
import random
import threading
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlmodel import Session, delete, select

from . import config, judge
from .auth import (CODE_RE, USERNAME_RE, check_password, current_driver, get_auth, issue_token, new_driver,
                   require_admin, suggest_code)
from .db import AuthToken, Driver, Progress, RaceSession, SessionRun, Submission, engine, get_session, init_db
from .problems import Problem, get_problem, load_problems
from .timing import (SessionTiming, all_timing, build_standings, end_time, get_race, max_points, now,
                     race_state, session_time)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("funprogp")

# Serialises "record a solve" so two simultaneous solves are ordered consistently.
_timing_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    for n, items in load_problems().items():
        log.info("%s: %d problems loaded", config.SESSIONS[n]["name"], len(items))
    log.info("Judge: %s", judge.judge_status())
    log.info("Admin login: %s", config.ADMIN_USERNAME)
    yield


app = FastAPI(title="FunPro GP", lifespan=lifespan)


@app.middleware("http")
async def errors_as_json(request: Request, call_next):
    """Turn crashes into a JSON 500 *inside* the CORS layer, so the browser shows the real error
    instead of a misleading "blocked by CORS policy"."""
    try:
        return await call_next(request)
    except Exception:
        log.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse({"detail": "Server error - check the backend terminal"}, status_code=500)


# Added last = outermost, so every response (errors included) carries the CORS headers.
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])


# ------------------------------------------------------------------ helpers

def session_cfg(n: int) -> dict:
    if n not in config.SESSIONS:
        raise HTTPException(404, "No such session")
    return config.SESSIONS[n]


def driver_public(d: Driver) -> dict:
    return {"id": d.id, "name": d.name, "code": d.code, "number": d.number, "color": d.color, "team": d.team,
            "team_name": config.TEAMS.get(d.team, {}).get("name", "")}


def get_run(s: Session, driver_id: int, n: int) -> Optional[SessionRun]:
    return s.exec(select(SessionRun).where(SessionRun.driver_id == driver_id, SessionRun.session == n)).first()


def get_progress(s: Session, driver_id: int, problem: Problem, create: bool = True) -> Optional[Progress]:
    p = s.exec(select(Progress).where(Progress.driver_id == driver_id, Progress.problem_id == problem.id)).first()
    if p is None and create:
        p = Progress(driver_id=driver_id, problem_id=problem.id, session=problem.session, total_tests=len(problem.tests))
        s.add(p)
    return p


def switch_focus(s: Session, run: SessionRun, problem_id: Optional[str], t: float) -> None:
    """Close the timing interval of the open problem and start one for the new problem."""
    if run.current_problem_id and run.current_since is not None:
        prob = get_problem(run.current_problem_id)
        if prob:
            prog = get_progress(s, run.driver_id, prob)
            if not prog.solved:
                prog.active_seconds += max(0.0, t - run.current_since)
                s.add(prog)
    run.current_problem_id = problem_id
    run.current_since = t if problem_id else None
    s.add(run)


def ensure_run(s: Session, driver_id: int, n: int, t: float) -> SessionRun:
    run = get_run(s, driver_id, n)
    if run is None:
        problems = load_problems()[n]
        run = SessionRun(driver_id=driver_id, session=n, joined_at=t,
                         current_problem_id=problems[0].id if problems else None, current_since=t)
        s.add(run)
        s.commit()
        s.refresh(run)
    return run


def driver_status(s: Session, driver_id: int, n: int, t: float) -> str:
    st = race_state(get_race(s, n), t)
    if st == "running":
        run = get_run(s, driver_id, n)
        if run and run.ended_at is not None:
            return "finished"  # this driver solved everything; waiting for the flag
    return st


def progress_public(p: Optional[Progress], problem: Problem, timing: SessionTiming) -> dict:
    if p is None:
        return {"best_passed": 0, "total_tests": len(problem.tests), "points": 0, "attempts": 0,
                "solved": False, "lap_seconds": None, "color": None}
    return {"best_passed": p.best_passed, "total_tests": p.total_tests or len(problem.tests), "points": p.points,
            "attempts": p.attempts, "solved": p.solved, "lap_seconds": p.lap_seconds,
            "color": timing.color(p.driver_id, p.problem_id)}


def race_public(rs: Optional[RaceSession], t: float) -> dict:
    return {
        "state": race_state(rs, t),
        "lights_start": rs.lights_start if rs else None,
        "lights_out": rs.lights_out if rs else None,
        "end_at": end_time(rs) if rs else None,
    }


def session_summary(s: Session, driver: Optional[Driver], n: int, timing: SessionTiming,
                    drivers: dict[int, Driver], t: float) -> dict:
    cfg = config.SESSIONS[n]
    problems = load_problems()[n]
    rs = get_race(s, n)
    out = {
        "n": n, "name": cfg["name"], "label": cfg["label"],
        "duration_sec": cfg["duration_min"] * 60,
        "points_per_problem": cfg["points_per_problem"],
        "problems_count": len(problems),
        "max_points": cfg["points_per_problem"] * len(problems),
        "fastest_lap_bonus": config.FASTEST_LAP_BONUS.get(n, 0),
        **race_public(rs, t),
        "fastest_lap": timing.fastest_public(drivers),
    }
    if driver is not None:
        progs = s.exec(select(Progress).where(Progress.driver_id == driver.id, Progress.session == n)).all()
        pb = timing.personal_best.get(driver.id)
        out.update({
            "status": driver_status(s, driver.id, n, t),
            "points": round(sum(p.points for p in progs), 2),
            "bonus": timing.bonus(driver.id),
            "solved": sum(1 for p in progs if p.solved),
            "best_lap": pb.lap_seconds if pb else None,
            "time": session_time(list(progs), rs),
            "colors": {c: sum(1 for p in progs if timing.color(driver.id, p.problem_id) == c)
                       for c in ("purple", "green", "yellow")},
        })
    return out


def require_running(s: Session, problem: Problem, grace: float = 0) -> RaceSession:
    rs = get_race(s, problem.session)
    t = now()
    if rs is None or t < rs.lights_out:
        raise HTTPException(409, "This session has not started yet")
    if t > end_time(rs) + grace:
        raise HTTPException(409, "Chequered flag - this session is over")
    return rs


# ------------------------------------------------------------------ schemas

class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=40)
    password: str = Field(min_length=1, max_length=64)
    # Only for a new driver (second step of the login form):
    code: Optional[str] = None
    team: Optional[str] = None


class FocusIn(BaseModel):
    problem_id: str


class CodeIn(BaseModel):
    problem_id: str
    code: str = Field(max_length=config.MAX_CODE_CHARS)
    custom_input: Optional[str] = None


class ExtendIn(BaseModel):
    seconds: int = Field(ge=-600, le=1800)


class ResetIn(BaseModel):
    keep_drivers: bool = True
    confirm: str


# ------------------------------------------------------------------ public

@app.get("/api/health")
def health():
    return {"ok": True, "server_now": now(), "judge": judge.judge_status()}


@app.get("/api/standings", dependencies=[Depends(require_admin)])
def standings(s: Session = Depends(get_session)):
    """Full ranking: Race Control only (drivers must not see the table during the event)."""
    return build_standings(s)


@app.get("/api/fastest-laps")
def fastest_laps(s: Session = Depends(get_session)):
    """The one thing about other drivers everyone may see: each session's fastest lap."""
    drivers = {x.id: x for x in s.exec(select(Driver)).all()}
    timing = all_timing(s)
    return {str(n): timing[n].fastest_public(drivers) for n in config.SESSIONS}


# ------------------------------------------------------------------ auth

@app.post("/api/auth/login")
def login(body: LoginIn, s: Session = Depends(get_session)):
    username = " ".join(body.username.split())  # trim and collapse repeated spaces

    # 1) Exactly the admin credentials -> Race Control.
    if username == config.ADMIN_USERNAME and body.password == config.ADMIN_PASSWORD:
        return {"token": issue_token(s, None, True), "role": "admin", "driver": None, "created": False}

    # 2) Anything else -> a driver.
    #    Existing name: the password must match the one chosen at registration.
    #    New name: first answer "needs_registration", then create it once code + team are sent.
    if not USERNAME_RE.match(username):
        raise HTTPException(422, "Name: 2-32 characters: letters, digits, spaces, '.', '_' or '-'")
    d = s.exec(select(Driver).where(Driver.username == username.lower())).first()
    if d is not None:
        if not check_password(body.password, d.password_hash):
            raise HTTPException(401, "This name is already registered and the password doesn't match")
        return {"token": issue_token(s, d.id, False), "role": "driver", "driver": driver_public(d), "created": False}

    if len(body.password) < 4:
        raise HTTPException(422, "Choose a password of at least 4 characters")
    taken = {x.code: x.name for x in s.exec(select(Driver)).all()}
    if body.code is None or body.team is None:
        return {"needs_registration": True, "name": username, "suggested_code": suggest_code(username),
                "taken_codes": sorted(taken)}
    code = body.code.strip().upper()
    if not CODE_RE.match(code):
        raise HTTPException(422, "Driver code must be exactly 3 letters (A-Z)")
    if code in taken:
        raise HTTPException(409, f"Code {code} is already used by {taken[code]}. Pick another one.")
    if body.team not in config.TEAMS:
        raise HTTPException(422, "Pick a team")
    d = new_driver(s, username, body.password, code, body.team)
    return {"token": issue_token(s, d.id, False), "role": "driver", "driver": driver_public(d), "created": True}


@app.get("/api/auth/me")
def me(tok: AuthToken = Depends(get_auth), s: Session = Depends(get_session)):
    if tok.is_admin:
        return {"role": "admin", "driver": None, "admin_name": config.ADMIN_USERNAME}
    d = s.get(Driver, tok.driver_id)
    if not d:
        raise HTTPException(401, "Driver not found, please log in again")
    return {"role": "driver", "driver": driver_public(d)}


@app.post("/api/auth/logout")
def logout(tok: AuthToken = Depends(get_auth), s: Session = Depends(get_session)):
    s.delete(tok)
    s.commit()
    return {"ok": True}


# ------------------------------------------------------------------ driver

@app.get("/api/me/state")
def my_state(d: Driver = Depends(current_driver), s: Session = Depends(get_session)):
    t = now()
    timing = all_timing(s)
    drivers = {x.id: x for x in s.exec(select(Driver)).all()}
    sessions = [session_summary(s, d, n, timing[n], drivers, t) for n in config.SESSIONS]
    return {"driver": driver_public(d), "server_now": t, "sessions": sessions,
            "all_finished": all(x["state"] == "finished" for x in sessions), "max_points": max_points()}


@app.get("/api/sessions/{n}/board")
def session_board(n: int, d: Driver = Depends(current_driver), s: Session = Depends(get_session)):
    session_cfg(n)
    t = now()
    st = race_state(get_race(s, n), t)
    if st in ("pending", "lights"):
        raise HTTPException(409, "Session not started")
    run = ensure_run(s, d.id, n, t) if st == "running" else get_run(s, d.id, n)
    timing = SessionTiming(s, n)
    drivers = {x.id: x for x in s.exec(select(Driver)).all()}
    problems = load_problems()[n]
    progs = {p.problem_id: p for p in s.exec(
        select(Progress).where(Progress.driver_id == d.id, Progress.session == n)).all()}
    return {
        "server_now": t,
        "session": session_summary(s, d, n, timing, drivers, t),
        "current_problem_id": run.current_problem_id if run else None,
        "problems": [{**p.public(), "progress": progress_public(progs.get(p.id), p, timing)} for p in problems],
    }


@app.post("/api/sessions/{n}/focus")
def focus(n: int, body: FocusIn, d: Driver = Depends(current_driver), s: Session = Depends(get_session)):
    problem = get_problem(body.problem_id)
    if not problem or problem.session != n:
        raise HTTPException(404, "Problem not in this session")
    require_running(s, problem)
    t = now()
    run = ensure_run(s, d.id, n, t)
    if run.ended_at is None and run.current_problem_id != problem.id:
        switch_focus(s, run, problem.id, t)
        s.commit()
    return {"ok": True}


@app.post("/api/run")
def run_code(body: CodeIn, d: Driver = Depends(current_driver), s: Session = Depends(get_session)):
    problem = get_problem(body.problem_id)
    if not problem:
        raise HTTPException(404, "Problem not found")
    require_running(s, problem)
    s.close()  # don't hold a DB connection while code runs
    cases = [{"input": body.custom_input, "output": None}] if body.custom_input is not None else problem.examples
    results, engine_used = judge.execute(body.code, [c["input"] for c in cases], problem.time_limit)
    out = []
    for c, r in zip(cases, results):
        if c["output"] is None:
            verdict = "ran" if r.status == "ok" else r.status
        else:
            verdict = judge.verdict_for(r, c["output"])
        out.append({"input": c["input"], "expected": c["output"], "output": r.stdout, "stderr": r.stderr,
                    "verdict": verdict, "time": r.time})
    return {"engine": engine_used, "cases": out}


@app.post("/api/submit")
def submit(body: CodeIn, d: Driver = Depends(current_driver), s: Session = Depends(get_session)):
    t = now()
    problem = get_problem(body.problem_id)
    if not problem:
        raise HTTPException(404, "Problem not found")
    require_running(s, problem, grace=config.SUBMIT_GRACE_SEC)
    driver_id = d.id
    run = ensure_run(s, driver_id, problem.session, t)
    prog = get_progress(s, driver_id, problem)
    if prog.solved:
        raise HTTPException(409, "Already solved - move on to the next problem!")
    # The lap clock for this problem stops when Submit is pressed.
    if run.current_problem_id != problem.id:
        switch_focus(s, run, problem.id, t)
    lap_candidate = prog.active_seconds + (t - run.current_since if run.current_since is not None else 0)
    s.commit()
    s.close()

    results, engine_used = judge.execute(body.code, [tc["input"] for tc in problem.tests], problem.time_limit)
    verdicts = [judge.verdict_for(r, tc["output"]) for r, tc in zip(results, problem.tests)]
    passed = sum(v == judge.PASSED for v in verdicts)
    total = len(problem.tests)
    first_fail = next((v for v in verdicts if v != judge.PASSED), None)
    error_text = next((r.stderr for r, v in zip(results, verdicts)
                       if v in (judge.RUNTIME, judge.COMPILE) and r.stderr), "")
    overall = "accepted" if passed == total else first_fail
    ppp = config.SESSIONS[problem.session]["points_per_problem"]

    with _timing_lock, Session(engine) as s2:
        prog = get_progress(s2, driver_id, problem)
        run = get_run(s2, driver_id, problem.session)
        prog.attempts += 1
        prog.total_tests = total
        improved = passed > prog.best_passed
        if improved:
            prog.best_passed = passed
            prog.points = round(ppp * passed / total, 2)
            prog.improved_at = t
        newly_solved = passed == total and not prog.solved
        if newly_solved:
            prog.solved, prog.solved_at, prog.lap_seconds = True, t, round(lap_candidate, 3)
            if run.current_problem_id == problem.id:
                run.current_since = now()
            s2.add(run)
        s2.add(prog)
        s2.add(Submission(driver_id=driver_id, problem_id=problem.id, session=problem.session,
                          code=body.code, passed=passed, total=total, verdict=overall, created_at=t))
        s2.commit()
        problems = load_problems()[problem.session]
        solved_count = len(s2.exec(select(Progress).where(
            Progress.driver_id == driver_id, Progress.session == problem.session,
            Progress.solved == True)).all())  # noqa: E712
        session_complete = solved_count == len(problems)
        if session_complete and run.ended_at is None:
            switch_focus(s2, run, None, now())
            run.ended_at = now()
            s2.add(run)
            s2.commit()
        s2.refresh(prog)
        timing = SessionTiming(s2, problem.session)
        return {
            "engine": engine_used,
            "verdict": overall,
            "passed": passed,
            "total": total,
            "tests": [{"n": i + 1, "verdict": v, "time": r.time} for i, (v, r) in enumerate(zip(verdicts, results))],
            "error": error_text[:2000],
            "points_this_run": round(ppp * passed / total, 2),
            "improved": improved,
            "newly_solved": newly_solved,
            "session_complete": session_complete,
            "progress": progress_public(prog, problem, timing),
        }


@app.get("/api/me/results")
def my_results(d: Driver = Depends(current_driver), s: Session = Depends(get_session)):
    t = now()
    table = build_standings(s)
    mine = dict(next(r for r in table["rows"] if r["driver"]["id"] == d.id))
    for hidden in ("pos", "gap"):  # no ranking information for drivers
        mine.pop(hidden, None)
    timing = all_timing(s)
    drivers = {x.id: x for x in s.exec(select(Driver)).all()}
    progs = {p.problem_id: p for p in s.exec(select(Progress).where(Progress.driver_id == d.id)).all()}
    sessions = []
    for n, items in load_problems().items():
        summ = session_summary(s, d, n, timing[n], drivers, t)
        summ["problems"] = [{"id": p.id, "order": p.order, "title": p.title,
                             **progress_public(progs.get(p.id), p, timing[n])} for p in items]
        sessions.append(summ)
    return {"driver": driver_public(d), "standing": mine, "sessions": sessions, "max_points": max_points()}


# ------------------------------------------------------------------ admin (Race Control)

@app.get("/api/admin/overview", dependencies=[Depends(require_admin)])
def admin_overview(s: Session = Depends(get_session)):
    t = now()
    timing = all_timing(s)
    drivers = {x.id: x for x in s.exec(select(Driver)).all()}
    progs = s.exec(select(Progress)).all()
    sessions = []
    for n, items in load_problems().items():
        summ = session_summary(s, None, n, timing[n], drivers, t)
        summ["joined"] = len(s.exec(select(SessionRun).where(SessionRun.session == n)).all())
        stats = []
        for p in items:
            pp = [x for x in progs if x.problem_id == p.id]
            solved = [x for x in pp if x.solved and x.lap_seconds is not None]
            best = min(solved, key=lambda x: (x.lap_seconds, x.solved_at or 0), default=None)
            stats.append({
                "id": p.id, "order": p.order, "title": p.title,
                "attempted": sum(1 for x in pp if x.attempts > 0),
                "solved": len(solved),
                "best_lap": best.lap_seconds if best else None,
                "best_code": drivers[best.driver_id].code if best and best.driver_id in drivers else None,
            })
        summ["problems"] = stats
        sessions.append(summ)
    return {"server_now": t, "sessions": sessions, "drivers": len(drivers), "standings": build_standings(s)}


@app.post("/api/admin/sessions/{n}/start", dependencies=[Depends(require_admin)])
def admin_start(n: int, s: Session = Depends(get_session)):
    cfg = session_cfg(n)
    t = now()
    if get_race(s, n):
        raise HTTPException(409, f"{cfg['name']} has already been started")
    for m in config.SESSIONS:
        st = race_state(get_race(s, m), t)
        if m < n and st != "finished":
            raise HTTPException(409, f"Finish {config.SESSIONS[m]['name']} first")
        if st in ("lights", "running"):
            raise HTTPException(409, f"{config.SESSIONS[m]['name']} is still running")
    lights_start = t + config.LIGHTS_LEAD_SEC
    # Five lights at 0,1,2,3,4 s, then a random hold before they all go out.
    lights_out = lights_start + 4 + random.uniform(*config.LIGHTS_HOLD_SEC)
    rs = RaceSession(n=n, lights_start=lights_start, lights_out=lights_out,
                     deadline=lights_out + cfg["duration_min"] * 60)
    s.add(rs)
    s.commit()
    log.info("%s started by Race Control", cfg["name"])
    return race_public(rs, t)


@app.post("/api/admin/sessions/{n}/extend", dependencies=[Depends(require_admin)])
def admin_extend(n: int, body: ExtendIn, s: Session = Depends(get_session)):
    session_cfg(n)
    rs = get_race(s, n)
    t = now()
    if race_state(rs, t) not in ("lights", "running"):
        raise HTTPException(409, "Only a running session can be extended")
    rs.deadline = max(t + 10, rs.deadline + body.seconds)
    s.add(rs)
    s.commit()
    return race_public(rs, t)


@app.post("/api/admin/sessions/{n}/end", dependencies=[Depends(require_admin)])
def admin_end(n: int, s: Session = Depends(get_session)):
    session_cfg(n)
    rs = get_race(s, n)
    t = now()
    if race_state(rs, t) not in ("lights", "running"):
        raise HTTPException(409, "This session is not running")
    rs.ended_at = t
    s.add(rs)
    s.commit()
    return race_public(rs, t)


@app.post("/api/admin/reset", dependencies=[Depends(require_admin)])
def admin_reset(body: ResetIn, s: Session = Depends(get_session)):
    if body.confirm != "RESET":
        raise HTTPException(422, "Type RESET to confirm")
    for model in (Submission, Progress, SessionRun, RaceSession):
        s.exec(delete(model))
    if not body.keep_drivers:
        s.exec(delete(AuthToken).where(AuthToken.is_admin == False))  # noqa: E712
        s.exec(delete(Driver))
    s.commit()
    log.warning("Event reset by Race Control (keep_drivers=%s)", body.keep_drivers)
    return {"ok": True}


@app.delete("/api/admin/drivers/{driver_id}", dependencies=[Depends(require_admin)])
def admin_delete_driver(driver_id: int, s: Session = Depends(get_session)):
    d = s.get(Driver, driver_id)
    if not d:
        raise HTTPException(404, "Driver not found")
    for model in (Submission, Progress, SessionRun):
        s.exec(delete(model).where(model.driver_id == driver_id))
    s.exec(delete(AuthToken).where(AuthToken.driver_id == driver_id))
    s.delete(d)
    s.commit()
    return {"ok": True}
