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
import { haversineKm, rectRing, splitAntimeridian } from "@/lib/geo";
import { groundTrack, subpoint } from "@/lib/orbit";
import { satelliteSvg } from "@/lib/satellite-art";
import { SATELLITES, SIM_SPEED, simNow, type SatState } from "@/lib/sim";
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
function sphericalMidpoint(pts: [number, number][]): [number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [lon, lat] of pts) {
    const a = (lat * Math.PI) / 180;
    const o = (lon * Math.PI) / 180;
    x += Math.cos(a) * Math.cos(o);
    y += Math.cos(a) * Math.sin(o);
    z += Math.sin(a);
  }
  return [(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI];
}

function popupContent(eyebrow: string, title: string, lines: string[]) {
  const root = document.createElement("div");
  root.style.cssText = "padding:12px 14px;min-width:180px;font-family:var(--font-geist-sans),Arial,sans-serif";
  const add = (text: string, css: string) => {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = css;
    root.appendChild(el);
  };
  add(eyebrow, "color:#AEB8FF;font-size:10px;letter-spacing:1.5px;margin-bottom:6px");
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
        paint: { "line-color": "#AEB8FF", "line-width": 1.25, "line-opacity": 0.2 },
      });
      addLayer(map, {
        id: "track-future",
        type: "line",
        source: "track-future",
        paint: {
          "line-color": "#AEB8FF",
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
        coordinates: [
          s.polygon
            ? [...s.polygon, s.polygon[0]]
            : rectRing(s.lon, s.lat, s.widthKm, s.heightKm),
        ],
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

    const markers = new Map<string, { marker: Marker; el: HTMLButtonElement }>();
    for (const def of SATELLITES) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "sat-marker";
      el.title = def.name;
      el.setAttribute("aria-label", def.name);
      el.dataset.status = "TRANSIT";
      el.innerHTML =
        '<span class="sat-ring"></span><span class="sat-ring"></span>' +
        satelliteSvg({ className: "sat-art" });

      const label = document.createElement("span");
      label.className = "sat-label";
      const dot = document.createElement("span");
      dot.className = "sat-dot";
      const name = document.createElement("span");
      name.textContent = def.name.replace("TANAGER", "Tanager");
      label.append(dot, name);
      el.appendChild(label);

      const popup = new Popup({ offset: 28, closeButton: false });
      popup.on("open", () => {
        const s = satStatesRef.current?.find((x) => x.id === def.id);
        popup.setDOMContent(
          popupContent(
            def.name.replace("TANAGER", "Tanager"),
            s ? s.status.charAt(0) + s.status.slice(1).toLowerCase() : "In transit",
            s?.site ? [`${s.status === "COLLECTING" ? "Current" : "Next"} target: ${s.site.name}`] : [],
          ),
        );
      });

      markers.set(def.id, {
        el,
        marker: new Marker({ element: el, anchor: "center" })
          .setLngLat(subpoint(def.orbit, simNow()))
          .setPopup(popup)
          .addTo(map),
      });
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
      for (const def of SATELLITES) markers.get(def.id)?.marker.setLngLat(subpoint(def.orbit, t));
      const now = performance.now();
      if (now - lastTrack > 1000) {
        lastTrack = now;
        updateTracks(t);
        for (const def of SATELLITES) {
          const m = markers.get(def.id);
          const st = satStatesRef.current?.find((x) => x.id === def.id);
          if (m && st && m.el.dataset.status !== st.status) m.el.dataset.status = st.status;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      markers.forEach((m) => m.marker.remove());
    };
  }, [ready]);

  const fly = (view: "tanagers" | keyof typeof VIEWS) => {
    const map = mapRef.current;
    if (!map) return;
    if (view !== "tanagers") {
      map.easeTo({ ...VIEWS[view], duration: 1400 });
      return;
    }
    // Aim where the satellites will be when the camera arrives, since they move quickly.
    const duration = 1600;
    const t = simNow() + duration * SIM_SPEED;
    const pts = SATELLITES.map((d) => subpoint(d.orbit, t));
    const center = sphericalMidpoint(pts);
    const spanKm = pts.length > 1 ? Math.max(...pts.map((p) => haversineKm(p, center))) * 2 : 0;
    const zoom = Math.min(5, Math.max(0.8, Math.log2(28000 / Math.max(spanKm, 500) / Math.cos((center[1] * Math.PI) / 180))));
    map.easeTo({ center, zoom, duration });
  };

  return (
    <div className="absolute inset-0 bg-[#05060F]">
      <div
        ref={container}
        className="h-full w-full"
        aria-label="Simulated Tanager orbital operations map"
      />

      <div className="absolute left-5 top-5 z-10">
        <p className="text-sm font-medium text-slate-300">Live orbital view</p>
        <div className="mt-3 flex gap-2">
          {(["tanagers", "americas", "world"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => fly(v)}
              className="rounded-full border border-white/10 bg-[#0B0D1F]/75 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_6px_16px_-6px_rgba(0,0,0,0.6)] backdrop-blur-xl transition active:scale-95 hover:bg-white/10"
            >
              {v === "tanagers" ? "Tanagers" : v === "americas" ? "Americas" : "World"}
            </button>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute right-5 top-5 z-10 rounded-xl border border-white/10 bg-[#0B0D1F]/75 px-3 py-2 backdrop-blur">
        {TEAMS.map((t) => (
          <div key={t.id} className="flex items-center gap-2 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-sm" style={{ background: t.color }} aria-hidden />
            {t.short}
          </div>
        ))}
        <div className="mt-1.5 border-t border-white/10 pt-1.5 text-xs text-slate-500">
          Solid is funded, dashed is waitlisted
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-24 rounded-xl border border-white/10 bg-[#0B0D1F]/75 px-3 py-2 backdrop-blur">
        <p className="text-xs text-slate-500">Simulated orbital data</p>
      </div>
    </div>
  );
}
