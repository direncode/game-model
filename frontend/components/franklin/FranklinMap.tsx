"use client";

import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useFranklinStore } from "@/stores/franklin";
import type { FSDSpot, FSDHeatmapPoint, FSDConvergenceItem } from "@/lib/fsd-api";

// Franklin Street corridor center
const FRANKLIN_ST_CENTER: [number, number] = [-79.0548, 35.9132];
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface FranklinMapProps {
  spots: FSDSpot[];
  heatmap: FSDHeatmapPoint[];
  convergence?: FSDConvergenceItem[];
}

function spotsToGeoJSON(spots: FSDSpot[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: spots
      .filter((s) => s.lat && s.lon)
      .map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
        properties: {
          name: s.name,
          busyness: s.busyness ?? 0,
          amenity_type: s.amenity_type ?? "",
          closed: s.closed ?? false,
          address: s.address ?? "",
          category: s.category ?? "",
        },
      })),
  };
}

function heatmapToGeoJSON(points: FSDHeatmapPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map(([lat, lon, weight]) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [lon, lat] },
      properties: { weight: weight ?? 0 },
    })),
  };
}

function convergenceToGeoJSON(
  items: FSDConvergenceItem[],
  spots: FSDSpot[]
): GeoJSON.FeatureCollection {
  const spotMap = new Map(spots.map((s) => [s.name, s]));
  return {
    type: "FeatureCollection",
    features: items
      .map((c) => {
        const spot = spotMap.get(c.venue_name);
        const lat = c.lat ?? spot?.lat;
        const lon = c.lon ?? spot?.lon;
        if (!lat || !lon) return null;
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [lon, lat] },
          properties: {
            name: c.venue_name,
            score: c.convergence_score ?? 0,
            keywords: (c.matching_keywords ?? []).slice(0, 3).join(", "),
          },
        };
      })
      .filter(Boolean) as GeoJSON.Feature[],
  };
}

