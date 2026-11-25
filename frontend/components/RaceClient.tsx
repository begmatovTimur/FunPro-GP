"use client";

import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeEditor from "@/components/CodeEditor";
import ConsolePanel, { type ConsoleResult } from "@/components/ConsolePanel";
import Lights from "@/components/Lights";
import ProblemView from "@/components/ProblemView";
import SessionReport from "@/components/SessionReport";
import TopBar, { Brand, DriverChip } from "@/components/TopBar";
import { api, ApiError } from "@/lib/api";
import { clock, lapTime, pts } from "@/lib/format";
import type { Board, DriverState, LapColor, Me } from "@/lib/types";
import { draftKey, useAuth } from "@/lib/useAuth";

type Phase = "loading" | "waiting" | "racing" | "finished" | "error";

export default function RaceClient({ n }: { n: number }) {
  const me = useAuth("driver");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [state, setState] = useState<DriverState | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [offset, setOffset] = useState(0); // server clock - local clock (ms)
  const [err, setErr] = useState("");

  const loadBoard = useCallback(async () => {
    const b = await api.board(n);
    setOffset(b.server_now * 1000 - Date.now());
    setBoard(b);
    setPhase(b.session.status === "finished" ? "finished" : "racing");
  }, [n]);

  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const boardLoading = useRef(false);

  // Poll the session state. Race Control decides when anything starts or ends.
  const poll = useCallback(async () => {
    try {
      const st = await api.state();
      const off = st.server_now * 1000 - Date.now();
      setState(st);
      setOffset(off);
      // An earlier session is live? Go there instead.
      const live = st.sessions.find((x) => x.n < n && (x.state === "lights" || x.state === "running") && x.status !== "finished");
      if (live) return router.replace(`/race/${live.n}`);
      const s = st.sessions.find((x) => x.n === n)!;
      if (s.state === "pending" || s.state === "lights") return setPhase("waiting");
      const p = phaseRef.current;
      // While the lights screen is showing "lights out", let it finish its moment first.
      const justWentOut = p === "waiting" && s.lights_out !== null && st.server_now < s.lights_out + 3;
      if ((p === "loading" || p === "waiting" || p === "error") && !justWentOut && !boardLoading.current) {
        boardLoading.current = true;
        try { await loadBoard(); } finally { boardLoading.current = false; }
      }
      // Done here and the next session is starting -> follow it.
      if (s.status === "finished" && n < 3) {
        const next = st.sessions.find((x) => x.n === n + 1)!;
        if (next.state === "lights" || next.state === "running") router.push(`/race/${n + 1}`);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) return; // network blip: keep trying
      setErr((e as Error).message);
      setPhase("error");
    }
  }, [n, router, loadBoard]);

  useEffect(() => {
    if (!me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    poll();
    const fast = phase === "waiting" || phase === "loading" || phase === "finished";
    const id = setInterval(poll, fast ? 1000 : 5000);
    return () => clearInterval(id);
  }, [me, poll, phase]);

  const sInfo = state?.sessions.find((x) => x.n === n);

  if (!me || phase === "loading") return <div className="page"><TopBar me={me} /></div>;
  if (phase === "error")
    return (
      <div className="page">
        <TopBar me={me} />
        <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ display: "grid", gap: 14, justifyItems: "center" }}>
            <div className="error-box">{err || "Something went wrong."}</div>
            <button className="btn" onClick={() => { setPhase("loading"); poll(); }}>Retry</button>
          </div>
        </div>
      </div>
    );
  if (phase === "waiting")
    return (
      <div className="page">
        <TopBar me={me} />
        <Lights
          title={`Q${n} · ${sInfo?.label ?? ""}`}
          subtitle={`${sInfo?.problems_count ?? ""} problems · ${(sInfo?.duration_sec ?? 0) / 60} minutes · the clock starts at lights out`}
          lightsStart={sInfo?.state === "lights" ? sInfo.lights_start : null}
          lightsOut={sInfo?.state === "lights" ? sInfo.lights_out : null}
          offset={offset}
          onGo={() => { loadBoard().catch(() => poll()); }}
        />
      </div>
    );
  if (phase === "finished" && board)
    return (
      <div className="page">
        <TopBar me={me} />
        <SessionReport board={board} waitingForFlag={board.session.state === "running"} />
      </div>
    );
  if (phase === "racing" && board && state && me.driver)
    return (
      <Workspace
        n={n}
        me={me}
        state={state}
        board={board}
        setBoard={setBoard}
        offset={offset}
        onFinished={loadBoard}
      />
    );
  return <div className="page"><TopBar me={me} /></div>;
}

// ======================================================================= Workspace

