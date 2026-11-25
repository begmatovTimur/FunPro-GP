"use client";

import Link from "next/link";
import { duration, lapTime, pts } from "@/lib/format";
import type { Board } from "@/lib/types";

export default function SessionReport({ board, waitingForFlag }: { board: Board; waitingForFlag?: boolean }) {
  const s = board.session;
  const next = s.n < 3 ? s.n + 1 : null;
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div className="chequered flag-band" />
      <main className="container" style={{ maxWidth: 920 }}>
        <div className="eyebrow" style={{ color: "var(--red)" }}>{waitingForFlag ? "All laps complete" : "Chequered flag"}</div>
        <h1 className="h-display" style={{ margin: "8px 0 24px" }}>
          {s.name} <span className="accent">complete</span>
        </h1>

        {waitingForFlag && (
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            You solved every problem. The session is still running for the others, and your colours can still
            change if someone sets a faster lap.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            ["Points", `${pts((s.points ?? 0) + (s.bonus ?? 0))} / ${s.max_points + s.fastest_lap_bonus}`],
            ["Solved", `${s.solved ?? 0} / ${s.problems_count}`],
            ["Time", duration(s.time)],
            ["Best lap", lapTime(s.best_lap)],
            ["Fastest lap", s.bonus ? `Yours! +${s.bonus}` : s.fastest_lap ? `${s.fastest_lap.code} ${lapTime(s.fastest_lap.lap)}` : "—"],
          ].map(([k, v]) => (
            <div key={k} className="card" style={{ padding: 18, ...(k === "Fastest lap" && s.bonus ? { background: "var(--purple)" } : {}) }}>
              <div className="eyebrow" style={k === "Fastest lap" && s.bonus ? { color: "#fff" } : {}}>{k}</div>
              <div style={{ fontSize: 26, fontWeight: 900 }}>{v}</div>
            </div>
          ))}
        </div>

        <div className="table-card">
          <table className="standings" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th>Lap</th>
                <th>Problem</th>
                <th className="num">Tests</th>
                <th className="num">Lap time</th>
                <th className="num">Pts.</th>
              </tr>
            </thead>
            <tbody>
              {board.problems.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className={`mini-lap ${p.progress.color ? `t-${p.progress.color}` : ""}`}>{p.order}</span>
                  </td>
                  <td>{p.title}</td>
                  <td className="num">{p.progress.best_passed}/{p.tests_count}</td>
                  <td className="num mono">{lapTime(p.progress.lap_seconds)}</td>
                  <td className="num pts">{pts(p.progress.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap", alignItems: "center" }}>
          {next ? (
            <span className="status-pill live" style={{ fontSize: 14, padding: "10px 16px" }}>
              Stay here: Race Control will start Q{next}
            </span>
          ) : (
            !waitingForFlag && <Link href="/results" className="btn btn-red btn-lg">Final results →</Link>
          )}
          <Link href="/" className="btn btn-ghost btn-lg">Paddock</Link>
        </div>
      </main>
    </div>
  );
}
