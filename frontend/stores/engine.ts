import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import { ws } from "@/lib/websocket";
import toast from "react-hot-toast";

// ─── Types ───────────────────────────────────────────────────────────

export type ChatMessageType = "welcome" | "dataset-picker" | "user-action" | "processing" | "result" | "error";

export interface ChatMessage {
  id: string;
  type: ChatMessageType;
  timestamp: number;
  data?: Record<string, any>;
}

interface EngineMetrics {
  loss: number;
  linkAuc: number;
  knnAccuracy: number;
  nanGuardStatus: string;
  gpuUtilization: number;
  estimatedTimeRemaining: number;
}

interface LossPoint {
  epoch: number;
  loss: number;
  linkAuc: number;
  knnAccuracy: number;
}

interface LastRunSummary {
  moduleCount: number;
  avgPurity: number;
  completedAt: string;
  datasetId: string;
  jobId: string;
}

interface DiscoveredModule {
  id: string;
  name: string;
  entity_count: number;
  dominant_type: string;
  purity_score: number;
  confidence: number;
  description?: string;
}

type EngineStatus = "idle" | "processing" | "converged" | "error";

// ─── Store ───────────────────────────────────────────────────────────

interface EngineState {
  // Status
  engineStatus: EngineStatus;
  errorMessage: string | null;

  // Active job
  activeJobId: string | null;
  activeDatasetId: string | null;
  activeDatasetName: string | null;

  // Progress
  progress: number;
  currentEpoch: number;
  totalEpochs: number;

  // Metrics
  metrics: EngineMetrics;
  lossHistory: LossPoint[];

  // Results
  lastRunSummary: LastRunSummary | null;
  discoveredModules: DiscoveredModule[];

  // Chat
  chatMessages: ChatMessage[];

  // Actions
  startJob: (datasetId: string, datasetName: string, config?: Record<string, any>) => Promise<void>;
  cancelJob: () => Promise<void>;
  subscribeToJob: (jobId: string) => () => void;
  hydrateFromLastJob: (datasetId: string) => Promise<void>;
  reset: () => void;
  setActiveDataset: (id: string, name: string) => void;
  addMessage: (type: ChatMessageType, data?: Record<string, any>) => void;
  clearMessages: () => void;
  initChat: () => void;
}

const DEFAULT_METRICS: EngineMetrics = {
  loss: 0,
  linkAuc: 0,
  knnAccuracy: 0,
  nanGuardStatus: "healthy",
  gpuUtilization: 0,
  estimatedTimeRemaining: 0,
};

