"""Session clock, live timing colours and the championship table."""
import time
from typing import Optional

from sqlmodel import Session, select

from . import config
from .db import Driver, Progress, RaceSession
from .problems import load_problems


def now() -> float:
    return time.time()


# ------------------------------------------------------------------ global session clock

def race_state(rs: Optional[RaceSession], t: Optional[float] = None) -> str:
    """pending -> lights -> running -> finished"""
    t = now() if t is None else t
    if rs is None:
        return "pending"
    if rs.ended_at is not None or t >= rs.deadline:
        return "finished"
    if t < rs.lights_out:
        return "lights"
    return "running"


def end_time(rs: RaceSession) -> float:
    return min(rs.deadline, rs.ended_at) if rs.ended_at is not None else rs.deadline


def get_race(s: Session, n: int) -> Optional[RaceSession]:
    return s.get(RaceSession, n)


# ------------------------------------------------------------------ live colours

def _lap_key(p: Progress):
    # Equal times: whoever set it first keeps it.
    return (p.lap_seconds, p.solved_at or 0, p.id or 0)


class SessionTiming:
    """Colours for one session, recomputed from all solved laps.

    - purple: the single fastest lap of the session, by anyone
    - green:  a driver's personal best lap in the session (exactly one per driver)
    - yellow: every other lap
    """

    def __init__(self, s: Session, n: int):
        self.n = n
        self.laps = [p for p in s.exec(select(Progress).where(Progress.session == n, Progress.solved == True)).all()  # noqa: E712
                     if p.lap_seconds is not None]
        self.fastest: Optional[Progress] = min(self.laps, key=_lap_key) if self.laps else None
        best_by_driver: dict[int, Progress] = {}
        for p in self.laps:
            cur = best_by_driver.get(p.driver_id)
            if cur is None or _lap_key(p) < _lap_key(cur):
                best_by_driver[p.driver_id] = p
        self.personal_best = best_by_driver
        self.colors: dict[tuple[int, str], str] = {}
        for p in self.laps:
            if self.fastest is not None and p.id == self.fastest.id:
                c = "purple"
            elif best_by_driver[p.driver_id].id == p.id:
                c = "green"
            else:
                c = "yellow"
            self.colors[(p.driver_id, p.problem_id)] = c

    def color(self, driver_id: int, problem_id: str) -> Optional[str]:
        return self.colors.get((driver_id, problem_id))

    def holds_fastest(self, driver_id: int) -> bool:
        return self.fastest is not None and self.fastest.driver_id == driver_id

    def bonus(self, driver_id: int) -> int:
        return config.FASTEST_LAP_BONUS.get(self.n, 0) if self.holds_fastest(driver_id) else 0

    def fastest_public(self, drivers: dict[int, Driver]) -> Optional[dict]:
        if not self.fastest:
            return None
        d = drivers.get(self.fastest.driver_id)
        return {"lap": self.fastest.lap_seconds, "problem_id": self.fastest.problem_id,
                "driver_id": self.fastest.driver_id, "code": d.code if d else "???",
                "name": d.name if d else "?", "color": d.color if d else "#888"}


def all_timing(s: Session) -> dict[int, SessionTiming]:
    return {n: SessionTiming(s, n) for n in config.SESSIONS}


def max_points() -> dict:
    probs = load_problems()
    problems = sum(c["points_per_problem"] * len(probs[n]) for n, c in config.SESSIONS.items())
    bonus = sum(config.FASTEST_LAP_BONUS.values())
    return {"problems": problems, "bonus": bonus, "total": problems + bonus}


# ------------------------------------------------------------------ standings

def session_time(progs: list[Progress], rs: Optional[RaceSession]) -> float:
    """How long the driver needed for their score in this session: from lights out to the
    submission that reached their final points (0 if they scored nothing)."""
    if rs is None:
        return 0.0
    marks = [p.improved_at for p in progs if p.points > 0 and p.improved_at is not None]
    return round(max(0.0, max(marks) - rs.lights_out), 3) if marks else 0.0


def build_standings(s: Session) -> dict:
    t = now()
    drivers = {d.id: d for d in s.exec(select(Driver)).all()}
    progs = s.exec(select(Progress)).all()
    timing = all_timing(s)
    races = {n: get_race(s, n) for n in config.SESSIONS}
    states = {n: race_state(races[n], t) for n in config.SESSIONS}
    by_driver: dict[int, list[Progress]] = {}
    for p in progs:
        by_driver.setdefault(p.driver_id, []).append(p)

    rows = []
    for d in drivers.values():
        ps = by_driver.get(d.id, [])
        per = {}
        for n in config.SESSIONS:
            sp = [p for p in ps if p.session == n]
            pb = timing[n].personal_best.get(d.id)
            per[str(n)] = {
                "points": round(sum(p.points for p in sp), 2),
                "bonus": timing[n].bonus(d.id),
                "solved": sum(1 for p in sp if p.solved),
                "best_lap": pb.lap_seconds if pb else None,
                "fastest_lap": timing[n].holds_fastest(d.id),
                "state": states[n],
                "time": session_time(sp, races[n]),
            }
        laps = [p.lap_seconds for p in ps if p.solved and p.lap_seconds is not None]
        problem_pts = round(sum(p.points for p in ps), 2)
        bonus = sum(v["bonus"] for v in per.values())
        rows.append({
            "driver": {"id": d.id, "name": d.name, "code": d.code, "number": d.number, "color": d.color,
                       "team": d.team, "team_name": config.TEAMS.get(d.team, {}).get("name", "")},
            "sessions": per,
            "problem_points": problem_pts,
            "bonus": bonus,
            "total": round(problem_pts + bonus, 2),
            "solved": sum(1 for p in ps if p.solved),
            "best_lap": min(laps) if laps else None,
            "total_lap_time": round(sum(laps), 3),
            "time": round(sum(v["time"] for v in per.values()), 3),
            "fastest_laps": sum(1 for v in per.values() if v["fastest_lap"]),
        })
    # Points (fastest-lap bonus included) first; tie -> less total time; then fastest lap; then name.
    rows.sort(key=lambda r: (-r["total"], r["time"], r["best_lap"] or 1e12, r["driver"]["name"].lower()))
    leader = rows[0]["total"] if rows else 0
    for i, r in enumerate(rows, 1):
        r["pos"] = i
        r["gap"] = round(leader - r["total"], 2)
    return {
        "server_now": t,
        "rows": rows,
        "max_points": max_points(),
        "fastest_laps": {str(n): timing[n].fastest_public(drivers) for n in config.SESSIONS},
        "states": {str(n): states[n] for n in config.SESSIONS},
    }
