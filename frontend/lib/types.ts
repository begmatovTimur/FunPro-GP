export type LapColor = "purple" | "green" | "yellow" | null;
export type SessionStatus = "locked" | "ready" | "running" | "finished";

export interface Driver {
  id: number;
  name: string;
  code: string;
  number: number;
  color: string;
}

export interface SessionSummary {
  n: number;
  name: string;
  label: string;
  duration_sec: number;
  points_per_problem: number;
  problems_count: number;
  max_points: number;
  status: SessionStatus;
  started_at: number | null;
  deadline: number | null;
  ended_at: number | null;
  points: number;
  solved: number;
  best_lap: number | null;
  colors: { purple: number; green: number; yellow: number };
}

export interface DriverState {
  driver: Driver;
  server_now: number;
  sessions: SessionSummary[];
  all_finished: boolean;
}

export interface Example {
  input: string;
  output: string;
  explanation?: string;
}

export interface Progress {
  best_passed: number;
  total_tests: number;
  points: number;
  attempts: number;
  solved: boolean;
  lap_seconds: number | null;
  color: LapColor;
}

export interface Problem {
  id: string;
  session: number;
  order: number;
  title: string;
  difficulty: string;
  statement: string;
  input_format: string;
  output_format: string;
  constraints: string[];
  examples: Example[];
  notes: string;
  starter_code: string;
  time_limit: number;
  tests_count: number;
  max_points: number;
  progress: Progress;
}

export interface Board {
  server_now: number;
  session: SessionSummary;
  current_problem_id: string | null;
  problems: Problem[];
}

export type Verdict =
  | "passed"
  | "wrong_answer"
  | "time_limit"
  | "runtime_error"
  | "compile_error"
  | "internal_error"
  | "ran";

export interface RunCase {
  input: string;
  expected: string | null;
  output: string;
  stderr: string;
  verdict: Verdict;
  time: number | null;
}

export interface RunResponse {
  engine: string;
  cases: RunCase[];
}

export interface SubmitResponse {
  engine: string;
  verdict: "accepted" | Verdict;
  passed: number;
  total: number;
  tests: { n: number; verdict: Verdict; time: number | null }[];
  error: string;
  points_this_run: number;
  improved: boolean;
  newly_solved: boolean;
  session_complete: boolean;
  progress: Progress;
}

export interface StandingRow {
  pos: number;
  driver: Driver;
  sessions: Record<string, { points: number; solved: number; best_lap: number | null; status: string }>;
  total: number;
  solved: number;
  best_lap: number | null;
  total_lap_time: number;
  purple: number;
  gap: number;
}

export interface Standings {
  server_now: number;
  rows: StandingRow[];
  max_points: number;
}

export interface ResultsResponse {
  driver: Driver;
  standing: StandingRow;
  field_size: number;
  max_points: number;
  sessions: (SessionSummary & {
    problems: ({ id: string; order: number; title: string } & Progress)[];
  })[];
}
