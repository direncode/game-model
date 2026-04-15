export type ForkStatus = "provisioning" | "active" | "suspended" | "teardown";
export type HealthStatus = "healthy" | "degraded" | "critical" | "unknown";
export type CustomerTier = "starter" | "growth" | "enterprise";

export interface Fork {
  id: string;
  customer_id: string;
  subdomain: string;
  status: ForkStatus;
  entity_count: number;
  last_reduction_at: string;
  queries_served_total: number;
  storage_used_bytes: number;
  enabled_modules: string[];
  health_status: HealthStatus;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  tier: CustomerTier;
  fork_count: number;
  total_entities: number;
  mrr: number;
}

export interface UsageSummary {
  entities_processed: number;
  queries_served: number;
  storage_gb: number;
  compute_cost_usd: number;
}

export interface Invoice {
  id: string;
  customer_id: string;
  customer_name: string;
  amount_usd: number;
  status: "paid" | "pending" | "overdue";
  issued_at: string;
  due_at: string;
}

export interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  adoption_count: number;
  revenue_usd: number;
}

export interface UpdateRollout {
  id: string;
  version: string;
  status: "pending" | "rolling" | "paused" | "complete" | "rolled_back";
  forks_updated: number;
  forks_total: number;
  started_at: string;
}

export interface FleetMetrics {
  total_forks: number;
  active_forks: number;
  suspended_forks: number;
  provisioning_forks: number;
  total_entities: number;
  total_queries_30d: number;
  total_mrr: number;
  health_distribution: Record<HealthStatus, number>;
}
