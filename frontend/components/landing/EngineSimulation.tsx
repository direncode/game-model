"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  DEMO_NODES,
  DEMO_EDGES,
  DEMO_METRICS,
  MODULE_COLORS,
  type SimNode,
  type SimMetricFrame,
} from "@/lib/demo-data";
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

type Stage = "idle" | "encoding" | "exploring" | "crystallizing" | "converged";

const STAGE_CONFIG: { key: Stage; label: string; num: string }[] = [
  { key: "encoding", label: "Encode", num: "01" },
  { key: "exploring", label: "Explore", num: "02" },
  { key: "crystallizing", label: "Crystallize", num: "03" },
  { key: "converged", label: "Converged", num: "04" },
];

const MODULE_NAMES = [
  "CMP Pipeline", "Netherlands Hub", "Singapore ATP", "Design-to-Fab",
  "China Packaging", "Lithography", "Equipment", "Materials",
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getStagePositionKey(stage: Stage): keyof SimNode["positions"] {
  switch (stage) {
    case "idle": return "idle";
    case "encoding": return "encoded";
    case "exploring": return "exploring";
    case "crystallizing":
    case "converged": return "crystallized";
  }
}

function getPrevStageKey(stage: Stage): keyof SimNode["positions"] {
  switch (stage) {
    case "idle": return "idle";
    case "encoding": return "idle";
    case "exploring": return "encoded";
    case "crystallizing": return "exploring";
    case "converged": return "crystallized";
  }
}

interface HoveredNode {
  node: SimNode;
  screenX: number;
  screenY: number;
}

export function EngineSimulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [currentMetric, setCurrentMetric] = useState<SimMetricFrame>(DEMO_METRICS[0]);
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null);
  const progressRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);

  // Zoom and pan state
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });

  // Store computed positions for hit-testing
  const nodePositionsRef = useRef<Map<string, [number, number]>>(new Map());

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const getStageFromProgress = (p: number): Stage => {
    if (p < 0.01) return "idle";
    if (p < 0.2) return "encoding";
    if (p < 0.5) return "exploring";
    if (p < 0.85) return "crystallizing";
    return "converged";
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const p = progressRef.current;
    const stage = getStageFromProgress(p);
    const z = zoomRef.current;
    const pan = panRef.current;

    const scaleX = w / 800;
    const scaleY = h / 600;

    ctx.clearRect(0, 0, w, h);

    // Background glow
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.5);
    grad.addColorStop(0, "rgba(0, 212, 255, 0.03)");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Apply zoom and pan transform
    ctx.save();
    ctx.translate(w / 2 + pan.x, h / 2 + pan.y);
    ctx.scale(z, z);
    ctx.translate(-w / 2, -h / 2);

    // Stage transition
    let stageT = 1;
    if (stage === "encoding") stageT = Math.min(1, p / 0.2);
    else if (stage === "exploring") stageT = Math.min(1, (p - 0.2) / 0.3);
    else if (stage === "crystallizing") stageT = Math.min(1, (p - 0.5) / 0.35);

    const currentPosKey = getStagePositionKey(stage);
    const prevPosKey = getPrevStageKey(stage);

    // Compute positions
    const positions: Map<string, [number, number]> = new Map();
    DEMO_NODES.forEach((node) => {
      const from = node.positions[prevPosKey];
      const to = node.positions[currentPosKey];
      const x = lerp(from[0], to[0], stageT) * scaleX;
      const y = lerp(from[1], to[1], stageT) * scaleY;
      const wobbleX = stage === "exploring" ? Math.sin(p * 30 + parseFloat(node.id) * 7) * 3 : 0;
      const wobbleY = stage === "exploring" ? Math.cos(p * 25 + parseFloat(node.id) * 5) * 3 : 0;
      positions.set(node.id, [x + wobbleX, y + wobbleY]);
    });

    // Store screen-space positions for hit-testing
    const screenPositions: Map<string, [number, number]> = new Map();
    positions.forEach((pos, id) => {
      const sx = (pos[0] - w / 2) * z + w / 2 + pan.x;
      const sy = (pos[1] - h / 2) * z + h / 2 + pan.y;
      screenPositions.set(id, [sx, sy]);
    });
    nodePositionsRef.current = screenPositions;

    // Draw edges
    const edgeStageOrder: Record<string, number> = { encoded: 1, exploring: 2, crystallized: 3 };
    const currentStageNum = stage === "idle" ? 0 : stage === "encoding" ? 1 : stage === "exploring" ? 2 : 3;

    DEMO_EDGES.forEach((edge) => {
      const edgeAppearNum = edgeStageOrder[edge.appearsAt] || 1;
      if (edgeAppearNum > currentStageNum) return;

      const from = positions.get(edge.source);
      const to = positions.get(edge.target);
      if (!from || !to) return;

      const isHidden = edge.appearsAt === "exploring";
      const alpha = isHidden ? 0.15 + stageT * 0.15 : 0.08 + stageT * 0.08;

      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
      ctx.strokeStyle = isHidden
        ? `rgba(201, 169, 110, ${alpha})`
        : `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = edge.weight * (isHidden ? 2 : 1);
      ctx.stroke();
    });

    // Draw nodes
    DEMO_NODES.forEach((node) => {
      const pos = positions.get(node.id);
      if (!pos) return;

      const [x, y] = pos;
      const moduleColor = MODULE_COLORS[node.moduleId ?? 0] || "#525252";
      const isHovered = hoveredNode?.node.id === node.id;
      const baseRadius = stage === "idle" ? 3 : stage === "converged" ? 5 : 3 + stageT * 2;
      const radius = isHovered ? baseRadius + 3 : baseRadius;

      // Hover glow ring
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = moduleColor + "15";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = moduleColor + "60";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Module glow
      if ((stage === "crystallizing" || stage === "converged") && !isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = moduleColor + "20";
        ctx.fill();
      }

      // Node body
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);

      if (stage === "idle") {
        ctx.fillStyle = isHovered ? "#a3a3a3" : "#525252";
      } else if (stage === "encoding") {
        const r = Math.round(lerp(82, 255, stageT));
        const g = Math.round(lerp(82, 255, stageT));
        const b = Math.round(lerp(82, 255, stageT));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        ctx.fillStyle = moduleColor;
      }

      ctx.fill();

      // Labels on converged (zoom-aware)
      if (stage === "converged" && z >= 0.8) {
        ctx.font = `${Math.max(8, 9 / z)}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = isHovered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)";
        ctx.textAlign = "center";
        const label = node.label.length > 14 ? node.label.slice(0, 12) + ".." : node.label;
        ctx.fillText(label, x, y + radius + 12);
      }
    });

    // Module labels
    if (stage === "converged" || (stage === "crystallizing" && stageT > 0.7)) {
      const moduleCenters: Map<number, [number, number, number]> = new Map();
      DEMO_NODES.forEach((node) => {
        const pos = positions.get(node.id);
        if (!pos || node.moduleId === undefined) return;
        const existing = moduleCenters.get(node.moduleId) || [0, 0, 0];
        moduleCenters.set(node.moduleId, [existing[0] + pos[0], existing[1] + pos[1], existing[2] + 1]);
      });

      moduleCenters.forEach((val, modId) => {
        const cx = val[0] / val[2];
        const cy = val[1] / val[2];
        const name = MODULE_NAMES[modId] || `Module ${modId}`;
        const color = MODULE_COLORS[modId] || "#fff";

        ctx.font = `bold ${Math.max(9, 11 / z)}px 'Inter', sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.globalAlpha = stage === "converged" ? 1 : (stageT - 0.7) / 0.3;
        ctx.fillText(name, cx, cy - 35);
        ctx.globalAlpha = 1;
      });
    }

    ctx.restore();
  }, [hoveredNode]);

  // Initial draw
  useEffect(() => {
    draw();
  }, [draw]);

  // Redraw on zoom/pan changes
  useEffect(() => {
    draw();
  }, [zoom, draw]);

  // Animation loop
  useEffect(() => {
    if (!playing) return;

    let lastTime = 0;
    const DURATION = 15000;

    const tick = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      const dt = timestamp - lastTime;
      lastTime = timestamp;

      if (playingRef.current) {
        progressRef.current = Math.min(1, progressRef.current + (dt / DURATION) * speedRef.current);
        setProgress(progressRef.current);

        const metricIdx = Math.min(
          DEMO_METRICS.length - 1,
          Math.floor(progressRef.current * (DEMO_METRICS.length - 1))
        );
        setCurrentMetric(DEMO_METRICS[metricIdx]);

        if (progressRef.current >= 1) {
          playingRef.current = false;
          setPlaying(false);
          draw();
          return;
        }
      }

      draw();
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, draw]);

  // ─── Mouse Handlers ───

  const getCanvasMousePos = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const findNodeAtPos = (mx: number, my: number): SimNode | null => {
    const z = zoomRef.current;
    const hitRadius = Math.max(8, 12 / z);
    let closest: SimNode | null = null;
    let closestDist = Infinity;

    DEMO_NODES.forEach((node) => {
      const pos = nodePositionsRef.current.get(node.id);
      if (!pos) return;
      const dx = pos[0] - mx;
      const dy = pos[1] - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < hitRadius && dist < closestDist) {
        closest = node;
        closestDist = dist;
      }
    });

    return closest;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getCanvasMousePos(e);

    // Handle panning
    if (isPanningRef.current) {
      const dx = e.clientX - lastPanPosRef.current.x;
      const dy = e.clientY - lastPanPosRef.current.y;
      panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      draw();
      return;
    }

    // Hit-test for hover
    const node = findNodeAtPos(x, y);
    if (node) {
      const pos = nodePositionsRef.current.get(node.id);
      setHoveredNode(pos ? { node, screenX: pos[0], screenY: pos[1] } : null);
      if (canvasRef.current) canvasRef.current.style.cursor = "pointer";
    } else {
      setHoveredNode(null);
      if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      isPanningRef.current = true;
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
    }
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    if (canvasRef.current) canvasRef.current.style.cursor = hoveredNode ? "pointer" : "grab";
  };

  const handleMouseLeave = () => {
    isPanningRef.current = false;
    setHoveredNode(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(4, zoomRef.current * delta));
    zoomRef.current = newZoom;
    setZoom(newZoom);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(4, zoomRef.current * 1.3);
    zoomRef.current = newZoom;
    setZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.5, zoomRef.current / 1.3);
    zoomRef.current = newZoom;
    setZoom(newZoom);
  };

  const handleResetView = () => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
  };

  const handlePlay = () => {
    if (progressRef.current >= 1) {
      progressRef.current = 0;
      setProgress(0);
    }
    setPlaying(true);
  };

  const handlePause = () => setPlaying(false);

  const handleReset = () => {
    setPlaying(false);
    progressRef.current = 0;
    setProgress(0);
    setCurrentMetric(DEMO_METRICS[0]);
    handleResetView();
  };

  const stage = getStageFromProgress(progress);

  return (
    <div className="card-metric overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {playing ? (
            <button onClick={handlePause} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
              <Pause className="w-4 h-4 text-white" />
            </button>
          ) : (
            <button onClick={handlePlay} className="p-2 bg-li-cyan/20 rounded-lg hover:bg-li-cyan/30 transition-colors">
              <Play className="w-4 h-4 text-li-cyan" />
            </button>
          )}
          <button onClick={handleReset} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
            <RotateCcw className="w-3.5 h-3.5 text-li-gray-500" />
          </button>
          <span className="data-label">{stage === "idle" ? "Ready" : stage}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button onClick={handleZoomOut} className="p-1.5 text-li-gray-500 hover:text-white transition-colors">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-li-gray-500 w-8 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={handleZoomIn} className="p-1.5 text-li-gray-500 hover:text-white transition-colors">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="w-px h-4 bg-li-gray-800" />
          {/* Speed controls */}
          <div className="flex items-center gap-1">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                  speed === s ? "bg-li-cyan/20 text-li-cyan" : "text-li-gray-500 hover:text-white"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline Timeline */}
      <div className="flex items-center gap-0 mb-6">
        {STAGE_CONFIG.map((s, i) => {
          const isActive = s.key === stage;
          const isPast = STAGE_CONFIG.findIndex((sc) => sc.key === stage) > i;

          return (
            <div key={s.key} className="flex-1 flex items-center">
              <div className="flex items-center gap-2 flex-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-medium transition-all duration-500 ${
                    isActive
                      ? "bg-li-cyan text-black ring-2 ring-li-cyan/30"
                      : isPast
                      ? "bg-li-cyan/20 text-li-cyan"
                      : "bg-li-gray-900 text-li-gray-600"
                  }`}
                >
                  {s.num}
                </div>
                <span
                  className={`text-xs font-mono hidden sm:block transition-colors duration-300 ${
                    isActive ? "text-li-cyan" : isPast ? "text-li-gray-400" : "text-li-gray-600"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STAGE_CONFIG.length - 1 && (
                <div className="flex-shrink-0 w-8 h-px mx-1">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      background: isPast || isActive
                        ? "linear-gradient(90deg, rgba(0,212,255,0.5), rgba(0,212,255,0.2))"
                        : "rgba(26,26,26,1)",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Canvas + Tooltip */}
      <div
        ref={containerRef}
        className="relative bg-li-depth-1 border border-li-border-accent rounded-lg overflow-hidden"
        style={{ height: 360 }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: "block", cursor: "grab" }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
        />

        {/* Hover Tooltip */}
        {hoveredNode && (
          <div
            className="absolute pointer-events-none z-10 px-3 py-2 bg-li-black-elevated/95 border border-li-gray-800 rounded-lg shadow-xl backdrop-blur-sm"
            style={{
              left: Math.min(hoveredNode.screenX + 16, (containerRef.current?.clientWidth || 600) - 200),
              top: Math.max(8, hoveredNode.screenY - 60),
            }}
          >
            <p className="text-xs font-medium text-white">{hoveredNode.node.label}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: MODULE_COLORS[hoveredNode.node.moduleId ?? 0] }}
              />
              <span className="text-[10px] font-mono text-li-gray-400">
                {MODULE_NAMES[hoveredNode.node.moduleId ?? 0]}
              </span>
            </div>
            <span className="text-[10px] font-mono text-li-gray-500 mt-0.5 block">
              Type: {hoveredNode.node.type}
            </span>
          </div>
        )}

        {/* Run Simulation overlay */}
        {stage === "idle" && !playing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={handlePlay}
              className="flex items-center gap-3 px-6 py-3 bg-li-cyan/10 border border-li-cyan/20 rounded-lg hover:bg-li-cyan/20 transition-colors group"
            >
              <Play className="w-5 h-5 text-li-cyan group-hover:scale-110 transition-transform" />
              <span className="text-sm font-mono text-li-cyan">Run Simulation</span>
            </button>
          </div>
        )}

        {/* Zoom hint */}
        {zoom !== 1 && (
          <button
            onClick={handleResetView}
            className="absolute bottom-2 right-2 px-2 py-1 bg-li-black-elevated/80 border border-li-gray-800 rounded text-[10px] font-mono text-li-gray-500 hover:text-white transition-colors"
          >
            Reset View
          </button>
        )}
      </div>

      {/* Metric Bar */}
      <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-li-border-accent">
        <div>
          <p className="data-label">Modules</p>
          <p className="font-mono text-lg font-medium text-white">
            {currentMetric.moduleCount}<span className="text-li-gray-600">/16</span>
          </p>
        </div>
        <div>
          <p className="data-label">Purity</p>
          <p className="font-mono text-lg font-medium text-white">
            {(currentMetric.purity * 100).toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="data-label">Link AUC</p>
          <p className="font-mono text-lg font-medium text-li-cyan">
            {(currentMetric.linkAuc * 100).toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="data-label">Loss</p>
          <p className="font-mono text-lg font-medium text-white">
            {currentMetric.loss.toFixed(3)}
          </p>
        </div>
      </div>
    </div>
  );
}
