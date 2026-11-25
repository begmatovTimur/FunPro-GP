"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";
import type { Me } from "./types";

/**
 * Loads the logged-in user and sends them to the right place:
 * no login -> /login; admin on a driver page -> /admin; driver on /admin -> /.
 * `need` = which role the page is for ("any" = both, e.g. standings).
 */
export function useAuth(need: "driver" | "admin" | "any") {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let alive = true;
    if (!getToken()) {
      if (need !== "any") router.replace("/login");
      return;
    }
    api.me().then(
      (m) => {
        if (!alive) return;
        if (need === "driver" && m.role === "admin") return router.replace("/admin");
        if (need === "admin" && m.role !== "admin") return router.replace("/");
        setMe(m);
      },
      () => {
        if (alive && need !== "any") router.replace("/login");
      },
    );
    return () => {
      alive = false;
    };
  }, [need, router]);

  return me;
}

export async function logout() {
  try {
    await api.logout();
  } catch {}
  setToken(null);
  window.location.href = "/login";
}

export function draftKey(driverId: number, problemId: string) {
  return `fpgp.code.${driverId}.${problemId}`;
}
