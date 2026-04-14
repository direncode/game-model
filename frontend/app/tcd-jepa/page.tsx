"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { useTCDStore } from "@/lib/tcd/store";
import { cn } from "@/lib/utils";
import { Network } from "lucide-react";

import DemoLauncher from "@/components/tcd/DemoLauncher";
import StatCardGrid from "@/components/tcd/StatCardGrid";
import ConvergenceChart from "@/components/tcd/ConvergenceChart";
import BenchmarkChart from "@/components/tcd/BenchmarkChart";
import TopologyViz from "@/components/tcd/TopologyViz";
import IntelligencePanel from "@/components/tcd/IntelligencePanel";
import ModuleFormationFeed from "@/components/tcd/ModuleFormationFeed";
import MarketplaceTab from "@/components/tcd/MarketplaceTab";
import TCDAIDrawer from "@/components/tcd/TCDAIDrawer";

export default function TCDJEPAPage() {
  const activeTab = useTCDStore((s) => s.activeTab);
  const setActiveTab = useTCDStore((s) => s.setActiveTab);
  const status = useTCDStore((s) => s.status);
  const loadLatest = useTCDStore((s) => s.loadLatest);

  // Auto-load the latest cached session on mount
  useEffect(() => {
    if (status === "idle") {
      loadLatest();
    }
  }, [status, loadLatest]);

  return (
    <div className="min-h-screen bg-li-bg">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Network className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">TCD-JEPA Module Factory</h1>
              <p className="text-xs text-li-text-muted mt-0.5">
                Topological Crystallization Dynamics — interpretable, routable neural modules via persistent homology
              </p>
            </div>
          </div>
          {/* Tab switcher */}
          <div className="flex bg-li-gray-900 rounded-lg p-0.5 border border-li-gray-800">
            {(["live", "registry", "marketplace"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                  activeTab === tab
                    ? "bg-white/10 text-white"
                    : "text-li-text-muted hover:text-white"
                )}
              >
                {tab === "live" ? "Live" : tab === "registry" ? "Registry" : "Marketplace"}
              </button>
            ))}
          </div>
        </div>

        {/* Demo launcher — always visible */}
        <div className="mb-5">
          <DemoLauncher />
        </div>

        {/* Stat cards */}
        <div className="mb-5">
          <StatCardGrid />
        </div>

        {/* Tab content */}
        {activeTab === "live" && (
          <div className="space-y-5">
            {/* Top row: Convergence + Benchmark */}
            <div className="grid grid-cols-3 gap-5">
              <div className="col-span-2">
                <ConvergenceChart />
              </div>
              <BenchmarkChart />
            </div>

            {/* Middle row: Topology + Module Feed */}
            <div className="grid grid-cols-3 gap-5">
              <TopologyViz />
              <div className="col-span-2">
                <ModuleFormationFeed />
              </div>
            </div>

            {/* Intelligence panel — full width */}
            <IntelligencePanel />
          </div>
        )}

        {activeTab === "registry" && (
          <div className="space-y-5">
            <ModuleFormationFeed />
            <IntelligencePanel />
          </div>
        )}

        {activeTab === "marketplace" && <MarketplaceTab />}

        {/* AI Agent drawer */}
        <TCDAIDrawer />
      </main>
    </div>
  );
}
