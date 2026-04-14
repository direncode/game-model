// Zustand store for Data Estate vertical state

import { create } from "zustand";
import type {
  AllocationRequest,
  Dashboard,
  EstateModule,
  LedgerEntry,
  LedgerSummary,
  Submission,
} from "./types";
import * as api from "./api";

interface DataEstateState {
  // Data
  submissions: Submission[];
  modules: EstateModule[];
  ledger: LedgerEntry[];
  ledgerSummary: LedgerSummary | null;
  allocations: AllocationRequest[];
  dashboard: Dashboard | null;

  // UI
  activeTab: "overview" | "scroll" | "ledger" | "allocations" | "chat";
  loading: boolean;
  error: string | null;

  // Actions
  setActiveTab: (tab: DataEstateState["activeTab"]) => void;
  loadDashboard: () => Promise<void>;
  loadSubmissions: (status?: string) => Promise<void>;
  loadModules: () => Promise<void>;
  loadLedger: (category?: string) => Promise<void>;
  loadLedgerSummary: () => Promise<void>;
  loadAllocations: (status?: string) => Promise<void>;
  reset: () => void;
}

export const useDataEstateStore = create<DataEstateState>((set) => ({
  submissions: [],
  modules: [],
  ledger: [],
  ledgerSummary: null,
  allocations: [],
  dashboard: null,
  activeTab: "overview",
  loading: false,
  error: null,

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadDashboard: async () => {
    try {
      set({ loading: true, error: null });
      const dashboard = await api.fetchDashboard();
      set({ dashboard, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  loadSubmissions: async (status?: string) => {
    try {
      const submissions = await api.fetchSubmissions(status);
      set({ submissions });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadModules: async () => {
    try {
      const modules = await api.fetchEstateModules();
      set({ modules });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadLedger: async (category?: string) => {
    try {
      const ledger = await api.fetchLedger(category);
      set({ ledger });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadLedgerSummary: async () => {
    try {
      const ledgerSummary = await api.fetchLedgerSummary();
      set({ ledgerSummary });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadAllocations: async (status?: string) => {
    try {
      const allocations = await api.fetchAllocations(status);
      set({ allocations });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  reset: () =>
    set({
      submissions: [],
      modules: [],
      ledger: [],
      ledgerSummary: null,
      allocations: [],
      dashboard: null,
      activeTab: "overview",
      loading: false,
      error: null,
    }),
}));
