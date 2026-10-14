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
import { formatLatLon, groundTrack, orbitalStats, subpoint } from "@/lib/orbit";
import { satelliteSvg } from "@/lib/satellite-art";
import { SATELLITES, SIM_SPEED, formatEta, simNow, type SatState, type SatelliteDef } from "@/lib/sim";
import type { TargetSite } from "@/lib/sites";

interface Props {
  sites: TargetSite[];
  /** Keys of sites a satellite is acquiring right now. */
  activeKeys: string[];
  satStates: SatState[] | null;
}

type FollowMode = "off" | "T1" | "T2" | "both";

type AddLayerArg = Parameters<MapLibreMap["addLayer"]>[0];
const addLayer = (map: MapLibreMap, spec: unknown) => map.addLayer(spec as AddLayerArg);

const ctl =
  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white";
const ctlOn = "bg-white/[0.12] text-white";

const emptyFC = { type: "FeatureCollection" as const, features: [] as never[] };

/** Zoom at which the whole globe fits the map box with a little margin. */
function globeFitZoom(el: HTMLElement) {
  const min = Math.min(el.clientWidth || 600, el.clientHeight || 600);
  // Globe diameter is roughly 163 px at zoom 0 and doubles per zoom level.
  return Math.min(2.2, Math.max(0, Math.log2((0.8 * min) / 163)));
}

/** Where the Tanagers are right now, as one point (falls back to the first if they're far apart). */
function tanagerCenter(t: number): [number, number] {
  const c = sphericalMidpoint(SATELLITES.map((d) => subpoint(d.orbit, t)));
  return [c[0], Math.max(-35, Math.min(35, c[1]))];
}

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
  // Points on opposite sides of the globe have no meaningful midpoint, so fall back to the first.
  if (Math.hypot(x, y, z) < 0.25 * pts.length) return pts[0];
  return [(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI];
}

