"""Loads problems from problems/q1, problems/q2, problems/q3 (one JSON file per problem)."""
import json
from dataclasses import dataclass, field

from .config import DEFAULT_TIME_LIMIT_SEC, PROBLEMS_DIR, SESSIONS


@dataclass
class Problem:
    id: str
    session: int
    order: int
    title: str
    difficulty: str
    statement: str
    input_format: str
    output_format: str
    constraints: list[str]
    examples: list[dict]
    tests: list[dict]
    starter_code: str
    time_limit: float = DEFAULT_TIME_LIMIT_SEC
    notes: str = ""
    extra: dict = field(default_factory=dict)

    def public(self) -> dict:
        """Everything a student may see (no hidden tests)."""
        return {
            "id": self.id,
            "session": self.session,
            "order": self.order,
            "title": self.title,
            "difficulty": self.difficulty,
            "statement": self.statement,
            "input_format": self.input_format,
            "output_format": self.output_format,
            "constraints": self.constraints,
            "examples": self.examples,
            "notes": self.notes,
            "starter_code": self.starter_code,
            "time_limit": self.time_limit,
            "tests_count": len(self.tests),
            "max_points": SESSIONS[self.session]["points_per_problem"],
        }


_cache: dict[int, list[Problem]] | None = None


def load_problems(force: bool = False) -> dict[int, list[Problem]]:
    global _cache
    if _cache is not None and not force:
        return _cache
    result: dict[int, list[Problem]] = {}
    for n in SESSIONS:
        folder = PROBLEMS_DIR / f"q{n}"
        items: list[Problem] = []
        for path in sorted(folder.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            tests = data.get("tests", [])
            missing = [i for i, t in enumerate(tests, 1) if "output" not in t]
            if missing:
                raise ValueError(f"{path.name}: tests {missing} have no 'output'. Run tools/fill_outputs.py first.")
            items.append(
                Problem(
                    id=data.get("id", path.stem),
                    session=n,
                    order=data.get("order", len(items) + 1),
                    title=data["title"],
                    difficulty=data.get("difficulty", SESSIONS[n]["label"]),
                    statement=data["statement"],
                    input_format=data.get("input_format", ""),
                    output_format=data.get("output_format", ""),
                    constraints=data.get("constraints", []),
                    examples=data.get("examples", []),
                    tests=tests,
                    starter_code=data.get("starter_code", "# Read input with input() and print the answer\n"),
                    time_limit=float(data.get("time_limit", DEFAULT_TIME_LIMIT_SEC)),
                    notes=data.get("notes", ""),
                )
            )
        items.sort(key=lambda p: p.order)
        ids = [p.id for p in items]
        if len(ids) != len(set(ids)):
            raise ValueError(f"Duplicate problem ids in {folder}")
        result[n] = items
    _cache = result
    return result


def get_problem(problem_id: str) -> Problem | None:
    for items in load_problems().values():
        for p in items:
            if p.id == problem_id:
                return p
    return None
