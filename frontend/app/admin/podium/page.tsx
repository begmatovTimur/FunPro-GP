"use client";

import confetti from "canvas-confetti";
import { useEffect, useState } from "react";
import DriverFigure from "@/components/DriverFigure";
import StandingsTable from "@/components/StandingsTable";
import TeamLogo from "@/components/TeamLogo";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { duration, pts } from "@/lib/format";
import { liveryFor } from "@/lib/liveries";
import type { StandingRow, Standings } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";

const METAL: Record<number, { name: string; color: string; grad: string; height: number }> = {
  1: { name: "Winner", color: "#f2c94c", grad: "linear-gradient(180deg,#f7dc7a,#d4a017 55%,#a87400)", height: 210 },
  2: { name: "Second", color: "#c9ced3", grad: "linear-gradient(180deg,#f1f3f5,#a8adb3 55%,#7d8288)", height: 160 },
  3: { name: "Third", color: "#e0975f", grad: "linear-gradient(180deg,#f4be8c,#b4652f 55%,#8a4b25)", height: 125 },
};

/** Race Control's podium ceremony: P3, P2, then P1 revealed one by one; P4+ in a table below. */
export default function PodiumPage() {
  const me = useAuth("admin");
  const [data, setData] = useState<Standings | null>(null);
  const [revealed, setRevealed] = useState(0); // 0 = none, 1 = P3, 2 = P2 too, 3 = all
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!me) return;
    let alive = true;
    const load = () => api.standings().then((d) => { if (alive) { setData(d); setErr(""); } }, (e) => alive && setErr(e.message));
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [me]);

  const rows = data?.rows ?? [];
  const byPos = (p: number) => rows.find((r) => r.pos === p) ?? null;
  const finished = data ? Object.values(data.states).every((s) => s === "finished") : false;
  const isShown = (p: number) => revealed >= 4 - p; // P3 first, then P2, then P1

  function next() {
    const n = Math.min(3, revealed + 1);
    setRevealed(n);
    const p = 4 - n;
    const r = byPos(p);
    const L = liveryFor(r?.driver.team, r?.driver.color);
    if (p === 1) {
      const burst = (x: number) => confetti({ particleCount: 160, spread: 90, startVelocity: 55, origin: { x, y: 0.55 }, colors: [L.suit, L.accent, "#f2c94c", "#ffffff"] });
      burst(0.2); burst(0.8);
      setTimeout(() => confetti({ particleCount: 220, spread: 140, origin: { y: 0.3 }, colors: ["#f2c94c", "#ffffff", L.accent] }), 400);
    } else {
      confetti({ particleCount: 60, spread: 60, origin: { x: p === 2 ? 0.3 : 0.7, y: 0.6 }, colors: [METAL[p].color, "#ffffff"] });
    }
  }

  const label = revealed < 3 ? `Reveal P${3 - revealed}` : "All revealed";

  return (
    <div className="page">
      <TopBar me={me} />
      <section className="podium-stage">
        <div className="podium-head">
          <div>
            <div className="eyebrow" style={{ color: "var(--red)" }}>FunPro GP 2026 · {finished ? "Final classification" : "Provisional: race still running"}</div>
            <h1 className="h-display" style={{ fontSize: 54 }}>The <span className="accent">podium</span></h1>
          </div>
          <div className="podium-controls">
            <button className="btn btn-red btn-lg" onClick={next} disabled={revealed >= 3 || rows.length === 0}>{label}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRevealed(3)}>Show all</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRevealed(0)}>Hide</button>
          </div>
        </div>
        {err && <div className="error-box">{err}</div>}

        <div className="podium-row">
          {[2, 1, 3].map((p) => (
            <PodiumSpot key={p} place={p} row={byPos(p)} shown={isShown(p)} />
          ))}
        </div>
      </section>

      <main className="container" style={{ maxWidth: 1280, paddingTop: 30 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
          <h2 className="h-display" style={{ fontSize: 30 }}>Classification</h2>
          <span className="muted" style={{ fontSize: 14 }}>From P4. Equal points are split by total time.</span>
        </div>
        <div className="table-card">
          {revealed < 3 ? (
            <p className="muted" style={{ padding: "16px 0" }}>Shown after the winner is revealed, so nobody can work out the podium early.</p>
          ) : rows.length > 3 ? (
            <StandingsTable rows={rows.slice(3)} />
          ) : (
            <p className="muted" style={{ padding: "16px 0" }}>Nobody behind the podium.</p>
          )}
        </div>
      </main>
    </div>
  );
}

function PodiumSpot({ place, row, shown }: { place: number; row: StandingRow | null; shown: boolean }) {
  const m = METAL[place];
  const visible = shown && row;
  return (
    <div className={`podium-col p${place}`}>
      <div className={`podium-figure ${visible ? "in" : "mystery"}`}>
        {visible ? (
          <DriverFigure
            team={row.driver.team}
            color={row.driver.color}
            number={row.driver.number}
            celebrate={place === 1}
            trophy={place === 1 ? m.color : undefined}
            size={place === 1 ? 230 : 200}
          />
        ) : (
          <div className="mystery">
            <div className="mystery-shape"><DriverFigure size={place === 1 ? 230 : 200} /></div>
            <span>?</span>
          </div>
        )}
      </div>
      <div className={`podium-card ${visible ? "in" : ""}`} style={{ borderTopColor: m.color }}>
        {visible ? (
          <>
            <div className="pc-name">{row.driver.name}</div>
            <div className="pc-team">
              <TeamLogo team={row.driver.team} color={row.driver.color} size={22} />
              <span>{row.driver.code}{row.driver.team_name ? ` · ${row.driver.team_name}` : ""}</span>
            </div>
            <div className="pc-stats">
              <span><b>{pts(row.total)}</b> pts</span>
              <span className="mono">{duration(row.time)}</span>
            </div>
          </>
        ) : (
          <div className="pc-name muted">{row ? "???" : "—"}</div>
        )}
      </div>
      <div className="podium-block" style={{ height: m.height, background: m.grad }}>
        <span>{place}</span>
      </div>
    </div>
  );
}
