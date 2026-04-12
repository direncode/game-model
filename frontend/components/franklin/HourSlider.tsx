"use client";

import { useEffect, useRef } from "react";
import { useFranklinStore } from "@/stores/franklin";

const formatHour = (h: number) => {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

export default function HourSlider() {
  const { selectedHour, setHour } = useFranklinStore();
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      setHour(new Date().getHours());
    }
  }, [setHour]);

  return (
    <div className="flex items-center gap-4">
      <span className="text-xs font-mono text-li-text-muted w-12">
        {formatHour(0)}
      </span>
      <div className="flex-1 relative">
        <input
          type="range"
          min={0}
          max={23}
          value={selectedHour}
          onChange={(e) => setHour(Number(e.target.value))}
          className="w-full h-1.5 bg-li-gray-800 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-li-cyan
            [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,212,255,0.4)]
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-li-cyan
            [&::-moz-range-thumb]:border-none
            [&::-moz-range-thumb]:cursor-pointer"
        />
      </div>
      <span className="text-xs font-mono text-li-text-muted w-12 text-right">
        {formatHour(23)}
      </span>
      <div className="flex items-center gap-2 ml-2 px-3 py-1.5 rounded-lg bg-li-gray-900 border border-li-border">
        <span className="text-sm font-mono font-medium text-li-cyan">
          {formatHour(selectedHour)}
        </span>
      </div>
    </div>
  );
}
