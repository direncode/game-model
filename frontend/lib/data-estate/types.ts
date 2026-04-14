// Types for the Data Estate vertical

export type SubmissionStatus = "pending" | "approved" | "rejected";
export type AllocationStatus = "pending" | "approved" | "denied" | "flagged";
export type ModuleType = "attractor" | "cycle" | "boundary";

export interface Submission {
  id: string;
  org_id: string;
  title: string;
  status: SubmissionStatus;
  estate_tag: string;
  submitted_by: string;
  reviewed_by: string | null;
  review_note: string | null;
  dataset_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  org_id: string;
  amount: number;
  label: string;
  category_tag: string;
  version: number;
  effective_date: string;
  created_by: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface LedgerSummary {
  total_allocated: number;
  category_totals: Record<string, number>;
  entry_count: number;
}

export interface AllocationRequest {
  id: string;
  org_id: string;
  amount: number;
  justification: string;
  category_tag: string;
  score_result: ScoreResult | null;
  status: AllocationStatus;
  requested_by: string;
  decided_by: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface ScoreResult {
  total: number;
  recommendation: string;
  factors: ScoreFactor[];
}

export interface ScoreFactor {
  name: string;
  score: number;
  weight: number;
  detail: string;
}

export interface EstateModule {
  id: string;
  module_type: ModuleType;
  purity: number;
  quality_score: number;
  members: string[];
  description: string | null;
  created_at: string | null;
}

export interface ChatResponse {
  answer: string;
  sources: string[];
  module_hits: number;
}

export interface Dashboard {
  total_submissions: number;
  pending_submissions: number;
  approved_submissions: number;
  total_modules: number;
  modules_by_type: Record<string, number>;
  ledger_total: number;
  ledger_categories: number;
  allocation_requests_pending: number;
}
