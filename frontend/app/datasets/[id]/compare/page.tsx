"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageLoader } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTime } from "@/lib/utils";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  GitCompare,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Job {
  id: string;
  status: string;
  module_count?: number;
  final_link_auc?: number;
  final_knn_accuracy?: number;
  config?: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

interface Metric {
  epoch: number;
  loss: number;
  link_auc: number;
  knn_accuracy: number;
}

export default function ComparePage() {
  const params = useParams();
  const datasetId = params.id as string;

  const [jobIdA, setJobIdA] = useState<string>("");
  const [jobIdB, setJobIdB] = useState<string>("");

  // Fetch dataset to get crystallization history
  const { data: dataset, isLoading: datasetLoading } = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => api.getDataset(datasetId) as Promise<any>,
  });

  // Fetch metrics for both jobs when selected
  const { data: metricsA } = useQuery({
    queryKey: ["metrics", jobIdA],
    queryFn: () => api.getCrystallizationMetrics(jobIdA) as Promise<Metric[]>,
    enabled: !!jobIdA,
  });

  const { data: metricsB } = useQuery({
    queryKey: ["metrics", jobIdB],
    queryFn: () => api.getCrystallizationMetrics(jobIdB) as Promise<Metric[]>,
    enabled: !!jobIdB,
  });

  const { data: jobA } = useQuery({
    queryKey: ["job", jobIdA],
    queryFn: () => api.getCrystallizationJob(jobIdA) as Promise<Job>,
    enabled: !!jobIdA,
  });

  const { data: jobB } = useQuery({
    queryKey: ["job", jobIdB],
    queryFn: () => api.getCrystallizationJob(jobIdB) as Promise<Job>,
    enabled: !!jobIdB,
  });

  // Merge metrics for overlay chart
  const mergedMetrics = useMemo(() => {
    if (!metricsA && !metricsB) return [];
    const maxLen = Math.max(
      (metricsA as Metric[] || []).length,
      (metricsB as Metric[] || []).length
    );
    const merged = [];
    for (let i = 0; i < maxLen; i++) {
      merged.push({
        epoch: i + 1,
        loss_a: (metricsA as Metric[])?.[i]?.loss ?? null,
        loss_b: (metricsB as Metric[])?.[i]?.loss ?? null,
        auc_a: (metricsA as Metric[])?.[i]?.link_auc ?? null,
        auc_b: (metricsB as Metric[])?.[i]?.link_auc ?? null,
      });
    }
    return merged;
  }, [metricsA, metricsB]);

  if (datasetLoading) return <PageLoader />;

  const jobs: Job[] = (dataset as any)?.crystallization_jobs || [];
  const completedJobs = jobs.filter((j) => j.status === "completed");

  if (completedJobs.length < 2) {
    return (
      <EmptyState
        icon={GitCompare}
        title="Not enough runs to compare"
        description="You need at least 2 completed crystallization runs to compare. Run crystallization multiple times with different configurations."
      />
    );
  }

  const renderDiff = (label: string, valA?: number, valB?: number) => {
    if (valA === undefined || valB === undefined) return null;
    const diff = valB - valA;
    const pct = valA !== 0 ? ((diff / valA) * 100).toFixed(1) : "N/A";
    const isPositive = diff > 0;

    return (
      <div className="li-card py-3 px-4">
        <p className="text-xs text-li-text-muted mb-1">{label}</p>
        <div className="flex items-center gap-3">
          <span className="font-data text-sm text-li-text-secondary">
            {valA.toFixed(4)}
          </span>
          <span className="text-li-text-muted">→</span>
          <span className="font-data text-sm text-li-text-primary">
            {valB.toFixed(4)}
          </span>
          <span
            className={`flex items-center gap-1 text-xs font-data ${
              isPositive ? "text-green-400" : diff < 0 ? "text-red-400" : "text-li-text-muted"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : diff < 0 ? (
              <ArrowDownRight className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            {pct}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display text-li-text-primary">
          Compare Crystallization Runs
        </h2>
        <p className="text-sm text-li-text-secondary mt-1">
          Side-by-side comparison of training metrics and results
        </p>
      </div>

      {/* Job Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-li-text-secondary mb-1.5">
            Run A (baseline)
          </label>
          <select
            value={jobIdA}
            onChange={(e) => setJobIdA(e.target.value)}
            className="li-input"
          >
            <option value="">Select a run...</option>
            {completedJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {formatDateTime(job.completed_at || job.created_at)} — {job.module_count || "?"} modules
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-li-text-secondary mb-1.5">
            Run B (comparison)
          </label>
          <select
            value={jobIdB}
            onChange={(e) => setJobIdB(e.target.value)}
            className="li-input"
          >
            <option value="">Select a run...</option>
            {completedJobs
              .filter((j) => j.id !== jobIdA)
              .map((job) => (
                <option key={job.id} value={job.id}>
                  {formatDateTime(job.completed_at || job.created_at)} — {job.module_count || "?"} modules
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Comparison Results */}
      {jobA && jobB && (
        <>
          {/* Metric Diffs */}
          <div className="grid grid-cols-3 gap-4">
            {renderDiff(
              "Link Prediction AUC",
              (jobA as Job).final_link_auc,
              (jobB as Job).final_link_auc
            )}
            {renderDiff(
              "kNN Accuracy",
              (jobA as Job).final_knn_accuracy,
              (jobB as Job).final_knn_accuracy
            )}
            <div className="li-card py-3 px-4">
              <p className="text-xs text-li-text-muted mb-1">Module Count</p>
              <div className="flex items-center gap-3">
                <span className="font-data text-sm text-li-text-secondary">
                  {(jobA as Job).module_count ?? "?"}
                </span>
                <span className="text-li-text-muted">→</span>
                <span className="font-data text-sm text-li-text-primary">
                  {(jobB as Job).module_count ?? "?"}
                </span>
              </div>
            </div>
          </div>

          {/* Overlaid Training Charts */}
          {mergedMetrics.length > 0 && (
            <div className="li-card">
              <h3 className="text-sm font-display text-li-text-primary mb-4">
                Training Loss Comparison
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mergedMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis dataKey="epoch" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="loss_a"
                    stroke="#06B6D4"
                    strokeWidth={2}
                    dot={false}
                    name="Run A Loss"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="loss_b"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                    name="Run B Loss"
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {mergedMetrics.length > 0 && (
            <div className="li-card">
              <h3 className="text-sm font-display text-li-text-primary mb-4">
                Link AUC Comparison
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mergedMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis dataKey="epoch" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} domain={[0, 1]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="auc_a"
                    stroke="#06B6D4"
                    strokeWidth={2}
                    dot={false}
                    name="Run A AUC"
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="auc_b"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                    name="Run B AUC"
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
