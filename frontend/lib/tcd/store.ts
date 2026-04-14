import { create } from "zustand";
import type {
  ModuleEntry,
  ConvergencePoint,
  StreamEvent,
  InsightResult,
  MarketplaceModule,
} from "./types";
import * as api from "./api";

interface TCDState {
  // Session
  sessionId: string | null;
  jobId: string | null;
  status: "idle" | "running" | "complete" | "error";
  errorMessage: string | null;

  // Data
  modules: ModuleEntry[];
  convergenceHistory: ConvergencePoint[];
  intelligence: Record<string, InsightResult[]>;
  marketplace: MarketplaceModule[];
  currentStage: string;
  progress: number;
  lastMessage: string;

  // UI
  activeTab: "live" | "registry" | "marketplace";
  activeIntelligenceTab: string;
  agentOpen: boolean;

  // Actions
  loadLatest: () => Promise<void>;
  startDemo: () => Promise<void>;
  applyStreamEvent: (event: StreamEvent) => void;
  fetchModules: () => Promise<void>;
  fetchIntelligence: () => Promise<void>;
  fetchConvergence: () => Promise<void>;
  fetchMarketplace: () => Promise<void>;
  setActiveTab: (tab: "live" | "registry" | "marketplace") => void;
  setIntelligenceTab: (tab: string) => void;
  setAgentOpen: (open: boolean) => void;
  reset: () => void;
}

export const useTCDStore = create<TCDState>((set, get) => ({
  sessionId: null,
  jobId: null,
  status: "idle",
  errorMessage: null,
  modules: [],
  convergenceHistory: [],
  intelligence: {},
  marketplace: [],
  currentStage: "",
  progress: 0,
  lastMessage: "",
  activeTab: "live",
  activeIntelligenceTab: "causal",
  agentOpen: false,

  loadLatest: async () => {
    try {
      const latest = await api.fetchLatestSession();
      if (!latest) return;
      set({ sessionId: latest.session_id, status: "complete" });
      // Fetch all cached data
      const state = get();
      await Promise.allSettled([
        state.fetchModules(),
        state.fetchIntelligence(),
        state.fetchConvergence(),
        state.fetchMarketplace(),
      ]);
    } catch {
      // No cached session — that's fine, user can run demo
    }
  },

  startDemo: async () => {
    try {
      set({ status: "running", errorMessage: null, convergenceHistory: [], modules: [], intelligence: {}, marketplace: [] });
      const { session_id, job_id } = await api.startDemo();
      set({ sessionId: session_id, jobId: job_id });
    } catch (e: any) {
      set({ status: "error", errorMessage: e.message });
    }
  },

  applyStreamEvent: (event: StreamEvent) => {
    const updates: Partial<TCDState> = {
      currentStage: event.stage,
      progress: event.progress,
      lastMessage: event.message || "",
    };

    if (event.stage === "complete") {
      updates.status = "complete";
    }
    if (event.stage === "error") {
      updates.status = "error";
      updates.errorMessage = event.message || "Unknown error";
    }

    // Append convergence data
    if (event.epoch !== undefined && event.loss !== undefined) {
      const prev = get().convergenceHistory;
      const exists = prev.some((p) => p.epoch === event.epoch);
      if (!exists) {
        updates.convergenceHistory = [
          ...prev,
          {
            epoch: event.epoch,
            loss: event.loss,
            link_auc: event.link_auc ?? 0,
            module_count: event.module_count ?? 0,
          },
        ];
      }
    }

    set(updates);
  },

  fetchModules: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    const { modules } = await api.fetchModules(sessionId);
    set({ modules });
  },

  fetchIntelligence: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    const data = await api.fetchIntelligence(sessionId);
    if (!data?.engines) return;
    const intelligence: Record<string, InsightResult[]> = {};
    for (const [eng, val] of Object.entries(data.engines as Record<string, any>)) {
      intelligence[eng] = val.insights || [];
    }
    set({ intelligence });
  },

  fetchConvergence: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    const history = await api.fetchConvergenceHistory(sessionId);
    if (history.length > 0) set({ convergenceHistory: history });
  },

  fetchMarketplace: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    const { modules } = await api.fetchMarketplace(sessionId);
    set({ marketplace: modules });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setIntelligenceTab: (tab) => set({ activeIntelligenceTab: tab }),
  setAgentOpen: (open) => set({ agentOpen: open }),
  reset: () =>
    set({
      sessionId: null, jobId: null, status: "idle", errorMessage: null,
      modules: [], convergenceHistory: [], intelligence: {}, marketplace: [],
      currentStage: "", progress: 0, lastMessage: "",
    }),
}));
