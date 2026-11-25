export type LapColor = "purple" | "green" | "yellow" | null;
export type RaceState = "pending" | "lights" | "running" | "finished";

export interface Driver {
  id: number;
  name: string;
  code: string;
  number: number;
  color: string;
  team: string;
  team_name: string;
}

export interface Me {
  role: "admin" | "driver";
  driver: Driver | null;
  admin_name?: string;
}

export type LoginResponse =
  | (Me & { token: string; created: boolean; needs_registration?: undefined })
  | { needs_registration: true; name: string; suggested_code: string; taken_codes: string[] };

export interface FastestLap {
  lap: number;
  problem_id: string;
  driver_id: number;
  code: string;
  name: string;
  color: string;
}

export interface MaxPoints {
  problems: number;
  bonus: number;
  total: number;
}

/** Global session info (same for everyone) + this driver's numbers when asked as a driver. */
export interface SessionSummary {
  n: number;
  name: string;
  label: string;
  duration_sec: number;
  points_per_problem: number;
  problems_count: number;
  max_points: number;
  fastest_lap_bonus: number;
  state: RaceState;
  lights_start: number | null;
  lights_out: number | null;
  end_at: number | null;
  fastest_lap: FastestLap | null;
  // driver-only
  status?: RaceState;
  points?: number;
  bonus?: number;
  solved?: number;
  best_lap?: number | null;
  time?: number;
  colors?: { purple: number; green: number; yellow: number };
}

export interface DriverState {
  driver: Driver;
  server_now: number;
  sessions: SessionSummary[];
  all_finished: boolean;
  max_points: MaxPoints;
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

export interface StandingSession {
  points: number;
  bonus: number;
  solved: number;
  best_lap: number | null;
  fastest_lap: boolean;
  state: RaceState;
  time: number;
}

export interface StandingRow {
  pos: number;
  driver: Driver;
  sessions: Record<string, StandingSession>;
  problem_points: number;
  bonus: number;
  total: number;
  solved: number;
  best_lap: number | null;
  total_lap_time: number;
  time: number;
  fastest_laps: number;
  gap: number;
}

export interface Standings {
  server_now: number;
  rows: StandingRow[];
  max_points: MaxPoints;
  fastest_laps: Record<string, FastestLap | null>;
  states: Record<string, RaceState>;
}

export interface ResultsResponse {
  driver: Driver;
  standing: Omit<StandingRow, "pos" | "gap">;
  max_points: MaxPoints;
  sessions: (SessionSummary & {
    problems: ({ id: string; order: number; title: string } & Progress)[];
  })[];
}

export interface AdminProblemStat {
  id: string;
  order: number;
  title: string;
  attempted: number;
  solved: number;
  best_lap: number | null;
  best_code: string | null;
}

export interface AdminOverview {
  server_now: number;
  drivers: number;
  sessions: (SessionSummary & { joined: number; problems: AdminProblemStat[] })[];
  standings: Standings;
}
