import { DEMO_NOW } from "./config";
import { haversineKm } from "./geo";
import { orbitOverPoint, subpoint, type Orbit } from "./orbit";
import type { TargetSite } from "./sites";

/** How much faster than real time the demo orbits run. */
export const SIM_SPEED = 8;
/** A satellite is "acquiring" a site while its ground point is within this distance. */
export const ACQ_RADIUS_KM = 350;

let wall0: number | null = null;
/** Simulated clock (ms since epoch). Client only. Continues across in-app navigation. */
export function simNow() {
  if (wall0 === null) wall0 = performance.now();
  return DEMO_NOW + (performance.now() - wall0) * SIM_SPEED;
}

export interface SatelliteDef {
  id: string;
  name: string;
  orbit: Orbit;
}

/*
 * Phased so that Tanager-1 is already crossing the Permian when the page
 * loads, and Tanager-2 approaches the San Juan Basin a few minutes later.
 */
export const SATELLITES: SatelliteDef[] = [
  {
    id: "T1",
    name: "TANAGER-1",
    orbit: orbitOverPoint(-102.1, 31.9, { epochMs: DEMO_NOW + 25_000, descending: true }),
  },
  {
    id: "T2",
    name: "TANAGER-2",
    orbit: orbitOverPoint(-107.6, 36.7, {
      epochMs: DEMO_NOW + 11 * 60_000,
      descending: false,
    }),
  },
];

export interface SatState {
  id: string;
  name: string;
  pos: [number, number];
  status: "COLLECTING" | "TRANSIT";
  site: TargetSite | null;
  /** 0..1 progress through the acquisition arc while collecting. */
  progress: number;
  /** Simulated ms until the next acquisition starts (TRANSIT only). */
  etaMs: number | null;
}

function nearestInRange(pos: [number, number], sites: TargetSite[]) {
  let best: { site: TargetSite; d: number } | null = null;
  for (const s of sites) {
    const d = haversineKm(pos, [s.lon, s.lat]);
    if (d <= ACQ_RADIUS_KM && (!best || d < best.d)) best = { site: s, d };
  }
  return best;
}

export function satState(def: SatelliteDef, t: number, sites: TargetSite[]): SatState {
  const pos = subpoint(def.orbit, t);
  const here = nearestInRange(pos, sites);

  if (here) {
    const later = subpoint(def.orbit, t + 10_000);
    const dLater = haversineKm(later, [here.site.lon, here.site.lat]);
    const approaching = dLater < here.d;
    const f = here.d / ACQ_RADIUS_KM;
    return {
      id: def.id,
      name: def.name,
      pos,
      status: "COLLECTING",
      site: here.site,
      progress: approaching ? 0.5 * (1 - f) : 0.5 + 0.5 * f,
      etaMs: null,
    };
  }

  const STEP = 45_000;
  const HORIZON = 12 * 3_600_000;
  for (let dt = STEP; dt <= HORIZON; dt += STEP) {
    const hit = nearestInRange(subpoint(def.orbit, t + dt), sites);
    if (hit) {
      return {
        id: def.id,
        name: def.name,
        pos,
        status: "TRANSIT",
        site: hit.site,
        progress: 0,
        etaMs: dt,
      };
    }
  }
  return { id: def.id, name: def.name, pos, status: "TRANSIT", site: null, progress: 0, etaMs: null };
}

export function formatEta(ms: number) {
  const m = Math.round(ms / 60_000);
  if (m < 1) return "< 1 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}
