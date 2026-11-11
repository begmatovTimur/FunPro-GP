import type {
  Board,
  Driver,
  DriverState,
  ResultsResponse,
  RunResponse,
  SessionSummary,
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

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Can't reach the race control server. Check the network and try again.");
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

const post = <T,>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  createDriver: (body: { name: string; code?: string; number: number; color: string }) =>
    post<Driver>("/drivers", body),
  state: (driverId: number) => request<DriverState>(`/drivers/${driverId}/state`),
  startSession: (n: number, driverId: number) => post<SessionSummary>(`/sessions/${n}/start`, { driver_id: driverId }),
  board: (n: number, driverId: number) => request<Board>(`/sessions/${n}/board?driver_id=${driverId}`),
  focus: (n: number, driverId: number, problemId: string) =>
    post<{ ok: boolean }>(`/sessions/${n}/focus`, { driver_id: driverId, problem_id: problemId }),
  finish: (n: number, driverId: number) => post<SessionSummary>(`/sessions/${n}/finish`, { driver_id: driverId }),
  run: (driverId: number, problemId: string, code: string, customInput?: string) =>
    post<RunResponse>("/run", {
      driver_id: driverId,
      problem_id: problemId,
      code,
      custom_input: customInput ?? null,
    }),
  submit: (driverId: number, problemId: string, code: string) =>
    post<SubmitResponse>("/submit", { driver_id: driverId, problem_id: problemId, code }),
  standings: () => request<Standings>("/standings"),
  results: (driverId: number) => request<ResultsResponse>(`/drivers/${driverId}/results`),
};
