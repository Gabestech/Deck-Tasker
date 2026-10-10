/*
 * Simplified two-body circular orbit for the demo. NOT real ephemeris.
 * Good enough for a believable sun-synchronous ground track. Swap for
 * satellite.js + real TLEs later (see OrbitalMap / sim.ts call sites).
 */

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const EARTH_ROT_DEG_PER_S = 360 / 86164.0905;

export interface Orbit {
  inclDeg: number;
  periodMin: number;
  /** Argument of latitude at epoch, degrees. */
  u0Deg: number;
  /** Geographic longitude of the ascending node at epoch, degrees. */
  ascNodeLonDeg: number;
  epochMs: number;
}

export function wrapLon(lon: number) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export function subpoint(o: Orbit, tMs: number): [number, number] {
  const dt = (tMs - o.epochMs) / 1000;
  const u = rad(o.u0Deg) + ((2 * Math.PI) / (o.periodMin * 60)) * dt;
  const i = rad(o.inclDeg);
  const lat = deg(Math.asin(Math.sin(i) * Math.sin(u)));
  const alpha = deg(Math.atan2(Math.cos(i) * Math.sin(u), Math.cos(u)));
  const lon = wrapLon(alpha + o.ascNodeLonDeg - EARTH_ROT_DEG_PER_S * dt);
  return [lon, lat];
}

/** Build an orbit whose ground track passes exactly over (lon, lat) at `epochMs`. */
export function orbitOverPoint(
  lon: number,
  lat: number,
  opts: { epochMs: number; descending: boolean; inclDeg?: number; periodMin?: number },
): Orbit {
  const inclDeg = opts.inclDeg ?? 97.4;
  const periodMin = opts.periodMin ?? 94.6;
  const s = Math.sin(rad(lat)) / Math.sin(rad(inclDeg));
  const base = Math.asin(Math.max(-1, Math.min(1, s)));
  const u = opts.descending ? Math.PI - base : base;
  const alpha = deg(Math.atan2(Math.cos(rad(inclDeg)) * Math.sin(u), Math.cos(u)));
  return {
    inclDeg,
    periodMin,
    u0Deg: deg(u),
    ascNodeLonDeg: wrapLon(lon - alpha),
    epochMs: opts.epochMs,
  };
}

export function groundTrack(
  o: Orbit,
  fromMs: number,
  toMs: number,
  stepMs: number,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let t = fromMs; t <= toMs; t += stepMs) pts.push(subpoint(o, t));
  return pts;
}
