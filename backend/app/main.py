import logging
import re
import threading
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from . import config, judge
from .db import Driver, Progress, SessionRun, Submission, engine, get_session, init_db
from .problems import Problem, get_problem, load_problems

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("funprogp")

# Serialises the "record a solve + decide its colour" step so two simultaneous solves
# can't both be purple.
_timing_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    probs = load_problems()
    for n, items in probs.items():
        log.info("%s: %d problems loaded", config.SESSIONS[n]["name"], len(items))
    log.info("Judge: %s", judge.judge_status())
    yield


app = FastAPI(title="FunPro GP", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def now() -> float:
    return time.time()


# ------------------------------------------------------------------ helpers

def get_driver(s: Session, driver_id: int) -> Driver:
    d = s.get(Driver, driver_id)
    if not d:
        raise HTTPException(404, "Driver not found")
    return d


def session_cfg(n: int) -> dict:
    if n not in config.SESSIONS:
        raise HTTPException(404, "No such session")
    return config.SESSIONS[n]


def get_run(s: Session, driver_id: int, n: int) -> Optional[SessionRun]:
    return s.exec(select(SessionRun).where(SessionRun.driver_id == driver_id, SessionRun.session == n)).first()


def get_progress(s: Session, driver_id: int, problem: Problem, create: bool = True) -> Optional[Progress]:
    p = s.exec(select(Progress).where(Progress.driver_id == driver_id, Progress.problem_id == problem.id)).first()
    if p is None and create:
        p = Progress(driver_id=driver_id, problem_id=problem.id, session=problem.session, total_tests=len(problem.tests))
        s.add(p)
    return p


def switch_focus(s: Session, run: SessionRun, problem_id: Optional[str], t: float) -> None:
    """Close the timing interval of the currently open problem and open a new one."""
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


def finish_run(s: Session, run: SessionRun, t: float) -> None:
    if run.ended_at is None:
        end = min(t, run.deadline)
        switch_focus(s, run, None, end)
        run.ended_at = end
        s.add(run)


def refresh_run(s: Session, run: Optional[SessionRun]) -> Optional[SessionRun]:
    """Auto-finish a run whose clock has run out."""
    if run and run.ended_at is None and now() >= run.deadline:
        finish_run(s, run, run.deadline)
        s.commit()
        s.refresh(run)
    return run


def session_status(s: Session, driver_id: int, n: int) -> tuple[str, Optional[SessionRun]]:
    run = refresh_run(s, get_run(s, driver_id, n))
    if run:
        return ("finished" if run.ended_at is not None else "running"), run
    if n == 1:
        return "ready", None
    prev_status, _ = session_status(s, driver_id, n - 1)
    return ("ready" if prev_status == "finished" else "locked"), None


def session_summary(s: Session, driver_id: int, n: int) -> dict:
    cfg = config.SESSIONS[n]
    problems = load_problems()[n]
    status, run = session_status(s, driver_id, n)
    progs = s.exec(select(Progress).where(Progress.driver_id == driver_id, Progress.session == n)).all()
    laps = [p.lap_seconds for p in progs if p.solved and p.lap_seconds is not None]
    return {
        "n": n,
        "name": cfg["name"],
        "label": cfg["label"],
        "duration_sec": cfg["duration_min"] * 60,
        "points_per_problem": cfg["points_per_problem"],
        "problems_count": len(problems),
        "max_points": cfg["points_per_problem"] * len(problems),
        "status": status,
        "started_at": run.started_at if run else None,
        "deadline": run.deadline if run else None,
        "ended_at": run.ended_at if run else None,
        "points": round(sum(p.points for p in progs), 2),
        "solved": sum(1 for p in progs if p.solved),
        "best_lap": min(laps) if laps else None,
        "colors": {c: sum(1 for p in progs if p.color == c) for c in ("purple", "green", "yellow")},
    }


def driver_public(d: Driver) -> dict:
    return {"id": d.id, "name": d.name, "code": d.code, "number": d.number, "color": d.color}


def progress_public(p: Optional[Progress], problem: Problem) -> dict:
    if p is None:
        return {"best_passed": 0, "total_tests": len(problem.tests), "points": 0, "attempts": 0,
                "solved": False, "lap_seconds": None, "color": None}
    return {"best_passed": p.best_passed, "total_tests": p.total_tests or len(problem.tests), "points": p.points,
            "attempts": p.attempts, "solved": p.solved, "lap_seconds": p.lap_seconds, "color": p.color}


def require_running(s: Session, driver_id: int, problem: Problem, grace: float = 0) -> SessionRun:
    run = get_run(s, driver_id, problem.session)
    if not run:
        raise HTTPException(409, "This session has not started yet")
    if run.ended_at is not None or now() > run.deadline + grace:
        refresh_run(s, run)
        raise HTTPException(409, "Chequered flag - this session is over")
    return run


# ------------------------------------------------------------------ schemas

class DriverIn(BaseModel):
    name: str = Field(min_length=2, max_length=40)
    code: Optional[str] = None
    number: int = Field(ge=1, le=99)
    color: str = "#e10600"


class DriverRef(BaseModel):
    driver_id: int


class FocusIn(BaseModel):
    driver_id: int
    problem_id: str


class CodeIn(BaseModel):
    driver_id: int
    problem_id: str
    code: str = Field(max_length=config.MAX_CODE_CHARS)
    custom_input: Optional[str] = None


# ------------------------------------------------------------------ routes

@app.get("/api/health")
def health():
    return {"ok": True, "server_now": now(), "judge": judge.judge_status()}


@app.get("/api/config")
def get_config():
    probs = load_problems()
    return {
        "sessions": [
            {"n": n, "name": c["name"], "label": c["label"], "duration_sec": c["duration_min"] * 60,
             "points_per_problem": c["points_per_problem"], "problems_count": len(probs[n]),
             "max_points": c["points_per_problem"] * len(probs[n])}
            for n, c in config.SESSIONS.items()
        ],
        "purple_scope": config.PURPLE_SCOPE,
    }


@app.post("/api/drivers")
def create_driver(body: DriverIn, s: Session = Depends(get_session)):
    name = " ".join(body.name.split())
    code = (body.code or "").strip().upper()
    if not code:
        letters = re.sub(r"[^A-Za-z]", "", name.split()[-1])
        code = (letters[:3] or "DRV").upper().ljust(3, "X")
    if not re.fullmatch(r"[A-Z]{3}", code):
        raise HTTPException(422, "Driver code must be exactly 3 letters")
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", body.color):
        raise HTTPException(422, "Colour must look like #RRGGBB")
    d = Driver(name=name, code=code, number=body.number, color=body.color, created_at=now())
    s.add(d)
    s.commit()
    s.refresh(d)
    return driver_public(d)


@app.get("/api/drivers/{driver_id}/state")
def driver_state(driver_id: int, s: Session = Depends(get_session)):
    d = get_driver(s, driver_id)
    sessions = [session_summary(s, driver_id, n) for n in config.SESSIONS]
    return {
        "driver": driver_public(d),
        "server_now": now(),
        "sessions": sessions,
        "all_finished": all(x["status"] == "finished" for x in sessions),
    }


@app.post("/api/sessions/{n}/start")
def start_session(n: int, body: DriverRef, s: Session = Depends(get_session)):
    cfg = session_cfg(n)
    get_driver(s, body.driver_id)
    status, run = session_status(s, body.driver_id, n)
    if status == "locked":
        raise HTTPException(409, f"Finish {config.SESSIONS[n - 1]['name']} first")
    if run is None:
        t = now()
        problems = load_problems()[n]
        run = SessionRun(
            driver_id=body.driver_id, session=n, started_at=t, deadline=t + cfg["duration_min"] * 60,
            current_problem_id=problems[0].id if problems else None, current_since=t,
        )
        s.add(run)
        s.commit()
    return session_summary(s, body.driver_id, n)


@app.get("/api/sessions/{n}/board")
def session_board(n: int, driver_id: int, s: Session = Depends(get_session)):
    session_cfg(n)
    get_driver(s, driver_id)
    status, run = session_status(s, driver_id, n)
    if status in ("locked", "ready"):
        raise HTTPException(409, "Session not started")
    problems = load_problems()[n]
    progs = {p.problem_id: p for p in s.exec(
        select(Progress).where(Progress.driver_id == driver_id, Progress.session == n)).all()}
    return {
        "server_now": now(),
        "session": session_summary(s, driver_id, n),
        "current_problem_id": run.current_problem_id,
        "problems": [{**p.public(), "progress": progress_public(progs.get(p.id), p)} for p in problems],
    }


@app.post("/api/sessions/{n}/focus")
def focus(n: int, body: FocusIn, s: Session = Depends(get_session)):
    problem = get_problem(body.problem_id)
    if not problem or problem.session != n:
        raise HTTPException(404, "Problem not in this session")
    run = require_running(s, body.driver_id, problem)
    if run.current_problem_id != problem.id:
        switch_focus(s, run, problem.id, now())
        s.commit()
    return {"ok": True}


@app.post("/api/sessions/{n}/finish")
def finish_session(n: int, body: DriverRef, s: Session = Depends(get_session)):
    session_cfg(n)
    run = get_run(s, body.driver_id, n)
    if not run:
        raise HTTPException(409, "Session not started")
    finish_run(s, run, now())
    s.commit()
    return session_summary(s, body.driver_id, n)


@app.post("/api/run")
def run_code(body: CodeIn, s: Session = Depends(get_session)):
    problem = get_problem(body.problem_id)
    if not problem:
        raise HTTPException(404, "Problem not found")
    get_driver(s, body.driver_id)
    require_running(s, body.driver_id, problem)
    s.close()  # don't hold a DB connection while code runs

    if body.custom_input is not None:
        cases = [{"input": body.custom_input, "output": None}]
    else:
        cases = problem.examples
    results, engine_used = judge.execute(body.code, [c["input"] for c in cases], problem.time_limit)
    out = []
    for c, r in zip(cases, results):
        verdict = r.status if c["output"] is None and r.status != "ok" else (
            "ran" if c["output"] is None else judge.verdict_for(r, c["output"]))
        out.append({"input": c["input"], "expected": c["output"], "output": r.stdout, "stderr": r.stderr,
                    "verdict": verdict, "time": r.time})
    return {"engine": engine_used, "cases": out}


@app.post("/api/submit")
def submit(body: CodeIn, s: Session = Depends(get_session)):
    t = now()
    problem = get_problem(body.problem_id)
    if not problem:
        raise HTTPException(404, "Problem not found")
    get_driver(s, body.driver_id)
    run = require_running(s, body.driver_id, problem, grace=config.SUBMIT_GRACE_SEC)
    prog = get_progress(s, body.driver_id, problem)
    if prog.solved:
        raise HTTPException(409, "Already solved - move on to the next problem!")
    # Stop the clock for this problem at the moment Submit was pressed.
    if run.current_problem_id != problem.id:
        switch_focus(s, run, problem.id, t)
    lap_candidate = prog.active_seconds + (t - run.current_since if run.current_since is not None else 0)
    s.commit()
    s.close()

    inputs = [tc["input"] for tc in problem.tests]
    results, engine_used = judge.execute(body.code, inputs, problem.time_limit)
    verdicts = [judge.verdict_for(r, tc["output"]) for r, tc in zip(results, problem.tests)]
    passed = sum(v == judge.PASSED for v in verdicts)
    total = len(problem.tests)
    first_fail = next((v for v in verdicts if v != judge.PASSED), None)
    error_text = next((r.stderr for r, v in zip(results, verdicts) if v in (judge.RUNTIME, judge.COMPILE) and r.stderr), "")
    overall = "accepted" if passed == total else first_fail
    ppp = config.SESSIONS[problem.session]["points_per_problem"]

    with _timing_lock, Session(engine) as s2:
        prog = get_progress(s2, body.driver_id, problem)
        run = get_run(s2, body.driver_id, problem.session)
        prog.attempts += 1
        prog.total_tests = total
        improved = passed > prog.best_passed
        if improved:
            prog.best_passed = passed
            prog.points = round(ppp * passed / total, 2)
        newly_solved = passed == total and not prog.solved
        if newly_solved:
            lap = round(lap_candidate, 3)
            scope = select(Progress).where(Progress.session == problem.session, Progress.solved == True)  # noqa: E712
            if config.PURPLE_SCOPE == "problem":
                scope = scope.where(Progress.problem_id == problem.id)
            record = min((p.lap_seconds for p in s2.exec(scope).all() if p.lap_seconds is not None), default=None)
            personal = min((p.lap_seconds for p in s2.exec(
                select(Progress).where(Progress.driver_id == body.driver_id, Progress.session == problem.session,
                                       Progress.solved == True)).all() if p.lap_seconds is not None),  # noqa: E712
                default=None)
            if record is None or lap < record:
                color = "purple"
            elif personal is None or lap < personal:
                color = "green"
            else:
                color = "yellow"
            prog.solved, prog.solved_at, prog.lap_seconds, prog.color = True, t, lap, color
            if run.current_problem_id == problem.id:
                run.current_since = now()  # stop counting time on a solved problem
            s2.add(run)
        s2.add(prog)
        s2.add(Submission(driver_id=body.driver_id, problem_id=problem.id, session=problem.session,
                          code=body.code, passed=passed, total=total, verdict=overall, created_at=t))
        s2.commit()
        # All problems of the session solved -> session complete.
        problems = load_problems()[problem.session]
        solved_count = len(s2.exec(select(Progress).where(
            Progress.driver_id == body.driver_id, Progress.session == problem.session,
            Progress.solved == True)).all())  # noqa: E712
        session_complete = solved_count == len(problems)
        if session_complete:
            finish_run(s2, run, now())
            s2.commit()
        s2.refresh(prog)
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
            "progress": progress_public(prog, problem),
        }


