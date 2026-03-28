"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ws } from "@/lib/websocket";
import { useAuthStore } from "@/store/auth";
import { cn, formatDuration } from "@/lib/utils";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import toast from "react-hot-toast";
import type { CrystallizationJob, CrystallizationConfig, Dataset } from "@/lib/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Play,
  Square,
  Settings2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Shield,
  Clock,
  TrendingDown,
  Target,
  Crosshair,
} from "lucide-react";

interface LossDataPoint {
  epoch: number;
  loss: number;
}

export default function CrystallizePage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuthStore();
  const datasetId = params.id as string;

  // Config state
  const [moduleCount, setModuleCount] = useState("");
  const [epochs, setEpochs] = useState("");
  const [learningRate, setLearningRate] = useState("");
  const [phThreshold, setPhThreshold] = useState("");
  const [moduleCapacity, setModuleCapacity] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Job state
  const [activeJob, setActiveJob] = useState<CrystallizationJob | null>(null);
  const [lossHistory, setLossHistory] = useState<LossDataPoint[]>([]);
  const [starting, setStarting] = useState(false);

  const { data: dataset } = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => api.getDataset(datasetId) as Promise<Dataset>,
  });

  // WebSocket subscription for live updates
  useEffect(() => {
    if (!activeJob || activeJob.status !== "running") return;

    ws.connect(token || undefined);

    const unsub = ws.subscribeToCrystallization(activeJob.id, {
      onProgress: (data: any) => {
        setActiveJob((prev) =>
          prev
            ? {
                ...prev,
                progress: data.progress ?? prev.progress,
                current_epoch: data.current_epoch ?? prev.current_epoch,
                training_loss: data.training_loss ?? prev.training_loss,
                link_prediction_auc: data.link_prediction_auc ?? prev.link_prediction_auc,
                knn_accuracy: data.knn_accuracy ?? prev.knn_accuracy,
                nan_guard_status: data.nan_guard_status ?? prev.nan_guard_status,
                gpu_utilization: data.gpu_utilization ?? prev.gpu_utilization,
                estimated_time_remaining:
                  data.estimated_time_remaining ?? prev.estimated_time_remaining,
              }
            : prev
        );

        if (data.training_loss !== undefined && data.current_epoch !== undefined) {
          setLossHistory((prev) => [
            ...prev,
            { epoch: data.current_epoch, loss: data.training_loss },
          ]);
        }
      },
      onComplete: () => {
        setActiveJob((prev) => (prev ? { ...prev, status: "completed" } : prev));
        toast.success("TCD-JEPA discovered your modules!");
        router.push(`/datasets/${datasetId}/modules`);
      },
      onError: (data: any) => {
        setActiveJob((prev) => (prev ? { ...prev, status: "failed" } : prev));
        toast.error(`TCD-JEPA error: ${data.error}`);
      },
    });

    return () => unsub();
  }, [activeJob?.id, activeJob?.status, token, datasetId, router]);

  const handleStart = async () => {
    setStarting(true);
    const config: CrystallizationConfig = {};
    if (moduleCount) config.module_count = parseInt(moduleCount);
    if (epochs) config.epochs = parseInt(epochs);
    if (learningRate) config.learning_rate = parseFloat(learningRate);
    if (phThreshold) config.ph_filtration_threshold = parseFloat(phThreshold);
    if (moduleCapacity) config.module_capacity = parseInt(moduleCapacity);

    try {
      const job = (await api.triggerCrystallization(
        datasetId,
        config
      )) as CrystallizationJob;
      setActiveJob(job);
      setLossHistory([]);
      toast.success("TCD-JEPA is analyzing your data...");
    } catch (err: any) {
      toast.error(err.message || "TCD-JEPA failed to start");
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!activeJob) return;
    try {
      await api.cancelCrystallization(activeJob.id);
      setActiveJob((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      toast.success("TCD-JEPA analysis cancelled");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel");
    }
  };

  const nanStatusColor = (status?: string) => {
    if (status === "healthy") return "bg-li-accent";
    if (status === "warning") return "bg-li-warning";
    if (status === "critical") return "bg-li-danger";
    return "bg-li-text-muted";
  };

  const isRunning = activeJob?.status === "running";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-display text-li-text-primary">
          TCD-JEPA Analysis
        </h2>
        <p className="text-sm text-li-text-secondary mt-1">
          Ask TCD-JEPA to discover hidden structure in your dataset through
          topological crystallization
        </p>
      </div>

      {!isRunning && activeJob?.status !== "completed" ? (
        /* Configuration Form */
        <div className="li-card max-w-2xl space-y-6">
          <h3 className="text-sm font-display text-li-text-primary">
            Configuration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-li-text-secondary mb-1.5">
                Module Count
              </label>
              <input
                type="number"
                value={moduleCount}
                onChange={(e) => setModuleCount(e.target.value)}
                className="li-input"
                placeholder="Auto"
                min={2}
              />
            </div>
            <div>
              <label className="block text-sm text-li-text-secondary mb-1.5">
                Epochs
              </label>
              <input
                type="number"
                value={epochs}
                onChange={(e) => setEpochs(e.target.value)}
                className="li-input"
                placeholder="Auto"
                min={10}
              />
            </div>
            <div>
              <label className="block text-sm text-li-text-secondary mb-1.5">
                Learning Rate
              </label>
              <input
                type="number"
                value={learningRate}
                onChange={(e) => setLearningRate(e.target.value)}
                className="li-input"
                placeholder="Auto"
                step="0.0001"
                min={0}
              />
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-li-text-muted hover:text-li-text-secondary transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            Advanced Settings
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-li-border">
              <div>
                <label className="block text-sm text-li-text-secondary mb-1.5">
                  PH Filtration Threshold
                </label>
                <input
                  type="number"
                  value={phThreshold}
                  onChange={(e) => setPhThreshold(e.target.value)}
                  className="li-input"
                  placeholder="Auto"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm text-li-text-secondary mb-1.5">
                  Module Capacity
                </label>
                <input
                  type="number"
                  value={moduleCapacity}
                  onChange={(e) => setModuleCapacity(e.target.value)}
                  className="li-input"
                  placeholder="Auto"
                  min={1}
                />
              </div>
            </div>
          )}

          {dataset && (
            <div className="p-3 rounded-lg bg-li-bg border border-li-border text-xs font-data text-li-text-muted">
              Smart defaults based on dataset: {dataset.entity_count} entities,{" "}
              {dataset.edge_count} edges, density {dataset.density.toFixed(4)}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={starting}
            className="li-btn-primary flex items-center gap-2"
          >
            {starting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Ask TCD-JEPA
          </button>
        </div>
      ) : (
        /* Live Progress Dashboard */
        <div className="space-y-6">
          {/* Progress header */}
          <div className="li-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {isRunning && <LoadingSpinner size="sm" />}
                <div>
                  <h3 className="text-sm font-display text-li-text-primary">
                    {isRunning
                      ? "TCD-JEPA is Analyzing"
                      : `Crystallization ${activeJob?.status}`}
                  </h3>
                  <p className="text-xs text-li-text-muted font-data">
                    Epoch {activeJob?.current_epoch || 0} /{" "}
                    {activeJob?.total_epochs || "?"}
                  </p>
                </div>
              </div>
              {isRunning && (
                <button
                  onClick={handleCancel}
                  className="li-btn-danger flex items-center gap-2 text-sm"
                >
                  <Square className="w-3 h-3" />
                  Cancel
                </button>
              )}
            </div>

            {/* Overall progress bar */}
            <div className="w-full bg-li-bg rounded-full h-2 mb-2">
              <div
                className="bg-li-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${(activeJob?.progress || 0) * 100}%` }}
              />
            </div>
            <p className="text-xs text-li-text-muted font-data text-right">
              {((activeJob?.progress || 0) * 100).toFixed(1)}%
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Training Loss Curve */}
            <div className="li-card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-4 h-4 text-li-primary" />
                <h3 className="text-sm font-display text-li-text-primary">
                  Training Loss
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={lossHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis
                    dataKey="epoch"
                    tick={{ fill: "#9CA3AF", fontSize: 11 }}
                    axisLine={{ stroke: "#1F2937" }}
                    label={{
                      value: "Epoch",
                      position: "insideBottom",
                      offset: -5,
                      fill: "#6B7280",
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    tick={{ fill: "#9CA3AF", fontSize: 11 }}
                    axisLine={{ stroke: "#1F2937" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #1F2937",
                      borderRadius: "8px",
                      color: "#F9FAFB",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="loss"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                    animationDuration={200}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Metrics gauges */}
            <div className="space-y-4">
              {/* Link Prediction AUC */}
              <div className="li-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-li-accent" />
                    <span className="text-sm text-li-text-secondary">
                      Link Prediction AUC
                    </span>
                  </div>
                  <span className="text-lg font-display text-li-accent">
                    {activeJob?.link_prediction_auc
                      ? (activeJob.link_prediction_auc * 100).toFixed(1) + "%"
                      : "--"}
                  </span>
                </div>
                <div className="w-full bg-li-bg rounded-full h-2">
                  <div
                    className="bg-li-accent h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${(activeJob?.link_prediction_auc || 0) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* kNN Accuracy */}
              <div className="li-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-li-warning" />
                    <span className="text-sm text-li-text-secondary">
                      kNN Accuracy
                    </span>
                  </div>
                  <span className="text-lg font-display text-li-warning">
                    {activeJob?.knn_accuracy
                      ? (activeJob.knn_accuracy * 100).toFixed(1) + "%"
                      : "--"}
                  </span>
                </div>
                <div className="w-full bg-li-bg rounded-full h-2">
                  <div
                    className="bg-li-warning h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${(activeJob?.knn_accuracy || 0) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Status indicators */}
              <div className="li-card grid grid-cols-3 gap-4">
                {/* NaN Guard */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-li-text-muted" />
                    <div
                      className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        nanStatusColor(activeJob?.nan_guard_status)
                      )}
                    />
                  </div>
                  <p className="text-xs text-li-text-muted">NaN Guard</p>
                  <p className="text-xs font-data text-li-text-secondary capitalize">
                    {activeJob?.nan_guard_status || "unknown"}
                  </p>
                </div>

                {/* GPU Utilization */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Cpu className="w-4 h-4 text-li-text-muted" />
                  </div>
                  <p className="text-xs text-li-text-muted">GPU</p>
                  <p className="text-sm font-data font-bold text-li-text-primary">
                    {activeJob?.gpu_utilization
                      ? `${activeJob.gpu_utilization}%`
                      : "--"}
                  </p>
                </div>

                {/* ETA */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-li-text-muted" />
                  </div>
                  <p className="text-xs text-li-text-muted">ETA</p>
                  <p className="text-sm font-data font-bold text-li-text-primary">
                    {activeJob?.estimated_time_remaining
                      ? formatDuration(activeJob.estimated_time_remaining)
                      : "--"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
