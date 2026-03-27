"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/LoadingSpinner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { formatDateTime } from "@/lib/utils";
import type { Report } from "@/lib/types";
import toast from "react-hot-toast";
import { FileText, Download, Plus } from "lucide-react";

const reportTypes = [
  { value: "executive_summary", label: "Executive Summary" },
  { value: "full_analysis", label: "Full Analysis" },
  { value: "change_report", label: "Change Report" },
];

const formatOptions = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
  { value: "html", label: "HTML" },
  { value: "json", label: "JSON" },
];

export default function ReportsPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const datasetId = params.id as string;

  const [showGenerate, setShowGenerate] = useState(false);
  const [reportType, setReportType] = useState("executive_summary");
  const [format, setFormat] = useState("pdf");

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => api.listReports() as Promise<Report[]>,
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      api.generateReport(datasetId, { report_type: reportType, format }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setShowGenerate(false);
      toast.success("Report generation started");
    },
    onError: (err: any) => toast.error(err.message || "Failed to generate report"),
  });

  const datasetReports = (reports as Report[] | undefined)?.filter(
    (r) => r.dataset_id === datasetId
  ) || [];

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-display text-li-text-primary">
            Reports
          </h2>
          <p className="text-sm text-li-text-secondary mt-1">
            Generate and download analysis reports
          </p>
        </div>
        <button
          onClick={() => setShowGenerate(!showGenerate)}
          className="li-btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Generate Report
        </button>
      </div>

      {/* Generate form */}
      {showGenerate && (
        <div className="li-card space-y-4 max-w-lg">
          <h3 className="text-sm font-display text-li-text-primary">
            New Report
          </h3>

          <div>
            <label className="block text-sm text-li-text-secondary mb-1.5">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="li-input"
            >
              {reportTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-li-text-secondary mb-1.5">
              Format
            </label>
            <div className="flex gap-2">
              {formatOptions.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-data transition-colors ${
                    format === f.value
                      ? "bg-li-primary/10 text-li-primary border border-li-primary/30"
                      : "bg-li-bg border border-li-border text-li-text-secondary hover:border-li-border-light"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowGenerate(false)}
              className="li-btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="li-btn-primary flex items-center gap-2"
            >
              {generateMutation.isPending ? (
                <LoadingSpinner size="sm" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Generate
            </button>
          </div>
        </div>
      )}

      {/* Reports list */}
      {datasetReports.length > 0 ? (
        <div className="space-y-3">
          {datasetReports.map((report) => (
            <div
              key={report.id}
              className="li-card flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-li-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-li-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-li-text-primary">
                    {report.title}
                  </h4>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="li-badge bg-li-surface text-li-text-secondary border border-li-border">
                      {reportTypes.find((t) => t.value === report.type)?.label ||
                        report.type}
                    </span>
                    <span className="li-badge bg-li-primary/10 text-li-primary uppercase">
                      {report.format}
                    </span>
                    <span className="text-xs text-li-text-muted font-data">
                      {formatDateTime(report.generated_at)}
                    </span>
                  </div>
                </div>
              </div>
              <a
                href={report.download_url}
                className="li-btn-secondary flex items-center gap-2 text-sm"
                download
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description="Generate your first report to export analysis results."
        />
      )}
    </div>
  );
}
