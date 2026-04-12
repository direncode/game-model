"use client";

import React, { useRef, useState, useMemo } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

const SOURCE_COLORS: Record<string, string> = {
  edgar: "#00d4ff",
  pubmed: "#3fb950",
  patents: "#a371f7",
  comtrade: "#d29922",
  climate: "#388bfd",
  tesla: "#f85149",
};

interface Survivor {
  name: string;
  type: string;
  source_id: string;
  display_name: string;
  cluster: number;
  composite_score: number;
  coord_3d: [number, number, number] | null;
}

export interface OceanGlobeProps {
  survivors: Survivor[];
  height?: number;
}

function SurvivorPoint({
  survivor,
  onHover,
}: {
  survivor: Survivor;
  onHover: (s: Survivor | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = SOURCE_COLORS[survivor.source_id] ?? "#6B7280";
  const radius = 0.02 + survivor.composite_score * 0.03;

  if (!survivor.coord_3d) return null;

  return (
    <mesh
      ref={meshRef}
      position={survivor.coord_3d}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(survivor);
      }}
      onPointerOut={() => onHover(null)}
    >
      <sphereGeometry args={[radius, 12, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.4}
        roughness={0.3}
        metalness={0.5}
      />
    </mesh>
  );
}

function ReferenceSphere() {
  return (
    <mesh>
      <sphereGeometry args={[1.2, 32, 32]} />
      <meshStandardMaterial
        color="#6B7280"
        wireframe
        transparent
        opacity={0.1}
      />
    </mesh>
  );
}

function Scene({
  survivors,
  onHover,
  hovered,
}: {
  survivors: Survivor[];
  onHover: (s: Survivor | null) => void;
  hovered: Survivor | null;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} />

      <ReferenceSphere />

      {survivors.map((s, i) => (
        <SurvivorPoint key={`${s.source_id}-${s.name}-${i}`} survivor={s} onHover={onHover} />
      ))}

      {hovered && hovered.coord_3d && (
        <Html position={hovered.coord_3d} distanceFactor={4} zIndexRange={[100, 0]}>
          <div className="bg-li-depth-1 border border-li-border rounded-lg px-3 py-2 shadow-lg pointer-events-none whitespace-nowrap">
            <p className="text-xs font-medium text-li-text-primary">{hovered.display_name}</p>
            <p className="text-[10px] text-li-text-muted">
              {hovered.source_id} | {hovered.type} | score: {hovered.composite_score.toFixed(3)}
            </p>
          </div>
        </Html>
      )}

      <OrbitControls enableDamping dampingFactor={0.1} />
    </>
  );
}

export default function OceanGlobe({ survivors, height = 500 }: OceanGlobeProps) {
  const [hovered, setHovered] = useState<Survivor | null>(null);

  const activeSources = useMemo(() => {
    const set = new Set(survivors.map((s) => s.source_id));
    return Array.from(set);
  }, [survivors]);

  return (
    <div className="relative bg-li-depth-1 border border-li-border rounded-lg overflow-hidden" style={{ height }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        style={{ background: "#0a0a0a" }}
      >
        <Scene survivors={survivors} onHover={setHovered} hovered={hovered} />
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-li-depth-1/90 border border-li-border rounded-lg px-3 py-2 backdrop-blur-sm">
        <div className="text-[10px] uppercase tracking-widest text-li-text-muted mb-1">Sources</div>
        <div className="flex flex-col gap-1">
          {activeSources.map((src) => (
            <div key={src} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: SOURCE_COLORS[src] ?? "#6B7280" }}
              />
              <span className="text-[10px] text-li-text-secondary font-mono">{src}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
