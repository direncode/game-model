"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { cn, formatNumber } from "@/lib/utils";
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Database,
  Lock,
  Eye,
  FileText,
  Server,
  Key,
  UserCheck,
  Clock,
  Users,
  Activity,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────

interface ComplianceDashboardData {
  total_users: number;
  total_audit_entries: number;
  top_actions: Array<{ action: string; count: number }>;
}

interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  status: "pass" | "fail" | "partial";
  category: string;
}

interface GdprItem {
  name: string;
  status: "ready" | "in_progress" | "not_started";
  icon: React.ElementType;
}

// ── Static Data ────────────────────────────────────────────────────

const soc2Controls: ComplianceControl[] = [
  {
    id: "CC6.1",
    name: "Logical and Physical Access Controls",
    description: "Role-based access control implemented for all system functions",
    status: "pass",
    category: "Security",
  },
  {
    id: "CC6.2",
    name: "System Account Management",
    description: "User provisioning and deprovisioning workflows in place",
    status: "pass",
    category: "Security",
  },
  {
    id: "CC6.3",
    name: "Authentication Mechanisms",
    description: "JWT-based authentication with token expiration",
    status: "pass",
    category: "Security",
  },
  {
    id: "CC7.1",
    name: "System Monitoring",
    description: "Audit logging for all data access and modifications",
    status: "pass",
    category: "Monitoring",
  },
  {
    id: "CC7.2",
    name: "Anomaly Detection",
    description: "Real-time monitoring for unusual access patterns",
    status: "partial",
    category: "Monitoring",
  },
  {
    id: "CC8.1",
    name: "Change Management",
    description: "Version control and lineage tracking for all data transformations",
    status: "pass",
    category: "Operations",
  },
  {
    id: "CC9.1",
    name: "Risk Mitigation",
    description: "Contestation layer for validating AI-discovered structures",
    status: "pass",
    category: "Risk",
  },
  {
    id: "A1.1",
    name: "Data Encryption at Rest",
    description: "Database encryption for sensitive data fields",
    status: "pass",
    category: "Availability",
  },
  {
    id: "A1.2",
    name: "Data Encryption in Transit",
    description: "TLS 1.3 for all API communications",
    status: "pass",
    category: "Availability",
  },
  {
    id: "PI1.1",
    name: "Data Processing Integrity",
    description: "NaN guard and validation checks during crystallization",
    status: "pass",
    category: "Processing",
  },
];

const gdprReadiness: GdprItem[] = [
  { name: "Data Subject Access Requests (DSAR)", status: "ready", icon: UserCheck },
  { name: "Right to Erasure", status: "ready", icon: XCircle },
  { name: "Data Processing Records", status: "ready", icon: FileText },
  { name: "Data Protection Impact Assessment", status: "in_progress", icon: Shield },
  { name: "Consent Management", status: "in_progress", icon: CheckCircle2 },
  { name: "Data Portability", status: "ready", icon: Database },
  { name: "Breach Notification", status: "ready", icon: AlertCircle },
  { name: "Privacy by Design", status: "ready", icon: Lock },
];

const gdprStatusColors: Record<string, string> = {
  ready: "text-li-accent",
  in_progress: "text-li-warning",
  not_started: "text-li-danger",
};

const gdprStatusLabels: Record<string, string> = {
  ready: "Ready",
  in_progress: "In Progress",
  not_started: "Not Started",
};

const statusIcon = (status: string) => {
  if (status === "pass") return <CheckCircle2 className="w-4 h-4 text-li-accent" />;
  if (status === "fail") return <XCircle className="w-4 h-4 text-li-danger" />;
  return <AlertCircle className="w-4 h-4 text-li-warning" />;
};

const BAR_COLORS = [
  "#06b6d4",
  "#22d3ee",
  "#67e8f9",
  "#a5f3fc",
  "#0891b2",
  "#0e7490",
  "#155e75",
  "#164e63",
  "#083344",
  "#0c4a6e",
];

