"use client";

import { useEffect, useState } from "react";
import StandingsTable from "@/components/StandingsTable";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import { lapTime } from "@/lib/format";
import type { Standings } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";

export default function StandingsPage() {
  const me = useAuth("admin"); // the full table is for Race Control (projector) only
  const [data, setData] = useState<Standings | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!me) return;
    let alive = true;
    const load = () =>
      api.standings().then(
        (d) => { if (alive) { setData(d); setErr(""); } },
        (e) => { if (alive) setErr(e.message); },
      );
    load();
    const t = setInterval(load, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [me]);

  const live = data && Object.entries(data.states).find(([, st]) => st === "running" || st === "lights");

  return (
    <div className="page">
      <TopBar me={me} />
      <main className="container" style={{ maxWidth: 1280 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
          <h1 className="h-display">FunPro GP Drivers&apos; Standings</h1>
          <span className={`status-pill ${live ? "live" : ""}`} style={{ marginLeft: "auto" }}>
            {live ? `Q${live[0]} live · updates automatically` : "Updates automatically"}
          </span>
        </div>
        {data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 16 }}>
            {(["1", "2", "3"] as const).map((n) => {
              const fl = data.fastest_laps[n];
              return (
                <div key={n} className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontWeight: 900, fontStyle: "italic", fontSize: 24 }}>Q{n}</div>
                  <div className="eyebrow" style={{ fontSize: 11 }}>Fastest lap</div>
                  {fl ? (
                    <>
                      <span className="fl-badge" style={{ fontSize: 15, marginLeft: "auto" }}>{lapTime(fl.lap)}</span>
                      <b>{fl.code}</b>
                    </>
                  ) : (
                    <span className="muted" style={{ marginLeft: "auto" }}>—</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {err && <div className="error-box" style={{ marginBottom: 16 }}>{err}</div>}
        <div className="table-card">{data && <StandingsTable rows={data.rows} />}</div>
      </main>
    </div>
  );
}
