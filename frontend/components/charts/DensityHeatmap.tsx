"use client";

import React, { useRef, useEffect } from "react";

export interface DensityHeatmapProps {
  types: string[];
  matrix: number[][];
  width?: number;
  height?: number;
}

function interpolateColor(t: number): string {
  // From dark blue (low) to bright blue-cyan (high)
  const r = Math.round(10 + t * 49);   // 10 -> 59
  const g = Math.round(14 + t * 116);  // 14 -> 130
  const b = Math.round(23 + t * 223);  // 23 -> 246
  return `rgb(${r}, ${g}, ${b})`;
}

export default function DensityHeatmap({
  types,
  matrix,
  width = 500,
  height = 500,
}: DensityHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || types.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const n = types.length;
    const labelSpace = 80;
    const cellW = (width - labelSpace) / n;
    const cellH = (height - labelSpace) / n;

    // Find max for normalization
    let maxVal = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (matrix[i]?.[j] > maxVal) maxVal = matrix[i][j];
      }
    }
    if (maxVal === 0) maxVal = 1;

    // Clear
    ctx.fillStyle = "#0A0E17";
    ctx.fillRect(0, 0, width, height);

    // Draw cells
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const val = matrix[i]?.[j] ?? 0;
        const t = val / maxVal;
        const x = labelSpace + j * cellW;
        const y = labelSpace + i * cellH;

        ctx.fillStyle = interpolateColor(t);
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

        // Value text
        if (cellW > 30) {
          ctx.fillStyle = t > 0.5 ? "#F9FAFB" : "#6B7280";
          ctx.font = "10px 'IBM Plex Mono', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(val.toString(), x + cellW / 2, y + cellH / 2);
        }
      }
    }

    // Draw labels
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "11px 'DM Sans', sans-serif";

    // Row labels (left)
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      const label = types[i].length > 10 ? types[i].slice(0, 10) + "..." : types[i];
      ctx.fillText(label, labelSpace - 6, labelSpace + i * cellH + cellH / 2);
    }

    // Column labels (top, rotated)
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let j = 0; j < n; j++) {
      const label = types[j].length > 10 ? types[j].slice(0, 10) + "..." : types[j];
      ctx.save();
      ctx.translate(labelSpace + j * cellW + cellW / 2, labelSpace - 6);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }, [types, matrix, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block mx-auto"
    />
  );
}
