"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, getToken, setToken } from "./api";
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
    let retry: ReturnType<typeof setTimeout> | undefined;
    if (!getToken()) {
      if (need !== "any") router.replace("/login");
      return;
    }
    const check = () =>
      api.me().then(
        (m) => {
          if (!alive) return;
          if (need === "driver" && m.role === "admin") return router.replace("/admin");
          if (need === "admin" && m.role !== "admin") return router.replace("/");
          setMe(m);
        },
        (e) => {
          if (!alive) return;
          // Server unreachable for a moment (restart, Wi-Fi blip): keep the login and try again.
          if (e instanceof ApiError && e.status === 0) retry = setTimeout(check, 2000);
          else if (need !== "any") router.replace("/login"); // 401 is handled in api.ts
        },
      );
    check();
    return () => {
      alive = false;
      clearTimeout(retry);
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
