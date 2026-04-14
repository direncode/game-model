// API client for the Data Estate vertical

import type {
  AllocationRequest,
  ChatResponse,
  Dashboard,
  EstateModule,
  LedgerEntry,
  LedgerSummary,
  Submission,
} from "./types";

const API = "/api/v1/data-estate";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API Error: ${res.status}`);
  }
  return res.json();
}

// Submissions
export const submitDocument = (title: string, rawText: string, estateTag = "default") =>
  request<Submission>("/submit", {
    method: "POST",
    body: JSON.stringify({ title, raw_text: rawText, estate_tag: estateTag }),
  });

export const fetchSubmissions = (status?: string, estateTag?: string) => {
  const params = new URLSearchParams();
  if (status) params.set("status_filter", status);
  if (estateTag) params.set("estate_tag", estateTag);
  return request<Submission[]>(`/submissions?${params}`);
};

export const reviewSubmission = (id: string, action: "approve" | "reject", note?: string) =>
  request<Submission>(`/submissions/${id}/review`, {
    method: "POST",
    body: JSON.stringify({ action, note }),
  });

export const fetchScroll = (estateTag = "default") =>
  request<Submission[]>(`/scroll?estate_tag=${estateTag}`);

// Modules
export const fetchEstateModules = (limit = 50, minQuality = 0) =>
  request<EstateModule[]>(`/modules?limit=${limit}&min_quality=${minQuality}`);

// Ledger
export const fetchLedger = (categoryTag?: string) => {
  const params = categoryTag ? `?category_tag=${categoryTag}` : "";
  return request<LedgerEntry[]>(`/ledger${params}`);
};

export const createLedgerEntry = (data: {
  amount: number;
  label: string;
  category_tag: string;
  effective_date: string;
  metadata?: Record<string, unknown>;
}) => request<LedgerEntry>("/ledger", { method: "POST", body: JSON.stringify(data) });

export const fetchLedgerSummary = () => request<LedgerSummary>("/ledger/summary");

// Allocations
export const createAllocationRequest = (data: {
  amount: number;
  justification: string;
  category_tag: string;
}) =>
  request<AllocationRequest>("/allocations/request", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fetchAllocations = (status?: string) => {
  const params = status ? `?status_filter=${status}` : "";
  return request<AllocationRequest[]>(`/allocations${params}`);
};

export const decideAllocation = (id: string, action: "approve" | "deny" | "flag", note?: string) =>
  request<AllocationRequest>(`/allocations/${id}/decide`, {
    method: "POST",
    body: JSON.stringify({ action, note }),
  });

// Chat
export const estateChat = (question: string, estateTag = "default") =>
  request<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify({ question, estate_tag: estateTag }),
  });

// Dashboard
export const fetchDashboard = () => request<Dashboard>("/dashboard");
