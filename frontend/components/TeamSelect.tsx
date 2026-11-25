"use client";

import { useEffect, useRef, useState } from "react";
import TeamLogo from "@/components/TeamLogo";
import { TEAMS } from "@/lib/teams";

/** Dropdown with team logos (a native <select> can't show images). */
export default function TeamSelect({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const selected = TEAMS.find((t) => t.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      setHover((h) => (h + (e.key === "ArrowDown" ? 1 : TEAMS.length - 1)) % TEAMS.length);
    }
    if ((e.key === "Enter" || e.key === " ") && open && hover >= 0) {
      e.preventDefault();
      onChange(TEAMS[hover].id);
      setOpen(false);
    }
  }

  return (
    <div className="team-select" ref={ref} onKeyDown={onKey}>
      <button
        type="button"
        className={`team-select-btn ${open ? "open" : ""}`}
        onClick={() => { setOpen((o) => !o); setHover(TEAMS.findIndex((t) => t.id === value)); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={selected ? { borderLeftColor: selected.color } : undefined}
      >
        {selected ? (
          <>
            <TeamLogo team={selected.id} size={26} />
            <span>{selected.name}</span>
          </>
        ) : (
          <span className="muted">Choose your team…</span>
        )}
        <span className="chev">▾</span>
      </button>
      {open && (
        <ul className="team-options" role="listbox">
          {TEAMS.map((t, i) => (
            <li
              key={t.id}
              role="option"
              aria-selected={t.id === value}
              className={`${t.id === value ? "sel" : ""} ${i === hover ? "hover" : ""}`}
              onMouseEnter={() => setHover(i)}
              onClick={() => { onChange(t.id); setOpen(false); }}
            >
              <span className="bar" style={{ background: t.color }} />
              <TeamLogo team={t.id} size={28} />
              <span>{t.name}</span>
              {t.id === value && <span className="tick">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
