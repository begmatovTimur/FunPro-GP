"""Scripted race that checks the live timing rules, the fastest-lap bonus and the standings."""
import pathlib
import threading
import time

import httpx
from playwright.sync_api import sync_playwright

API = "http://localhost:8000/api"
WEB = "http://localhost:3000"
c = httpx.Client(base_url=API, timeout=120)
SOL = lambda pid: pathlib.Path(f"/home/claude/funprogp/backend/contest/solutions/{pid}.py").read_text()
Q1 = ["q1-lap-time", "q1-driver-code", "q1-fuel-check", "q1-podium", "q1-season-points", "q1-grid-penalty"]
Q2 = ["q2-personal-best", "q2-tyre-stint", "q2-drs-train", "q2-places-gained", "q2-theoretical-best"]
results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(("  PASS " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail else ""))


def H(t):
    return {"Authorization": f"Bearer {t}"}


def login(name, code, team):
    return c.post("/auth/login", json={"username": name, "password": "pass", "code": code, "team": team}).json()


def solve(drv, n, pid, lap, code=None):
    """Open the problem, keep it open for `lap` seconds, then submit."""
    c.post(f"/sessions/{n}/focus", headers=H(drv["token"]), json={"problem_id": pid})
    time.sleep(lap)
    return c.post("/submit", headers=H(drv["token"]), json={"problem_id": pid, "code": code or SOL(pid)}).json()


def colors(drv, n):
    b = c.get(f"/sessions/{n}/board", headers=H(drv["token"])).json()
    return {p["id"]: p["progress"]["color"] for p in b["problems"] if p["progress"]["solved"]}


def all_colors(drivers, n):
    return {d["driver"]["code"]: colors(d, n) for d in drivers}


def standings():
    return c.get("/standings", headers=H(ADM["token"])).json()


def row(code):
    return next(r for r in standings()["rows"] if r["driver"]["code"] == code)


def invariants(drivers, n, label):
    cols = all_colors(drivers, n)
    flat = [col for d in cols.values() for col in d.values()]
    check(f"{label}: exactly one purple in Q{n}", flat.count("purple") == 1, str(cols))
    ok = all(list(d.values()).count("green") + list(d.values()).count("purple") == 1 for d in cols.values() if d)
    check(f"{label}: each driver has exactly one personal best (green or purple)", ok)
    return cols


A = login("Alpha Driver", "AAA", "mercedes")
B = login("Bravo Driver", "BBB", "ferrari")
C = login("Charlie Driver", "CCC", "mclaren")
ADM = c.post("/auth/login", json={"username": "funprogp", "password": "helloWorld"}).json()
DR = [A, B, C]

print("\n== Start Q1")
st = c.post("/admin/sessions/1/start", headers=H(ADM["token"])).json()
time.sleep(max(0, st["lights_out"] - time.time()) + 0.3)
for d in DR:
    c.get("/sessions/1/board", headers=H(d["token"]))
