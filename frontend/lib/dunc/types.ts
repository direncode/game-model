// D-U-N-C shared TypeScript types.
//
// These mirror the backend Pydantic schemas in `backend/app/schemas/dunc.py`
// and the dataclasses in `backend/app/services/dunc/`. Keep them in sync —
// they are the wire contract for REST responses and WS frames.

export type DuncRole = "manager" | "technical_staff";
export type DuncMatchStatus = "idle" | "running" | "paused" | "finished";
export type DuncScenario = "under_run" | "pressing_shift" | "convergence";
export type DuncInsightKind =
  | "under_run"
  | "pressing_shift"
  | "convergence"
  | "transition"
  | "info";
export type DuncSeverity = "info" | "notable" | "critical";

export interface DuncMatchSummary {
  id: string;
  name: string;
  status: DuncMatchStatus;
  clock_sec: number;
  hz: number;
  subscribers: number;
  created_at: number;
}

export interface DuncInsight {
  id: string;
  t: number;
  kind: DuncInsightKind;
  severity: DuncSeverity;
  title: string;
  summary: string;
  actors: string[];
  evidence: Record<string, number | string>;
  audience: DuncRole[];
}

export interface DuncPlayerTick {
  id: string;
  team: "home" | "away";
  number: number;
  role: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  distance_m: number;
  fatigue: number;
  zone: string;
}

export interface DuncBallTick {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface DuncPrelude {
  type: "prelude";
  match_id: string;
  recent_insights: DuncInsight[];
}

export interface DuncPing {
  type: "ping";
}

export type DuncFrame = DuncTick | DuncPrelude | DuncPing;

export interface DuncAgentReply {
  role: DuncRole;
  question: string;
  answer: string;
  citations: string[];
  style: "concise" | "detailed";
}

export interface DuncActiveScenario {
  name: string;
  remaining_sec: number;
  affected_count: number;
  affected_ids: string[];
}

export interface DuncTick {
  type: "tick";
  match_id: string;
  t: number;
  clock_sec: number;
  ball: DuncBallTick;
  players: DuncPlayerTick[];
  insights: DuncInsight[];
  active_scenarios: DuncActiveScenario[];
}

export interface DuncMatchEvent {
  minute: number;
  type: string;
  team: string;
  player?: string;
  player_number?: number;
  xg?: number;
}

export interface DuncMatchInfo {
  home_team: string;
  away_team: string;
  home_short: string;
  away_short: string;
  home_color: string;
  away_color: string;
  home_score: number;
  away_score: number;
  home_xg: number;
  away_xg: number;
  competition?: string;
  matchday?: string;
  venue?: string;
  home_manager?: string;
  away_manager?: string;
  context?: string;
  events: DuncMatchEvent[];
}

// Pitch constants — mirror backend simulator.
export const PITCH_X = 105;
export const PITCH_Y = 68;

// ── Prediction Engine types ─────────────────────────────────────────

export interface ProbabilitySet {
  home: number;
  draw: number;
  away: number;
}

export interface MatchPrediction {
  match_key: string;
  home_team: string;
  away_team: string;
  league: string;
  date: string;

  bookmaker: ProbabilitySet;
  polymarket: ProbabilitySet | null;
  ml_model: ProbabilitySet;

  kl_divergence_bk_poly: number | null;
  max_divergence: number | null;
  sources_agree: boolean;
  blended: ProbabilitySet;

  claude_report: string | null;
  confidence: "high" | "medium" | "low";

  model_accuracy: number;
  model_last_trained: string;
}

export interface ModelStatus {
  status: "ready" | "training" | "cold";
  accuracy: number | null;
  log_loss: number | null;
  last_trained: string | null;
  matches_in_dataset: number;
  leagues: string[];
}
