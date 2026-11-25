import type {
  AdminOverview,
  Board,
  DriverState,
  LoginResponse,
  Me,
  ResultsResponse,
  RunResponse,
  Standings,
  SubmitResponse,
} from "./types";

/**
 * The backend runs on port 8000 of the same machine that serves this site,
 * so students on the lab network reach it at http://<organiser-laptop-ip>:8000.
 * Override with NEXT_PUBLIC_API_URL if you host it elsewhere.
 */
function apiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  if (typeof window === "undefined") return "http://127.0.0.1:8000";
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

const TOKEN_KEY = "fpgp.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Can't reach race control. Check the network and try again.");
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {}
    if (res.status === 401 && !path.startsWith("/auth/login") && typeof window !== "undefined") {
      setToken(null);
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

const post = <T,>(path: string, body: unknown = {}) => request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  login: (username: string, password: string, registration?: { code: string; team: string }) =>
    post<LoginResponse>("/auth/login", { username, password, ...(registration ?? {}) }),
  me: () => request<Me>("/auth/me"),
  logout: () => post<{ ok: boolean }>("/auth/logout"),

  state: () => request<DriverState>("/me/state"),
  results: () => request<ResultsResponse>("/me/results"),
  board: (n: number) => request<Board>(`/sessions/${n}/board`),
  focus: (n: number, problemId: string) => post<{ ok: boolean }>(`/sessions/${n}/focus`, { problem_id: problemId }),
  run: (problemId: string, code: string, customInput?: string) =>
    post<RunResponse>("/run", { problem_id: problemId, code, custom_input: customInput ?? null }),
  submit: (problemId: string, code: string) => post<SubmitResponse>("/submit", { problem_id: problemId, code }),
  standings: () => request<Standings>("/standings"), // admin only
  fastestLaps: () => request<Standings["fastest_laps"]>("/fastest-laps"),

  admin: {
    overview: () => request<AdminOverview>("/admin/overview"),
    start: (n: number) => post(`/admin/sessions/${n}/start`),
    extend: (n: number, seconds: number) => post(`/admin/sessions/${n}/extend`, { seconds }),
    end: (n: number) => post(`/admin/sessions/${n}/end`),
    reset: (keepDrivers: boolean) => post("/admin/reset", { confirm: "RESET", keep_drivers: keepDrivers }),
    deleteDriver: (id: number) => request(`/admin/drivers/${id}`, { method: "DELETE" }),
  },
};
