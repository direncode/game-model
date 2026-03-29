"use client";

import { useMemo } from "react";
import { useFranklinStore } from "@/stores/franklin";
import type { FSDSpot } from "@/lib/fsd-api";
import { Search } from "lucide-react";

interface VenueListProps {
  spots: FSDSpot[];
}

const AMENITY_TYPES = [
  "All",
  "bar",
  "pub",
  "restaurant",
  "cafe",
  "fast_food",
  "ice_cream",
  "cinema",
  "pharmacy",
  "supermarket",
] as const;

function BusynessBar({ value, closed }: { value: number; closed: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-li-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${value}%`,
            backgroundColor: closed ? "#404040" : value > 70 ? "#00d4ff" : value > 40 ? "#0a6e8a" : "#1a3a4a",
          }}
        />
      </div>
      <span className={`text-xs font-mono font-medium w-7 text-right ${closed ? "text-li-text-muted" : "text-li-cyan"}`}>
        {value}
      </span>
    </div>
  );
}

export default function VenueList({ spots }: VenueListProps) {
  const { venueSearch, setVenueSearch, amenityFilter, setAmenityFilter, selectVenue, selectedVenue } =
    useFranklinStore();

  const filtered = useMemo(() => {
    let result = [...spots];
    if (venueSearch) {
      const q = venueSearch.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q));
    }
    if (amenityFilter) {
      result = result.filter((s) => s.amenity_type === amenityFilter);
    }
    return result.sort((a, b) => b.busyness - a.busyness);
  }, [spots, venueSearch, amenityFilter]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-li-border space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-li-text-muted" />
          <input
            type="text"
            placeholder="Search venues..."
            value={venueSearch}
            onChange={(e) => setVenueSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-li-gray-900 border border-li-border rounded-lg
              text-white placeholder:text-li-text-muted focus:outline-none focus:border-li-gray-700"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {AMENITY_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setAmenityFilter(type === "All" ? null : type)}
              className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
                (type === "All" && !amenityFilter) || amenityFilter === type
                  ? "border-li-cyan text-li-cyan bg-li-cyan/10"
                  : "border-li-border text-li-text-muted hover:text-white hover:border-li-gray-700"
              }`}
            >
              {type === "All" ? "All" : type.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="px-3 py-2 border-b border-li-border">
        <span className="text-[11px] font-mono text-li-text-muted">
          {filtered.length} venue{filtered.length !== 1 ? "s" : ""}
          {filtered.filter((s) => !s.closed).length > 0 &&
            ` · ${filtered.filter((s) => !s.closed).length} open`}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((spot) => (
          <button
            key={spot.name}
            onClick={() => selectVenue(spot)}
            className={`w-full text-left px-3 py-2.5 border-b border-li-border transition-colors ${
              selectedVenue?.name === spot.name
                ? "bg-li-cyan/5 border-l-2 border-l-li-cyan"
                : "hover:bg-white/[0.03]"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm text-white font-medium leading-tight truncate">
                {spot.name}
              </span>
              {spot.closed && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-li-gray-800 text-li-text-muted flex-shrink-0">
                  CLOSED
                </span>
              )}
            </div>
            <div className="text-[11px] text-li-text-muted mb-1.5">
              {spot.amenity_type.replace("_", " ")}
              {spot.address && ` · ${spot.address}`}
            </div>
            <BusynessBar value={spot.busyness} closed={spot.closed} />
          </button>
        ))}
      </div>
    </div>
  );
}
