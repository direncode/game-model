const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) { this.token = token; }

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

  // Auth
  async register(data: { email: string; name: string; password: string }) { return this.request("/api/v1/auth/register", { method: "POST", body: JSON.stringify(data) }); }
  async login(data: { email: string; password: string }) { return this.request<{ access_token: string; refresh_token: string }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(data) }); }
  async getMe() { return this.request("/api/v1/auth/me"); }

  // Datasets
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

  // Crystallization
  async triggerCrystallization(datasetId: string, config?: object) { return this.request(`/api/v1/datasets/${datasetId}/crystallize`, { method: "POST", body: JSON.stringify(config || {}) }); }
  async getCrystallizationJob(jobId: string) { return this.request(`/api/v1/crystallization/${jobId}`); }
  async getCrystallizationMetrics(jobId: string) { return this.request(`/api/v1/crystallization/${jobId}/metrics`); }
  async cancelCrystallization(jobId: string) { return this.request(`/api/v1/crystallization/${jobId}/cancel`, { method: "POST" }); }

  // Modules
  async listModules(datasetId: string) { return this.request(`/api/v1/datasets/${datasetId}/modules`); }
  async getModule(moduleId: string) { return this.request(`/api/v1/modules/${moduleId}`); }
  async getModuleEntities(moduleId: string, page = 1, perPage = 50) { return this.request(`/api/v1/modules/${moduleId}/entities?page=${page}&per_page=${perPage}`); }
  async updateModule(moduleId: string, data: { name?: string; description?: string }) { return this.request(`/api/v1/modules/${moduleId}`, { method: "PUT", body: JSON.stringify(data) }); }

  // Hidden Connections
  async listConnections(datasetId: string, page = 1, perPage = 20) { return this.request(`/api/v1/datasets/${datasetId}/connections?page=${page}&per_page=${perPage}`); }
  async validateConnection(connectionId: string, validated: boolean) { return this.request(`/api/v1/connections/${connectionId}/validate`, { method: "POST", body: JSON.stringify({ validated }) }); }

  // Challenges
  async createChallenge(data: object) { return this.request("/api/v1/challenges", { method: "POST", body: JSON.stringify(data) }); }
  async listChallenges(datasetId: string) { return this.request(`/api/v1/datasets/${datasetId}/challenges`); }
  async getChallenge(id: string) { return this.request(`/api/v1/challenges/${id}`); }
  async addComment(challengeId: string, content: string) { return this.request(`/api/v1/challenges/${challengeId}/comments`, { method: "POST", body: JSON.stringify({ content }) }); }
  async resolveChallenge(id: string, data: { status: string; resolution_reasoning: string }) { return this.request(`/api/v1/challenges/${id}/resolve`, { method: "PUT", body: JSON.stringify(data) }); }

  // Lineage
  async getLineage(subjectId: string) { return this.request(`/api/v1/lineage/${subjectId}`); }
  async getLineageGraph(subjectId: string) { return this.request(`/api/v1/lineage/${subjectId}/graph`); }

  // Reports
  async generateReport(datasetId: string, data: { report_type: string; format?: string }) { return this.request(`/api/v1/datasets/${datasetId}/reports`, { method: "POST", body: JSON.stringify(data) }); }
  async listReports() { return this.request("/api/v1/reports"); }

  // Embeddings
  async querySimilar(entityName: string, topK = 10, datasetId?: string) { return this.request("/api/v1/embeddings/query", { method: "POST", body: JSON.stringify({ entity_name: entityName, top_k: topK, dataset_id: datasetId }) }); }

  // Admin
  async listUsers() { return this.request("/api/v1/admin/users"); }
  async updateUserRole(userId: string, role: string) { return this.request(`/api/v1/admin/users/${userId}/role`, { method: "PUT", body: JSON.stringify({ role }) }); }
  async getAuditLog(page = 1, perPage = 50) { return this.request(`/api/v1/admin/audit?page=${page}&per_page=${perPage}`); }

  // Alerts
  async createAlert(data: object) { return this.request("/api/v1/alerts", { method: "POST", body: JSON.stringify(data) }); }
  async listAlerts() { return this.request("/api/v1/alerts"); }
  async updateAlert(id: string, data: object) { return this.request(`/api/v1/alerts/${id}`, { method: "PUT", body: JSON.stringify(data) }); }
  async deleteAlert(id: string) { return this.request(`/api/v1/alerts/${id}`, { method: "DELETE" }); }
}

export const api = new ApiClient(API_BASE);
