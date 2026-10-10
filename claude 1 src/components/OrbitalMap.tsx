"use client";

import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  type GeoJSONSource,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASEMAP_STYLE_URL, TEAMS, TEAM_BY_ID } from "@/lib/config";
import { rectRing, splitAntimeridian } from "@/lib/geo";
import { groundTrack, subpoint } from "@/lib/orbit";
import { SATELLITES, simNow, type SatState } from "@/lib/sim";
import type { TargetSite } from "@/lib/sites";

interface Props {
  sites: TargetSite[];
  /** Keys of sites a satellite is acquiring right now. */
  activeKeys: string[];
  satStates: SatState[] | null;
}

type AddLayerArg = Parameters<MapLibreMap["addLayer"]>[0];
const addLayer = (map: MapLibreMap, spec: unknown) => map.addLayer(spec as AddLayerArg);

const emptyFC = { type: "FeatureCollection" as const, features: [] as never[] };

const VIEWS = {
  americas: { center: [-104, 35] as [number, number], zoom: 3.2 },
  world: { center: [-40, 20] as [number, number], zoom: 1.2 },
};

/** Popup bodies are built from text nodes, never HTML strings, so user-typed names can't inject markup. */
function popupContent(eyebrow: string, title: string, lines: string[]) {
  const root = document.createElement("div");
  root.style.cssText = "padding:12px 14px;min-width:180px;font-family:var(--font-geist-sans),Arial,sans-serif";
  const add = (text: string, css: string) => {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = css;
    root.appendChild(el);
  };
  add(eyebrow, "color:#67e8f9;font-size:10px;letter-spacing:1.5px;margin-bottom:6px");
  add(title, "font-size:13px;font-weight:700");
  for (const l of lines) add(l, "color:#94a3b8;font-size:12px;margin-top:4px");
  return root;
}

