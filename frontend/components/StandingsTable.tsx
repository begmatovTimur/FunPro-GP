import type { StandingRow } from "@/lib/types";
import TeamLogo from "@/components/TeamLogo";
import { duration, lapTime, pts } from "@/lib/format";

/**
 * F1-style drivers' standings. The holder of each session's fastest lap gets a purple
 * badge with the lap time next to that session's points (and the bonus is in the total).
 */
export default function StandingsTable({
  rows,
  meId,
  onDelete,
}: {
  rows: StandingRow[];
  meId?: number | null;
  onDelete?: (row: StandingRow) => void;
}) {
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
          <th className="num" title="Time to reach your score in each session (lights out → last scoring submit), added up. Breaks ties on points.">Time</th>
          <th className="num">Pts.</th>
          {onDelete && <th />}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.driver.id} className={r.driver.id === meId ? "me" : ""}>
            <td className={r.pos <= 3 ? `pos-${r.pos}` : ""} style={{ fontWeight: 900 }}>
              {r.pos}
            </td>
            <td>
              <TeamLogo team={r.driver.team} color={r.driver.color} size={22} title={r.driver.team_name || undefined} />
              {r.driver.name} <span className="muted" style={{ marginLeft: 6 }}>{r.driver.code}</span>
            </td>
            <td className="muted">{r.driver.number}</td>
            {(["1", "2", "3"] as const).map((n) => {
              const s = r.sessions[n];
              return (
                <td key={n} className="num">
                  {s.state === "pending" ? (
                    <span className="muted">—</span>
                  ) : (
                    <>
                      {pts(s.points)}
                      {s.fastest_lap && s.best_lap !== null && (
                        <span className="fl-badge" title={`Fastest lap of Q${n}: +${s.bonus} pts`}>
                          {lapTime(s.best_lap)} <small>+{s.bonus}</small>
                        </span>
                      )}
                    </>
                  )}
                </td>
              );
            })}
            <td className="num">{r.solved}</td>
            <td className="num mono" style={{ fontWeight: 500 }}>
              {lapTime(r.best_lap)}
            </td>
            <td className="num muted">{r.pos === 1 ? "—" : `-${pts(r.gap)}`}</td>
            <td
              className="num mono"
              style={{ fontWeight: 500 }}
              title={(["1", "2", "3"] as const).map((n) => `Q${n} ${duration(r.sessions[n].time)}`).join(" · ")}
            >
              {duration(r.time)}
            </td>
            <td className="num pts">{pts(r.total)}</td>
            {onDelete && (
              <td className="num">
                <button className="btn btn-sm btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: 12 }} onClick={() => onDelete(r)}>
                  Remove
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