/** Zoom that frames two points `spanKm` apart, centred at `lat`. */
function zoomForSpan(spanKm: number, lat: number) {
  const z = Math.log2(28000 / Math.max(spanKm, 500) / Math.cos((lat * Math.PI) / 180));
  return Math.min(5, Math.max(0.8, z));
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
  add(eyebrow, "color:#AEB8FF;font-size:11px;font-weight:600;margin-bottom:6px");
  add(title, "font-size:13px;font-weight:700");
  for (const l of lines) add(l, "color:#94a3b8;font-size:12px;margin-top:4px");
  return root;
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

/** Live status card for one satellite. Built from text nodes only, so site names can't inject markup. */
function buildSatCard(def: SatelliteDef) {
  const stats = orbitalStats(def.orbit);
  const root = node("div", "sat-card");

  const head = node("div", "sat-card-head");
  const glyph = node("div", "sat-card-glyph");
  glyph.innerHTML = satelliteSvg({ size: 32 });
  const title = node("div", "sat-card-title");
  title.append(
    node("div", "sat-card-name", def.name.replace("TANAGER", "Tanager")),
    node("div", "sat-card-sub", "Hyperspectral imager"),
  );
  const chip = node("span", "sat-card-chip", "In transit");
  head.append(glyph, title, chip);

  const body = node("div", "sat-card-body");
  const label = node("div", "sat-card-label");
  const target = node("div", "sat-card-target");
  const meta = node("div", "sat-card-meta");
  const teamDot = node("span", "sat-card-teamdot");
  const metaText = node("span", "");
  meta.append(teamDot, metaText);
  const prog = node("div", "sat-card-prog");
  const progRow = node("div", "sat-card-progrow");
  const progValue = node("span", "");
  progRow.append(node("span", "", "Acquisition"), progValue);
  const bar = node("div", "sat-card-bar");
  const fill = node("span", "");
  bar.append(fill);
  prog.append(progRow, bar);
  const eta = node("div", "sat-card-eta");
  body.append(label, target, meta, prog, eta);

  const foot = node("div", "sat-card-foot");
  const cell = (k: string, v = "") => {
    const c = node("div", "");
    const val = node("div", "sat-card-v", v);
    c.append(node("div", "sat-card-k", k), val);
    foot.append(c);
    return val;
  };
  const pos = cell("Position");
  cell("Altitude", `${Math.round(stats.altKm)} km`);
  cell("Speed", `${stats.speedKmS.toFixed(1)} km/s`);

  root.append(head, body, foot);

  const update = (s: SatState | undefined) => {
    const collecting = s?.status === "COLLECTING";
    chip.textContent = collecting ? "Collecting" : "In transit";
    chip.dataset.status = s?.status ?? "TRANSIT";
    label.textContent = collecting ? "Imaging now" : "Next target";
    if (s?.site) {
      const team = TEAM_BY_ID[s.site.team];
      target.textContent = s.site.name;
      teamDot.style.background = team.color;
      metaText.textContent = `${team.name} · ${s.site.funded} funded request${s.site.funded === 1 ? "" : "s"}`;
      meta.style.display = "flex";
    } else {
      target.textContent = "No funded target ahead";
      meta.style.display = "none";
    }
    prog.style.display = collecting ? "block" : "none";
    if (collecting && s) {
      const pct = Math.round(s.progress * 100);
      progValue.textContent = `${pct}%`;
      fill.style.width = `${pct}%`;
    }
    const showEta = !collecting && s?.etaMs != null;
    eta.style.display = showEta ? "block" : "none";
    if (showEta && s?.etaMs != null) eta.textContent = `Starts in ${formatEta(s.etaMs)}`;
    if (s) pos.textContent = formatLatLon(s.pos[0], s.pos[1]);
  };

  return { root, update };
}

export default function OrbitalMap({ sites, activeKeys, satStates }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const satStatesRef = useRef<SatState[] | null>(satStates);
  const [ready, setReady] = useState(false);
  const [follow, setFollow] = useState<FollowMode>("off");
  const followRef = useRef<{ mode: FollowMode; zoomUntil: number }>({ mode: "off", zoomUntil: 0 });

  const setFollowMode = (mode: FollowMode) => {
    followRef.current = { mode, zoomUntil: mode === "off" ? 0 : performance.now() + 1800 };
    setFollow(mode);
  };

  useEffect(() => {
    satStatesRef.current = satStates;
  }, [satStates]);

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;

    const map = new MapLibreMap({
      container: container.current,
      style: BASEMAP_STYLE_URL,
      // Parked on the whole globe with the Tanagers in the middle. Zoom in from there.
      center: tanagerCenter(simNow()),
      zoom: globeFitZoom(container.current),
      minZoom: 0.5,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new NavigationControl({ showCompass: false, showZoom: true }), "bottom-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    // Compact attribution starts expanded on small screens; keep it as the small (i) until tapped.
    const collapseAttribution = () =>
      container.current
        ?.querySelectorAll(".maplibregl-ctrl-attrib.maplibregl-compact-show")
        .forEach((el) => el.classList.remove("maplibregl-compact-show"));
    map.once("load", collapseAttribution);
    map.once("idle", collapseAttribution);

    map.on("style.load", () => {
      // Globe projection (MapLibre GL JS 5+): zoom out and the world becomes a sphere.
      map.setProjection({ type: "globe" });

      // Tint the basemap to the app palette: land a touch lighter than the ocean so continents read.
      const LAND = "#161A3A";
      const OCEAN = "#070917";
      for (const l of map.getStyle().layers) {
        if (l.type === "background") map.setPaintProperty(l.id, "background-color", LAND);
        else if (l.type === "fill" && /water/i.test(l.id)) map.setPaintProperty(l.id, "fill-color", OCEAN);
        else if (l.type === "fill" && /landcover|landuse|park/i.test(l.id)) map.setPaintProperty(l.id, "fill-color", LAND);
        else if (l.type === "line" && /boundary/i.test(l.id)) map.setPaintProperty(l.id, "line-color", "#454E8C");
      }
      // Soft atmosphere halo around the globe. Skipped quietly if this build lacks it.
      try {
        map.setSky({
          "sky-color": "#12163A",
          "horizon-color": "#8F9CFF",
          "fog-color": "#0B0D1F",
          "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
        } as unknown as Parameters<MapLibreMap["setSky"]>[0]);
      } catch {
        /* no atmosphere */
      }

      map.addSource("sites", { type: "geojson", data: emptyFC });
      map.addSource("site-dots", { type: "geojson", data: emptyFC });
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
      // Footprints are tiny at world scale, so one dot per target stands in until you zoom in.
      addLayer(map, {
        id: "site-glow",
        type: "circle",
        source: "site-dots",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 9, 5, 16],
          "circle-blur": 1,
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.35, 7, 0],
        },
      });
      addLayer(map, {
        id: "site-points",
        type: "circle",
        source: "site-dots",
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
            popupContent("Collection target", String(p.name), [
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

    // Grabbing the map hands control back to the user.
    map.on("dragstart", () => setFollowMode("off"));
    map.on("rotatestart", () => setFollowMode("off"));

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
    (map.getSource("site-dots") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: sites.map((s, i) => ({
        type: "Feature" as const,
        properties: features[i].properties,
        geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
      })),
    });
  }, [sites, activeKeys, ready]);

  // Satellite markers + ground tracks. One animation loop, cancelled on unmount.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    type Item = {
      marker: Marker;
      el: HTMLButtonElement;
      popup: Popup;
      card: ReturnType<typeof buildSatCard>;
      pinned: boolean;
    };
    const items = new Map<string, Item>();
    const stateOf = (id: string) => satStatesRef.current?.find((x) => x.id === id);

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

      const card = buildSatCard(def);
      const popup = new Popup({ offset: 36, closeButton: false, closeOnClick: false, maxWidth: "320px" });
      popup.setDOMContent(card.root);
      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat(subpoint(def.orbit, simNow()))
        .addTo(map);
      const item: Item = { marker, el, popup, card, pinned: false };
      items.set(def.id, item);

      // Hover previews the card, click pins it, clicking the map unpins.
      const open = () => {
        if (!popup.isOpen()) popup.setLngLat(marker.getLngLat()).addTo(map);
        card.update(stateOf(def.id));
      };
      const close = () => {
        if (popup.isOpen()) popup.remove();
      };
      el.addEventListener("mouseenter", open);
      el.addEventListener("focus", open);
      el.addEventListener("mouseleave", () => {
        if (!item.pinned) close();
      });
      el.addEventListener("blur", () => {
        if (!item.pinned) close();
      });
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        item.pinned = !item.pinned;
        if (item.pinned) open();
        else close();
      });
    }
    const unpinAll = () =>
      items.forEach((it) => {
        it.pinned = false;
        if (it.popup.isOpen()) it.popup.remove();
      });
    map.on("click", unpinAll);

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
      for (const def of SATELLITES) {
        const it = items.get(def.id);
        if (!it) continue;
        const pos = subpoint(def.orbit, t);
        it.marker.setLngLat(pos);
        if (it.popup.isOpen()) it.popup.setLngLat(pos);
      }

      const f = followRef.current;
      if (f.mode !== "off") {
        const defs = f.mode === "both" ? SATELLITES : SATELLITES.filter((d) => d.id === f.mode);
        const pts = defs.map((d) => subpoint(d.orbit, t));
        const target = sphericalMidpoint(pts);
        const c = map.getCenter();
        const dLng = ((target[0] - c.lng + 540) % 360) - 180;
        const next: [number, number] = [c.lng + dLng * 0.14, c.lat + (target[1] - c.lat) * 0.14];
        let zoom = map.getZoom();
        if (performance.now() < f.zoomUntil) {
          const span = pts.length > 1 ? Math.max(...pts.map((p) => haversineKm(p, target))) * 2 : 0;
          const tz = pts.length > 1 ? zoomForSpan(span, target[1]) : 4.2;
          zoom += (tz - zoom) * 0.08;
        }
        map.jumpTo({ center: next, zoom });
      }

      const now = performance.now();
      if (now - lastTrack > 1000) {
        lastTrack = now;
        updateTracks(t);
        for (const def of SATELLITES) {
          const it = items.get(def.id);
          const st = stateOf(def.id);
          if (!it || !st) continue;
          if (it.el.dataset.status !== st.status) it.el.dataset.status = st.status;
          if (it.popup.isOpen()) it.card.update(st);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      map.off("click", unpinAll);
      items.forEach((it) => {
        it.popup.remove();
        it.marker.remove();
      });
    };
  }, [ready]);

  const fly = (view: "tanagers" | "world") => {
    const map = mapRef.current;
    if (!map) return;
    setFollowMode("off");
    if (view === "world") {
      map.easeTo({ center: tanagerCenter(simNow()), zoom: globeFitZoom(map.getContainer()), duration: 1400 });
      return;
    }
    // Aim where the satellites will be when the camera arrives, since they move quickly.
    const duration = 1600;
    const t = simNow() + duration * SIM_SPEED;
    const pts = SATELLITES.map((d) => subpoint(d.orbit, t));
    const center = sphericalMidpoint(pts);
    const spanKm = pts.length > 1 ? Math.max(...pts.map((p) => haversineKm(p, center))) * 2 : 0;
    map.easeTo({ center, zoom: zoomForSpan(spanKm, center[1]), duration });
  };

  return (
    <div className="absolute inset-0 bg-[#05060F]">
      <div
        ref={container}
        className="h-full w-full"
        aria-label="Simulated Tanager orbital operations map"
      />

      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-2 sm:left-4 sm:top-4">
        <div className="flex rounded-lg border border-white/10 bg-[#0B0D1F]/80 p-0.5 backdrop-blur-xl">
          <button type="button" onClick={() => fly("world")} className={ctl}>
            World
          </button>
          <button type="button" onClick={() => fly("tanagers")} className={ctl}>
            Tanagers
          </button>
          <button
            type="button"
            aria-pressed={follow !== "off"}
            onClick={() => setFollowMode(follow === "off" ? "T1" : "off")}
            title="Keep the camera on a satellite. Drag the map to stop."
            className={`${ctl} ${follow !== "off" ? ctlOn : ""}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${follow !== "off" ? "bg-emerald-400" : "bg-slate-500"}`}
              aria-hidden
            />
            Follow
          </button>
        </div>
        {follow !== "off" && (
          <div className="flex rounded-lg border border-white/10 bg-[#0B0D1F]/80 p-0.5 backdrop-blur-xl">
            {[
              ...SATELLITES.map((d) => ({ id: d.id as FollowMode, label: d.name.replace("TANAGER-", "T") })),
              { id: "both" as FollowMode, label: "Both" },
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setFollowMode(o.id)}
                className={`${ctl} ${follow === o.id ? ctlOn : ""}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2.5 rounded-md bg-[#0B0D1F]/70 px-2 py-1 backdrop-blur sm:left-4 sm:gap-3"
        title="Solid outline: funded. Dashed: waitlisted."
      >
        {TEAMS.map((t) => (
          <span key={t.id} className="flex items-center gap-1 text-[10px] text-slate-400 sm:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} aria-hidden />
            {t.short}
          </span>
        ))}
      </div>
    </div>
  );
}
