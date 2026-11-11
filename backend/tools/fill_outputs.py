"""Fill in expected outputs of a problem by running its reference solution.

Usage (from the backend folder):
    python tools/fill_outputs.py problems/q1/01-race-distance.json problems/solutions/q1-race-distance.py
    python tools/fill_outputs.py --all            # every problem that has problems/solutions/<id>.py

Write only the "input" of each example/test in the JSON; this script adds "output".
Existing outputs are overwritten, so re-run it whenever you change a solution or an input.
"""
import json
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


def run(solution: Path, inp: str) -> str:
    p = subprocess.run([sys.executable, str(solution)], input=inp.encode(), capture_output=True, timeout=60)
    if p.returncode != 0:
        raise SystemExit(f"Solution crashed on input:\n{inp[:500]}\n{p.stderr.decode()}")
    return p.stdout.decode().replace("\r\n", "\n").rstrip() + "\n"


def fill(problem_path: Path, solution: Path) -> None:
    data = json.loads(problem_path.read_text(encoding="utf-8"))
    for key in ("examples", "tests"):
        for case in data.get(key, []):
            case["output"] = run(solution, case["input"])
    problem_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"OK  {problem_path.relative_to(BACKEND)}  ({len(data.get('examples', []))} examples, "
          f"{len(data.get('tests', []))} tests)")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--all":
        for path in sorted((BACKEND / "problems").glob("q*/*.json")):
            pid = json.loads(path.read_text(encoding="utf-8")).get("id", path.stem)
            sol = BACKEND / "problems" / "solutions" / f"{pid}.py"
            if sol.exists():
                fill(path, sol)
            else:
                print(f"--  {path.name}: no solutions/{pid}.py, skipped")
    elif len(sys.argv) == 3:
        fill(Path(sys.argv[1]), Path(sys.argv[2]))
    else:
        print(__doc__)
