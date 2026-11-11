import type { StandingRow } from "@/lib/types";
import { lapTime, pts } from "@/lib/format";

export default function StandingsTable({ rows, meId }: { rows: StandingRow[]; meId?: number | null }) {
  if (!rows.length) return <p className="muted" style={{ padding: "20px 0" }}>No drivers on track yet.</p>;
  return (
    <table className="standings">
      <thead>
        <tr>
          <th style={{ width: 60 }}>Pos.</th>
          <th>Driver</th>
          <th>No.</th>
          <th className="num">Q1</th>
          <th className="num">Q2</th>
          <th className="num">Q3</th>
          <th className="num">Solved</th>
          <th className="num">Best lap</th>
          <th className="num">Gap</th>
          <th className="num">Pts.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.driver.id} className={r.driver.id === meId ? "me" : ""}>
            <td className={r.pos <= 3 ? `pos-${r.pos}` : ""} style={{ fontWeight: 900 }}>
              {r.pos}
            </td>
            <td>
              <span className="team-dot" style={{ background: r.driver.color }} />
              {r.driver.name} <span className="muted" style={{ marginLeft: 6 }}>{r.driver.code}</span>
            </td>
            <td className="muted">{r.driver.number}</td>
            {(["1", "2", "3"] as const).map((n) => (
              <td key={n} className="num">
                {r.sessions[n]?.status === "not_started" ? (
                  <span className="muted">—</span>
                ) : (
                  <>
                    {pts(r.sessions[n].points)}
                    {r.sessions[n].status === "running" && (
                      <span className="c-green" style={{ marginLeft: 6, fontSize: 11 }}>●</span>
                    )}
                  </>
                )}
              </td>
            ))}
            <td className="num">{r.solved}</td>
            <td className="num mono" style={{ fontWeight: 500 }}>{lapTime(r.best_lap)}</td>
            <td className="num muted">{r.pos === 1 ? "—" : `-${pts(r.gap)}`}</td>
            <td className="num pts">{pts(r.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
