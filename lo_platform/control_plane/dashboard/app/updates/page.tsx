"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import type { UpdateRollout } from "@/lib/types";

function generateMockRollouts(): {
  currentVersion: string;
  latestVersion: string;
  rollouts: UpdateRollout[];
} {
  return {
    currentVersion: "2.4.1",
    latestVersion: "2.5.0",
    rollouts: [
      {
        id: "roll-005",
        version: "2.5.0",
        status: "rolling",
        forks_updated: 7,
        forks_total: 12,
        started_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "roll-004",
        version: "2.4.1",
        status: "complete",
        forks_updated: 12,
        forks_total: 12,
        started_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
      {
        id: "roll-003",
        version: "2.4.0",
        status: "complete",
        forks_updated: 11,
        forks_total: 11,
        started_at: new Date(Date.now() - 21 * 86400000).toISOString(),
      },
      {
        id: "roll-002",
        version: "2.3.2",
        status: "rolled_back",
        forks_updated: 4,
        forks_total: 11,
        started_at: new Date(Date.now() - 35 * 86400000).toISOString(),
      },
    ],
  };
}

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-cp-gray-400", label: "Pending" },
  rolling: { icon: RefreshCw, color: "text-cp-cyan", label: "Rolling Out" },
  paused: { icon: Pause, color: "text-cp-yellow", label: "Paused" },
  complete: { icon: CheckCircle, color: "text-cp-green", label: "Complete" },
  rolled_back: { icon: RotateCcw, color: "text-cp-red", label: "Rolled Back" },
};

export default function UpdatesPage() {
  const [data, setData] = useState<ReturnType<typeof generateMockRollouts> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(generateMockRollouts());
    setLoading(false);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cp-cyan border-t-transparent" />
      </div>
    );
  }

  const activeRollout = data.rollouts.find((r) => r.status === "rolling" || r.status === "paused");

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-cp-white">Update Management</h1>
        <p className="mt-1 text-sm text-cp-gray-500">
          Manage version rollouts across the fork fleet
        </p>
      </div>

      {/* Version info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-cp-gray-500">
            Current Version
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-cp-white">
            v{data.currentVersion}
          </p>
          <p className="mt-1 text-xs text-cp-gray-600">
            Deployed across fleet
          </p>
        </div>
        <div className="rounded-lg border border-cp-cyan/20 bg-cp-cyan-glow p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-cp-gray-500">
            Latest Available
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold text-cp-cyan">
            v{data.latestVersion}
          </p>
          <p className="mt-1 text-xs text-cp-gray-600">
            {activeRollout ? "Rollout in progress" : "Ready to deploy"}
          </p>
        </div>
        <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-cp-gray-500">
            Rollout Progress
          </p>
          {activeRollout ? (
            <>
              <p className="mt-2 font-mono text-2xl font-semibold text-cp-white">
                {activeRollout.forks_updated}/{activeRollout.forks_total}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-cp-gray-800">
                <div
                  className="h-1.5 rounded-full bg-cp-cyan transition-all"
                  style={{
                    width: `${(activeRollout.forks_updated / activeRollout.forks_total) * 100}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <p className="mt-2 text-lg text-cp-gray-500">No active rollout</p>
          )}
        </div>
      </div>

      {/* Active rollout controls */}
      {activeRollout && (
        <div className="rounded-lg border border-cp-cyan/20 bg-cp-black-elevated p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin text-cp-cyan" />
              <div>
                <p className="font-medium text-cp-white">
                  Rolling out v{activeRollout.version}
                </p>
                <p className="text-xs text-cp-gray-500">
                  {activeRollout.forks_updated} of {activeRollout.forks_total} forks updated
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeRollout.status === "rolling" ? (
                <button className="flex items-center gap-1.5 rounded-md border border-cp-yellow/30 bg-cp-yellow/10 px-3 py-1.5 text-xs font-medium text-cp-yellow hover:bg-cp-yellow/20">
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </button>
              ) : (
                <button className="flex items-center gap-1.5 rounded-md border border-cp-green/30 bg-cp-green/10 px-3 py-1.5 text-xs font-medium text-cp-green hover:bg-cp-green/20">
                  <Play className="h-3.5 w-3.5" />
                  Resume
                </button>
              )}
              <button className="flex items-center gap-1.5 rounded-md border border-cp-red/30 bg-cp-red/10 px-3 py-1.5 text-xs font-medium text-cp-red hover:bg-cp-red/20">
                <RotateCcw className="h-3.5 w-3.5" />
                Rollback
              </button>
            </div>
          </div>

          {/* Progress bar with individual forks */}
          <div className="mt-4 grid grid-cols-12 gap-1">
            {Array.from({ length: activeRollout.forks_total }, (_, i) => (
              <div
                key={i}
                className={`h-6 rounded ${
                  i < activeRollout.forks_updated
                    ? "bg-cp-cyan/30"
                    : "bg-cp-gray-800"
                }`}
                title={`Fork ${i + 1}: ${i < activeRollout.forks_updated ? "Updated" : "Pending"}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Rollout history */}
      <div className="rounded-lg border border-cp-border bg-cp-black-elevated p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-cp-gray-500">
          Rollout History
        </p>
        <div className="space-y-3">
          {data.rollouts.map((rollout) => {
            const cfg = statusConfig[rollout.status];
            const Icon = cfg.icon;
            return (
              <div
                key={rollout.id}
                className="flex items-center justify-between rounded-md bg-cp-gray-900 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 ${cfg.color} ${
                      rollout.status === "rolling" ? "animate-spin" : ""
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-cp-gray-200">
                      v{rollout.version}
                    </p>
                    <p className="text-xs text-cp-gray-600">
                      {new Date(rollout.started_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-cp-gray-400">
                    {rollout.forks_updated}/{rollout.forks_total} forks
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      rollout.status === "complete"
                        ? "bg-cp-green/15 text-cp-green"
                        : rollout.status === "rolling"
                        ? "bg-cp-cyan/15 text-cp-cyan"
                        : rollout.status === "paused"
                        ? "bg-cp-yellow/15 text-cp-yellow"
                        : rollout.status === "rolled_back"
                        ? "bg-cp-red/15 text-cp-red"
                        : "bg-cp-gray-700/50 text-cp-gray-400"
                    }`}
                  >
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
