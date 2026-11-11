"use client";

import confetti from "canvas-confetti";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeEditor from "@/components/CodeEditor";
import ConsolePanel, { type ConsoleResult } from "@/components/ConsolePanel";
import Lights from "@/components/Lights";
import ProblemView from "@/components/ProblemView";
import SessionReport from "@/components/SessionReport";
import TopBar, { Brand, DriverChip } from "@/components/TopBar";
import { api, ApiError } from "@/lib/api";
import { clock, lapTime, pts } from "@/lib/format";
import type { Board, DriverState, LapColor } from "@/lib/types";
import { draftKey, useDriverId } from "@/lib/useDriver";

type Phase = "loading" | "nodriver" | "locked" | "grid" | "racing" | "finished" | "error";

export default function RaceClient({ n }: { n: number }) {
  const [driverId] = useDriverId();
  const [phase, setPhase] = useState<Phase>("loading");
  const [state, setState] = useState<DriverState | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [offset, setOffset] = useState(0); // server clock - local clock (ms)
  const [err, setErr] = useState("");

  const loadBoard = useCallback(async () => {
    if (!driverId) return;
    const b = await api.board(n, driverId);
    setOffset(b.server_now * 1000 - Date.now());
    setBoard(b);
    setPhase(b.session.status === "finished" ? "finished" : "racing");
  }, [driverId, n]);

  const loadAll = useCallback(async () => {
    if (driverId === undefined) return;
    if (driverId === null) return setPhase("nodriver");
    try {
      const st = await api.state(driverId);
      setState(st);
      const s = st.sessions.find((x) => x.n === n);
      if (!s) return setPhase("error");
      if (s.status === "locked") return setPhase("locked");
      if (s.status === "ready") return setPhase("grid");
      await loadBoard();
    } catch (e) {
      setErr((e as Error).message);
      setPhase("error");
    }
  }, [driverId, n, loadBoard]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);

  const sessionName = `Q${n}`;
  const sInfo = state?.sessions.find((x) => x.n === n);

  if (phase === "loading") return <div className="page"><TopBar /></div>;
  if (phase === "nodriver")
    return (
      <Centered>
        <p>You are not registered on this computer.</p>
        <Link className="btn btn-red" href="/">Go to registration</Link>
      </Centered>
    );
  if (phase === "error")
    return (
      <Centered>
        <div className="error-box">{err || "Something went wrong."}</div>
        <button className="btn" onClick={() => { setPhase("loading"); loadAll(); }}>Retry</button>
      </Centered>
    );
  if (phase === "locked")
    return (
      <Centered driver={state?.driver}>
        <h1 className="h-display">{sessionName} is <span className="accent">locked</span></h1>
        <p className="muted">Finish Q{n - 1} first. Every session must be completed before the next one opens.</p>
        <Link className="btn btn-red" href={`/race/${n - 1}`}>Go to Q{n - 1}</Link>
      </Centered>
    );
  if (phase === "grid")
    return (
      <div className="page">
        <TopBar driver={state?.driver} />
        <Lights
          title={`${sessionName} · ${sInfo?.label ?? ""}`}
          subtitle={`${sInfo?.problems_count ?? ""} problems · ${(sInfo?.duration_sec ?? 0) / 60} minutes · the clock starts at lights out`}
          onLightsOut={async () => {
            await api.startSession(n, driverId!);
            const b = await api.board(n, driverId!);
            setOffset(b.server_now * 1000 - Date.now());
            setBoard(b);
          }}
          onDone={() => setPhase("racing")}
        />
      </div>
    );
  if (phase === "finished" && board)
    return (
      <div className="page">
        <TopBar driver={state?.driver} />
        <SessionReport board={board} />
      </div>
    );
  if (phase === "racing" && board && state)
    return (
      <Workspace
        n={n}
        driverId={driverId!}
        state={state}
        board={board}
        setBoard={setBoard}
        offset={offset}
        onFinished={async () => { await loadBoard(); setState(await api.state(driverId!)); }}
      />
    );
  return <div className="page"><TopBar /></div>;
}

function Centered({ children, driver }: { children: React.ReactNode; driver?: DriverState["driver"] }) {
  return (
    <div className="page">
      <TopBar driver={driver} />
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", textAlign: "center", maxWidth: 520 }}>{children}</div>
      </div>
    </div>
  );
}

// ======================================================================= Workspace