# The first problem is open from the start of the session (by design), so park each driver
# on a problem they never solve; then every lap below is measured exactly.
for d, park in ((A, Q1[4]), (B, Q1[4]), (C, Q1[5])):
    c.post("/sessions/1/focus", headers=H(d["token"]), json={"problem_id": park})

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    # Driver A watching their race screen; admin watching the standings table.
    pa = browser.new_context(viewport={"width": 1440, "height": 860}).new_page()
    pa_log = []
    T0 = time.time()
    pa.on("request", lambda r: pa_log.append(f"{time.time()-T0:5.1f}s {r.method} {r.url.split('/api')[-1]}") if "/api" in r.url and r.method != "OPTIONS" else None)
    pa.on("pageerror", lambda e: pa_log.append("pageerror " + str(e)))
    pa.goto(WEB + "/login")
    pa.evaluate(f"localStorage.setItem('fpgp.token', '{A['token']}')")
    pa.goto(WEB + "/race/1")
    try:
        pa.wait_for_selector(".race", timeout=20000)
    except Exception:
        pa.screenshot(path="stuck.png")
        print("RACE PAGE DID NOT LOAD. url:", pa.url)
        print("\n".join(pa_log[:40]))
        raise
    ps = browser.new_context(viewport={"width": 1440, "height": 860}).new_page()
    ps.goto(WEB + "/login")
    ps.evaluate(f"localStorage.setItem('fpgp.token', '{ADM['token']}')")
    ps.goto(WEB + "/standings")
    ps.wait_for_selector("table.standings", timeout=20000)

    def a_box(i):
        return pa.eval_on_selector_all(".laps .lap", "els => els.map(e => (e.className.match(/t-(\\w+)/) || [,'-'])[1])")[i]

    def table_order():
        return ps.eval_on_selector_all("table.standings tbody tr td:nth-child(2)", "els => els.map(e => e.textContent.trim().slice(-3))")

    print("\n== Step 1: AAA solves problem 1 (lap ~3 s): first lap of the session")
    r = solve(A, 1, Q1[0], 3.0)
    check("AAA problem 1 is purple", r["progress"]["color"] == "purple", f"lap {r['progress']['lap_seconds']}")
    check("lap time measured correctly (~3 s)", 2.9 < r["progress"]["lap_seconds"] < 3.4, str(r["progress"]["lap_seconds"]))
    check("AAA holds Q1 fastest lap, +2 bonus", row("AAA")["sessions"]["1"]["bonus"] == 2)
    check("AAA total = 10 problem pts + 2 bonus = 12", row("AAA")["total"] == 12)

    print("\n== Step 2: AAA solves problem 2 slower (lap ~5 s)")
    time.sleep(0.2)
    r = solve(A, 1, Q1[1], 5.0)
    check("AAA problem 2 is yellow (slower than own best)", r["progress"]["color"] == "yellow")
    invariants(DR, 1, "after step 2")

    print("\n== Step 3: BBB solves problem 3 faster (lap ~1 s): takes the fastest lap")
    r = solve(B, 1, Q1[2], 1.0)
    check("BBB problem 3 is purple", r["progress"]["color"] == "purple")
    cols = invariants(DR, 1, "after step 3")
    check("AAA problem 1 turned purple -> green (still AAA's best)", cols["AAA"][Q1[0]] == "green")
    check("AAA problem 2 stays yellow", cols["AAA"][Q1[1]] == "yellow")
    check("bonus moved: BBB +2, AAA 0", row("BBB")["sessions"]["1"]["bonus"] == 2 and row("AAA")["sessions"]["1"]["bonus"] == 0)
    # Live browser checks (no reload): A's box 1 should turn green within the 3 s poll
    time.sleep(4)
    check("LIVE: AAA's screen shows box 1 green without refresh", a_box(0) == "green", a_box(0))
    s = standings()
    check("standings: AAA 20 pts ahead of BBB 12 pts", [r["driver"]["code"] for r in s["rows"]][:2] == ["AAA", "BBB"],
          str([(r["driver"]["code"], r["total"]) for r in s["rows"]]))

    print("\n== Step 4: AAA solves problem 4 very fast (lap ~0.4 s): takes the fastest lap back")
    r = solve(A, 1, Q1[3], 0.4)
    cols = invariants(DR, 1, "after step 4")
    check("AAA problem 4 purple", cols["AAA"][Q1[3]] == "purple")
    check("AAA problem 1 now yellow (no longer AAA's best)", cols["AAA"][Q1[0]] == "yellow")
    check("BBB problem 3 purple -> green", cols["BBB"][Q1[2]] == "green")
    time.sleep(4)
    check("LIVE: AAA's screen: box 1 yellow, box 4 purple", (a_box(0), a_box(3)) == ("yellow", "purple"), f"{a_box(0)},{a_box(3)}")
    ps.wait_for_timeout(3500)
    badge_row = ps.eval_on_selector_all("table.standings tbody tr", "rows => rows.filter(r => r.querySelector('.fl-badge')).map(r => r.textContent)")
    check("LIVE: standings purple badge is on AAA's row only", len(badge_row) == 1 and "AAA" in badge_row[0], str(badge_row)[:80])

    print("\n== Step 5: P1/P2 swap through the bonus. CCC catches up on points")
    for pid, lap in ((Q1[0], 2), (Q1[1], 2), (Q1[2], 2)):
        solve(C, 1, pid, lap)
    # AAA: 3 solved = 30 + 2 bonus = 32 ; CCC: 3 solved = 30
    order = [r["driver"]["code"] for r in standings()["rows"]]
    check("AAA (30 + 2 bonus) ahead of CCC (30)", order.index("AAA") < order.index("CCC"),
          str([(x["driver"]["code"], x["total"]) for x in standings()["rows"]]))
    ps.wait_for_timeout(3500)
    check("LIVE: standings shows AAA on top", table_order()[0] == "AAA", str(table_order()))
    r = solve(C, 1, Q1[3], 0.2)  # CCC sets a new fastest lap -> bonus moves -> CCC 40 + 2, AAA 30
    s = standings()
    order = [x["driver"]["code"] for x in s["rows"]]
    check("CCC's new fastest lap moves the bonus: CCC now P1", order[0] == "CCC",
          str([(x["driver"]["code"], x["total"]) for x in s["rows"]]))
    check("AAA lost the bonus (back to 30 pts)", row("AAA")["total"] == 30)
    check("CCC = 40 + 2 = 42", row("CCC")["total"] == 42)
    ps.wait_for_timeout(3500)
    check("LIVE: standings table re-ordered with CCC on top", table_order()[0] == "CCC", str(table_order()))

    print("\n== Step 6: equal points are split by time")
    solve(B, 1, Q1[0], 1.5)
    solve(B, 1, Q1[1], 1.5)   # BBB: 30 pts, same as AAA
    s = standings()
    tied = [x for x in s["rows"] if x["total"] == 30]
    check("AAA and BBB tied on 30 points", len(tied) == 2, str([(x["driver"]["code"], x["total"]) for x in s["rows"]]))
    check("tie broken by lower total time", tied[0]["time"] <= tied[1]["time"],
          f"{tied[0]['driver']['code']} {tied[0]['time']} before {tied[1]['driver']['code']} {tied[1]['time']}")

    print("\n== Step 7: two drivers submit at the same instant")
    out = {}

    def go(d, key, pid):
        out[key] = solve(d, 1, pid, 0.05)

    t1 = threading.Thread(target=go, args=(A, "A", Q1[5]))
    t2 = threading.Thread(target=go, args=(B, "B", Q1[5]))
    t1.start(); t2.start(); t1.join(); t2.join()
    invariants(DR, 1, "after simultaneous solves")

    print("\n== Step 8: Q2 has its own records")
    q1_before = all_colors(DR, 1)
    c.post("/admin/sessions/1/end", headers=H(ADM["token"]))
    st = c.post("/admin/sessions/2/start", headers=H(ADM["token"])).json()
    time.sleep(max(0, st["lights_out"] - time.time()) + 0.3)
    for d in DR:
        c.get("/sessions/2/board", headers=H(d["token"]))
    r = solve(B, 2, Q2[0], 6.0)  # much slower than any Q1 lap
    check("BBB's 6 s lap is purple in Q2 (Q1 laps don't count)", r["progress"]["color"] == "purple")
    check("Q2 fastest lap gives +5", row("BBB")["sessions"]["2"]["bonus"] == 5)
    check("Q1 colours unchanged by Q2", all_colors(DR, 1) == q1_before)
    r = solve(A, 2, Q2[1], 1.0, code="print('LAPS 0')")  # wrong answer -> partial / zero, no colour
    check("wrong answer: no colour, partial points only", r["progress"]["color"] is None and not r["progress"]["solved"],
          f"{r['passed']}/10, {r['progress']['points']} pts")

    s = standings()
    print("\nFinal table:")
    for x in s["rows"]:
        print(f"  P{x['pos']} {x['driver']['code']}  total {x['total']}  bonus {x['bonus']}  time {x['time']}")
    totals_ok = all(abs(x["total"] - (x["problem_points"] + x["bonus"])) < 1e-9 for x in s["rows"])
    check("every total = problem points + fastest-lap bonus", totals_ok)
    sorted_ok = all((a["total"], -a["time"]) >= (b["total"], -b["time"]) for a, b in zip(s["rows"], s["rows"][1:]))
    check("table sorted by points, then lower time", sorted_ok)
    browser.close()

print(f"\n{sum(results)}/{len(results)} checks passed")
