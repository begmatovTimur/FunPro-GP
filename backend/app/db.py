import logging
import time
from pathlib import Path
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Session, SQLModel, create_engine

from .config import DATABASE_URL

log = logging.getLogger("db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30})


class Driver(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)  # stored lower-case
    password_hash: str
    name: str  # shown on screens (the username as typed)
    code: str  # 3-letter code like "ANT"
    number: int
    color: str  # team colour, hex
    team: str = ""  # team id from config.TEAMS
    created_at: float


class AuthToken(SQLModel, table=True):
    token: str = Field(primary_key=True)
    driver_id: Optional[int] = Field(default=None, index=True)  # None for the admin
    is_admin: bool = False
    created_at: float


class RaceSession(SQLModel, table=True):
    """Global state of a qualifying session, controlled by the admin. Same clock for everyone."""

    n: int = Field(primary_key=True)
    lights_start: float  # first red light comes on
    lights_out: float  # the clock starts here
    deadline: float  # chequered flag (admin can extend)
    ended_at: Optional[float] = None  # set when the admin ends the session early


class SessionRun(SQLModel, table=True):
    """One driver's participation in one session (for lap timing)."""

    __table_args__ = (UniqueConstraint("driver_id", "session"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    driver_id: int = Field(index=True)
    session: int
    joined_at: float
    ended_at: Optional[float] = None  # set when the driver has solved everything
    current_problem_id: Optional[str] = None
    current_since: Optional[float] = None


class Progress(SQLModel, table=True):
    """A driver's state on one problem. Colours are NOT stored: they are recomputed live."""

    __table_args__ = (UniqueConstraint("driver_id", "problem_id"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    driver_id: int = Field(index=True)
    problem_id: str = Field(index=True)
    session: int = Field(index=True)
    best_passed: int = 0
    total_tests: int = 0
    points: float = 0
    attempts: int = 0
    active_seconds: float = 0
    solved: bool = False
    solved_at: Optional[float] = None
    lap_seconds: Optional[float] = None
    improved_at: Optional[float] = None  # when the current best score on this problem was reached


class Submission(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    driver_id: int = Field(index=True)
    problem_id: str
    session: int
    code: str
    passed: int
    total: int
    verdict: str
    created_at: float


def _schema_outdated() -> bool:
    with engine.connect() as conn:
        tables = {r[0] for r in conn.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'")}
        if "driver" not in tables:
            return False
        cols = {r[1] for r in conn.exec_driver_sql("PRAGMA table_info(driver)")}
        return "username" not in cols or "racesession" not in tables


# Columns added after the first login version. Added in place, so existing data is kept.
_NEW_COLUMNS = {
    "driver": {"team": "VARCHAR NOT NULL DEFAULT ''"},
    "progress": {"improved_at": "FLOAT"},
}


def _add_missing_columns() -> None:
    with engine.begin() as conn:
        for table, cols in _NEW_COLUMNS.items():
            have = {r[1] for r in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
            for name, ddl in cols.items():
                if name not in have:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
                    log.info("Added column %s.%s", table, name)
        # Old rows: the best score was reached at the solve time (or unknown).
        conn.exec_driver_sql("UPDATE progress SET improved_at = solved_at WHERE improved_at IS NULL AND solved_at IS NOT NULL")


def init_db() -> None:
    # A database from the previous version (no logins) is moved aside, not deleted.
    if DATABASE_URL.startswith("sqlite:///") and _schema_outdated():
        engine.dispose()
        path = Path(DATABASE_URL.removeprefix("sqlite:///"))
        backup = path.with_name(f"{path.stem}.old-{int(time.time())}.db")
        for suffix in ("", "-wal", "-shm"):
            src = Path(str(path) + suffix)
            if src.exists():
                src.rename(Path(str(backup) + suffix))
        log.warning("Old database format: moved it to %s and started a fresh one", backup.name)
    SQLModel.metadata.create_all(engine)
    _add_missing_columns()
    with engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA journal_mode=WAL")


def get_session():
    with Session(engine) as s:
        yield s
