"use client";

import { useEffect, useState } from "react";
import StandingsTable from "@/components/StandingsTable";
import TopBar from "@/components/TopBar";
import { api } from "@/lib/api";
import type { Standings } from "@/lib/types";
import { useDriverId } from "@/lib/useDriver";

export default function StandingsPage() {
  const [driverId] = useDriverId();
  const [data, setData] = useState<Standings | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () =>
      api.standings().then(
        (d) => { if (alive) { setData(d); setErr(""); } },
        (e) => { if (alive) setErr(e.message); },
      );
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const me = data?.rows.find((r) => r.driver.id === driverId)?.driver;
  const live = data?.rows.filter((r) => Object.values(r.sessions).some((s) => s.status === "running")).length ?? 0;

  return (
    <div className="page">
      <TopBar driver={me} />
      <main className="container" style={{ maxWidth: 1240 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          <h1 className="h-display">FunPro GP Drivers&apos; Standings</h1>
          <span className="status-pill live" style={{ marginLeft: "auto" }}>{live} on track · updates live</span>
        </div>
        {err && <div className="error-box" style={{ marginBottom: 16 }}>{err}</div>}
        <div className="table-card">{data && <StandingsTable rows={data.rows} meId={driverId} />}</div>
      </main>
    </div>
  );
}