export default function FranklinMap({ spots, heatmap, convergence = [] }: FranklinMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const spotsRef = useRef<FSDSpot[]>(spots);
  const { selectVenue } = useFranklinStore();

  // Keep spots ref fresh for click handler closure
  useEffect(() => { spotsRef.current = spots; }, [spots]);

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: FRANKLIN_ST_CENTER,
      zoom: 14,
      attributionControl: false,
      pitchWithRotate: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    // Show coordinates in bottom-left
    map.addControl(
      new mapboxgl.ScaleControl({ maxWidth: 100, unit: "metric" }),
      "bottom-left"
    );

    map.on("load", () => {
      // ── Heatmap layer ──────────────────────────────
      map.addSource("fsd-heatmap", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "fsd-heatmap-layer",
        type: "heatmap",
        source: "fsd-heatmap",
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 100, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 12, 0.8, 17, 2],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 12, 20, 16, 40],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0,   "rgba(0,0,0,0)",
            0.1, "rgba(0,30,60,0.4)",
            0.3, "rgba(0,80,130,0.6)",
            0.5, "rgba(0,150,200,0.75)",
            0.7, "rgba(0,212,255,0.85)",
            1.0, "rgba(180,240,255,0.95)",
          ],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.9, 17, 0.4],
        },
      });

      // ── Convergence pulse rings ─────────────────────
      map.addSource("fsd-convergence", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "fsd-convergence-pulse",
        type: "circle",
        source: "fsd-convergence",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "score"], 0, 12, 100, 24],
          "circle-color": "rgba(255,200,0,0)",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffd700",
          "circle-stroke-opacity": ["interpolate", ["linear"], ["get", "score"], 0, 0.3, 100, 0.9],
          "circle-opacity": 0,
        },
      });

      // ── Venue dots ─────────────────────────────────
      map.addSource("fsd-venues", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "fsd-venue-circles",
        type: "circle",
        source: "fsd-venues",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            14, ["interpolate", ["linear"], ["get", "busyness"], 0, 3, 100, 7],
            17, ["interpolate", ["linear"], ["get", "busyness"], 0, 5, 100, 12],
          ],
          "circle-color": [
            "case",
            ["get", "closed"], "#2a2a2a",
            ["interpolate", ["linear"], ["get", "busyness"],
              0,  "#111827",
              25, "#0a4a6b",
              50, "#0a6e8a",
              75, "#00a8cc",
              100, "#00d4ff",
            ],
          ],
          "circle-opacity": ["case", ["get", "closed"], 0.25, 0.9],
          "circle-stroke-width": ["case", ["get", "closed"], 0, 1.5],
          "circle-stroke-color": "#00d4ff",
          "circle-stroke-opacity": [
            "interpolate", ["linear"], ["get", "busyness"], 0, 0.1, 100, 0.6
          ],
        },
      });

      // ── Venue labels (high zoom) ───────────────────
      map.addLayer({
        id: "fsd-venue-labels",
        type: "symbol",
        source: "fsd-venues",
        minzoom: 16,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["DIN Pro Regular", "Arial Unicode MS Regular"],
          "text-size": 10,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-max-width": 8,
        },
        paint: {
          "text-color": "#aaa",
          "text-halo-color": "#000",
          "text-halo-width": 1,
          "text-opacity": ["case", ["get", "closed"], 0, 0.8],
        },
        filter: [">", ["get", "busyness"], 20],
      });

      // ── Click popup ────────────────────────────────
      map.on("click", "fsd-venue-circles", (e) => {
        if (!e.features?.[0]) return;
        const props = e.features[0].properties!;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        const spot = spotsRef.current.find((s) => s.name === props.name);
        if (spot) selectVenue(spot);
        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: "280px", className: "fsd-popup" })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:Inter,sans-serif;color:#fff;background:#0d0d0d;padding:12px;border-radius:8px;border:1px solid #222;">
              <div style="font-weight:600;font-size:14px;margin-bottom:3px;">${props.name}</div>
              <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">
                ${props.amenity_type}${props.closed ? " · CLOSED" : ""}
                ${props.address ? `<br/><span style="text-transform:none;letter-spacing:0;">${props.address}</span>` : ""}
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="flex:1;height:5px;background:#1a1a1a;border-radius:3px;overflow:hidden;">
                  <div style="width:${props.busyness}%;height:100%;background:${props.closed ? "#333" : "#00d4ff"};border-radius:3px;"></div>
                </div>
                <span style="font-family:monospace;font-size:14px;font-weight:700;color:${props.closed ? "#444" : "#00d4ff"};">${props.busyness}</span>
              </div>
            </div>
          `)
          .addTo(map);
      });

      map.on("mouseenter", "fsd-venue-circles", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "fsd-venue-circles", () => { map.getCanvas().style.cursor = ""; });
    });

    mapRef.current = map;
    return () => map.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update heatmap + venue data
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const doUpdate = () => {
      (map.getSource("fsd-heatmap") as mapboxgl.GeoJSONSource)?.setData(heatmapToGeoJSON(heatmap));
      (map.getSource("fsd-venues") as mapboxgl.GeoJSONSource)?.setData(spotsToGeoJSON(spots));
    };
    map.isStyleLoaded() ? doUpdate() : map.once("load", doUpdate);
  }, [spots, heatmap]);

  // Update convergence overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !convergence.length) return;
    const doUpdate = () => {
      (map.getSource("fsd-convergence") as mapboxgl.GeoJSONSource)?.setData(
        convergenceToGeoJSON(convergence, spotsRef.current)
      );
    };
    map.isStyleLoaded() ? doUpdate() : map.once("load", doUpdate);
  }, [convergence]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-li-gray-900 rounded-lg border border-li-border">
        <p className="text-sm text-li-text-muted">
          Set <code className="font-mono text-li-cyan">NEXT_PUBLIC_MAPBOX_TOKEN</code> in .env.local
        </p>
      </div>
    );
  }

  return <div ref={mapContainer} className="w-full h-full" />;
}
