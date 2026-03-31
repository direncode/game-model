"use client";

import { useEffect, useRef } from "react";
import type { FSDHeatmapPoint, FSDSpot } from "@/lib/fsd-api";

interface HeatmapGridProps {
  heatmap: FSDHeatmapPoint[];
  spots: FSDSpot[];
}

// Chapel Hill / Carrboro bounding box
const LAT_MIN = 35.900;
const LAT_MAX = 35.932;
const LON_MIN = -79.080;
const LON_MAX = -79.025;

export default function HeatmapGrid({ heatmap, spots }: HeatmapGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Background
    ctx.fillStyle = "#080808";
    ctx.fillRect(0, 0, W, H);

    // Use heatmap points if available, otherwise fall back to spots
    const points: [number, number, number][] =
      heatmap.length > 0
        ? heatmap
        : spots
            .filter((s) => s.lat && s.lon)
            .map((s) => [s.lat, s.lon, s.busyness ?? 0]);

    if (points.length === 0) {
      ctx.fillStyle = "#333";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No data", W / 2, H / 2);
      return;
    }

    // First pass: draw soft glow blobs
    for (const [lat, lon, weight] of points) {
      const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W;
      const y = H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * H;
      const norm = Math.max(0, Math.min(1, weight / 100));
      if (norm < 0.01) continue;

      const r = 14 + norm * 20;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,212,255,${0.55 * norm})`);
      g.addColorStop(0.4, `rgba(0,150,200,${0.25 * norm})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Second pass: draw crisp venue dots
    for (const [lat, lon, weight] of points) {
      const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W;
      const y = H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * H;
      const norm = Math.max(0, Math.min(1, weight / 100));

      // Color scale: dark → blue → cyan
      let color: string;
      if (norm < 0.25)      color = `rgba(10,70,110,${0.6 + norm})`;
      else if (norm < 0.5)  color = `rgba(0,120,180,${0.7 + norm * 0.3})`;
      else if (norm < 0.75) color = `rgba(0,180,230,0.95)`;
      else                  color = `rgba(0,212,255,1)`;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 2.5 + norm * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Franklin Street label
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    const fxL = ((-79.0548 - LON_MIN) / (LON_MAX - LON_MIN)) * W;
    const fy  = H - ((35.9132 - LAT_MIN) / (LAT_MAX - LAT_MIN)) * H;
    ctx.fillText("W Franklin St", fxL, fy - 8);
  }, [heatmap, spots]);

  return (
    <canvas
      ref={canvasRef}
      width={480}
      height={220}
      className="w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