// ── Custom Tooltip ─────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { action: string } }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-li-card border border-li-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-li-text-primary font-medium">
        {payload[0].payload.action}
      </p>
      <p className="text-xs text-li-primary font-data">
        {formatNumber(payload[0].value)} events
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function CompliancePage() {
  const passCount = soc2Controls.filter((c) => c.status === "pass").length;
  const totalControls = soc2Controls.length;

  const { data: dashboardData, isLoading: dashLoading } = useQuery({
    queryKey: ["compliance-dashboard"],
    queryFn: () =>
      api.getComplianceDashboard() as Promise<ComplianceDashboardData>,
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <Sidebar />
      <main className="ml-64 pt-16">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-display text-li-text-primary flex items-center gap-3">
              <Shield className="w-6 h-6 text-li-warning" />
              Compliance Dashboard
            </h1>
            <p className="text-sm text-li-text-secondary mt-1">
              SOC 2 controls, GDPR readiness, and data governance
            </p>
          </div>

          {/* Live stats from API */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
            <div className="li-card text-center">
              <p className="text-3xl font-display text-li-accent">
                {passCount}/{totalControls}
              </p>
              <p className="text-sm text-li-text-muted mt-1">SOC 2 Controls Passing</p>
            </div>
            <div className="li-card text-center">
              <p className="text-3xl font-display text-li-accent">
                {gdprReadiness.filter((g) => g.status === "ready").length}/
                {gdprReadiness.length}
              </p>
              <p className="text-sm text-li-text-muted mt-1">GDPR Items Ready</p>
            </div>
            <div className="li-card text-center">
              {dashLoading ? (
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-li-primary" />
              ) : (
                <p className="text-3xl font-display text-li-primary flex items-center justify-center gap-2">
                  <Users className="w-6 h-6" />
                  {dashboardData?.total_users != null
                    ? formatNumber(dashboardData.total_users)
                    : "--"}
                </p>
              )}
              <p className="text-sm text-li-text-muted mt-1">Total Users</p>
            </div>
            <div className="li-card text-center">
              {dashLoading ? (
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-li-primary" />
              ) : (
                <p className="text-3xl font-display text-li-primary flex items-center justify-center gap-2">
                  <Activity className="w-6 h-6" />
                  {dashboardData?.total_audit_entries != null
                    ? formatNumber(dashboardData.total_audit_entries)
                    : "--"}
                </p>
              )}
              <p className="text-sm text-li-text-muted mt-1">
                Total Audit Entries
              </p>
            </div>
          </div>

          {/* Top Actions Bar Chart */}
          {dashboardData?.top_actions && dashboardData.top_actions.length > 0 && (
            <div className="li-card mb-8">
              <h3 className="text-sm font-display text-li-text-primary mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-li-primary" />
                Top Actions
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dashboardData.top_actions}
                    layout="vertical"
                    margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="action"
                      width={140}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ fill: "rgba(6,182,212,0.08)" }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                      {dashboardData.top_actions.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={BAR_COLORS[index % BAR_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* SOC 2 Controls */}
            <div className="li-card">
              <h3 className="text-sm font-display text-li-text-primary mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-li-primary" />
                SOC 2 Control Checklist
              </h3>
              <div className="space-y-2">
                {soc2Controls.map((control) => (
                  <div
                    key={control.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-li-bg border border-li-border"
                  >
                    <div className="mt-0.5">{statusIcon(control.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-data text-li-primary">
                          {control.id}
                        </span>
                        <span className="text-sm font-medium text-li-text-primary">
                          {control.name}
                        </span>
                      </div>
                      <p className="text-xs text-li-text-muted">
                        {control.description}
                      </p>
                    </div>
                    <span className="li-badge bg-li-surface text-li-text-muted border border-li-border text-[10px] flex-shrink-0">
                      {control.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              {/* GDPR Readiness */}
              <div className="li-card">
                <h3 className="text-sm font-display text-li-text-primary mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-li-accent" />
                  GDPR Readiness
                </h3>
                <div className="space-y-2">
                  {gdprReadiness.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-li-bg border border-li-border"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon
                          className={cn(
                            "w-4 h-4",
                            gdprStatusColors[item.status]
                          )}
                        />
                        <span className="text-sm text-li-text-primary">
                          {item.name}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-data",
                          gdprStatusColors[item.status]
                        )}
                      >
                        {gdprStatusLabels[item.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Inventory */}
              <div className="li-card">
                <h3 className="text-sm font-display text-li-text-primary mb-4 flex items-center gap-2">
                  <Database className="w-4 h-4 text-li-warning" />
                  Data Inventory
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-li-bg border border-li-border">
                    <div className="flex items-center gap-3">
                      <Server className="w-4 h-4 text-li-text-muted" />
                      <span className="text-sm text-li-text-primary">
                        Graph Datasets
                      </span>
                    </div>
                    <span className="text-xs font-data text-li-text-secondary">
                      Encrypted at rest, access-logged
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-li-bg border border-li-border">
                    <div className="flex items-center gap-3">
                      <Key className="w-4 h-4 text-li-text-muted" />
                      <span className="text-sm text-li-text-primary">
                        User Credentials
                      </span>
                    </div>
                    <span className="text-xs font-data text-li-text-secondary">
                      bcrypt hashed, salted
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-li-bg border border-li-border">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-li-text-muted" />
                      <span className="text-sm text-li-text-primary">
                        Audit Logs
                      </span>
                    </div>
                    <span className="text-xs font-data text-li-text-secondary">
                      Immutable, 90-day retention
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-li-bg border border-li-border">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-li-text-muted" />
                      <span className="text-sm text-li-text-primary">
                        Embedding Vectors
                      </span>
                    </div>
                    <span className="text-xs font-data text-li-text-secondary">
                      Derived data, deletable with source
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
