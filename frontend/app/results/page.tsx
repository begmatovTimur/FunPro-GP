"use client";

import confetti from "canvas-confetti";
import { useEffect, useRef, useState } from "react";
import TeamLogo from "@/components/TeamLogo";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { duration, lapTime, pts } from "@/lib/format";
import type { ResultsResponse } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";

/** A driver's own race report. No positions and no table: the ranking is revealed at the podium ceremony. */
export default function ResultsPage() {
  const me = useAuth("driver");
  const [res, setRes] = useState<ResultsResponse | null>(null);
  const [err, setErr] = useState("");
  const celebrated = useRef(false);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    const load = () =>
      api.results().then(
        (r) => { if (alive) { setRes(r); setErr(""); } },
        (e) => { if (alive) setErr((e as Error).message); },
      );
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [me]);

  const allDone = res?.sessions.every((s) => s.state === "finished");
  useEffect(() => {
    if (allDone && !celebrated.current) {
      celebrated.current = true;
      confetti({ particleCount: 140, spread: 100, origin: { y: 0.3 }, colors: ["#e10600", "#ffffff", "#15151e"] });
    }
  }, [allDone]);

  const st = res?.standing;

  return (
    <div className="page">
      <TopBar me={me} />
      <div className="chequered flag-band" style={{ height: 34 }} />
      <main className="container" style={{ maxWidth: 1180 }}>
        {err && <div className="error-box">{err}</div>}
        {res && st && (
          <>
            <div className="eyebrow" style={{ color: "var(--red)" }}>{allDone ? "Chequered flag" : "Race in progress"}</div>
            <h1 className="h-display" style={{ margin: "8px 0 24px" }}>
              Your race <span className="accent">report</span>
            </h1>

            <div className="result-hero">
              <div className="card" style={{ display: "flex", gap: 24, alignItems: "center", borderLeft: `8px solid ${res.driver.color}` }}>
                {res.driver.team && <TeamLogo team={res.driver.team} size={84} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.1 }}>{res.driver.name}</div>
                  <div className="muted" style={{ fontWeight: 700, letterSpacing: 2, marginTop: 4 }}>
                    {res.driver.code}{res.driver.team_name ? ` · ${res.driver.team_name}` : ""}
                  </div>
                  <div className="status-pill" style={{ marginTop: 14 }}>
                    🏆 Final positions are revealed at the podium ceremony
                  </div>
                </div>
              </div>
              <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                <div>
                  <div className="eyebrow">Total points</div>
                  <div className="big-pts">{pts(st.total)}<span className="muted" style={{ fontSize: 24 }}>/{res.max_points.total}</span></div>
                  {st.bonus > 0 && <div className="c-purple" style={{ fontWeight: 700, marginTop: 4 }}>incl. +{st.bonus} fastest-lap bonus</div>}
                </div>
                <div>
                  <div className="eyebrow">Total time</div>
                  <div className="big-pts mono" style={{ fontSize: 40, lineHeight: "64px" }}>{duration(st.time)}</div>
                </div>
                <div>
                  <div className="eyebrow">Problems solved</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>{st.solved}<span className="muted" style={{ fontSize: 16 }}>/{res.sessions.reduce((a, s) => a + s.problems_count, 0)}</span></div>
                </div>
                <div>
                  <div className="eyebrow">Best lap</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }} className="mono">{lapTime(st.best_lap)}</div>
                </div>
              </div>
            </div>

            <div className="sessions-grid" style={{ marginBottom: 32 }}>
              {res.sessions.map((s) => (
                <div key={s.n} className={`session-card ${s.state === "finished" ? "finished" : s.state === "pending" ? "locked" : "running"}`} style={{ minHeight: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <div className="q" style={{ fontSize: 40 }}>{s.name}</div>
                    <div style={{ fontSize: 30, fontWeight: 900 }}>{pts((s.points ?? 0) + (s.bonus ?? 0))}<span className="muted" style={{ fontSize: 15 }}>/{s.max_points + s.fastest_lap_bonus}</span></div>
                  </div>
                  <div className="mini-laps">
                    {s.problems.map((p) => (
                      <span key={p.id} className={`mini-lap ${p.color ? `t-${p.color}` : ""}`} title={`${p.title}: ${p.best_passed}/${p.total_tests} tests`}>
                        {p.order}
                      </span>
                    ))}
                  </div>
                  <div className="stat-row">
                    <div className="stat"><div className="v" style={{ fontSize: 20 }}>{s.solved}/{s.problems_count}</div><div className="k">Solved</div></div>
                    <div className="stat"><div className="v mono" style={{ fontSize: 20 }}>{duration(s.time)}</div><div className="k">Time</div></div>
                    <div className="stat"><div className="v mono" style={{ fontSize: 20 }}>{s.bonus ? <span className="fl-badge" style={{ marginLeft: 0, fontSize: 16 }}>{lapTime(s.best_lap)} <small>+{s.bonus}</small></span> : lapTime(s.best_lap)}</div><div className="k">Best lap</div></div>
                  </div>
                  {s.fastest_lap && !s.bonus && (
                    <div style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="muted">Session fastest lap</span>
                      <span className="fl-badge" style={{ marginLeft: 0 }}>{lapTime(s.fastest_lap.lap)}</span>
                      <b>{s.fastest_lap.code}</b>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