function Workspace({
  n, driverId, state, board, setBoard, offset, onFinished,
}: {
  n: number;
  driverId: number;
  state: DriverState;
  board: Board;
  setBoard: React.Dispatch<React.SetStateAction<Board | null>>;
  offset: number;
  onFinished: () => Promise<void>;
}) {
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
      try { saved = localStorage.getItem(draftKey(driverId, p.id)); } catch {}
      init[p.id] = saved ?? p.starter_code;
    }
    return init;
  });
  const code = codes[currentId] ?? "";
  const setCode = useCallback((v: string) => {
    setCodes((c) => ({ ...c, [currentId]: v }));
    try { localStorage.setItem(draftKey(driverId, currentId), v); } catch {}
  }, [currentId, driverId]);

  // ---- clock
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(t);
  }, [offset]);
  const left = (board.session.deadline ?? 0) - now / 1000;
  const finishing = useRef(false);
  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    await onFinished();
  }, [onFinished]);
  useEffect(() => {
    if (left <= 0) finish();
  }, [left, finish]);

  // ---- tell the server which problem is open (lap timing)
  const firstFocus = useRef(true);
  useEffect(() => {
    if (firstFocus.current && currentId === board.current_problem_id) { firstFocus.current = false; return; }
    firstFocus.current = false;
    api.focus(n, driverId, currentId).catch(() => {});
  }, [currentId, n, driverId, board.current_problem_id]);

  // ---- console state
  const [tab, setTab] = useState<"cases" | "result">("cases");
  const [caseIdx, setCaseIdx] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const [results, setResults] = useState<Record<string, ConsoleResult>>({});
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [toast, setToast] = useState<{ color: LapColor; lap: number | null; title: string } | null>(null);
  const [confirmBox, setConfirmBox] = useState(false);

  const goTo = (id: string) => {
    setCurrentId(id);
    setCaseIdx(0);
    setTab(results[id] ? "result" : "cases");
  };

  const run = useCallback(async () => {
    if (busy) return;
    setBusy("run");
    setTab("result");
    const custom = caseIdx === -1;
    try {
      const data = await api.run(driverId, currentId, code, custom ? customInput : undefined);
      setResults((r) => ({ ...r, [currentId]: { kind: "run", data, custom } }));
    } catch (e) {
      setResults((r) => ({ ...r, [currentId]: { kind: "error", message: (e as Error).message } }));
      if (e instanceof ApiError && e.status === 409) finish();
    } finally {
      setBusy(null);
    }
  }, [busy, caseIdx, code, currentId, customInput, driverId, finish]);

  const submit = async () => {
    if (busy || current.progress.solved) return;
    setBusy("submit");
    setTab("result");
    const pid = currentId;
    try {
      const data = await api.submit(driverId, pid, code);
      setResults((r) => ({ ...r, [pid]: { kind: "submit", data } }));
      setBoard((b) =>
        b && {
          ...b,
          session: {
            ...b.session,
            points: b.problems.reduce((a, p) => a + (p.id === pid ? data.progress.points : p.progress.points), 0),
            solved: b.problems.reduce((a, p) => a + ((p.id === pid ? data.progress.solved : p.progress.solved) ? 1 : 0), 0),
          },
          problems: b.problems.map((p) => (p.id === pid ? { ...p, progress: data.progress } : p)),
        },
      );
      if (data.newly_solved) {
        const p = problems.find((x) => x.id === pid)!;
        setToast({ color: data.progress.color, lap: data.progress.lap_seconds, title: `${p.order}. ${p.title}` });
        setTimeout(() => setToast(null), 4500);
        if (data.progress.color === "purple") {
          confetti({ particleCount: 90, spread: 80, origin: { y: 0.15 }, colors: ["#a033ff", "#ffffff", "#e10600"] });
        }
      }
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

  return (
    <div className="race">
      {/* ------------------------------------------------ race control bar */}
      <div className="race-bar">
        <Brand />
        <div className="q-tabs">
          {state.sessions.map((s) => (
            <div
              key={s.n}
              className={`q-tab ${s.n === n ? "current" : ""} ${s.status === "finished" ? "done" : ""}`}
              title={s.n === n ? "Current session" : s.status === "finished" ? "Completed" : "Locked until this session ends"}
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
        <div className="race-clock" style={{ marginLeft: "auto" }}>
          <div className="race-points" style={{ display: "inline-block", verticalAlign: "top", marginRight: 14 }}>
            <div className="k" style={{ fontSize: 10, letterSpacing: 2, fontWeight: 700, color: "var(--muted)" }}>POINTS</div>
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
        <button className="btn btn-sm btn-ghost" onClick={() => setConfirmBox(true)} title="End this session early">
          Box box
        </button>
        <DriverChip driver={state.driver} />
      </div>

      {/* ------------------------------------------------ split view */}
      <div className="split" ref={splitRef}>
        <div className="pane" style={{ width: `${leftPct}%` }}>
          <div className="pane-head">
            <span className="tab on">📄 Description</span>
            <span className="muted" style={{ marginLeft: "auto", fontWeight: 600 }}>
              {sessionLabel(n)} · Problem {current.order} of {problems.length}
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
              <div className="big">{toast.color === "purple" ? "Purple lap!" : toast.color === "green" ? "Personal best" : "Lap complete"}</div>
              <div style={{ fontWeight: 700 }}>{toast.title}</div>
            </div>
            <div className="t">{lapTime(toast.lap)}</div>
          </div>
        </div>
      )}

      {confirmBox && (
        <div className="overlay" onClick={() => setConfirmBox(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Box, box?</h2>
            <p className="muted" style={{ lineHeight: 1.6 }}>
              Ending {sessionLabel(n)} now locks your points for this session. You can&apos;t come back to it,
              even though {clock(left)} is left on the clock.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmBox(false)}>Stay out</button>
              <button
                className="btn btn-red"
                style={{ flex: 1 }}
                onClick={async () => { setConfirmBox(false); await api.finish(n, driverId).catch(() => {}); finish(); }}
              >
                End session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function sessionLabel(n: number) {
  return `Q${n}`;
}
