"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASEMAP_STYLE_URL, SWATH_KM } from "@/lib/config";
import {
  bboxDeg,
  extractPolygon,
  polygonAreaKm2,
  polygonCentroid,
  rectRing,
  ringSelfIntersects,
  type Ring,
} from "@/lib/geo";

export type AoiShape = "box" | "polygon";

const OFFLINE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#0A0C1C" } }],
};

const MAX_UPLOAD_BYTES = 2_000_000;
const CLOSE_PX = 12;
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

function zoomFor(lat: number, heightKm: number) {
  const z = Math.log2((220 * 156.543 * Math.cos((lat * Math.PI) / 180)) / Math.max(heightKm, 5));
  return Math.min(9, Math.max(3.5, z));
}

type AddLayerArg = Parameters<MapLibreMap["addLayer"]>[0];
const addLayer = (map: MapLibreMap, spec: unknown) => map.addLayer(spec as AddLayerArg);

const EMPTY = { type: "FeatureCollection" as const, features: [] as never[] };

const fmtKm2 = (n: number) => `${Math.round(n).toLocaleString("en-US")} km²`;

const tool =
  "rounded-full border border-white/10 bg-[#0B0D1F]/75 px-3 py-1.5 text-xs font-medium text-slate-200 " +
  "shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_6px_16px_-6px_rgba(0,0,0,0.6)] backdrop-blur-xl " +
  "transition active:scale-95 hover:bg-white/10 disabled:opacity-40 disabled:active:scale-100";
const toolOn =
  "!border-cyan-300/50 !bg-cyan-400/20 !text-white shadow-[0_0_0_3px_rgba(143,156,255,0.18)]";

