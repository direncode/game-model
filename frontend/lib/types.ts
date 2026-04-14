// BTUT Intelligence
export interface BTUTScores {
  composite: number;
  diversity: number;
  reconstruction: number;
  anomaly: number;
}

export interface BTUTSurvivor {
  rank: number;
  name: string;
  ticker: string;
  type: string;
  cik: string;
  cluster: number;
  flips: number;
  fingerprint: string;
  scores: BTUTScores;
  anomaly_story: string;
}

export interface BTUTStatus {
  pipeline_status: string;
  total_entities: number;
  total_clusters: number;
  unique_fingerprints: number;
  survivor_count: number;
  reduction_ratio: number;
  survivor_types: Record<string, number>;
  reconstruction: Record<string, any>;
  wall_seconds: number;
}

export interface BTUTCluster {
  cluster_id: number;
  member_count: number;
  type_distribution: Record<string, number>;
  avg_composite: number;
  max_composite: number;
  sample_members: Array<{ name: string; ticker: string; type: string; composite: number }>;
}

export interface BTUTAnalysis {
  ticker: string;
  company_name: string;
  cik: string;
  entity_type: string;
  anomaly_story: string;
  scores: BTUTScores;
  lattice_profile: {
    total_flips: number;
    total_rotations: number;
    flip_rate: number;
    fingerprint_48bit: string;
    coarse_resolution: string;
    medium_resolution: string;
    fine_resolution: string;
  };
  cluster: {
    id: number;
    total_members: number;
    peers: Array<{ name: string; ticker: string; type: string; composite: number }>;
  };
  attributes: Record<string, any>;
}

export interface BTUTSearchHit {
  name: string;
  ticker: string;
  type: string;
  matched_field: string;
  composite: number;
  is_survivor: boolean;
}

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

// --- QR Digital Identity ---

export interface QRIdentity {
  id: string;
  code: string;
  subject_type: string;
  subject_id: string;
  tier: "public" | "org" | "admin";
  org_id: string | null;
  minted_by: string;
  minted_at: string;
  revoked_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface QRScanResult {
  qr_identity: QRIdentity;
  access_granted: string;
  entity_summary: Record<string, unknown>;
  lineage: Record<string, unknown> | null;
}

export interface QRCodeImage {
  code: string;
  image_base64: string;
  url: string;
}

export interface QRScanLog {
  id: string;
  qr_identity_id: string;
  scanned_by: string | null;
  scanned_at: string;
  access_granted: string;
  ip_address: string | null;
}