export const useEngineStore = create<EngineState>()(
  persist(
    (set, get) => ({
      // ── Initial State ──────────────────────────────────────────────
      engineStatus: "idle",
      errorMessage: null,
      activeJobId: null,
      activeDatasetId: null,
      activeDatasetName: null,
      progress: 0,
      currentEpoch: 0,
      totalEpochs: 0,
      metrics: { ...DEFAULT_METRICS },
      lossHistory: [],
      lastRunSummary: null,
      discoveredModules: [],
      chatMessages: [],

      // ── Chat Actions ─────────────────────────────────────────────
      addMessage: (type: ChatMessageType, data?: Record<string, any>) => {
        const msg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type,
          timestamp: Date.now(),
          data,
        };
        set((state) => ({ chatMessages: [...state.chatMessages, msg] }));
      },

      clearMessages: () => {
        set({ chatMessages: [] });
      },

      initChat: () => {
        const { chatMessages, engineStatus, lastRunSummary } = get();
        if (chatMessages.length > 0) return;
        get().addMessage("welcome");
        if (engineStatus === "converged" && lastRunSummary) {
          get().addMessage("result");
        }
        get().addMessage("dataset-picker");
      },

      // ── Set Active Dataset ─────────────────────────────────────────
      setActiveDataset: (id: string, name: string) => {
        set({ activeDatasetId: id, activeDatasetName: name });
      },

      // ── Start Job ──────────────────────────────────────────────────
      startJob: async (datasetId: string, datasetName: string, config?: Record<string, any>) => {
        try {
          set({
            engineStatus: "processing",
            activeDatasetId: datasetId,
            activeDatasetName: datasetName,
            progress: 0,
            currentEpoch: 0,
            totalEpochs: 0,
            metrics: { ...DEFAULT_METRICS },
            lossHistory: [],
            discoveredModules: [],
            errorMessage: null,
          });

          const job = await api.triggerCrystallization(datasetId, config) as any;
          const jobId = job.id || job.job_id;

          set({ activeJobId: jobId });

          // Push chat messages
          get().addMessage("user-action", { datasetName, datasetId });
          get().addMessage("processing");

          // Subscribe to WebSocket for live updates
          get().subscribeToJob(jobId);
        } catch (err: any) {
          set({ engineStatus: "error", errorMessage: err.message || "Failed to start engine" });
          toast.error(err.message || "TCD-JEPA failed to start");
        }
      },

      // ── Cancel Job ─────────────────────────────────────────────────
      cancelJob: async () => {
        const { activeJobId } = get();
        if (!activeJobId) return;

        try {
          await api.cancelCrystallization(activeJobId);
          set({
            engineStatus: "idle",
            activeJobId: null,
            progress: 0,
            currentEpoch: 0,
          });
          toast.success("TCD-JEPA analysis cancelled");
        } catch (err: any) {
          toast.error(err.message || "Failed to cancel");
        }
      },

      // ── Subscribe to WebSocket ─────────────────────────────────────
      subscribeToJob: (jobId: string) => {
        const unsub = ws.subscribeToCrystallization(jobId, {
          onProgress: (data: any) => {
            const newPoint: LossPoint = {
              epoch: data.epoch || get().currentEpoch + 1,
              loss: data.loss ?? data.training_loss ?? 0,
              linkAuc: data.link_auc ?? data.link_prediction_auc ?? 0,
              knnAccuracy: data.knn_accuracy ?? 0,
            };

            set((state) => ({
              progress: data.progress ?? state.progress,
              currentEpoch: data.epoch ?? state.currentEpoch,
              totalEpochs: data.total_epochs ?? state.totalEpochs,
              metrics: {
                loss: newPoint.loss,
                linkAuc: newPoint.linkAuc,
                knnAccuracy: newPoint.knnAccuracy,
                nanGuardStatus: data.nan_guard_status ?? state.metrics.nanGuardStatus,
                gpuUtilization: data.gpu_utilization ?? state.metrics.gpuUtilization,
                estimatedTimeRemaining: data.estimated_time_remaining ?? state.metrics.estimatedTimeRemaining,
              },
              lossHistory: [...state.lossHistory, newPoint],
            }));
          },

          onComplete: async (data: any) => {
            const { activeDatasetId } = get();

            // Fetch discovered modules inline
            let modules: DiscoveredModule[] = [];
            if (activeDatasetId) {
              try {
                const result = await api.listModules(activeDatasetId) as any;
                modules = Array.isArray(result) ? result : result?.items || [];
              } catch {
                // Non-critical
              }
            }

            const avgPurity = modules.length > 0
              ? modules.reduce((sum: number, m: any) => sum + (m.purity_score || 0), 0) / modules.length
              : 0;

            set({
              engineStatus: "converged",
              progress: 1,
              discoveredModules: modules,
              lastRunSummary: {
                moduleCount: modules.length,
                avgPurity: Math.round(avgPurity * 100),
                completedAt: new Date().toISOString(),
                datasetId: activeDatasetId || "",
                jobId: get().activeJobId || "",
              },
            });

            get().addMessage("result", { moduleCount: modules.length });
            toast.success(`TCD-JEPA discovered ${modules.length} modules!`);
          },

          onError: (data: any) => {
            set({
              engineStatus: "error",
              errorMessage: data?.error || "TCD-JEPA encountered an error",
            });
            get().addMessage("error", { error: data?.error || "TCD-JEPA encountered an error" });
            toast.error(data?.error || "TCD-JEPA encountered an error");
          },
        });

        return unsub;
      },

      // ── Hydrate from last job ──────────────────────────────────────
      hydrateFromLastJob: async (datasetId: string) => {
        // Try to restore state from the most recent job for this dataset
        // This handles page refresh during processing
        const { activeJobId, engineStatus } = get();

        if (activeJobId && engineStatus === "processing") {
          try {
            const job = await api.getCrystallizationJob(activeJobId) as any;

            if (job.status === "running") {
              // Reconnect WebSocket
              get().subscribeToJob(activeJobId);
            } else if (job.status === "completed") {
              // Hydrate results
              const modules = await api.listModules(datasetId) as any;
              const moduleList = Array.isArray(modules) ? modules : modules?.items || [];
              const avgPurity = moduleList.length > 0
                ? moduleList.reduce((s: number, m: any) => s + (m.purity_score || 0), 0) / moduleList.length
                : 0;

              set({
                engineStatus: "converged",
                progress: 1,
                discoveredModules: moduleList,
                lastRunSummary: {
                  moduleCount: moduleList.length,
                  avgPurity: Math.round(avgPurity * 100),
                  completedAt: job.completed_at || new Date().toISOString(),
                  datasetId,
                  jobId: activeJobId,
                },
              });
            } else if (job.status === "failed") {
              set({ engineStatus: "error", errorMessage: job.error_message });
            }
          } catch {
            // Job may not exist anymore
            set({ engineStatus: "idle", activeJobId: null });
          }
        }
      },

      // ── Reset ──────────────────────────────────────────────────────
      reset: () => {
        set({
          engineStatus: "idle",
          errorMessage: null,
          activeJobId: null,
          progress: 0,
          currentEpoch: 0,
          totalEpochs: 0,
          metrics: { ...DEFAULT_METRICS },
          lossHistory: [],
          discoveredModules: [],
          chatMessages: [],
        });
        // Re-initialize chat with welcome + dataset picker
        get().addMessage("welcome");
        get().addMessage("dataset-picker");
      },
    }),
    {
      name: "li-engine-store-v2",
      partialize: () => ({}),
    }
  )
);
