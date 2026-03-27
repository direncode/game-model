"use client";

import React, { useRef, useState, useMemo } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

export interface Module3DNode {
  id: string;
  name: string;
  entity_count: number;
  dominant_type?: string;
  position: [number, number, number];
}

export interface Module3DRelationship {
  source: string;
  target: string;
  strength: number;
}

export interface Module3DExplorerProps {
  modules: Module3DNode[];
  relationships: Module3DRelationship[];
  width?: number;
  height?: number;
}

const TYPE_COLORS: Record<string, string> = {
  person: "#3B82F6",
  organization: "#10B981",
  location: "#F59E0B",
  event: "#EF4444",
  concept: "#8B5CF6",
  product: "#EC4899",
  default: "#6B7280",
};

function getColor(type?: string): string {
  return TYPE_COLORS[type?.toLowerCase() ?? ""] || TYPE_COLORS.default;
}

interface ModuleSphereProps {
  module: Module3DNode;
  maxCount: number;
  onHover: (module: Module3DNode | null) => void;
}

function ModuleSphere({ module, maxCount, onHover }: ModuleSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = getColor(module.dominant_type);
  const radius = 0.3 + (module.entity_count / Math.max(maxCount, 1)) * 0.7;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={module.position}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(module);
      }}
      onPointerOut={() => onHover(null)}
    >
      <sphereGeometry args={[radius, 24, 24]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.85}
        roughness={0.4}
        metalness={0.3}
      />
    </mesh>
  );
}

interface ConnectionLineProps {
  start: [number, number, number];
  end: [number, number, number];
  strength: number;
}

function ConnectionLine({ start, end, strength }: ConnectionLineProps) {
  const points = useMemo(() => {
    return [new THREE.Vector3(...start), new THREE.Vector3(...end)];
  }, [start, end]);

  const geometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  const lineRef = useRef<THREE.Line>(null);

  return (
    <primitive object={new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: "#374151",
      transparent: true,
      opacity: 0.3 + strength * 0.5,
    }))} ref={lineRef} />
  );
}

function Scene({
  modules,
  relationships,
  onHover,
}: {
  modules: Module3DNode[];
  relationships: Module3DRelationship[];
  onHover: (module: Module3DNode | null) => void;
}) {
  const maxCount = Math.max(...modules.map((m) => m.entity_count), 1);
  const posMap = new Map(modules.map((m) => [m.id, m.position]));

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} />

      {modules.map((mod) => (
        <ModuleSphere
          key={mod.id}
          module={mod}
          maxCount={maxCount}
          onHover={onHover}
        />
      ))}

      {relationships.map((rel, i) => {
        const start = posMap.get(rel.source);
        const end = posMap.get(rel.target);
        if (!start || !end) return null;
        return (
          <ConnectionLine
            key={i}
            start={start}
            end={end}
            strength={rel.strength}
          />
        );
      })}

      <OrbitControls enableDamping dampingFactor={0.1} />
    </>
  );
}

export default function Module3DExplorer({
  modules,
  relationships,
  width = 600,
  height = 400,
}: Module3DExplorerProps) {
  const [hovered, setHovered] = useState<Module3DNode | null>(null);

  return (
    <div
      className="relative bg-li-bg rounded-lg overflow-hidden"
      style={{ width, height }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        style={{ background: "#0A0E17" }}
      >
        <Scene
          modules={modules}
          relationships={relationships}
          onHover={setHovered}
        />
      </Canvas>

      {/* Tooltip overlay */}
      {hovered && (
        <div className="absolute top-3 left-3 bg-li-surface border border-li-border rounded-lg px-3 py-2 shadow-lg pointer-events-none">
          <p className="text-xs font-display text-li-text-primary">
            {hovered.name}
          </p>
          <p className="text-[10px] text-li-text-muted">
            {hovered.entity_count} entities
            {hovered.dominant_type && ` | ${hovered.dominant_type}`}
          </p>
        </div>
      )}
    </div>
  );
}
