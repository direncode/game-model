"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mintQRIdentity, getQRImage } from "@/lib/qr/api";
import type { QRIdentity } from "@/lib/types";

interface QRMinterProps {
  subjectType: string;
  subjectId: string;
  defaultTier?: "public" | "org" | "admin";
  onMinted?: (qi: QRIdentity) => void;
}

export function QRMinter({ subjectType, subjectId, defaultTier = "org", onMinted }: QRMinterProps) {
  const [tier, setTier] = useState(defaultTier);
  const queryClient = useQueryClient();

  const mintMutation = useMutation({
    mutationFn: () => mintQRIdentity({ subject_type: subjectType, subject_id: subjectId, tier }),
    onSuccess: (qi) => {
      queryClient.invalidateQueries({ queryKey: ["qr-entity", subjectType, subjectId] });
      onMinted?.(qi);
    },
  });

  return (
    <div className="flex items-center gap-3">
      <select
        value={tier}
        onChange={(e) => setTier(e.target.value as typeof tier)}
        className="bg-gray-800 text-gray-300 rounded px-3 py-1.5 text-sm border border-gray-700"
      >
        <option value="public">Public</option>
        <option value="org">Organization</option>
        <option value="admin">Admin</option>
      </select>
      <button
        onClick={() => mintMutation.mutate()}
        disabled={mintMutation.isPending}
        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded px-4 py-1.5 text-sm transition-colors disabled:opacity-50"
      >
        {mintMutation.isPending ? "Minting..." : "Mint QR Identity"}
      </button>
      {mintMutation.data && (
        <span className="text-green-400 text-sm font-mono">{mintMutation.data.code}</span>
      )}
    </div>
  );
}
