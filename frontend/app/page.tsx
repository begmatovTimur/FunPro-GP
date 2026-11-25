"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import TeamLogo from "@/components/TeamLogo";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { clock, duration, lapTime, pts } from "@/lib/format";
import type { DriverState, SessionSummary } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";

export default function Paddock() {
  const me = useAuth("driver");
  const router = useRouter();
  const [state, setState] = useState<DriverState | null>(null);
  const [offset, setOffset] = useState(0);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const st = await api.state();
      setOffset(st.server_now * 1000 - Date.now());
      setState(st);
      setErr("");
      // Race Control started a session -> everyone goes to the lights.
      const live = st.sessions.find((s) => (s.state === "lights" || s.state === "running") && s.status !== "finished");
      if (live) router.push(`/race/${live.n}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [router]);

  useEffect(() => {
    if (!me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [me, load]);

  const driver = state?.driver ?? me?.driver;
  const total = state ? state.sessions.reduce((a, s) => a + (s.points ?? 0) + (s.bonus ?? 0), 0) : 0;

  return (
    <div className="page">
      <TopBar me={me} />
      <main className="container">
        {err && <div className="error-box" style={{ marginBottom: 20 }}>{err}</div>}
        {driver && state && (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 8, height: 78, background: driver.color, borderRadius: 4 }} />
                {driver.team && <TeamLogo team={driver.team} size={64} />}
                <div>
                  <div className="eyebrow">Welcome to the paddock{driver.team_name ? ` · ${driver.team_name}` : ""}</div>
                  <h1 className="h-display" style={{ fontSize: 48 }}>
                    {driver.name} <span style={{ color: driver.color, fontStyle: "italic" }}>{driver.code}</span>
                  </h1>
                </div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div className="eyebrow">Championship points</div>
                <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>
                  {pts(total)}<span className="muted" style={{ fontSize: 20 }}> / {state.max_points.total}</span>
                </div>
              </div>
            </div>

            <div className="sessions-grid">
              {state.sessions.map((s) => <SessionCard key={s.n} s={s} offset={offset} />)}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24, alignItems: "center", flexWrap: "wrap" }}>
              {state.all_finished && <Link href="/results" className="btn btn-red">View final results →</Link>}
            </div>

            <div className="card" style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
              <Rule title="How it works">Race Control starts each session for everyone at once. Stay on this page: when the lights come on, you&apos;re taken to the grid automatically. One clock for all problems; jump between them freely.</Rule>
              <Rule title="Points">Each problem has 10 hidden tests. Every passed test scores: 1 pt in Q1, 2 pts in Q2, 3 pts in Q3. Fastest lap of a session: +2 (Q1), +5 (Q2), +7 (Q3). The full ranking stays secret until the podium ceremony.</Rule>
              <Rule title="Lap times">A lap is the time you spent with a problem open until it passed all 10 tests. Colours update live as others set laps.</Rule>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 8, textTransform: "uppercase", fontSize: 14, letterSpacing: 1 }}>Timing colours</div>
                {[["t-purple", "Fastest lap of the session (only one)"], ["t-green", "Your personal best (only one)"], ["t-yellow", "Your other laps"]].map(([c, t]) => (
                  <div key={c} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, fontSize: 14 }}>
                    <span className={c} style={{ width: 22, height: 16, borderRadius: 3, display: "inline-block" }} />
                    <span className="muted">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
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
    if (s.state !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [s.state]);
  const left = s.end_at ? s.end_at - (now + offset) / 1000 : s.duration_sec;
  const cls = s.state === "pending" ? "locked" : s.state === "finished" ? "finished" : "running";

  const pill = {
    pending: <span className="status-pill">Not started</span>,
    lights: <span className="status-pill live">Lights!</span>,
    running: <span className="status-pill live">Live · {clock(left)}</span>,
    finished: <span className="status-pill" style={{ color: "#fff" }}>🏁 Completed</span>,
  }[s.state];

  return (
    <div className={`session-card ${cls}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="q">{s.name}</div>
          <div className="muted" style={{ fontWeight: 700, marginTop: 6 }}>{s.label} · {s.problems_count} problems · {s.duration_sec / 60} min</div>
        </div>
        {pill}
      </div>
      <div className="stat-row">
        <div className="stat"><div className="v">{pts((s.points ?? 0) + (s.bonus ?? 0))}<span className="muted" style={{ fontSize: 15 }}>/{s.max_points}</span></div><div className="k">Points</div></div>
        <div className="stat"><div className="v">{s.solved}<span className="muted" style={{ fontSize: 15 }}>/{s.problems_count}</span></div><div className="k">Solved</div></div>
        <div className="stat"><div className="v mono" style={{ fontSize: 20, lineHeight: "39px" }}>{duration(s.time)}</div><div className="k">Time</div></div>
        <div className="stat">
          <div className={`v mono ${s.bonus ? "" : ""}`} style={{ fontSize: 20, lineHeight: "39px" }}>
            {s.bonus ? <span className="fl-badge" style={{ marginLeft: 0, fontSize: 16 }}>{lapTime(s.best_lap)}</span> : lapTime(s.best_lap)}
          </div>
          <div className="k">Best lap</div>
        </div>
      </div>
      <div style={{ marginTop: "auto" }}>
        {s.state === "pending" && <div className="muted" style={{ fontSize: 14 }}>Race Control will start this session. Stay on this page.</div>}
        {(s.state === "lights" || s.state === "running") && s.status !== "finished" && (
          <Link href={`/race/${s.n}`} className="btn btn-red" style={{ width: "100%" }}>Back on track →</Link>
        )}
        {(s.state === "finished" || s.status === "finished") && (
          <Link href={`/race/${s.n}`} className="btn btn-ghost" style={{ width: "100%" }}>Session report</Link>
        )}
        {s.fastest_lap && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span className="muted" style={{ fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontSize: 11 }}>Fastest lap</span>
            <span className="fl-badge" style={{ marginLeft: 0 }}>{lapTime(s.fastest_lap.lap)}</span>
            <b>{s.bonus ? "YOU" : s.fastest_lap.code}</b>
            {s.bonus ? <span className="c-purple">+{s.bonus} pts</span> : null}
          </div>
        )}
      </div>
    </div>
  );
}
