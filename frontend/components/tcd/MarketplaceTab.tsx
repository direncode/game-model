"use client";

import { useState } from "react";
import { useTCDStore } from "@/lib/tcd/store";
import { licenseModule, exportModule } from "@/lib/tcd/api";
import { cn } from "@/lib/utils";
import { Download, Key, Package } from "lucide-react";

const TIER_STYLES: Record<string, string> = {
  premium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  standard: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  basic: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const TYPE_STYLES: Record<string, string> = {
  attractor: "bg-blue-500/20 text-blue-300",
  cycle: "bg-purple-500/20 text-purple-300",
  boundary: "bg-amber-500/20 text-amber-300",
};

export default function MarketplaceTab() {
  const marketplace = useTCDStore((s) => s.marketplace);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);

  const handleLicense = async (moduleId: string) => {
    try {
      const resp = await licenseModule(moduleId);
      setLicenseKey(resp.license_key);
    } catch {}
  };

  const handleExport = async (moduleId: string) => {
    try {
      const blob = await exportModule(moduleId, "pt");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${moduleId.slice(0, 8)}.pt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  if (marketplace.length === 0) {
    return (
      <div className="text-center py-16 text-li-text-muted text-sm">
        Run the demo to populate the module marketplace
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {licenseKey && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-green-400 font-medium">License Key Generated</span>
            <p className="text-xs font-mono text-green-300 mt-1">{licenseKey}</p>
          </div>
          <button onClick={() => setLicenseKey(null)} className="text-green-400 text-xs hover:text-white">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {marketplace.map((m) => (
          <div key={m.id} className="bg-li-gray-900/60 border border-li-gray-800 rounded-lg p-4 hover:border-li-gray-600 transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className={cn("px-1.5 py-0.5 text-[9px] uppercase rounded font-mono", TYPE_STYLES[m.module_type] || "")}>
                {m.module_type}
              </span>
              <span className={cn("px-2 py-0.5 text-[9px] uppercase rounded border font-semibold", TIER_STYLES[m.tier] || "")}>
                {m.tier}
              </span>
            </div>

            {/* ID */}
            <p className="text-xs font-mono text-white mb-2 truncate">{m.id}</p>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <span className="text-[9px] text-li-text-muted">Purity</span>
                <div className="flex items-center gap-1">
                  <div className="flex-1 h-1 bg-li-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${m.purity * 100}%` }} />
                  </div>
                  <span className="text-[9px] font-mono text-white">{(m.purity * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div>
                <span className="text-[9px] text-li-text-muted">Quality</span>
                <div className="flex items-center gap-1">
                  <div className="flex-1 h-1 bg-li-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 rounded-full" style={{ width: `${m.quality_score * 100}%` }} />
                  </div>
                  <span className="text-[9px] font-mono text-white">{(m.quality_score * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Members */}
            <p className="text-[9px] text-li-text-muted mb-3">
              <Package className="w-3 h-3 inline -mt-0.5 mr-1" />
              {m.members.length} entities
            </p>

            {/* Price */}
            <div className="text-lg font-bold text-white font-mono mb-3">
              {m.price_credits.toFixed(0)} <span className="text-xs font-normal text-li-text-muted">credits</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleLicense(m.id)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/30 rounded text-[10px] text-cyan-300 transition-colors"
              >
                <Key className="w-3 h-3" />
                License
              </button>
              <button
                onClick={() => handleExport(m.id)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-li-gray-800 hover:bg-li-gray-700 rounded text-[10px] text-li-text-muted transition-colors"
              >
                <Download className="w-3 h-3" />
                Export
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
