"""Runs student Python code against test cases, via Judge0 or a local fallback runner."""
import base64
import logging
import os
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import httpx

from . import config

log = logging.getLogger("judge")

# Verdicts
PASSED = "passed"
WRONG = "wrong_answer"
TLE = "time_limit"
RUNTIME = "runtime_error"
COMPILE = "compile_error"
INTERNAL = "internal_error"


@dataclass
class RunResult:
    status: str  # "ok" | TLE | RUNTIME | COMPILE | INTERNAL  (raw execution status, before comparing output)
    stdout: str
    stderr: str
    time: float | None


def normalize(text: str) -> str:
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def outputs_match(actual: str, expected: str) -> bool:
    return normalize(actual) == normalize(expected)


# ---------------------------------------------------------------- Judge0

class Judge0Unavailable(Exception):
    pass


def _judge0_headers() -> dict:
    h = {"Content-Type": "application/json"}
    if config.JUDGE0_AUTH_TOKEN:
        h["X-Auth-Token"] = config.JUDGE0_AUTH_TOKEN
    if config.JUDGE0_RAPIDAPI_KEY:
        h["X-RapidAPI-Key"] = config.JUDGE0_RAPIDAPI_KEY
        h["X-RapidAPI-Host"] = config.JUDGE0_RAPIDAPI_HOST
    return h


def _b64(s: str) -> str:
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def _unb64(s: str | None) -> str:
    if not s:
        return ""
    return base64.b64decode(s).decode("utf-8", errors="replace")


def _run_judge0(code: str, inputs: list[str], time_limit: float) -> list[RunResult]:
    payload = {
        "submissions": [
            {
                "language_id": config.JUDGE0_PYTHON_ID,
                "source_code": _b64(code),
                "stdin": _b64(inp),
                "cpu_time_limit": time_limit,
                "wall_time_limit": time_limit * 3,
                "memory_limit": 256_000,
            }
            for inp in inputs
        ]
    }
    try:
        with httpx.Client(base_url=config.JUDGE0_URL, headers=_judge0_headers(), timeout=15) as client:
            r = client.post("/submissions/batch", params={"base64_encoded": "true"}, json=payload)
            r.raise_for_status()
            tokens = [item["token"] for item in r.json()]
            deadline = time.time() + 90
            results: dict[str, dict] = {}
            while time.time() < deadline:
                pending = [t for t in tokens if t not in results]
                if not pending:
                    break
                r = client.get(
                    "/submissions/batch",
                    params={
                        "tokens": ",".join(pending),
                        "base64_encoded": "true",
                        "fields": "token,status,stdout,stderr,compile_output,message,time",
                    },
                )
                r.raise_for_status()
                for sub in r.json()["submissions"]:
                    if sub and sub["status"]["id"] > 2:  # 1 = In Queue, 2 = Processing
                        results[sub["token"]] = sub
                if len(results) < len(tokens):
                    time.sleep(0.4)
    except (httpx.ConnectError, httpx.ConnectTimeout) as e:
        raise Judge0Unavailable(str(e)) from e

    out = []
    for t in tokens:
        sub = results.get(t)
        if sub is None:
            out.append(RunResult(INTERNAL, "", "Judge0 did not finish in time", None))
            continue
        sid = sub["status"]["id"]
        stdout = _unb64(sub.get("stdout"))[: config.MAX_OUTPUT_CHARS]
        stderr = (_unb64(sub.get("stderr")) or _unb64(sub.get("compile_output")) or _unb64(sub.get("message")))
        t_used = float(sub["time"]) if sub.get("time") else None
        if sid in (3, 4):  # Accepted / Wrong Answer -> program ran fine; we compare output ourselves
            status = "ok"
        elif sid == 5:
            status = TLE
        elif sid == 6:
            status = COMPILE
        elif 7 <= sid <= 12:
            status = RUNTIME
        else:
            status = INTERNAL
        out.append(RunResult(status, stdout, stderr[:4000], t_used))
    return out


# ---------------------------------------------------------------- Local runner (fallback)

def _run_local_one(path: str, inp: str, time_limit: float) -> RunResult:
    start = time.perf_counter()
    try:
        proc = subprocess.run(
            [sys.executable, "-I", path],
            input=inp.encode("utf-8"),
            capture_output=True,
            timeout=time_limit * 2,  # wall time; a bit more generous than Judge0's CPU time
            env={"PYTHONIOENCODING": "utf-8", "SYSTEMROOT": os.environ.get("SYSTEMROOT", "")},
        )
    except subprocess.TimeoutExpired:
        return RunResult(TLE, "", "", time_limit)
    elapsed = time.perf_counter() - start
    stdout = proc.stdout.decode("utf-8", errors="replace")[: config.MAX_OUTPUT_CHARS]
    stderr = proc.stderr.decode("utf-8", errors="replace")[:4000]
    if proc.returncode != 0:
        status = COMPILE if "SyntaxError" in stderr or "IndentationError" in stderr else RUNTIME
        return RunResult(status, stdout, stderr, elapsed)
    return RunResult("ok", stdout, stderr, elapsed)


def _run_local(code: str, inputs: list[str], time_limit: float) -> list[RunResult]:
    with tempfile.TemporaryDirectory(prefix="fpgp_") as d:
        path = os.path.join(d, "solution.py")
        with open(path, "w", encoding="utf-8") as f:
            f.write(code)
        with ThreadPoolExecutor(max_workers=4) as pool:
            return list(pool.map(lambda i: _run_local_one(path, i, time_limit), inputs))


# ---------------------------------------------------------------- Public API

_judge0_down_until = 0.0


def judge_status() -> dict:
    mode = config.JUDGE_MODE
    ok = None
    if mode in ("judge0", "auto"):
        try:
            r = httpx.get(f"{config.JUDGE0_URL}/about", headers=_judge0_headers(), timeout=3)
            ok = r.status_code == 200
        except httpx.HTTPError:
            ok = False
    return {"mode": mode, "judge0_url": config.JUDGE0_URL, "judge0_reachable": ok}


def execute(code: str, inputs: list[str], time_limit: float) -> tuple[list[RunResult], str]:
    """Returns (results, engine_used)."""
    global _judge0_down_until
    mode = config.JUDGE_MODE
    if mode == "local":
        return _run_local(code, inputs, time_limit), "local"
    if mode == "auto" and time.time() < _judge0_down_until:
        return _run_local(code, inputs, time_limit), "local"
    try:
        return _run_judge0(code, inputs, time_limit), "judge0"
    except Judge0Unavailable:
        if mode == "judge0":
            raise
        log.warning("Judge0 unreachable at %s, using LOCAL runner for 30s", config.JUDGE0_URL)
        _judge0_down_until = time.time() + 30
        return _run_local(code, inputs, time_limit), "local"


def verdict_for(result: RunResult, expected: str) -> str:
    if result.status != "ok":
        return result.status
    return PASSED if outputs_match(result.stdout, expected) else WRONG
