"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "fpgp.driverId";

/** The current driver id lives in localStorage (no auth in V1). undefined = still loading. */
export function useDriverId() {
  const [id, setId] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let v: number | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      v = raw ? Number(raw) : null;
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setId(v && Number.isFinite(v) ? v : null);
  }, []);

  const save = useCallback((next: number | null) => {
    try {
      if (next === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(next));
    } catch {}
    setId(next);
  }, []);

  return [id, save] as const;
}

export function draftKey(driverId: number, problemId: string) {
  return `fpgp.code.${driverId}.${problemId}`;
}
