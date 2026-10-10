"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASEMAP_STYLE_URL, SWATH_KM } from "@/lib/config";
import { rectRing } from "@/lib/geo";

const OFFLINE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#06111a" } }],
};

function zoomFor(lat: number, heightKm: number) {
  const z = Math.log2((220 * 156.543 * Math.cos((lat * Math.PI) / 180)) / Math.max(heightKm, 5));
  return Math.min(9, Math.max(3.5, z));
}

export default function AoiMap({
  lon,
  lat,
  widthKm,
  heightKm,
  focusKey,
  onPick,
}: {
  lon: number;
  lat: number;
  widthKm: number;
  heightKm: number;
  /** Changes when the view should jump to the AOI (preset chosen, coordinates typed). */
  focusKey: string;
  onPick: (lon: number, lat: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const latest = useRef({ lon, lat, widthKm, heightKm, onPick });
  latest.current = { lon, lat, widthKm, heightKm, onPick };

  const drawRect = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const { lon, lat, widthKm, heightKm } = latest.current;
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 85) return;
    const src = map.getSource("aoi") as GeoJSONSource | undefined;
    src?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [rectRing(lon, lat, widthKm, heightKm)] },
    });
    (map.getSource("aoi-pt") as GeoJSONSource | undefined)?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [lon, lat] },
    });
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE_URL,
      center: [latest.current.lon, latest.current.lat],
      zoom: zoomFor(latest.current.lat, latest.current.heightKm),
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    let loaded = false;
    let fellBack = false;

    map.on("style.load", () => {
      loaded = true;
      map.setProjection({ type: "mercator" });
      const tint = (id: string, prop: string, value: string) => {
        if (map.getLayer(id)) map.setPaintProperty(id, prop, value);
      };
      tint("background", "background-color", "#0b1d28");
      tint("water", "fill-color", "#050d14");

      if (!map.getSource("aoi")) {
        const empty = { type: "FeatureCollection", features: [] } as const;
        map.addSource("aoi", { type: "geojson", data: empty });
        map.addSource("aoi-pt", { type: "geojson", data: empty });
        map.addLayer({
          id: "aoi-fill",
          type: "fill",
          source: "aoi",
          paint: { "fill-color": "#22d3ee", "fill-opacity": 0.22 },
        });
        map.addLayer({
          id: "aoi-line",
          type: "line",
          source: "aoi",
          paint: { "line-color": "#67e8f9", "line-width": 2 },
        });
        map.addLayer({
          id: "aoi-pt",
          type: "circle",
          source: "aoi-pt",
          paint: {
            "circle-radius": 4,
            "circle-color": "#67e8f9",
            "circle-stroke-color": "#04141c",
            "circle-stroke-width": 1.5,
          },
        });
      }
      readyRef.current = true;
      drawRect();
    });

    map.on("error", () => {
      if (!loaded && !fellBack) {
        fellBack = true;
        readyRef.current = false;
        map.setStyle(OFFLINE_STYLE);
      }
    });

    map.on("click", (e) => {
      latest.current.onPick(
        Math.round(e.lngLat.lng * 1000) / 1000,
        Math.round(e.lngLat.lat * 1000) / 1000,
      );
    });
    map.getCanvas().style.cursor = "crosshair";

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // Redraw the rectangle whenever the AOI changes.
  useEffect(() => {
    drawRect();
  }, [lon, lat, widthKm, heightKm]);

  // Jump the view only when asked to (not on every click-to-place).
  useEffect(() => {
    const map = mapRef.current;
    const { lon, lat, heightKm } = latest.current;
    if (!map || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 85) return;
    map.easeTo({ center: [lon, lat], zoom: zoomFor(lat, heightKm), duration: 900 });
  }, [focusKey]);

  return (
    <div className="relative h-[340px] overflow-hidden rounded-lg border border-white/10 bg-[#050b12]">
      <div ref={containerRef} className="h-full w-full" aria-label="Area of interest map" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-[#071018]/85 px-2.5 py-1.5 text-[10px] tracking-wider text-slate-400 backdrop-blur">
        CLICK THE MAP TO PLACE THE AOI · SWATH ≈ {SWATH_KM} KM
      </div>
    </div>
  );
}
