export interface ModuleEntry {
  id: string;
  vertical: string;
  module_type: "attractor" | "cycle" | "boundary";
  purity: number;
  quality_score: number;
  members: string[];
  provenance_job_id: string | null;
  created_at: string;
}

export interface ConvergencePoint {
  epoch: number;
  loss: number;
  link_auc: number;
  module_count: number;
}

export interface StreamEvent {
  stage: string;
  progress: number;
  epoch?: number;
  loss?: number;
  link_auc?: number;
  module_count?: number;
  engine?: string;
  message?: string;
  insight_count?: number;
  elapsed_seconds?: number;
  timestamp?: string;
  job_id?: string;
}

export interface InsightResult {
  category: string;
  severity: "critical" | "notable" | "info";
  title: string;
  description: string;
  confidence: number;
  evidence: string[];
  persistence_bars?: { dim: number; birth: number; death: number }[];
}

export interface IntelligenceEngine {
  engine: string;
  insights: InsightResult[];
  insight_count: number;
}

export interface MarketplaceModule extends ModuleEntry {
  price_credits: number;
  tier: "basic" | "standard" | "premium";
}

export interface AgentResponse {
  answer: string;
  sources: string[];
  confidence: number;
  engine: string | null;
}
