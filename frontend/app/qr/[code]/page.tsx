"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { scanQRCode, getQRImage } from "@/lib/qr/api";

const TIER_COLORS = {
  public: "bg-green-500/20 text-green-400 border-green-500/30",
  org: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  admin: "bg-amber-500/20 text-amber-400 border-amber-500/30",
} as const;

const TIER_LABELS = {
  public: "Public Access",
  org: "Organization",
  admin: "Administrator",
} as const;

export default function QRScanPage() {
  const { code } = useParams<{ code: string }>();

  const { data: scanResult, isLoading, error } = useQuery({
    queryKey: ["qr-scan", code],
    queryFn: () => scanQRCode(code),
    enabled: !!code,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Resolving QR identity...</div>
      </div>
    );
  }

  if (error || !scanResult) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg font-medium">QR Code Not Found</div>
          <div className="text-gray-500 mt-2">
            Code <span className="font-mono">{code}</span> is invalid or has been revoked.
          </div>
        </div>
      </div>
    );
  }

  const { qr_identity: qi, access_granted, entity_summary, lineage } = scanResult;
  const tier = qi.tier as keyof typeof TIER_COLORS;

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Identity Card */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-xl text-white">{qi.code}</div>
            <span className={`px-3 py-1 rounded-full text-xs border ${TIER_COLORS[tier]}`}>
              {TIER_LABELS[tier]}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Entity Type</div>
              <div className="text-white capitalize">{qi.subject_type}</div>
            </div>
            <div>
              <div className="text-gray-500">Minted By</div>
              <div className="text-white">{qi.minted_by}</div>
            </div>
            <div>
              <div className="text-gray-500">Minted At</div>
              <div className="text-white">
                {new Date(qi.minted_at).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Access Granted</div>
              <div className="text-white capitalize">{access_granted}</div>
            </div>
          </div>
        </div>

        {/* Entity Summary */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-white font-medium mb-3">Entity Summary</h2>
          <pre className="text-gray-400 text-sm overflow-x-auto">
            {JSON.stringify(entity_summary, null, 2)}
          </pre>
        </div>

        {/* Lineage (if available based on tier) */}
        {lineage && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-white font-medium mb-3">Lineage</h2>
            {lineage.summary && (
              <div className="text-gray-400 text-sm mb-3">
                {(lineage.summary as Record<string, unknown>).event_count} provenance events tracked
              </div>
            )}
            <pre className="text-gray-400 text-sm overflow-x-auto max-h-96">
              {JSON.stringify(lineage, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