function Workspace({
  n, me, state, board, setBoard, offset, onFinished,
}: {
  n: number;
  me: Me;
  state: DriverState;
  board: Board;
  setBoard: React.Dispatch<React.SetStateAction<Board | null>>;
  offset: number;
  onFinished: () => Promise<void>;
}) {
  const driver = me.driver!;
  const problems = board.problems;
  const [currentId, setCurrentId] = useState<string>(
    () => (problems.some((p) => p.id === board.current_problem_id) ? board.current_problem_id! : problems[0].id),
  );
  const current = problems.find((p) => p.id === currentId)!;
  const idx = problems.findIndex((p) => p.id === currentId);

  // ---- code drafts (kept in localStorage per driver+problem)
  const [codes, setCodes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of problems) {
      let saved: string | null = null;
      try { saved = localStorage.getItem(draftKey(driver.id, p.id)); } catch {}
      init[p.id] = saved ?? p.starter_code;
    }
    return init;
  });
  const code = codes[currentId] ?? "";
  const setCode = useCallback((v: string) => {
    setCodes((c) => ({ ...c, [currentId]: v }));
    try { localStorage.setItem(draftKey(driver.id, currentId), v); } catch {}
  }, [currentId, driver.id]);

  // ---- live timing: refresh colours (others may beat your laps) and the clock (Race Control may change it)
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  useEffect(() => {
    const id = setInterval(async () => {
      if (busyRef.current === "submit") return;
      try {
        const b = await api.board(n);
        setBoard(b);
        if (b.session.status === "finished") onFinished();
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [n, setBoard, onFinished]);

  // ---- clock
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(t);
  }, [offset]);
  const left = (board.session.end_at ?? 0) - now / 1000;
  const finishing = useRef(false);
  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    await onFinished();
  }, [onFinished]);
  useEffect(() => {
    if (left <= -1) finish(); // 1 s after the flag, let the server confirm
  }, [left, finish]);

  // ---- tell the server which problem is open (lap timing)
  const firstFocus = useRef(true);
  useEffect(() => {
    if (firstFocus.current && currentId === board.current_problem_id) { firstFocus.current = false; return; }
    firstFocus.current = false;
    api.focus(n, currentId).catch(() => {});
  }, [currentId, n, board.current_problem_id]);

  // ---- console state
  const [tab, setTab] = useState<"cases" | "result">("cases");
  const [caseIdx, setCaseIdx] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const [results, setResults] = useState<Record<string, ConsoleResult>>({});
  const [toast, setToast] = useState<{ color: LapColor; lap: number | null; title: string } | null>(null);

  const goTo = (id: string) => {
    setCurrentId(id);
    setCaseIdx(0);
    setTab(results[id] ? "result" : "cases");
  };

  const run = useCallback(async () => {
    if (busyRef.current) return;
    setBusy("run");
    setTab("result");
    const custom = caseIdx === -1;
    try {
      const data = await api.run(currentId, code, custom ? customInput : undefined);
      setResults((r) => ({ ...r, [currentId]: { kind: "run", data, custom } }));
    } catch (e) {
      setResults((r) => ({ ...r, [currentId]: { kind: "error", message: (e as Error).message } }));
      if (e instanceof ApiError && e.status === 409) finish();
    } finally {
      setBusy(null);
    }
  }, [caseIdx, code, currentId, customInput, finish]);

  const submit = async () => {
    if (busy || current.progress.solved) return;
    setBusy("submit");
    setTab("result");
    const pid = currentId;
    try {
      const data = await api.submit(pid, code);
      setResults((r) => ({ ...r, [pid]: { kind: "submit", data } }));
      setBoard((b) => b && { ...b, problems: b.problems.map((p) => (p.id === pid ? { ...p, progress: data.progress } : p)) });
      if (data.newly_solved) {
        const p = problems.find((x) => x.id === pid)!;
        setToast({ color: data.progress.color, lap: data.progress.lap_seconds, title: `${p.order}. ${p.title}` });
        setTimeout(() => setToast(null), 4500);
        if (data.progress.color === "purple") {
          confetti({ particleCount: 90, spread: 80, origin: { y: 0.15 }, colors: ["#a033ff", "#ffffff", "#e10600"] });
        }
      }
      api.board(n).then(setBoard, () => {});
      if (data.session_complete) setTimeout(finish, 2500);
    } catch (e) {
      setResults((r) => ({ ...r, [pid]: { kind: "error", message: (e as Error).message } }));
      if (e instanceof ApiError && e.status === 409 && /over|flag/i.test(e.message)) finish();
    } finally {
      setBusy(null);
    }
  };

  // ---- resizable panes
  const [leftPct, setLeftPct] = useState(44);
  const [editorPct, setEditorPct] = useState(62);
  const splitRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<"h" | "v" | null>(null);
  useEffect(() => {
    if (!drag) return;
    const move = (e: MouseEvent) => {
      if (drag === "h" && splitRef.current) {
        const r = splitRef.current.getBoundingClientRect();
        setLeftPct(Math.min(70, Math.max(25, ((e.clientX - r.left) / r.width) * 100)));
      } else if (drag === "v" && rightRef.current) {
        const r = rightRef.current.getBoundingClientRect();
        setEditorPct(Math.min(85, Math.max(25, ((e.clientY - r.top) / r.height) * 100)));
      }
    };
    const up = () => setDrag(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
    };
  }, [drag]);

  const clockClass = left <= 60 ? "crit" : left <= 300 ? "warn" : "";
  const totalPoints = useMemo(() => problems.reduce((a, p) => a + p.progress.points, 0), [problems]);
  const fl = board.session.fastest_lap;

  return (
    <div className="race">
      {/* ------------------------------------------------ race control bar */}
      <div className="race-bar">
        <Brand />
        <div className="q-tabs">
          {state.sessions.map((s) => (
            <div
              key={s.n}
              className={`q-tab ${s.n === n ? "current" : ""} ${s.state === "finished" ? "done" : ""}`}
              title={s.n === n ? "Current session" : s.state === "finished" ? "Completed" : "Race Control starts this session"}
            >
              {s.name}
            </div>
          ))}
        </div>
        <div className="laps">
          {problems.map((p) => {
            const pr = p.progress;
            return (
              <button
                key={p.id}
                className={`lap ${p.id === currentId ? "active" : ""} ${pr.color ? `t-${pr.color}` : ""}`}
                onClick={() => goTo(p.id)}
                title={`${p.order}. ${p.title}${pr.solved ? ` · ${lapTime(pr.lap_seconds)}` : pr.attempts ? ` · ${pr.best_passed}/${pr.total_tests} tests` : ""}`}
              >
                {p.order}
                {!pr.solved && pr.best_passed > 0 && (
                  <span className="partial" style={{ width: `${(pr.best_passed / pr.total_tests) * 100}%` }} />
                )}
              </button>
            );
          })}
        </div>
        {fl && (
          <div className="fl-chip" title={`Fastest lap of ${board.session.name}: ${fl.name} (+${board.session.fastest_lap_bonus} pts)`}>
            <span className="k">Fastest lap</span>
            <span className="t-purple fl-time">{lapTime(fl.lap)}</span>
            <span style={{ fontWeight: 900 }}>{fl.driver_id === driver.id ? "YOU" : fl.code}</span>
          </div>
        )}
        <div className="race-clock" style={{ marginLeft: "auto" }}>
          <div className="race-points" style={{ display: "inline-block", verticalAlign: "top", marginRight: 14 }}>
            <div className="k">Points</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{pts(totalPoints)}<span className="muted" style={{ fontSize: 14 }}>/{board.session.max_points}</span></div>
          </div>
          <div style={{ display: "inline-block" }} className={clockClass}>
            <div className="k">Time left</div>
            <div className="v">{clock(left)}</div>
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => goTo(problems[(idx + 1) % problems.length].id)}>
          Next problem →
        </button>
        <DriverChip driver={driver} />
      </div>

      {/* ------------------------------------------------ split view */}
      <div className="split" ref={splitRef}>
        <div className="pane" style={{ width: `${leftPct}%` }}>
          <div className="pane-head">
            <span className="tab on">📄 Description</span>
            <span className="muted" style={{ marginLeft: "auto", fontWeight: 600 }}>
              Q{n} · Problem {current.order} of {problems.length}
            </span>
          </div>
          <ProblemView p={current} />
        </div>

        <div className={`gutter ${drag === "h" ? "drag" : ""}`} onMouseDown={() => setDrag("h")} />

        <div ref={rightRef} style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div className="pane" style={{ height: `${editorPct}%` }}>
            <div className="pane-head">
              <span className="tab on"><span style={{ color: "var(--green)" }}>{"</>"}</span> Code</span>
              <span className="muted" style={{ fontWeight: 600 }}>Python 3</span>
              <button
                className="tab"
                style={{ marginLeft: "auto" }}
                title="Reset to starter code"
                onClick={() => { if (confirm("Reset your code to the starter template?")) setCode(current.starter_code); }}
              >
                ↺ Reset
              </button>
            </div>
            <div className="editor-wrap">
              <CodeEditor value={code} onChange={setCode} onRun={run} />
            </div>
            <div className="editor-foot">Saved on this computer · read input with input() and print() the answer</div>
          </div>

          <div className={`vgutter ${drag === "v" ? "drag" : ""}`} onMouseDown={() => setDrag("v")} />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, borderRadius: 8, overflow: "hidden" }}>
            <ConsolePanel
              problem={current}
              tab={tab}
              setTab={setTab}
              caseIdx={caseIdx}
              setCaseIdx={setCaseIdx}
              customInput={customInput}
              setCustomInput={setCustomInput}
              result={results[currentId] ?? null}
              busy={busy}
            />
            <div className="action-bar">
              <span className="muted" style={{ fontSize: 13 }}>
                {current.progress.attempts > 0 && `Submissions: ${current.progress.attempts}`}
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn btn-sm btn-run" onClick={run} disabled={!!busy}>
                  {busy === "run" ? <span className="spinner" /> : "▶"} Run
                </button>
                <button className="btn btn-sm btn-submit" onClick={submit} disabled={!!busy || current.progress.solved}>
                  {busy === "submit" ? <span className="spinner" /> : "⬆"} {current.progress.solved ? "Solved" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="toast-wrap">
          <div className={`toast t-${toast.color}`}>
            <div>
              <div className="big">{toast.color === "purple" ? "Fastest lap!" : toast.color === "green" ? "Personal best" : "Lap complete"}</div>
              <div style={{ fontWeight: 700 }}>{toast.title}</div>
            </div>
            <div className="t">{lapTime(toast.lap)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
