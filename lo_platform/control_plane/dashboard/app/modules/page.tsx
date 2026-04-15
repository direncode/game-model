"use client";

import { useEffect, useState } from "react";
import {
  Package,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  GitFork,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import type { ModuleInfo } from "@/lib/types";

function generateMockModules(): ModuleInfo[] {
  return [
    {
      id: "mod-fsd",
      name: "FSD (Fractal Structure Discovery)",
      description: "Core structure discovery engine with TCD-JEPA crystallization pipeline",
      enabled: true,
      adoption_count: 12,
      revenue_usd: 0,
    },
    {
      id: "mod-btut",
      name: "BTUT Engine",
      description: "13-file MFG data reduction system with lattice threading",
      enabled: true,
      adoption_count: 8,
      revenue_usd: 2400,
    },
    {
      id: "mod-qr-identity",
      name: "QR Digital Identity",
      description: "QR codes as universal identity tokens for lineage tracking and tiered access",
      enabled: true,
      adoption_count: 6,
      revenue_usd: 1800,
    },
    {
      id: "mod-flow-engine",
      name: "Flow Engine",
      description: "Graph-based computational pipeline with well health and system metrics",
      enabled: true,
      adoption_count: 10,
      revenue_usd: 1200,
    },
    {
      id: "mod-niv-economics",
      name: "NIV Economics (Legacy)",
      description: "Economic vertical analysis patterns — deprecated, extracted to flow-engine",
      enabled: false,
      adoption_count: 2,
      revenue_usd: 0,
    },
    {
      id: "mod-spatial",
      name: "Spatial Analytics",
      description: "Geospatial entity clustering and proximity analysis",
      enabled: false,
      adoption_count: 0,
      revenue_usd: 0,
    },
  ];
}

export default function ModulesPage() {
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setModules(generateMockModules());
    setLoading(false);
  }, []);

  const handleToggle = (id: string) => {
    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cp-cyan border-t-transparent" />
      </div>
    );
  }

  const totalModuleRevenue = modules.reduce((s, m) => s + m.revenue_usd, 0);
  const enabledCount = modules.filter((m) => m.enabled).length;
  const totalAdoption = modules.reduce((s, m) => s + m.adoption_count, 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-cp-white">Module Management</h1>
        <p className="mt-1 text-sm text-cp-gray-500">
          Manage add-on modules across the fork fleet
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Module Revenue"
          value={`$${totalModuleRevenue.toLocaleString()}/mo`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          title="Active Modules"
          value={`${enabledCount}/${modules.length}`}
          icon={<Package className="h-4 w-4" />}
        />
        <StatCard
          title="Total Adoptions"
          value={totalAdoption}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Module list */}
      <div className="space-y-3">
        {modules.map((mod) => (
          <div
            key={mod.id}
            className={`rounded-lg border p-4 transition-colors ${
              mod.enabled
                ? "border-cp-border bg-cp-black-elevated"
                : "border-cp-border/50 bg-cp-black-light opacity-70"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Package
                    className={`h-4 w-4 ${
                      mod.enabled ? "text-cp-cyan" : "text-cp-gray-600"
                    }`}
                  />
                  <h3 className="text-sm font-medium text-cp-white">{mod.name}</h3>
                  {!mod.enabled && (
                    <span className="rounded bg-cp-gray-700/50 px-1.5 py-0.5 text-[10px] text-cp-gray-500">
                      disabled
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-cp-gray-500">{mod.description}</p>

                {/* Adoption + revenue stats */}
                <div className="mt-3 flex items-center gap-4">
                  <span className="flex items-center gap-1 text-xs text-cp-gray-400">
                    <GitFork className="h-3 w-3" />
                    {mod.adoption_count} fork{mod.adoption_count !== 1 ? "s" : ""}
                  </span>
                  {mod.revenue_usd > 0 && (
                    <span className="flex items-center gap-1 text-xs text-cp-green">
                      <DollarSign className="h-3 w-3" />
                      ${mod.revenue_usd.toLocaleString()}/mo
                    </span>
                  )}
                </div>

                {/* Adoption bar */}
                {mod.adoption_count > 0 && (
                  <div className="mt-2 h-1 w-48 rounded-full bg-cp-gray-800">
                    <div
                      className="h-1 rounded-full bg-cp-cyan transition-all"
                      style={{ width: `${(mod.adoption_count / 12) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Toggle */}
              <button
                onClick={() => handleToggle(mod.id)}
                className="flex-shrink-0 p-1"
                title={mod.enabled ? "Disable globally" : "Enable globally"}
              >
                {mod.enabled ? (
                  <ToggleRight className="h-6 w-6 text-cp-cyan" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-cp-gray-600" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
