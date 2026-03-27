"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { PageLoader } from "@/components/LoadingSpinner";
import { formatCompactNumber, formatDate } from "@/lib/utils";
import type { Dataset, DatasetProfile } from "@/lib/types";
import toast from "react-hot-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Boxes,
  Link2,
  Activity,
  Star,
  Sparkles,
  Trash2,
} from "lucide-react";

const CHART_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

export default function DatasetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const datasetId = params.id as string;

  const { data: dataset, isLoading: datasetLoading } = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => api.getDataset(datasetId) as Promise<Dataset>,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["dataset-profile", datasetId],
    queryFn: () => api.getDatasetProfile(datasetId) as Promise<DatasetProfile>,
    enabled: !!dataset && dataset.status === "ready",
  });

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this dataset? This action cannot be undone.")) {
      return;
    }
    try {
      await api.deleteDataset(datasetId);
      toast.success("Dataset deleted");
      router.push("/datasets");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete dataset");
    }
  };

  if (datasetLoading) return <PageLoader />;
  if (!dataset) return <div className="text-li-text-muted">Dataset not found</div>;

  const entityTypeData = profile?.entity_type_distribution
    ? Object.entries(profile.entity_type_distribution).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  const relationshipTypeData = profile?.relationship_type_distribution
    ? Object.entries(profile.relationship_type_distribution).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-display text-li-text-primary">
              {dataset.name}
            </h1>
            <StatusBadge status={dataset.status} />
          </div>
          {dataset.description && (
            <p className="text-sm text-li-text-secondary max-w-2xl">
              {dataset.description}
            </p>
          )}
          <p className="text-xs text-li-text-muted font-data mt-2">
            Created {formatDate(dataset.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/datasets/${datasetId}/crystallize`}
            className="li-btn-primary flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Crystallize
          </Link>
          <button
            onClick={handleDelete}
            className="li-btn-danger flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Entities"
          value={formatCompactNumber(dataset.entity_count)}
          icon={Boxes}
        />
        <StatCard
          label="Edges"
          value={formatCompactNumber(dataset.edge_count)}
          icon={Link2}
        />
        <StatCard
          label="Density"
          value={dataset.density.toFixed(4)}
          icon={Activity}
        />
        <StatCard
          label="Quality Score"
          value={
            profile?.quality_score
              ? `${(profile.quality_score * 100).toFixed(1)}%`
              : "N/A"
          }
          icon={Star}
        />
      </div>

      {/* Charts */}
      {profile && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Entity Type Distribution */}
          {entityTypeData.length > 0 && (
            <div className="li-card">
              <h3 className="text-sm font-display text-li-text-primary mb-4">
                Entity Type Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={entityTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#9CA3AF", fontSize: 12 }}
                    axisLine={{ stroke: "#1F2937" }}
                  />
                  <YAxis
                    tick={{ fill: "#9CA3AF", fontSize: 12 }}
                    axisLine={{ stroke: "#1F2937" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #1F2937",
                      borderRadius: "8px",
                      color: "#F9FAFB",
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {entityTypeData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Relationship Type Distribution */}
          {relationshipTypeData.length > 0 && (
            <div className="li-card">
              <h3 className="text-sm font-display text-li-text-primary mb-4">
                Relationship Type Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={relationshipTypeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis
                    type="number"
                    tick={{ fill: "#9CA3AF", fontSize: 12 }}
                    axisLine={{ stroke: "#1F2937" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "#9CA3AF", fontSize: 12 }}
                    axisLine={{ stroke: "#1F2937" }}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #1F2937",
                      borderRadius: "8px",
                      color: "#F9FAFB",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {relationshipTypeData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
