// Auth
export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "operator" | "analyst" | "viewer";
  organization_name?: string;
  last_login?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// Datasets
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  status: "uploading" | "profiling" | "ready" | "processing" | "error";
  entity_count: number;
  edge_count: number;
  density: number;
  quality_score?: number;
  created_at: string;
  updated_at: string;
}

export interface DatasetProfile {
  entity_count: number;
  edge_count: number;
  density: number;
  quality_score: number;
  entity_type_distribution: Record<string, number>;
  relationship_type_distribution: Record<string, number>;
}

// Crystallization
export interface CrystallizationJob {
  id: string;
  dataset_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  config: CrystallizationConfig;
  progress: number;
  current_epoch?: number;
  total_epochs?: number;
  training_loss?: number;
  link_prediction_auc?: number;
  knn_accuracy?: number;
  nan_guard_status?: "healthy" | "warning" | "critical";
  gpu_utilization?: number;
  estimated_time_remaining?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface CrystallizationConfig {
  module_count?: number;
  epochs?: number;
  learning_rate?: number;
  ph_filtration_threshold?: number;
  module_capacity?: number;
}

// Modules
export interface Module {
  id: string;
  dataset_id: string;
  index: number;
  name?: string;
  description?: string;
  purity_score: number;
  entity_count: number;
  dominant_type?: string;
  confidence: "high" | "medium" | "low";
  anchor_entities: AnchorEntity[];
  type_distribution: Record<string, number>;
}

export interface AnchorEntity {
  id: string;
  name: string;
  type: string;
  centrality: number;
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  centrality: number;
  module_id: string;
}

// Connections
export interface HiddenConnection {
  id: string;
  source_entity_id: string;
  source_entity_name: string;
  target_entity_id: string;
  target_entity_name: string;
  similarity_score: number;
  source_module_id: string;
  source_module_name?: string;
  target_module_id: string;
  target_module_name?: string;
  validation_status: "unvalidated" | "validated" | "invalidated";
}

// Challenges
export interface Challenge {
  id: string;
  dataset_id: string;
  title: string;
  type: "module_assignment" | "connection_validity" | "data_quality" | "interpretation";
  status: "open" | "under_review" | "accepted" | "rejected" | "deferred";
  challenger_name: string;
  challenger_id: string;
  reasoning: string;
  evidence?: string;
  proposed_resolution?: string;
  resolution_reasoning?: string;
  target_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ChallengeComment {
  id: string;
  challenge_id: string;
  author_name: string;
  author_id: string;
  content: string;
  created_at: string;
}

// Lineage
export interface LineageEvent {
  id: string;
  dataset_id: string;
  type: string;
  actor: string;
  action: string;
  timestamp: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

// Reports
export interface Report {
  id: string;
  dataset_id: string;
  title: string;
  type: "executive_summary" | "full_analysis" | "change_report";
  format: "pdf" | "docx" | "html" | "json";
  generated_at: string;
  download_url: string;
}

// Audit
export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  result: "success" | "failure";
  details?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
