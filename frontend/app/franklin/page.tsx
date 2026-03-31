"use client";

import { useQuery } from "@tanstack/react-query";
import { useFranklinStore } from "@/stores/franklin";
import { fetchSpots, fetchHeatmap, fetchDensity, fetchTrends, fetchStatus, fetchIntel, fetchConvergence } from "@/lib/fsd-api";
import { useUIStore } from "@/stores/ui";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import HourSlider from "@/components/franklin/HourSlider";
import FranklinMap from "@/components/franklin/FranklinMap";
import VenueList from "@/components/franklin/VenueList";
import VenueDetail from "@/components/franklin/VenueDetail";
import TrendPanel from "@/components/franklin/TrendPanel";
import DensityPanel from "@/components/franklin/DensityPanel";
import StatusBar from "@/components/franklin/StatusBar";
import ModulePanel from "@/components/franklin/ModulePanel";

export default function FranklinPage() {
  const { selectedHour } = useFranklinStore();
  const { sidebarCollapsed } = useUIStore();

  // Hour-dependent queries
  const spots = useQuery({
    queryKey: ["fsd-spots", selectedHour],
    queryFn: () => fetchSpots(selectedHour),
    staleTime: 60_000,
  });

  const heatmap = useQuery({
    queryKey: ["fsd-heatmap", selectedHour],
    queryFn: () => fetchHeatmap(selectedHour),
    staleTime: 60_000,
  });

  const density = useQuery({
    queryKey: ["fsd-density", selectedHour],
    queryFn: () => fetchDensity(selectedHour),
    staleTime: 60_000,
  });

  // Hour-independent queries
  const trends = useQuery({
    queryKey: ["fsd-trends"],
    queryFn: fetchTrends,
    staleTime: 5 * 60_000,
  });

  const status = useQuery({
    queryKey: ["fsd-status"],
    queryFn: fetchStatus,
    staleTime: 30_000,
  });

  const intel = useQuery({
    queryKey: ["fsd-intel"],
    queryFn: fetchIntel,
    staleTime: 5 * 60_000,
  });

  const convergence = useQuery({
    queryKey: ["fsd-convergence"],
    queryFn: fetchConvergence,
    staleTime: 5 * 60_000,
  });

  const spotsData = spots.data?.spots ?? [];
  // Fall back to building heatmap from spot busyness if API heatmap is empty
  const rawHeatmap = heatmap.data?.heatmap ?? [];
  const heatmapData = rawHeatmap.length > 0
    ? rawHeatmap
    : spotsData
        .filter((s) => s.lat && s.lon && s.busyness > 0)
        .map((s) => [s.lat, s.lon, s.busyness] as [number, number, number]);

  return (
    <div className="flex h-screen bg-li-bg">
      <Sidebar />

      <div className={`flex-1 flex flex-col min-h-0 transition-all duration-200 ${sidebarCollapsed ? "ml-14" : "ml-60"}`}>
        <Navbar />

        {/* Header: Title + Hour Slider + Status */}
        <div className="px-6 py-4 border-b border-li-border flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-display font-semibold text-white tracking-tight">
                Franklin Street
              </h1>
              <p className="text-xs text-li-text-muted">
                BTUT Mean-Field Game — 605 Chapel Hill venues, 8 live signals
              </p>
            </div>
            <StatusBar status={status.data} isLoading={status.isLoading} />
          </div>
          <HourSlider />
        </div>

        {/* Main content grid */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Top row: Map + Venue List */}
          <div className="flex-1 min-h-0 flex">
            {/* Map */}
            <div className="flex-[3] relative min-h-[400px]">
              <FranklinMap
                spots={spotsData}
                heatmap={heatmapData}
                convergence={convergence.data?.converging_venues}
              />
              <VenueDetail />

              {/* Loading overlay */}
              {(spots.isLoading || heatmap.isLoading) && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 pointer-events-none">
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-li-black-surface border border-li-border">
                    <div className="w-4 h-4 border-2 border-li-gray-700 border-t-li-cyan rounded-full animate-spin" />
                    <span className="text-sm text-li-text-secondary">Loading venues...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Venue list sidebar */}
            <div className="w-80 border-l border-li-border bg-li-black-surface flex-shrink-0">
              <VenueList spots={spotsData} />
            </div>
          </div>

          {/* Bottom row: Trends + Density + Modules */}
          <div className="h-72 flex-shrink-0 flex border-t border-li-border">
            <div className="flex-1 border-r border-li-border">
              <TrendPanel trends={trends.data} intel={intel.data} isLoading={trends.isLoading} />
            </div>
            <div className="flex-1 border-r border-li-border">
              <DensityPanel
                density={density.data}
                status={status.data}
                intel={intel.data}
                isLoading={density.isLoading}
              />
            </div>
            <div className="flex-1">
              <ModulePanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
