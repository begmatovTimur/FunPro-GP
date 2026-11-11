"use client";

import confetti from "canvas-confetti";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import StandingsTable from "@/components/StandingsTable";
import TopBar from "@/components/TopBar";
import { api, ApiError } from "@/lib/api";
import { lapTime, pts } from "@/lib/format";
import type { ResultsResponse, Standings } from "@/lib/types";
import { useDriverId } from "@/lib/useDriver";

export default function ResultsPage() {
  const [driverId] = useDriverId();
  const [res, setRes] = useState<ResultsResponse | null>(null);
  const [table, setTable] = useState<Standings | null>(null);
  const [err, setErr] = useState("");
  const celebrated = useRef(false);

  useEffect(() => {
    if (!driverId) return;
    let alive = true;
    const load = async () => {
      try {
        const [r, t] = await Promise.all([api.results(driverId), api.standings()]);
        if (!alive) return;
        setRes(r);
        setTable(t);
      } catch (e) {
        if (alive) setErr(e instanceof ApiError && e.status === 404 ? "Driver not found. Register on the paddock page." : (e as Error).message);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [driverId]);

  const allDone = res?.sessions.every((s) => s.status === "finished");
  useEffect(() => {
    if (allDone && !celebrated.current) {
      celebrated.current = true;
      confetti({ particleCount: 140, spread: 100, origin: { y: 0.3 }, colors: ["#e10600", "#ffffff", "#15151e"] });
    }
  }, [allDone]);

  if (driverId === null)
    return (
      <div className="page">
        <TopBar />
        <main className="container"><Link className="btn btn-red" href="/">Register first</Link></main>
      </div>
    );

  const st = res?.standing;
  const stillRacing = table ? table.rows.filter((r) => Object.values(r.sessions).some((s) => s.status !== "finished")).length : 0;

  return (
    <div className="page">
      <TopBar driver={res?.driver} />
      <div className="chequered flag-band" style={{ height: 34 }} />
      <main className="container" style={{ maxWidth: 1240 }}>
        {err && <div className="error-box">{err}</div>}
        {res && st && !allDone && (
          <div className="card" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <div className="eyebrow">Not finished yet</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>Complete all three sessions to see your final classification.</div>
            </div>
            <Link className="btn btn-red" style={{ marginLeft: "auto" }} href={`/race/${res.sessions.find((s) => s.status !== "finished")!.n}`}>
              Back to the track →
            </Link>
          </div>
        )}

        {res && st && allDone && (
          <>
            <div className="eyebrow" style={{ color: "var(--red)" }}>Final classification</div>
            <h1 className="h-display" style={{ margin: "8px 0 24px" }}>
              Race <span className="accent">report</span>
            </h1>
            <div className="result-hero">
              <div className="card" style={{ display: "flex", gap: 26, alignItems: "center", borderLeft: `8px solid ${res.driver.color}` }}>
                <div className={`big-pos ${st.pos <= 3 ? `pos-${st.pos}` : ""}`}>P{st.pos}</div>
                <div>
                  <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.1 }}>{res.driver.name}</div>
                  <div className="muted" style={{ fontWeight: 700, letterSpacing: 2, marginTop: 4 }}>
                    {res.driver.code} · #{res.driver.number}
                  </div>
                  <div className="muted" style={{ marginTop: 10 }}>
                    of {res.field_size} drivers{stillRacing > 0 && ` · provisional, ${stillRacing} still on track`}
                  </div>
                </div>
              </div>
              <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                <div>
                  <div className="eyebrow">Total points</div>
                  <div className="big-pts">{pts(st.total)}<span className="muted" style={{ fontSize: 24 }}>/{res.max_points}</span></div>
                </div>
                <div>
                  <div className="eyebrow">Best lap</div>
                  <div className="big-pts mono" style={{ fontSize: 40, lineHeight: "64px" }}>{lapTime(st.best_lap)}</div>
                </div>
                <div>
                  <div className="eyebrow">Problems solved</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }}>{st.solved}<span className="muted" style={{ fontSize: 16 }}>/{res.sessions.reduce((a, s) => a + s.problems_count, 0)}</span></div>
                </div>
                <div>
                  <div className="eyebrow">Purple laps</div>
                  <div style={{ fontSize: 28, fontWeight: 900 }} className="c-purple">{st.purple}</div>
                </div>
              </div>
            </div>

            <div className="sessions-grid" style={{ marginBottom: 32 }}>
              {res.sessions.map((s) => (
                <div key={s.n} className="session-card finished" style={{ minHeight: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <div className="q" style={{ fontSize: 40 }}>{s.name}</div>
                    <div style={{ fontSize: 30, fontWeight: 900 }}>{pts(s.points)}<span className="muted" style={{ fontSize: 15 }}>/{s.max_points}</span></div>
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
                    <div className="stat"><div className="v mono" style={{ fontSize: 20 }}>{lapTime(s.best_lap)}</div><div className="k">Best lap</div></div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="h-display" style={{ fontSize: 30, marginBottom: 16 }}>Drivers&apos; standings</h2>
        <div className="table-card">{table && <StandingsTable rows={table.rows} meId={driverId} />}</div>
      </main>
    </div>
  );
}
