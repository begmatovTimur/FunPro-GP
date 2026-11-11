"use client";

import { useEffect, useRef, useState } from "react";

/**
 * F1 start sequence: five red lights come on one per second, a random hold,
 * then all lights go out -> onLightsOut().
 */
export default function Lights({
  title,
  subtitle,
  onLightsOut,
  onDone,
}: {
  title: string;
  subtitle: string;
  onLightsOut: () => Promise<void>;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "sequence" | "out">("idle");
  const [lit, setLit] = useState(0);
  const [err, setErr] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function start() {
    setErr("");
    setPhase("sequence");
    setLit(0);
    for (let i = 1; i <= 5; i++) timers.current.push(setTimeout(() => setLit(i), i * 1000));
    const hold = 5000 + 700 + Math.random() * 1800; // random hold like the real thing
    timers.current.push(
      setTimeout(async () => {
        try {
          await onLightsOut();
          setLit(0);
          setPhase("out");
          timers.current.push(setTimeout(onDone, 1300));
        } catch (e) {
          setErr((e as Error).message);
          setPhase("idle");
          setLit(0);
        }
      }, hold),
    );
  }

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
      <div style={{ minHeight: 90, display: "grid", placeItems: "center" }}>
        {phase === "idle" && (
          <button className="btn btn-red btn-lg" onClick={start}>Start session</button>
        )}
        {phase === "sequence" && <div className="eyebrow" style={{ fontSize: 16 }}>Hold your nerve…</div>}
        {phase === "out" && <div className="go-text">Lights out<br /><span style={{ color: "var(--red)" }}>and away we go!</span></div>}
        {err && <div className="error-box" style={{ marginTop: 12 }}>{err}</div>}
      </div>
    </div>
  );
}
