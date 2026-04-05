const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) { this.token = token; }
  // Legacy methods — no-ops for backward compatibility
  setRefreshToken(_token: string | null) {}
  setOnLogout(_callback: () => void) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers as Record<string, string>,
    };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `API Error: ${res.status}`);
    }
    return res.json();
  }

  // ── Auth ──────────────────────────────────────────────────────────

  async register(data: { email: string; name: string; password: string; organization_name?: string }) {
    return this.request("/api/v1/auth/register", { method: "POST", body: JSON.stringify(data) });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{ access_token: string; refresh_token: string }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(data) });
  }

  async logout(refreshToken: string) {
    return this.request("/api/v1/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) }, false).catch(() => {});
  }

  async logoutAll() {
    return this.request("/api/v1/auth/logout-all", { method: "POST" });
  }

  async getMe() { return this.request("/api/v1/auth/me"); }

  async updateProfile(data: { name?: string; avatar_url?: string }) {
    return this.request("/api/v1/auth/me", { method: "PUT", body: JSON.stringify(data) });
  }

  // ── Sessions ──────────────────────────────────────────────────────

  async getSessions() {
    return this.request<Array<{
      id: string;
      ip_address: string | null;
      device_name: string | null;
      last_active_at: string | null;
      created_at: string;
    }>>("/api/v1/auth/sessions");
  }

  async revokeSession(sessionId: string) {
    return this.request(`/api/v1/auth/sessions/${sessionId}`, { method: "DELETE" });
  }

  // ── Password Management ───────────────────────────────────────────

  async changePassword(data: { current_password: string; new_password: string }) {
    return this.request("/api/v1/auth/change-password", { method: "POST", body: JSON.stringify(data) });
  }

  async forgotPassword(email: string) {
    return this.request("/api/v1/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
  }

  async resetPassword(data: { token: string; new_password: string }) {
    return this.request("/api/v1/auth/reset-password", { method: "POST", body: JSON.stringify(data) });
  }

  // ── Email Verification ────────────────────────────────────────────

  async verifyEmail(token: string) {
    return this.request("/api/v1/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
  }

  async resendVerification() {
    return this.request("/api/v1/auth/resend-verification", { method: "POST" });
  }

  // ── Datasets ──────────────────────────────────────────────────────

  async listDatasets(page = 1, perPage = 20) { return this.request(`/api/v1/datasets?page=${page}&per_page=${perPage}`); }
  async createDataset(data: { name: string; description?: string }) { return this.request("/api/v1/datasets", { method: "POST", body: JSON.stringify(data) }); }
  async getDataset(id: string) { return this.request(`/api/v1/datasets/${id}`); }
  async uploadDataset(id: string, file: File, schemaMapping?: object) {
    const formData = new FormData();
    formData.append("file", file);
    if (schemaMapping) formData.append("schema_mapping", JSON.stringify(schemaMapping));
    const headers: Record<string, string> = {};
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    const res = await fetch(`${this.baseUrl}/api/v1/datasets/${id}/upload`, { method: "POST", headers, body: formData });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  }
  async getDatasetProfile(id: string) { return this.request(`/api/v1/datasets/${id}/profile`); }
  async deleteDataset(id: string) { return this.request(`/api/v1/datasets/${id}`, { method: "DELETE" }); }

  // ── Crystallization ───────────────────────────────────────────────

  async triggerCrystallization(datasetId: string, config?: object) { return this.request(`/api/v1/datasets/${datasetId}/crystallize`, { method: "POST", body: JSON.stringify(config || {}) }); }
  async getCrystallizationJob(jobId: string) { return this.request(`/api/v1/crystallization/${jobId}`); }
  async getCrystallizationMetrics(jobId: string) { return this.request(`/api/v1/crystallization/${jobId}/metrics`); }
  async cancelCrystallization(jobId: string) { return this.request(`/api/v1/crystallization/${jobId}/cancel`, { method: "POST" }); }

  // ── Modules ───────────────────────────────────────────────────────

  async listModules(datasetId: string) { return this.request(`/api/v1/datasets/${datasetId}/modules`); }
  async getModule(moduleId: string) { return this.request(`/api/v1/modules/${moduleId}`); }
  async getModuleEntities(moduleId: string, page = 1, perPage = 50) { return this.request(`/api/v1/modules/${moduleId}/entities?page=${page}&per_page=${perPage}`); }
  async updateModule(moduleId: string, data: { name?: string; description?: string }) { return this.request(`/api/v1/modules/${moduleId}`, { method: "PUT", body: JSON.stringify(data) }); }

  // ── Hidden Connections ────────────────────────────────────────────

  async listConnections(datasetId: string, page = 1, perPage = 20) { return this.request(`/api/v1/datasets/${datasetId}/connections?page=${page}&per_page=${perPage}`); }
  async validateConnection(connectionId: string, validated: boolean) { return this.request(`/api/v1/connections/${connectionId}/validate`, { method: "POST", body: JSON.stringify({ validated }) }); }

  // ── Challenges ────────────────────────────────────────────────────

  async createChallenge(data: object) { return this.request("/api/v1/challenges", { method: "POST", body: JSON.stringify(data) }); }
  async listChallenges(datasetId: string) { return this.request(`/api/v1/datasets/${datasetId}/challenges`); }
  async getChallenge(id: string) { return this.request(`/api/v1/challenges/${id}`); }
  async addComment(challengeId: string, content: string) { return this.request(`/api/v1/challenges/${challengeId}/comments`, { method: "POST", body: JSON.stringify({ content }) }); }
  async resolveChallenge(id: string, data: { status: string; resolution_reasoning: string }) { return this.request(`/api/v1/challenges/${id}/resolve`, { method: "PUT", body: JSON.stringify(data) }); }

  // ── Lineage ───────────────────────────────────────────────────────

  async getLineage(subjectId: string) { return this.request(`/api/v1/lineage/${subjectId}`); }
  async getLineageGraph(subjectId: string) { return this.request(`/api/v1/lineage/${subjectId}/graph`); }

  // ── Reports ───────────────────────────────────────────────────────

  async generateReport(datasetId: string, data: { report_type: string; format?: string }) { return this.request(`/api/v1/datasets/${datasetId}/reports`, { method: "POST", body: JSON.stringify(data) }); }
  async listReports() { return this.request("/api/v1/reports"); }
  async downloadReport(id: string) { return this.request<{download_url: string}>('/api/v1/reports/' + id + '/download'); }

  // ── Embeddings ────────────────────────────────────────────────────

  async querySimilar(entityName: string, topK = 10, datasetId?: string) { return this.request("/api/v1/embeddings/query", { method: "POST", body: JSON.stringify({ entity_name: entityName, top_k: topK, dataset_id: datasetId }) }); }
  async batchSimilarity(datasetId: string, pairs: Array<{source: string, target: string}>) { return this.request('/api/v1/embeddings/batch', { method: 'POST', body: JSON.stringify({ dataset_id: datasetId, entity_pairs: pairs }) }); }

  // ── Admin ─────────────────────────────────────────────────────────

  async listUsers() { return this.request("/api/v1/admin/users"); }
  async updateUserRole(userId: string, role: string) { return this.request(`/api/v1/admin/users/${userId}/role`, { method: "PUT", body: JSON.stringify({ role }) }); }
  async getAuditLog(page = 1, perPage = 50) { return this.request(`/api/v1/admin/audit?page=${page}&per_page=${perPage}`); }
  async getComplianceDashboard() { return this.request("/api/v1/admin/compliance"); }

  // ── Alerts ────────────────────────────────────────────────────────

  async createAlert(data: object) { return this.request("/api/v1/alerts", { method: "POST", body: JSON.stringify(data) }); }
  async listAlerts() { return this.request("/api/v1/alerts"); }
  async updateAlert(id: string, data: object) { return this.request(`/api/v1/alerts/${id}`, { method: "PUT", body: JSON.stringify(data) }); }
  async deleteAlert(id: string) { return this.request(`/api/v1/alerts/${id}`, { method: "DELETE" }); }

  // ── Dataset Hub ─────────────────────────────────────────────────

  async searchHubDatasets(query: string, category?: string, limit = 20, offset = 0) {
    const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) });
    if (category) params.set("category", category);
    return this.request(`/api/v1/hub/search?${params}`);
  }

  async getHubDatasetInfo(datasetId: string) {
    return this.request(`/api/v1/hub/dataset/${encodeURIComponent(datasetId)}`);
  }

  async importHubDataset(data: { hf_dataset_id: string; name?: string; config?: string; split?: string; max_rows?: number }) {
    return this.request("/api/v1/hub/import", { method: "POST", body: JSON.stringify(data) });
  }

  async getHubCategories() {
    return this.request<Array<{ name: string; tags: string[] }>>("/api/v1/hub/categories");
  }

  async getHubFeatured() {
    return this.request<Array<{ id: string; name: string; description: string; tags: string[]; category: string }>>("/api/v1/hub/featured");
  }

  // ── BTUT Intelligence ─────────────────────────────────────────────

  async getBTUTStatus(dataset = "edgar") {
    return this.request<import("./types").BTUTStatus>(`/api/v1/btut/status?dataset=${dataset}`);
  }

  async getBTUTSurvivors(params?: { top_n?: number; type?: string; sort_by?: string; dataset?: string }) {
    const q = new URLSearchParams();
    q.set("dataset", params?.dataset || "edgar");
    if (params?.top_n) q.set("top_n", String(params.top_n));
    if (params?.type) q.set("type", params.type);
    if (params?.sort_by) q.set("sort_by", params.sort_by);
    return this.request<{ survivors: import("./types").BTUTSurvivor[]; total: number }>(`/api/v1/btut/survivors?${q}`);
  }

  async getBTUTAnalysis(ticker: string, dataset = "edgar") {
    return this.request<import("./types").BTUTAnalysis>(`/api/v1/btut/analyze/${encodeURIComponent(ticker)}?dataset=${dataset}`);
  }

  async getBTUTClusters(params?: { min_size?: number; top_n?: number; dataset?: string }) {
    const q = new URLSearchParams();
    q.set("dataset", params?.dataset || "edgar");
    if (params?.min_size) q.set("min_size", String(params.min_size));
    if (params?.top_n) q.set("top_n", String(params.top_n));
    return this.request<{ clusters: import("./types").BTUTCluster[]; total: number }>(`/api/v1/btut/clusters?${q}`);
  }

  async getBTUTSearch(keyword: string, field?: string, dataset = "edgar") {
    const q = new URLSearchParams({ q: keyword, dataset });
    if (field) q.set("field", field);
    return this.request<{ results: import("./types").BTUTSearchHit[]; total: number }>(`/api/v1/btut/search?${q}`);
  }

  async getBTUTQuery(params: {
    types?: string; min_composite?: number; max_composite?: number;
    min_anomaly?: number; max_anomaly?: number;
    min_flips?: number; max_flips?: number;
    clusters?: string; has_ticker?: boolean;
    sort_by?: string; sort_order?: string; limit?: number; offset?: number;
  }) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    return this.request<{ results: import("./types").BTUTSurvivor[]; total: number; filters_applied: Record<string, any> }>(`/api/v1/btut/query?${q}`);
  }

  async getBTUTCompare(tickers: string[]) {
    return this.request<{ entities: any[]; comparison: any }>(`/api/v1/btut/compare?tickers=${tickers.join(",")}`);
  }

  async getBTUTDistributions() {
    return this.request<any>("/api/v1/btut/distributions");
  }

  async getBTUTAnomalies(topN = 20, type?: string) {
    const q = new URLSearchParams({ top_n: String(topN) });
    if (type) q.set("type", type);
    return this.request<any[]>(`/api/v1/btut/anomalies?${q}`);
  }

  async getBTUTClusterDetail(clusterId: number, dataset = "edgar") {
    return this.request<any>(`/api/v1/btut/clusters/${clusterId}?dataset=${dataset}`);
  }

  async getBTUTDatasets() {
    return this.request<Array<{ id: string; name: string; description: string; entity_types: Array<{ name: string; color: string }>; lookup_field: string; lookup_label: string; has_results: boolean }>>("/api/v1/btut/datasets");
  }

}

export const api = new ApiClient(API_BASE);
