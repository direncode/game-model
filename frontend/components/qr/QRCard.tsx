"use client";

import { useQuery } from "@tanstack/react-query";
import { getQRImage } from "@/lib/qr/api";
import type { QRIdentity } from "@/lib/types";

const TIER_STYLES = {
  public: {
    border: "border-green-500/40",
    glow: "shadow-green-500/10",
    badge: "bg-green-500/20 text-green-400",
    label: "PUBLIC",
  },
  org: {
    border: "border-blue-500/40",
    glow: "shadow-blue-500/10",
    badge: "bg-blue-500/20 text-blue-400",
    label: "ORG",
  },
  admin: {
    border: "border-amber-500/40",
    glow: "shadow-amber-500/10",
    badge: "bg-amber-500/20 text-amber-400",
    label: "ADMIN",
  },
} as const;

interface QRCardProps {
  identity: QRIdentity;
  showImage?: boolean;
}

export function QRCard({ identity, showImage = true }: QRCardProps) {
  const tier = identity.tier as keyof typeof TIER_STYLES;
  const style = TIER_STYLES[tier];

  const { data: imageData } = useQuery({
    queryKey: ["qr-image", identity.code],
    queryFn: () => getQRImage(identity.code),
    enabled: showImage,
  });

  return (
    <div
      className={`bg-gray-900 rounded-xl border ${style.border} shadow-lg ${style.glow} p-5 w-72`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-white text-lg tracking-wider">{identity.code}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${style.badge}`}>
          {style.label}
        </span>
      </div>

      {imageData && (
        <div className="flex justify-center my-4">
          <img
            src={`data:image/png;base64,${imageData.image_base64}`}
            alt={`QR code ${identity.code}`}
            className="w-40 h-40 rounded"
          />
        </div>
      )}

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Type</span>
          <span className="text-gray-300 capitalize">{identity.subject_type}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Minted</span>
          <span className="text-gray-300">
            {new Date(identity.minted_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">By</span>
          <span className="text-gray-300 truncate ml-2">{identity.minted_by}</span>
        </div>
      </div>
    </div>
  );
}