export default function AoiMap({
  lon,
  lat,
  widthKm,
  heightKm,
  shape,
  polygon,
  focusKey,
  onPick,
  onShape,
  onPolygon,
}: {
  lon: number;
  lat: number;
  widthKm: number;
  heightKm: number;
  shape: AoiShape;
  polygon: Ring | null;
  /** Changes when the view should jump to the AOI (preset chosen, coordinates typed). */
  focusKey: string;
  onPick: (lon: number, lat: number) => void;
  onShape: (s: AoiShape) => void;
  onPolygon: (ring: Ring | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const labelRef = useRef<{ marker: Marker; el: HTMLDivElement } | null>(null);

  // Interaction state lives in refs so map handlers never go stale.
  const drawingRef = useRef(false);
  const ptsRef = useRef<Ring>([]);
  const cursorRef = useRef<[number, number] | null>(null);
  const dragRef = useRef<number | null>(null);
  const workRef = useRef<Ring | null>(null);

  const latest = useRef({ lon, lat, widthKm, heightKm, shape, polygon, onPick, onShape, onPolygon });

  // UI mirrors of the ref state.
  const [drawing, setDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  /* ---------- rendering ---------- */

  const render = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const L = latest.current;
    const set = (id: string, data: unknown) =>
      (map.getSource(id) as GeoJSONSource | undefined)?.setData(data as Parameters<GeoJSONSource["setData"]>[0]);

    let ring: Ring = [];
    let closed = false;
    if (drawingRef.current) ring = ptsRef.current;
    else if (workRef.current) {
      ring = workRef.current;
      closed = true;
    } else if (L.shape === "polygon" && L.polygon) {
      ring = L.polygon;
      closed = true;
    }

    const cursor = drawingRef.current ? cursorRef.current : null;
    const path = cursor && ring.length ? [...ring, cursor] : ring;
    const fillPts = closed ? ring : path;

    set(
      "draw-fill",
      fillPts.length >= 3
        ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...fillPts, fillPts[0]]] } }
        : EMPTY,
    );
    const lineCoords = closed && ring.length >= 3 ? [...ring, ring[0]] : path;
    set(
      "draw-line",
      lineCoords.length >= 2
        ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: lineCoords } }
        : EMPTY,
    );
    set("draw-verts", {
      type: "FeatureCollection",
      features: ring.map((p, i) => ({
        type: "Feature",
        properties: { i, first: i === 0 && drawingRef.current ? 1 : 0 },
        geometry: { type: "Point", coordinates: p },
      })),
    });

    // Box shape.
    const boxOk =
      L.shape === "box" &&
      !drawingRef.current &&
      Number.isFinite(L.lon) &&
      Number.isFinite(L.lat) &&
      Math.abs(L.lat) <= 85;
    set(
      "aoi-box",
      boxOk
        ? {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [rectRing(L.lon, L.lat, L.widthKm, L.heightKm)] },
          }
        : EMPTY,
    );

    // Area label.
    let labelText: string | null = null;
    let labelAt: [number, number] | null = null;
    if (ring.length >= 3) {
      labelText = fmtKm2(polygonAreaKm2(ring));
      labelAt = polygonCentroid(ring);
    } else if (boxOk) {
      labelText = fmtKm2(L.widthKm * L.heightKm);
      labelAt = [L.lon, L.lat];
    }
    const label = labelRef.current;
    if (label) {
      if (labelText && labelAt) {
        label.el.textContent = labelText;
        label.el.style.display = "block";
        label.marker.setLngLat(labelAt);
      } else {
        label.el.style.display = "none";
      }
    }
  };

  const startDrawing = () => {
    const map = mapRef.current;
    ptsRef.current = [];
    cursorRef.current = null;
    drawingRef.current = true;
    setDrawing(true);
    setPointCount(0);
    setNotice(null);
    map?.doubleClickZoom.disable();
    if (map) map.getCanvas().style.cursor = "crosshair";
    latest.current.onShape("polygon");
    latest.current.onPolygon(null);
    render();
  };

  const stopDrawing = () => {
    const map = mapRef.current;
    drawingRef.current = false;
    ptsRef.current = [];
    cursorRef.current = null;
    setDrawing(false);
    setPointCount(0);
    map?.doubleClickZoom.enable();
    if (map) map.getCanvas().style.cursor = "";
    render();
  };

  const finishDrawing = () => {
    const pts = ptsRef.current;
    if (pts.length < 3) {
      setNotice("Add at least 3 points to outline an area.");
      return;
    }
    if (ringSelfIntersects(pts)) {
      setNotice("The outline crosses itself. Undo a point or cancel and start again.");
      return;
    }
    setNotice(null);
    const ring = pts;
    stopDrawing();
    latest.current.onPolygon(ring);
  };

  const undoPoint = () => {
    if (!drawingRef.current || ptsRef.current.length === 0) return;
    ptsRef.current = ptsRef.current.slice(0, -1);
    setPointCount(ptsRef.current.length);
    setNotice(null);
    render();
  };

  const chooseBox = () => {
    if (drawingRef.current) stopDrawing();
    setNotice(null);
    latest.current.onPolygon(null);
    latest.current.onShape("box");
  };

  const clearShape = () => {
    if (drawingRef.current) stopDrawing();
    setNotice(null);
    latest.current.onPolygon(null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setNotice("That file is over 2 MB. Upload a simpler outline.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setNotice("That file isn't valid GeoJSON.");
      return;
    }
    const res = extractPolygon(parsed);
    if ("error" in res) {
      setNotice(res.error);
      return;
    }
    if (drawingRef.current) stopDrawing();
    setNotice(null);
    latest.current.onShape("polygon");
    latest.current.onPolygon(res.ring);
    const b = bboxDeg(res.ring);
    mapRef.current?.fitBounds(
      [
        [b.minLon, b.minLat],
        [b.maxLon, b.maxLat],
      ],
      { padding: 70, duration: 900, maxZoom: 9 },
    );
  };

  /* ---------- map setup ---------- */

  useEffect(() => {
    latest.current = { lon, lat, widthKm, heightKm, shape, polygon, onPick, onShape, onPolygon };
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const L0 = latest.current;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE_URL,
      center: [L0.lon, L0.lat],
      zoom: zoomFor(L0.lat, L0.heightKm),
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
      tint("background", "background-color", "#12152C");
      tint("water", "fill-color", "#080A18");

      if (!map.getSource("aoi-box")) {
        for (const id of ["aoi-box", "draw-fill", "draw-line", "draw-verts"]) {
          map.addSource(id, { type: "geojson", data: EMPTY });
        }
        addLayer(map, {
          id: "aoi-box-fill",
          type: "fill",
          source: "aoi-box",
          paint: { "fill-color": "#8F9CFF", "fill-opacity": 0.22 },
        });
        addLayer(map, {
          id: "aoi-box-line",
          type: "line",
          source: "aoi-box",
          paint: { "line-color": "#AEB8FF", "line-width": 2 },
        });
        addLayer(map, {
          id: "draw-fill",
          type: "fill",
          source: "draw-fill",
          paint: { "fill-color": "#8F9CFF", "fill-opacity": 0.22 },
        });
        addLayer(map, {
          id: "draw-line",
          type: "line",
          source: "draw-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#AEB8FF", "line-width": 2.25 },
        });
        addLayer(map, {
          id: "draw-verts",
          type: "circle",
          source: "draw-verts",
          paint: {
            "circle-radius": ["case", ["==", ["get", "first"], 1], 7, 5],
            "circle-color": "#ffffff",
            "circle-stroke-color": "#8F9CFF",
            "circle-stroke-width": 2.5,
          },
        });

        const el = document.createElement("div");
        el.style.cssText =
          "display:none;pointer-events:none;padding:4px 10px;border-radius:999px;font-size:12px;" +
          "font-weight:600;color:#fff;background:rgba(11,13,31,0.82);border:1px solid rgba(174,184,255,0.35);" +
          "box-shadow:0 6px 18px -6px rgba(0,0,0,0.7);backdrop-filter:blur(8px);font-variant-numeric:tabular-nums";
        labelRef.current = {
          el,
          marker: new Marker({ element: el, anchor: "center" }).setLngLat([0, 0]).addTo(map),
        };
      }
      readyRef.current = true;
      render();
    });

    map.on("error", () => {
      if (!loaded && !fellBack) {
        fellBack = true;
        readyRef.current = false;
        map.setStyle(OFFLINE_STYLE);
      }
    });

    map.on("click", (e) => {
      const L = latest.current;
      if (drawingRef.current) {
        const pts = ptsRef.current;
        if (pts.length >= 3) {
          const first = map.project(pts[0]);
          if (Math.hypot(first.x - e.point.x, first.y - e.point.y) < CLOSE_PX) {
            finishDrawing();
            return;
          }
        }
        ptsRef.current = [...pts, [round4(e.lngLat.lng), round4(e.lngLat.lat)]];
        setPointCount(ptsRef.current.length);
        setNotice(null);
        render();
        return;
      }
      if (L.shape === "box") {
        L.onPick(Math.round(e.lngLat.lng * 1000) / 1000, Math.round(e.lngLat.lat * 1000) / 1000);
      }
    });

    map.on("mousemove", (e) => {
      if (dragRef.current !== null && workRef.current) {
        const next = [...workRef.current];
        next[dragRef.current] = [round4(e.lngLat.lng), round4(e.lngLat.lat)];
        workRef.current = next;
        render();
        return;
      }
      if (drawingRef.current) {
        cursorRef.current = [e.lngLat.lng, e.lngLat.lat];
        render();
      }
    });

    // Drag finished-polygon vertices to reshape.
    map.on("mousedown", "draw-verts", (e) => {
      const L = latest.current;
      if (drawingRef.current || !L.polygon) return;
      const idx = Number(e.features?.[0]?.properties?.i);
      if (!Number.isFinite(idx)) return;
      e.preventDefault();
      dragRef.current = idx;
      workRef.current = [...L.polygon];
      map.dragPan.disable();
      map.getCanvas().style.cursor = "grabbing";
    });
    const endDrag = () => {
      if (dragRef.current === null) return;
      const ring = workRef.current;
      dragRef.current = null;
      workRef.current = null;
      map.dragPan.enable();
      map.getCanvas().style.cursor = "";
      if (ring && ringSelfIntersects(ring)) {
        setNotice("Edges can't cross. Move the point somewhere else.");
        render();
      } else if (ring) {
        setNotice(null);
        latest.current.onPolygon(ring);
      }
    };
    map.on("mouseup", endDrag);
    map.on("mouseenter", "draw-verts", () => {
      if (!drawingRef.current && dragRef.current === null) map.getCanvas().style.cursor = "grab";
    });
    map.on("mouseleave", "draw-verts", () => {
      if (!drawingRef.current && dragRef.current === null) map.getCanvas().style.cursor = "";
    });

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
      labelRef.current = null;
    };
    // The handlers only touch refs and stable setters, so they are safe to create once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw whenever the shape changes from outside.
  useEffect(() => {
    if (shape === "box" && drawingRef.current) stopDrawing();
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lon, lat, widthKm, heightKm, polygon, shape]);

  // Jump the view only when asked to (not on every click-to-place).
  useEffect(() => {
    const map = mapRef.current;
    const L = latest.current;
    if (!map || !Number.isFinite(L.lon) || !Number.isFinite(L.lat) || Math.abs(L.lat) > 85) return;
    map.easeTo({ center: [L.lon, L.lat], zoom: zoomFor(L.lat, L.heightKm), duration: 900 });
  }, [focusKey]);

  // Keyboard shortcuts while drawing.
  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "Enter") {
        e.preventDefault();
        finishDrawing();
      } else if (e.key === "Escape") {
        stopDrawing();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        undoPoint();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing]);

  const hasShape = shape === "polygon" ? !!polygon : false;
  const hint = drawing
    ? pointCount < 3
      ? "Click the map to add points around your target."
      : "Keep clicking, then click the first point or press Enter to finish."
    : shape === "polygon"
      ? polygon
        ? "Drag any point to reshape the area."
        : "Choose Draw area, then click to outline your target."
      : "Click the map to move the box, or switch to Draw area.";

  return (
    <div className="relative h-full min-h-[260px] overflow-hidden rounded-2xl border border-white/10 bg-[#070914] shadow-[0_20px_50px_-24px_rgba(0,0,0,0.8)]">
      <div ref={containerRef} className="h-full w-full" aria-label="Area of interest map" />

      <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-70px)] flex-col items-start gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startDrawing}
            className={`${tool} ${drawing || (shape === "polygon" && polygon) ? toolOn : ""}`}
          >
            {shape === "polygon" && polygon ? "Redraw area" : "Draw area"}
          </button>
          <button type="button" onClick={chooseBox} className={`${tool} ${shape === "box" && !drawing ? toolOn : ""}`}>
            Place box
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={tool}>
            Upload GeoJSON
          </button>
          {(hasShape || drawing) && (
            <button type="button" onClick={clearShape} className={tool}>
              Clear
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        {drawing && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={undoPoint} disabled={pointCount === 0} className={tool}>
              Undo point
            </button>
            <button type="button" onClick={finishDrawing} disabled={pointCount < 3} className={`${tool} ${toolOn}`}>
              Finish area
            </button>
            <button type="button" onClick={stopDrawing} className={tool}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex flex-col items-start gap-2">
        {notice && (
          <div
            role="alert"
            className="rounded-xl border border-amber-300/30 bg-amber-950/70 px-3 py-2 text-xs text-amber-100 backdrop-blur-xl"
          >
            {notice}
          </div>
        )}
        <div className="rounded-full border border-white/10 bg-[#0B0D1F]/75 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-xl">
          {hint} <span className="text-slate-500">Tanager swath is about {SWATH_KM} km.</span>
        </div>
      </div>
    </div>
  );
}
