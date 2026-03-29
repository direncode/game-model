"use client";

import { useFranklinStore } from "@/stores/franklin";
import { X, MapPin, Phone, Globe, Utensils, Sun } from "lucide-react";

export default function VenueDetail() {
  const { selectedVenue, selectVenue } = useFranklinStore();

  if (!selectedVenue) return null;

  const v = selectedVenue;

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-li-black-surface border-l border-li-border overflow-y-auto z-30">
      {/* Header */}
      <div className="sticky top-0 bg-li-black-surface border-b border-li-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-white">{v.name}</h3>
            <p className="text-xs text-li-text-muted mt-0.5">
              {v.amenity_type.replace("_", " ")}
              {v.brand && ` · ${v.brand}`}
            </p>
          </div>
          <button
            onClick={() => selectVenue(null)}
            className="p-1 rounded hover:bg-white/[0.06] text-li-text-muted hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Busyness */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 bg-li-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${v.busyness}%`,
                backgroundColor: v.closed ? "#404040" : "#00d4ff",
              }}
            />
          </div>
          <span className={`text-lg font-mono font-semibold ${v.closed ? "text-li-text-muted" : "text-li-cyan"}`}>
            {v.busyness}
          </span>
        </div>
        {v.closed && (
          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded bg-li-gray-800 text-li-text-muted uppercase tracking-wider">
            Closed at this hour
          </span>
        )}
      </div>

      {/* Signals */}
      <div className="p-4 border-b border-li-border">
        <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-li-text-muted mb-3">
          Signal Breakdown
        </h4>
        <div className="space-y-2.5">
          {Object.entries(v.signals).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <span className="text-[10px] font-mono text-li-text-muted w-20 flex-shrink-0 pt-0.5 uppercase">
                {key.replace("_", " ")}
              </span>
              <span className="text-xs text-li-gray-300 leading-relaxed">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div className="p-4 space-y-2.5">
        <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-li-text-muted mb-3">
          Details
        </h4>
        {v.address && (
          <div className="flex items-center gap-2 text-xs text-li-gray-400">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{v.address}</span>
          </div>
        )}
        {v.phone && (
          <div className="flex items-center gap-2 text-xs text-li-gray-400">
            <Phone className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{v.phone}</span>
          </div>
        )}
        {v.website && (
          <div className="flex items-center gap-2 text-xs text-li-gray-400">
            <Globe className="w-3.5 h-3.5 flex-shrink-0" />
            <a
              href={v.website}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:text-li-cyan transition-colors"
            >
              {v.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </div>
        )}
        {v.cuisine && (
          <div className="flex items-center gap-2 text-xs text-li-gray-400">
            <Utensils className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{v.cuisine}</span>
          </div>
        )}
        {v.outdoor_seating === "yes" && (
          <div className="flex items-center gap-2 text-xs text-li-gray-400">
            <Sun className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Outdoor seating</span>
          </div>
        )}
      </div>
    </div>
  );
}