def build_standings(s: Session) -> list[dict]:
    drivers = s.exec(select(Driver)).all()
    progs = s.exec(select(Progress)).all()
    by_driver: dict[int, list[Progress]] = {}
    for p in progs:
        by_driver.setdefault(p.driver_id, []).append(p)
    runs = s.exec(select(SessionRun)).all()
    run_map = {(r.driver_id, r.session): r for r in runs}
    t = now()
    rows = []
    for d in drivers:
        ps = by_driver.get(d.id, [])
        per = {}
        for n in config.SESSIONS:
            sp = [p for p in ps if p.session == n]
            laps = [p.lap_seconds for p in sp if p.solved and p.lap_seconds is not None]
            r = run_map.get((d.id, n))
            status = "not_started" if r is None else ("finished" if (r.ended_at or t >= r.deadline) else "running")
            per[n] = {"points": round(sum(p.points for p in sp), 2), "solved": sum(p.solved for p in sp),
                      "best_lap": min(laps) if laps else None, "status": status}
        laps_all = [p.lap_seconds for p in ps if p.solved and p.lap_seconds is not None]
        rows.append({
            "driver": driver_public(d),
            "sessions": per,
            "total": round(sum(p.points for p in ps), 2),
            "solved": sum(p.solved for p in ps),
            "best_lap": min(laps_all) if laps_all else None,
            "total_lap_time": round(sum(laps_all), 3),
            "purple": sum(p.color == "purple" for p in ps),
        })
    # Points first; tie -> less total solving time; then fastest single lap.
    rows.sort(key=lambda r: (-r["total"], r["total_lap_time"] if r["solved"] else 1e12,
                             r["best_lap"] or 1e12, r["driver"]["name"]))
    leader = rows[0]["total"] if rows else 0
    for i, r in enumerate(rows, 1):
        r["pos"] = i
        r["gap"] = round(leader - r["total"], 2)
    return rows


@app.get("/api/standings")
def standings(s: Session = Depends(get_session)):
    rows = build_standings(s)
    return {"server_now": now(), "rows": rows,
            "max_points": sum(c["points_per_problem"] * len(load_problems()[n]) for n, c in config.SESSIONS.items())}


@app.get("/api/drivers/{driver_id}/results")
def driver_results(driver_id: int, s: Session = Depends(get_session)):
    d = get_driver(s, driver_id)
    rows = build_standings(s)
    me = next(r for r in rows if r["driver"]["id"] == driver_id)
    progs = {p.problem_id: p for p in s.exec(select(Progress).where(Progress.driver_id == driver_id)).all()}
    sessions = []
    for n, items in load_problems().items():
        summ = session_summary(s, driver_id, n)
        summ["problems"] = [{"id": p.id, "order": p.order, "title": p.title,
                             **progress_public(progs.get(p.id), p)} for p in items]
        sessions.append(summ)
    return {"driver": driver_public(d), "standing": me, "field_size": len(rows), "sessions": sessions,
            "max_points": sum(x["max_points"] for x in sessions)}
