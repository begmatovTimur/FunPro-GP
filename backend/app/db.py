from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Session, SQLModel, create_engine

from .config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30})


class Driver(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    code: str  # 3-letter code like "ANT"
    number: int
    color: str  # team colour, hex
    created_at: float


class SessionRun(SQLModel, table=True):
    """One driver's run through one qualifying session."""

    __table_args__ = (UniqueConstraint("driver_id", "session"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    driver_id: int = Field(index=True, foreign_key="driver.id")
    session: int
    started_at: float
    deadline: float
    ended_at: Optional[float] = None
    # Which problem the driver currently has open, and since when (for lap timing).
    current_problem_id: Optional[str] = None
    current_since: Optional[float] = None


class Progress(SQLModel, table=True):
    """A driver's state on one problem."""

    __table_args__ = (UniqueConstraint("driver_id", "problem_id"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    driver_id: int = Field(index=True, foreign_key="driver.id")
    problem_id: str = Field(index=True)
    session: int
    best_passed: int = 0
    total_tests: int = 0
    points: float = 0
    attempts: int = 0
    active_seconds: float = 0  # time spent with this problem open
    solved: bool = False
    solved_at: Optional[float] = None
    lap_seconds: Optional[float] = None
    color: Optional[str] = None  # purple | green | yellow (fixed at the moment of solving)


class Submission(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    driver_id: int = Field(index=True, foreign_key="driver.id")
    problem_id: str
    session: int
    code: str
    passed: int
    total: int
    verdict: str
    created_at: float


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    with engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA journal_mode=WAL")


def get_session():
    with Session(engine) as s:
        yield s
