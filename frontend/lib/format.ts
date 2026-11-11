/** 83.456 -> "1:23.456" (lap time style) */
export function lapTime(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return "—";
  const ms = Math.round(sec * 1000);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(r).padStart(3, "0")}`;
}

/** 1499 -> "24:59" (countdown) */
export function clock(sec: number): string {
  const t = Math.max(0, Math.ceil(sec));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function pts(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export const VERDICT_LABEL: Record<string, string> = {
  accepted: "Accepted",
  passed: "Passed",
  wrong_answer: "Wrong Answer",
  time_limit: "Time Limit Exceeded",
  runtime_error: "Runtime Error",
  compile_error: "Syntax Error",
  internal_error: "Judge Error",
  ran: "Finished",
};

export const COLOR_LABEL: Record<string, string> = {
  purple: "Purple — fastest lap of all drivers",
  green: "Green — your personal best",
  yellow: "Yellow — slower than your best",
};
