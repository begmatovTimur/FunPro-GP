"use client";

import Link from "next/link";
import { lapTime, pts } from "@/lib/format";
import type { Board } from "@/lib/types";

export default function SessionReport({ board }: { board: Board }) {
  const s = board.session;
  const next = s.n < 3 ? s.n + 1 : null;
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div className="chequered flag-band" />
      <main className="container" style={{ maxWidth: 920 }}>
        <div className="eyebrow" style={{ color: "var(--red)" }}>Chequered flag</div>
        <h1 className="h-display" style={{ margin: "8px 0 24px" }}>
          {s.name} <span className="accent">complete</span>
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            ["Points", `${pts(s.points)} / ${s.max_points}`],
            ["Solved", `${s.solved} / ${s.problems_count}`],
            ["Best lap", lapTime(s.best_lap)],
            ["Purple laps", String(s.colors.purple)],
          ].map(([k, v]) => (
            <div key={k} className="card" style={{ padding: 18 }}>
              <div className="eyebrow">{k}</div>
              <div style={{ fontSize: 30, fontWeight: 900 }}>{v}</div>
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

        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          {next ? (
            <Link href={`/race/${next}`} className="btn btn-red btn-lg">Go to Q{next} →</Link>
          ) : (
            <Link href="/results" className="btn btn-red btn-lg">Final results →</Link>
          )}
          <Link href="/" className="btn btn-ghost btn-lg">Paddock</Link>
        </div>
      </main>
    </div>
  );
}
