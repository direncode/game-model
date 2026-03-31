"use client";

import { useRef, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useFranklinStore } from "@/stores/franklin";
import type { FSDSpot, FSDHeatmapPoint } from "@/lib/fsd-api";

const CHAPEL_HILL_CENTER: [number, number] = [-79.0555, 35.9132];
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface FranklinMapProps {
  spots: FSDSpot[];
  heatmap: FSDHeatmapPoint[];
}

function spotsToGeoJSON(spots: FSDSpot[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: spots.map((s) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
      properties: {
        name: s.name,
        busyness: s.busyness,
        amenity_type: s.amenity_type,
        closed: s.closed,
        address: s.address,
        category: s.category,
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
      properties: { weight },
    })),
  };
}

export default function FranklinMap({ spots, heatmap }: FranklinMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const { selectVenue } = useFranklinStore();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: CHAPEL_HILL_CENTER,
      zoom: 15,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      // Heatmap source + layer
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
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 1.5],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 12, 15, 16, 30],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.1, "rgba(0,50,80,0.4)",
            0.3, "rgba(0,100,150,0.6)",
            0.5, "rgba(0,170,220,0.7)",
            0.7, "rgba(0,212,255,0.8)",
            1, "rgba(200,240,255,0.9)",
          ],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.8, 17, 0.3],
        },
      });

      // Venue markers source + layer
      map.addSource("fsd-venues", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "fsd-venue-circles",
        type: "circle",
        source: "fsd-venues",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "busyness"], 0, 3, 50, 5, 100, 8],
          "circle-color": [
            "case",
            ["get", "closed"], "#404040",
            ["interpolate", ["linear"], ["get", "busyness"],
              0, "#1a1a1a",
              30, "#0a6e8a",
              60, "#00a8cc",
              100, "#00d4ff",
            ],
          ],
          "circle-opacity": ["case", ["get", "closed"], 0.3, 0.85],
          "circle-stroke-width": 1,
          "circle-stroke-color": ["case", ["get", "closed"], "#333", "#00d4ff"],
          "circle-stroke-opacity": 0.4,
        },
        minzoom: 14,
      });

      // Click handler for venue markers
      map.on("click", "fsd-venue-circles", (e) => {
        if (!e.features?.[0]) return;
        const props = e.features[0].properties!;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];

        const spot = spots.find((s) => s.name === props.name);
        if (spot) selectVenue(spot);

        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: "280px" })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family: Inter, sans-serif; color: #fff; background: #111; padding: 12px; border-radius: 8px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${props.name}</div>
              <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
                ${props.amenity_type}${props.closed ? ' · CLOSED' : ''}
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="flex: 1; height: 6px; background: #222; border-radius: 3px; overflow: hidden;">
                  <div style="width: ${props.busyness}%; height: 100%; background: ${props.closed ? '#404040' : '#00d4ff'}; border-radius: 3px;"></div>
                </div>
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; color: ${props.closed ? '#555' : '#00d4ff'};">
                  ${props.busyness}
                </span>
              </div>
              ${props.address ? `<div style="font-size: 11px; color: #666; margin-top: 6px;">${props.address}</div>` : ''}
            </div>
          `)
          .addTo(map);
      });

      map.on("mouseenter", "fsd-venue-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "fsd-venue-circles", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    mapRef.current = map;
    return () => map.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update data when spots/heatmap change — handle race condition where
  // data arrives before Mapbox style finishes loading
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const doUpdate = () => {
      const heatSrc = map.getSource("fsd-heatmap") as mapboxgl.GeoJSONSource;
      if (heatSrc) heatSrc.setData(heatmapToGeoJSON(heatmap));
      const venueSrc = map.getSource("fsd-venues") as mapboxgl.GeoJSONSource;
      if (venueSrc) venueSrc.setData(spotsToGeoJSON(spots));
    };

    if (map.isStyleLoaded()) {
      doUpdate();
    } else {
      map.once("load", doUpdate);
    }
  }, [spots, heatmap]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-li-gray-900 rounded-lg border border-li-border">
        <p className="text-sm text-li-text-muted">
          Set <code className="font-mono text-li-cyan">NEXT_PUBLIC_MAPBOX_TOKEN</code> in .env.local
        </p>
      </div>
    );
  }

  return (
    <div ref={mapContainer} className="w-full h-full rounded-lg overflow-hidden" />
  );
}