export default function OrbitalMap({ sites, activeKeys, satStates }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const satStatesRef = useRef<SatState[] | null>(satStates);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    satStatesRef.current = satStates;
  }, [satStates]);

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;

    const map = new MapLibreMap({
      container: container.current,
      style: BASEMAP_STYLE_URL,
      center: VIEWS.americas.center,
      zoom: VIEWS.americas.zoom,
      minZoom: 0.5,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new NavigationControl({ showCompass: true, showZoom: true }), "bottom-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-left");

    map.on("style.load", () => {
      // Globe projection (MapLibre GL JS 5+): zoom out and the world becomes a sphere.
      map.setProjection({ type: "globe" });

      map.addSource("sites", { type: "geojson", data: emptyFC });
      map.addSource("track-past", { type: "geojson", data: emptyFC });
      map.addSource("track-future", { type: "geojson", data: emptyFC });

      addLayer(map, {
        id: "track-past",
        type: "line",
        source: "track-past",
        paint: { "line-color": "#67e8f9", "line-width": 1.25, "line-opacity": 0.2 },
      });
      addLayer(map, {
        id: "track-future",
        type: "line",
        source: "track-future",
        paint: {
          "line-color": "#67e8f9",
          "line-width": 1.5,
          "line-opacity": 0.7,
          "line-dasharray": [2, 3],
        },
      });
      addLayer(map, {
        id: "site-fill",
        type: "fill",
        source: "sites",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": [
            "case",
            ["==", ["get", "active"], 1],
            0.5,
            ["==", ["get", "funded"], 1],
            0.25,
            0.06,
          ],
        },
      });
      addLayer(map, {
        id: "site-outline-funded",
        type: "line",
        source: "sites",
        filter: ["==", ["get", "funded"], 1],
        paint: { "line-color": ["get", "color"], "line-width": 1.6, "line-opacity": 0.9 },
      });
      addLayer(map, {
        id: "site-outline-waitlisted",
        type: "line",
        source: "sites",
        filter: ["==", ["get", "funded"], 0],
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.2,
          "line-opacity": 0.55,
          "line-dasharray": [3, 2],
        },
      });
      // Footprints are tiny at world scale, so a dot stands in until you zoom in.
      addLayer(map, {
        id: "site-points",
        type: "circle",
        source: "sites",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3.5, 5, 6],
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.95, 7, 0],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.7, 7, 0],
        },
      });

      const showSite = (e: {
        lngLat: { lng: number; lat: number };
        features?: { properties?: Record<string, unknown> }[];
      }) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;
        new Popup({ offset: 12, closeButton: false })
          .setLngLat(e.lngLat)
          .setDOMContent(
            popupContent("COLLECTION TARGET", String(p.name), [
              String(p.teamName),
              `${p.funded === 1 ? "Funded this cycle" : "Waitlisted"} · ${p.requests} request${
                p.requests === 1 ? "" : "s"
              }`,
            ]),
          )
          .addTo(map);
      };
      for (const layer of ["site-points", "site-fill"]) {
        map.on("click", layer, showSite);
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }

      setReady(true);
    });

    return () => {
      setReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Target footprints. Re-runs when the allocation changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const active = new Set(activeKeys);
    const features = sites.map((s) => ({
      type: "Feature" as const,
      properties: {
        name: s.name,
        color: TEAM_BY_ID[s.team].color,
        teamName: TEAM_BY_ID[s.team].name,
        funded: s.funded > 0 ? 1 : 0,
        active: active.has(s.key) ? 1 : 0,
        requests: s.funded + s.waitlisted,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [rectRing(s.lon, s.lat, s.widthKm, s.heightKm)],
      },
    }));
    (map.getSource("sites") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features,
    });
  }, [sites, activeKeys, ready]);

  // Satellite markers + ground tracks. One animation loop, cancelled on unmount.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    const markers = new Map<string, Marker>();
    for (const def of SATELLITES) {
      const el = document.createElement("button");
      el.type = "button";
      el.title = def.name;
      el.style.cssText =
        "display:flex;align-items:center;gap:7px;padding:5px 9px 5px 5px;border-radius:8px;" +
        "border:1px solid rgba(103,232,249,0.35);background:rgba(7,16,24,0.92);color:white;" +
        "cursor:pointer;box-shadow:0 0 20px rgba(34,211,238,0.18)";
      const icon = document.createElement("span");
      icon.textContent = "✦";
      icon.style.cssText =
        "display:flex;align-items:center;justify-content:center;width:22px;height:22px;" +
        "border-radius:50%;background:rgba(34,211,238,0.12);border:1px solid rgba(103,232,249,0.65);" +
        "color:#67e8f9;font-size:13px;box-shadow:0 0 14px rgba(34,211,238,0.45)";
      const label = document.createElement("span");
      label.textContent = def.name;
      label.style.cssText = "font-size:10px;font-weight:700;letter-spacing:1px";
      el.append(icon, label);

      const popup = new Popup({ offset: 22, closeButton: false });
      popup.on("open", () => {
        const s = satStatesRef.current?.find((x) => x.id === def.id);
        popup.setDOMContent(
          popupContent(
            def.name,
            s?.status ?? "TRANSIT",
            s?.site ? [`${s.status === "COLLECTING" ? "Current" : "Next"} target: ${s.site.name}`] : [],
          ),
        );
      });

      markers.set(
        def.id,
        new Marker({ element: el, anchor: "center" })
          .setLngLat(subpoint(def.orbit, simNow()))
          .setPopup(popup)
          .addTo(map),
      );
    }

    const MIN = 60_000;
    const updateTracks = (t: number) => {
      const past: [number, number][][] = [];
      const future: [number, number][][] = [];
      for (const def of SATELLITES) {
        past.push(...splitAntimeridian(groundTrack(def.orbit, t - 25 * MIN, t, 30_000)));
        future.push(...splitAntimeridian(groundTrack(def.orbit, t, t + 50 * MIN, 30_000)));
      }
      const fc = (lines: [number, number][][]) => ({
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            properties: {},
            geometry: { type: "MultiLineString" as const, coordinates: lines },
          },
        ],
      });
      (map.getSource("track-past") as GeoJSONSource | undefined)?.setData(fc(past));
      (map.getSource("track-future") as GeoJSONSource | undefined)?.setData(fc(future));
    };

    let raf = 0;
    let lastTrack = -Infinity;
    const loop = () => {
      const t = simNow();
      for (const def of SATELLITES) markers.get(def.id)?.setLngLat(subpoint(def.orbit, t));
      const now = performance.now();
      if (now - lastTrack > 1000) {
        lastTrack = now;
        updateTracks(t);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      markers.forEach((m) => m.remove());
    };
  }, [ready]);

  const fly = (view: keyof typeof VIEWS) =>
    mapRef.current?.easeTo({ ...VIEWS[view], duration: 1400 });

  return (
    <div className="absolute inset-0 bg-[#03080d]">
      <div
        ref={container}
        className="h-full w-full"
        aria-label="Simulated Tanager orbital operations map"
      />

      <div className="absolute left-5 top-5 z-10">
        <p className="text-xs tracking-widest text-slate-500">LIVE ORBITAL VIEW</p>
        <div className="mt-3 flex gap-2">
          {(["americas", "world"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => fly(v)}
              className="rounded-md border border-white/10 bg-[#071018]/80 px-2.5 py-1 text-[10px] tracking-widest text-slate-300 backdrop-blur transition hover:bg-white/10"
            >
              {v === "americas" ? "AMERICAS" : "WORLD"}
            </button>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute right-5 top-5 z-10 rounded-md border border-white/10 bg-[#071018]/80 px-3 py-2 backdrop-blur">
        {TEAMS.map((t) => (
          <div key={t.id} className="flex items-center gap-2 text-[10px] tracking-wider text-slate-400">
            <span className="h-2 w-2 rounded-sm" style={{ background: t.color }} aria-hidden />
            {t.short.toUpperCase()}
          </div>
        ))}
        <div className="mt-1.5 border-t border-white/10 pt-1.5 text-[10px] tracking-wider text-slate-500">
          SOLID = FUNDED · DASHED = WAITLIST
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-24 rounded-md border border-white/10 bg-[#071018]/80 px-3 py-2 backdrop-blur">
        <p className="text-[10px] tracking-widest text-slate-500">SIMULATED ORBITAL DATA</p>
      </div>
    </div>
  );
}
