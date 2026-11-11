"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { api, ApiError } from "@/lib/api";
import { clock, lapTime, pts } from "@/lib/format";
import type { DriverState, SessionSummary } from "@/lib/types";
import { useDriverId } from "@/lib/useDriver";

const TEAM_COLORS = [
  { name: "Silver Arrow", hex: "#00d2be" },
  { name: "Scuderia Red", hex: "#e8002d" },
  { name: "Papaya", hex: "#ff8000" },
  { name: "Energy Blue", hex: "#3671c6" },
  { name: "Racing Green", hex: "#229971" },
  { name: "Alpine Pink", hex: "#ff87bc" },
  { name: "Williams Blue", hex: "#1868db" },
  { name: "Haas White", hex: "#b6babd" },
  { name: "Kick Lime", hex: "#52e252" },
  { name: "Racing Bull", hex: "#6692ff" },
];

export default function Home() {
  const [driverId, setDriverId] = useDriverId();
  const [state, setState] = useState<DriverState | null>(null);
  const [offset, setOffset] = useState(0);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!driverId) return;
    try {
      const st = await api.state(driverId);
      setOffset(st.server_now * 1000 - Date.now());
      setState(st);
      setErr("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setDriverId(null);
      else setErr((e as Error).message);
    }
  }, [driverId, setDriverId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (driverId === undefined) return <div className="page"><TopBar /></div>;
  if (driverId === null) return <Register onDone={(id) => setDriverId(id)} />;

  return (
    <div className="page">
      <TopBar driver={state?.driver} />
      <main className="container">
        {err && <div className="error-box" style={{ marginBottom: 20 }}>{err}</div>}
        {state && <Paddock state={state} offset={offset} onSwitch={() => { setState(null); setDriverId(null); }} />}
      </main>
    </div>
  );
}

function Register({ onDone }: { onDone: (id: number) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [number, setNumber] = useState("");
  const [color, setColor] = useState(TEAM_COLORS[0].hex);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const autoCode = (n: string) => {
    const last = n.trim().split(/\s+/).pop() ?? "";
    return last.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  };
  const shownCode = codeTouched ? code : autoCode(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const num = Number(number);
    if (name.trim().length < 2) return setErr("Enter your full name.");
    if (!/^[A-Z]{3}$/.test(shownCode)) return setErr("Driver code must be 3 letters.");
    if (!Number.isInteger(num) || num < 1 || num > 99) return setErr("Pick a car number from 1 to 99.");
    setBusy(true);
    try {
      const d = await api.createDriver({ name: name.trim(), code: shownCode, number: num, color });
      onDone(d.id);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <TopBar />
      <main className="container" style={{ maxWidth: 980 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)", gap: 32, alignItems: "center" }} className="reg-grid">
          <div>
            <div className="eyebrow" style={{ color: "var(--red)" }}>Round 1 · University Grand Prix</div>
            <h1 className="h-display" style={{ fontSize: 64, margin: "12px 0 18px" }}>
              Lights out<br />and <span className="accent">code</span>
            </h1>
            <p className="muted" style={{ fontSize: 17, lineHeight: 1.6, maxWidth: 420 }}>
              Three qualifying sessions. Every solved problem is a lap. Set purple laps, collect points and fight for the podium.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              {[["Q1", "Easy", "25 min"], ["Q2", "Medium", "27 min"], ["Q3", "Hard", "32 min"]].map(([q, l, t]) => (
                <div key={q} style={{ background: "#000", borderRadius: 8, padding: "10px 14px", minWidth: 96 }}>
                  <div style={{ fontWeight: 900, fontStyle: "italic", fontSize: 22 }}>{q}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{l} · {t}</div>
                </div>
              ))}
            </div>
          </div>
          <form className="card" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div className="eyebrow">Driver registration</div>
              <h2 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 900 }}>Get your super licence</h2>
            </div>
            <div className="field">
              <label>Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kimi Antonelli" autoFocus maxLength={40} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="field">
                <label>Driver code</label>
                <input
                  value={shownCode}
                  maxLength={3}
                  placeholder="ANT"
                  onChange={(e) => { setCodeTouched(true); setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "")); }}
                  style={{ textTransform: "uppercase", fontWeight: 700, letterSpacing: 2 }}
                />
              </div>
              <div className="field">
                <label>Car number</label>
                <input value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="12" inputMode="numeric" />
              </div>
            </div>
            <div className="field">
              <label>Team colour</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {TEAM_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c.hex}
                    title={c.name}
                    onClick={() => setColor(c.hex)}
                    style={{
                      width: 34, height: 34, borderRadius: 6, background: c.hex,
                      border: color === c.hex ? "3px solid #fff" : "3px solid transparent",
                      boxShadow: color === c.hex ? "0 0 0 2px #000 inset" : "none",
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--panel)", borderRadius: 8, padding: 12 }}>
              <div style={{ width: 6, alignSelf: "stretch", background: color, borderRadius: 3 }} />
              <div style={{ fontSize: 34, fontWeight: 900, fontStyle: "italic", color }}>{number || "00"}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{name.trim() || "Your Name"}</div>
                <div className="muted" style={{ letterSpacing: 2, fontWeight: 700 }}>{shownCode || "XXX"}</div>
              </div>
            </div>
            {err && <div className="error-box">{err}</div>}
            <button className="btn btn-red btn-lg" disabled={busy}>{busy ? "Registering…" : "Enter the paddock"}</button>
          </form>
        </div>
        <style>{`@media (max-width: 860px) { .reg-grid { grid-template-columns: 1fr !important; } }`}</style>
      </main>
    </div>
  );
}

