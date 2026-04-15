const BASE_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:8001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export const controlPlaneAPI = {
  // Forks
  listForks: () => request<any[]>("/api/v1/forks"),
  getFork: (id: string) => request<any>(`/api/v1/forks/${id}`),
  createFork: (data: any) =>
    request<any>("/api/v1/forks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  suspendFork: (id: string) =>
    request<any>(`/api/v1/forks/${id}/suspend`, { method: "POST" }),
  resumeFork: (id: string) =>
    request<any>(`/api/v1/forks/${id}/resume`, { method: "POST" }),
  triggerReduction: (id: string) =>
    request<any>(`/api/v1/forks/${id}/reduce`, { method: "POST" }),
  deleteFork: (id: string) =>
    request<any>(`/api/v1/forks/${id}`, { method: "DELETE" }),

  // Customers
  listCustomers: () => request<any[]>("/api/v1/customers"),
  getCustomer: (id: string) => request<any>(`/api/v1/customers/${id}`),

  // Billing
  getUsage: (forkId: string) => request<any>(`/api/v1/billing/usage/${forkId}`),
  listInvoices: () => request<any[]>("/api/v1/billing/invoices"),
  getTiers: () => request<any>("/api/v1/billing/tiers"),

  // Updates
  listRollouts: () => request<any[]>("/api/v1/updates/rollouts"),
  startRollout: (version: string) =>
    request<any>("/api/v1/updates/rollouts", {
      method: "POST",
      body: JSON.stringify({ version }),
    }),
  pauseRollout: (id: string) =>
    request<any>(`/api/v1/updates/rollouts/${id}/pause`, { method: "POST" }),
  resumeRollout: (id: string) =>
    request<any>(`/api/v1/updates/rollouts/${id}/resume`, { method: "POST" }),
  rollbackRollout: (id: string) =>
    request<any>(`/api/v1/updates/rollouts/${id}/rollback`, { method: "POST" }),

  // Modules
  listModules: () => request<any[]>("/api/v1/modules"),
  toggleModule: (id: string, enabled: boolean) =>
    request<any>(`/api/v1/modules/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),

  // Health
  getFleetHealth: () => request<any>("/api/v1/fleet/health"),
};
