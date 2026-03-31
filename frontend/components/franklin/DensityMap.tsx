"use client";

import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import type { FSDHeatmapPoint, FSDSpot } from "@/lib/fsd-api";

// Slightly zoomed out to show the full corridor
const FRANKLIN_CENTER: [number, number] = [-79.0548, 35.9132];
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface DensityMapProps {
  heatmap: FSDHeatmapPoint[];
  spots: FSDSpot[];
}

function toHeatmapGeoJSON(
  heatmap: FSDHeatmapPoint[],
  spots: FSDSpot[]
): GeoJSON.FeatureCollection {
  const points =
    heatmap.length > 0
      ? heatmap
      : spots
          .filter((s) => s.lat && s.lon)
          .map((s) => [s.lat, s.lon, s.busyness ?? 0] as FSDHeatmapPoint);

  return {
    type: "FeatureCollection",
    features: points.map(([lat, lon, weight]) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [lon, lat] },
      properties: { weight: weight ?? 0 },
    })),
  };
}

export default function DensityMap({ heatmap, spots }: DensityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: FRANKLIN_CENTER,
      zoom: 13.5,
      interactive: false,          // read-only density view
      attributionControl: false,
    });

    map.on("load", () => {
      map.addSource("density-heat", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "density-heat-layer",
        type: "heatmap",
        source: "density-heat",
        paint: {
          "heatmap-weight": [
            "interpolate", ["linear"], ["get", "weight"],
            0, 0,
            100, 1,
          ],
          "heatmap-intensity": 2.5,
          "heatmap-radius": [
            "interpolate", ["linear"], ["zoom"],
            12, 25,
            16, 55,
          ],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0,   "rgba(0,0,0,0)",
            0.05,"rgba(40,0,0,0.5)",
            0.2, "rgba(120,10,10,0.7)",
            0.4, "rgba(200,40,0,0.85)",
            0.6, "rgba(255,100,0,0.92)",
            0.8, "rgba(255,180,0,0.96)",
            1.0, "rgba(255,240,180,1)",
          ],
          "heatmap-opacity": 0.92,
        },
      });

      // Set initial data
      const src = map.getSource("density-heat") as mapboxgl.GeoJSONSource;
      if (src) src.setData(toHeatmapGeoJSON(heatmap, spots));
    });

    mapRef.current = map;
    return () => map.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const doUpdate = () => {
      const src = map.getSource("density-heat") as mapboxgl.GeoJSONSource;
      if (src) src.setData(toHeatmapGeoJSON(heatmap, spots));
    };
    map.isStyleLoaded() ? doUpdate() : map.once("load", doUpdate);
  }, [heatmap, spots]);

  if (!MAPBOX_TOKEN) return null;

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-1 left-2 text-[9px] font-mono text-white/30 pointer-events-none">
        BTUT density field
      </div>
    </div>
  );
}
