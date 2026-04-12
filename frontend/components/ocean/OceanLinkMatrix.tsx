"use client";

import React, { useRef, useEffect } from "react";

const SOURCE_COLORS: Record<string, string> = {
  edgar: "#00d4ff",
  pubmed: "#3fb950",
  patents: "#a371f7",
  comtrade: "#d29922",
  climate: "#388bfd",
  tesla: "#f85149",
};

export interface OceanLinkMatrixProps {
  linkMatrix: Record<string, Record<string, number>>;
  sourceIds: string[];
  height?: number;
}

function interpolateColor(t: number): string {
  // From dark (#0a0a0a) to cyan (#00d4ff)
  const r = Math.round(10 + t * (0 - 10));
  const g = Math.round(10 + t * (212 - 10));
  const b = Math.round(10 + t * (255 - 10));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function OceanLinkMatrix({
  linkMatrix,
  sourceIds,
  height = 500,
}: OceanLinkMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const n = sourceIds.length;
  const width = Math.max(height, 400);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || n === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const labelSpace = 90;
    const cellW = (width - labelSpace) / n;
    const cellH = (height - labelSpace) / n;

    // Find max for normalization (excluding diagonal)
    let maxVal = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const val = linkMatrix[sourceIds[i]]?.[sourceIds[j]] ?? 0;
        if (val > maxVal) maxVal = val;
      }
    }
    if (maxVal === 0) maxVal = 1;

    // Clear
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    // Draw cells
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const val = linkMatrix[sourceIds[i]]?.[sourceIds[j]] ?? 0;
        const x = labelSpace + j * cellW;
        const y = labelSpace + i * cellH;

        if (i === j) {
          // Diagonal: gray, lower opacity
          ctx.fillStyle = "rgba(75, 75, 75, 0.3)";
        } else {
          const t = val / maxVal;
          ctx.fillStyle = interpolateColor(t);
        }
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

        // Value text
        if (cellW > 30) {
          const t = i === j ? 0.2 : val / maxVal;
          ctx.fillStyle = t > 0.4 ? "#F9FAFB" : "#6B7280";
          ctx.font = "11px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(val.toString(), x + cellW / 2, y + cellH / 2);
        }
      }
    }

    // Row labels (left)
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = SOURCE_COLORS[sourceIds[i]] ?? "#9CA3AF";
      ctx.font = "12px 'Inter', sans-serif";
      ctx.fillText(sourceIds[i], labelSpace - 8, labelSpace + i * cellH + cellH / 2);
    }

    // Column labels (top, rotated)
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let j = 0; j < n; j++) {
      ctx.save();
      ctx.translate(labelSpace + j * cellW + cellW / 2, labelSpace - 8);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = SOURCE_COLORS[sourceIds[j]] ?? "#9CA3AF";
      ctx.font = "12px 'Inter', sans-serif";
      ctx.fillText(sourceIds[j], 0, 0);
      ctx.restore();
    }
  }, [linkMatrix, sourceIds, n, width, height]);

  return (
    <div className="bg-li-depth-1 border border-li-border rounded-lg p-4 overflow-auto">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block mx-auto"
      />
    </div>
  );
}