function Paddock({ state, offset, onSwitch }: { state: DriverState; offset: number; onSwitch: () => void }) {
  const { driver, sessions } = state;
  const total = sessions.reduce((a, s) => a + s.points, 0);
  const max = sessions.reduce((a, s) => a + s.max_points, 0);
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 8, height: 78, background: driver.color, borderRadius: 4 }} />
          <div>
            <div className="eyebrow">Welcome to the paddock</div>
            <h1 className="h-display" style={{ fontSize: 48 }}>
              {driver.name} <span style={{ color: driver.color, fontStyle: "italic" }}>#{driver.number}</span>
            </h1>
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div className="eyebrow">Championship points</div>
          <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>
            {pts(total)}<span className="muted" style={{ fontSize: 20 }}> / {max}</span>
          </div>
        </div>
      </div>

      <div className="sessions-grid">
        {sessions.map((s) => <SessionCard key={s.n} s={s} offset={offset} />)}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 24, alignItems: "center", flexWrap: "wrap" }}>
        {state.all_finished && <Link href="/results" className="btn btn-red">View final results →</Link>}
        <Link href="/standings" className="btn btn-ghost">Live standings</Link>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => { if (confirm("Switch to a different driver on this computer?")) onSwitch(); }}>
          Not {driver.code}? Switch driver
        </button>
      </div>

      <div className="card" style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
        <Rule title="How it works">Each session has one clock for all its problems. Jump between problems freely. The next session unlocks when the clock runs out, you solve everything, or you box early.</Rule>
        <Rule title="Points">Each problem has 10 hidden tests. Every passed test scores: 1 pt in Q1, 2 pts in Q2, 3 pts in Q3. Your best submission counts.</Rule>
        <Rule title="Lap times">A lap is the time you spent with a problem open until it passed all 10 tests.</Rule>
        <div>
          <div style={{ fontWeight: 900, marginBottom: 8, textTransform: "uppercase", fontSize: 14, letterSpacing: 1 }}>Timing colours</div>
          {[["t-purple", "Fastest lap of all drivers in the session"], ["t-green", "Your personal best this session"], ["t-yellow", "Slower than your best"]].map(([c, t]) => (
            <div key={c} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, fontSize: 14 }}>
              <span className={c} style={{ width: 22, height: 16, borderRadius: 3, display: "inline-block" }} />
              <span className="muted">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Rule({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontWeight: 900, marginBottom: 6, textTransform: "uppercase", fontSize: 14, letterSpacing: 1 }}>{title}</div>
      <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}

function SessionCard({ s, offset }: { s: SessionSummary; offset: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (s.status !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [s.status]);
  const left = s.deadline ? s.deadline - (now + offset) / 1000 : s.duration_sec;

  const pill = {
    locked: <span className="status-pill">🔒 Locked</span>,
    ready: <span className="status-pill" style={{ color: "var(--red)" }}>Ready</span>,
    running: <span className="status-pill live">Live · {clock(left)}</span>,
    finished: <span className="status-pill" style={{ color: "#fff" }}>🏁 Completed</span>,
  }[s.status];

  return (
    <div className={`session-card ${s.status}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="q">{s.name}</div>
          <div className="muted" style={{ fontWeight: 700, marginTop: 6 }}>{s.label} · {s.problems_count} problems · {s.duration_sec / 60} min</div>
        </div>
        {pill}
      </div>
      <div className="stat-row">
        <div className="stat"><div className="v">{pts(s.points)}<span className="muted" style={{ fontSize: 15 }}>/{s.max_points}</span></div><div className="k">Points</div></div>
        <div className="stat"><div className="v">{s.solved}<span className="muted" style={{ fontSize: 15 }}>/{s.problems_count}</span></div><div className="k">Solved</div></div>
        <div className="stat"><div className="v mono" style={{ fontSize: 20, lineHeight: "39px" }}>{lapTime(s.best_lap)}</div><div className="k">Best lap</div></div>
      </div>
      <div style={{ marginTop: "auto" }}>
        {s.status === "ready" && <Link href={`/race/${s.n}`} className="btn btn-red" style={{ width: "100%" }}>Go to the grid →</Link>}
        {s.status === "running" && <Link href={`/race/${s.n}`} className="btn btn-red" style={{ width: "100%" }}>Back on track →</Link>}
        {s.status === "finished" && <Link href={`/race/${s.n}`} className="btn btn-ghost" style={{ width: "100%" }}>Session report</Link>}
        {s.status === "locked" && <div className="muted" style={{ fontSize: 14 }}>Unlocks after Q{s.n - 1} is completed.</div>}
      </div>
    </div>
  );
}
