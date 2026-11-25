"use client";

import { useEffect, useRef, useState } from "react";

/**
 * F1 start gantry, synchronised to the server clock so every screen in the room
 * lights up and goes out at the same moment. Race Control starts it; drivers only watch.
 *
 * lightsStart/lightsOut are server times (seconds). offset = server clock - local clock (ms).
 * With lightsStart = null the gantry is dark and we wait for Race Control.
 */
export default function Lights({
  title,
  subtitle,
  lightsStart,
  lightsOut,
  offset,
  onGo,
}: {
  title: string;
  subtitle: string;
  lightsStart: number | null;
  lightsOut: number | null;
  offset: number;
  onGo: () => void;
}) {
  const [now, setNow] = useState(() => Date.now() + offset);
  const fired = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 50);
    return () => clearInterval(t);
  }, [offset]);

  const t = now / 1000;
  let lit = 0;
  let out = false;
  if (lightsStart !== null && lightsOut !== null) {
    if (t >= lightsOut) out = true;
    else if (t >= lightsStart) lit = Math.min(5, Math.floor(t - lightsStart) + 1);
  }

  useEffect(() => {
    if (!out || fired.current) return;
    fired.current = true;
    const id = setTimeout(onGo, 1400);
    return () => clearTimeout(id);
  }, [out, onGo]);

  const waiting = lightsStart === null;
  const countdown = lightsStart !== null && t < lightsStart;

  return (
    <div className="lights-stage">
      <div style={{ textAlign: "center" }}>
        <div className="eyebrow" style={{ color: "var(--red)" }}>{subtitle}</div>
        <h1 className="h-display" style={{ fontSize: 56, marginTop: 8 }}>{title}</h1>
      </div>
      <div className="gantry">
        {[1, 2, 3, 4, 5].map((i) => (
          <div className="gantry-col" key={i}>
            <div className="bulb" />
            <div className={`bulb ${lit >= i ? "on" : ""}`} />
            <div className={`bulb ${lit >= i ? "on" : ""}`} />
          </div>
        ))}
      </div>
      <div style={{ minHeight: 90, display: "grid", placeItems: "center", textAlign: "center" }}>
        {waiting && (
          <div>
            <div className="status-pill live" style={{ fontSize: 14, padding: "8px 14px" }}>Waiting for Race Control</div>
            <p className="muted" style={{ marginTop: 14 }}>Stay on this screen. The lights will start for everyone at the same time.</p>
          </div>
        )}
        {countdown && <div className="eyebrow" style={{ fontSize: 18, color: "#fff" }}>Race Control: start sequence engaged</div>}
        {!waiting && !countdown && !out && <div className="eyebrow" style={{ fontSize: 16 }}>Hold your nerve…</div>}
        {out && <div className="go-text">Lights out<br /><span style={{ color: "var(--red)" }}>and away we go!</span></div>}
      </div>
    </div>
  );
}
