"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import StandingsTable from "@/components/StandingsTable";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { clock, lapTime } from "@/lib/format";
import type { AdminOverview, StandingRow } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";

type SessionInfo = AdminOverview["sessions"][number];

export default function RaceControl() {
  const me = useAuth("admin");
  const [data, setData] = useState<AdminOverview | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(0); // set by the ticking interval (Date.now() can't run during prerender)
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmBox, setConfirmBox] = useState<null | { title: string; text: string; action: () => Promise<unknown>; danger?: boolean }>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.admin.overview();
      setOffset(d.server_now * 1000 - Date.now());
      setData(d);
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 2000);
    const c = setInterval(() => setNow(Date.now()), 250);
    return () => { clearInterval(t); clearInterval(c); };
  }, [me, load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const serverNow = (now + offset) / 1000;
  const sessions = data?.sessions ?? [];
  const liveSession = sessions.find((s) => s.state === "lights" || s.state === "running");

  function startBlocker(s: SessionInfo): string | null {
    if (s.state !== "pending") return null;
    if (liveSession) return `${liveSession.name} is still running`;
    const prev = sessions.find((x) => x.n === s.n - 1);
    if (prev && prev.state !== "finished") return `Finish ${prev.name} first`;
    return null;
  }

  return (
    <div className="page">
      <TopBar me={me} />
      <main className="container" style={{ maxWidth: 1280 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          <div>
            <div className="eyebrow" style={{ color: "var(--red)" }}>FIA-approved, probably</div>
            <h1 className="h-display">Race <span className="accent">Control</span></h1>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            <span className="status-pill">{data?.drivers ?? 0} drivers registered</span>
            <Link href="/standings" target="_blank" className="btn btn-ghost btn-sm">Projector standings ↗</Link>
            <Link href="/admin/podium" className="btn btn-red btn-sm">🏆 Podium ceremony</Link>
          </div>
        </div>

        {err && <div className="error-box" style={{ marginBottom: 16 }}>{err}</div>}

        <div className="sessions-grid" style={{ marginBottom: 28 }}>
          {sessions.map((s) => {
            const blocker = startBlocker(s);
            const toLights = s.lights_start ? s.lights_start - serverNow : 0;
            const toGo = s.lights_out ? s.lights_out - serverNow : 0;
            const left = s.end_at ? s.end_at - serverNow : s.duration_sec;
            const cls = s.state === "pending" ? (blocker ? "locked" : "ready") : s.state === "finished" ? "finished" : "running";
            return (
              <div key={s.n} className={`session-card ${cls}`} style={{ minHeight: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div className="q">{s.name}</div>
                    <div className="muted" style={{ fontWeight: 700, marginTop: 6 }}>{s.label} · {s.problems_count} problems · {s.duration_sec / 60} min</div>
                  </div>
                  {s.state === "pending" && <span className="status-pill">Not started</span>}
                  {s.state === "lights" && <span className="status-pill live">Lights {toLights > 0 ? `in ${Math.ceil(toLights)}s` : "on"}</span>}
                  {s.state === "running" && <span className="status-pill live">Live</span>}
                  {s.state === "finished" && <span className="status-pill" style={{ color: "#fff" }}>🏁 Finished</span>}
                </div>

                {(s.state === "running" || s.state === "lights") && (
                  <div>
                    <div className="eyebrow">{s.state === "lights" ? "Lights out in" : "Time left"}</div>
                    <div className="mono" style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.1, color: left < 60 ? "var(--red)" : "#fff" }}>
                      {s.state === "lights" ? `0:0${Math.max(0, Math.ceil(toGo))}` : clock(left)}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>{s.joined} drivers on track</div>
                  </div>
                )}

                {s.fastest_lap && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                    <span className="muted" style={{ fontWeight: 700, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>Fastest lap</span>
                    <span className="fl-badge" style={{ marginLeft: 0 }}>{lapTime(s.fastest_lap.lap)}</span>
                    <b>{s.fastest_lap.name}</b>
                    <span className="muted">+{s.fastest_lap_bonus}</span>
                  </div>
                )}

                {s.state !== "pending" && (
                  <table className="admin-mini">
                    <thead><tr><th>#</th><th>Problem</th><th className="num">Solved</th><th className="num">Tried</th><th className="num">Best</th></tr></thead>
                    <tbody>
                      {s.problems.map((p) => (
                        <tr key={p.id}>
                          <td>{p.order}</td>
                          <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</td>
                          <td className="num">{p.solved}</td>
                          <td className="num">{p.attempted}</td>
                          <td className="num mono">{p.best_lap !== null ? `${lapTime(p.best_lap)} ${p.best_code}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div style={{ marginTop: "auto", display: "grid", gap: 8 }}>
                  {s.state === "pending" && (
                    <>
                      <button
                        className="btn btn-red btn-lg"
                        disabled={!!blocker || busy}
                        onClick={() => setConfirmBox({
                          title: `Start ${s.name}?`,
                          text: `The five red lights start on every driver's screen in ${2} seconds. After lights out, the ${s.duration_sec / 60}-minute clock runs for everyone.`,
                          action: () => api.admin.start(s.n),
                        })}
                      >
                        Start the race
                      </button>
                      {blocker && <div className="muted" style={{ fontSize: 13, textAlign: "center" }}>{blocker}</div>}
                    </>
                  )}
                  {(s.state === "running" || s.state === "lights") && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <button className="btn btn-sm" disabled={busy} onClick={() => act(() => api.admin.extend(s.n, -60))}>− 1 min</button>
                        <button className="btn btn-sm" disabled={busy} onClick={() => act(() => api.admin.extend(s.n, 60))}>+ 1 min</button>
                      </div>
                      <button
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() => setConfirmBox({
                          title: `Chequered flag for ${s.name}?`,
                          text: "This ends the session for everyone right now. Submissions after this are rejected.",
                          action: () => api.admin.end(s.n),
                          danger: true,
                        })}
                      >
                        🏁 End session now
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
          <h2 className="h-display" style={{ fontSize: 30 }}>Live standings</h2>
          <span className="muted" style={{ fontSize: 14 }}>Purple badge = fastest lap of that session (bonus included in Pts.)</span>
        </div>
        <div className="table-card" style={{ marginBottom: 32 }}>
          {data && (
            <StandingsTable
              rows={data.standings.rows}
              onDelete={(r: StandingRow) => setConfirmBox({
                title: `Remove ${r.driver.name}?`,
                text: "Deletes this driver account and all of their submissions and points. Useful for duplicate or test accounts.",
                action: () => api.admin.deleteDriver(r.driver.id),
                danger: true,
              })}
            />
          )}
        </div>

        <div className="card danger-zone">
          <div>
            <div style={{ fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>Reset the event</div>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>
              For after the dry run. Clears all sessions, laps, points and submissions so Q1 can be started again.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirmBox({
              title: "Reset results, keep drivers?",
              text: "All sessions, laps, points and submissions are deleted. Driver accounts stay, so students can log in with the same username and password.",
              action: () => api.admin.reset(true), danger: true,
            })}>Reset results</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirmBox({
              title: "Reset everything?",
              text: "Deletes every driver account as well as all results. Everyone has to log in again (new accounts are created).",
              action: () => api.admin.reset(false), danger: true,
            })}>Reset everything</button>
          </div>
        </div>
      </main>

      {confirmBox && (
        <div className="overlay" onClick={() => setConfirmBox(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{confirmBox.title}</h2>
            <p className="muted" style={{ lineHeight: 1.6 }}>{confirmBox.text}</p>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmBox(null)}>Cancel</button>
              <button
                className="btn btn-red"
                style={{ flex: 1 }}
                onClick={() => { const a = confirmBox.action; setConfirmBox(null); act(a); }}
              >
                {confirmBox.danger ? "Yes, do it" : "Lights, go!"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
