const R_EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(a: [number, number], b: [number, number]) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Rectangle polygon ring (lon/lat) around a centre, sized in km. Good enough away from the poles. */
export function rectRing(
  lon: number,
  lat: number,
  widthKm: number,
  heightKm: number,
): [number, number][] {
  const dLat = deg(heightKm / 2 / R_EARTH_KM);
  const dLon = deg(widthKm / 2 / (R_EARTH_KM * Math.cos(rad(lat))));
  return [
    [lon - dLon, lat - dLat],
    [lon + dLon, lat - dLat],
    [lon + dLon, lat + dLat],
    [lon - dLon, lat + dLat],
    [lon - dLon, lat - dLat],
  ];
}

/** Split a lon/lat path wherever it crosses the antimeridian so lines don't streak across the map. */
export function splitAntimeridian(path: [number, number][]): [number, number][][] {
  const parts: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (const p of path) {
    const prev = cur[cur.length - 1];
    if (prev && Math.abs(p[0] - prev[0]) > 180) {
      parts.push(cur);
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length) parts.push(cur);
  return parts.filter((p) => p.length > 1);
}

/* ------------------------------------------------------------------ */
/* Polygon helpers (area-of-interest drawing)                          */
/* ------------------------------------------------------------------ */

/** Open ring of [lon, lat] vertices. The closing point is NOT repeated. */
export type Ring = [number, number][];

const KM_PER_DEG = (Math.PI / 180) * R_EARTH_KM;

/** Project to a local flat km grid around the ring's bounding-box centre. Fine for AOI-sized shapes. */
function toLocalKm(ring: Ring) {
  const b = bboxDeg(ring);
  const lon0 = (b.minLon + b.maxLon) / 2;
  const lat0 = (b.minLat + b.maxLat) / 2;
  const k = Math.cos(rad(lat0));
  return {
    lon0,
    lat0,
    k,
    pts: ring.map(([lon, lat]) => [(lon - lon0) * k * KM_PER_DEG, (lat - lat0) * KM_PER_DEG] as [number, number]),
  };
}

export function bboxDeg(ring: Ring) {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return { minLon, maxLon, minLat, maxLat };
}

/** Planar polygon area in km² (shoelace on a local projection). */
export function polygonAreaKm2(ring: Ring): number {
  if (ring.length < 3) return 0;
  const { pts } = toLocalKm(ring);
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** Bounding box centre and its width/height in km. */
export function bboxKm(ring: Ring) {
  const b = bboxDeg(ring);
  const lon = (b.minLon + b.maxLon) / 2;
  const lat = (b.minLat + b.maxLat) / 2;
  return {
    lon,
    lat,
    widthKm: (b.maxLon - b.minLon) * Math.cos(rad(lat)) * KM_PER_DEG,
    heightKm: (b.maxLat - b.minLat) * KM_PER_DEG,
  };
}

/** Area centroid, falling back to the bounding-box centre for degenerate shapes. */
export function polygonCentroid(ring: Ring): [number, number] {
  const { lon0, lat0, k, pts } = toLocalKm(ring);
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-9) return [lon0, lat0];
  cx /= 3 * a;
  cy /= 3 * a;
  return [lon0 + cx / (KM_PER_DEG * k), lat0 + cy / KM_PER_DEG];
}

function orient(a: [number, number], b: [number, number], c: [number, number]) {
  const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

function segmentsCross(p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number]) {
  return orient(p1, p2, p3) !== orient(p1, p2, p4) && orient(p3, p4, p1) !== orient(p3, p4, p2);
}

/** True if any two non-adjacent edges of the closed ring cross. */
export function ringSelfIntersects(ring: Ring): boolean {
  const n = ring.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = ring[i];
    const a2 = ring[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsCross(a1, a2, ring[j], ring[(j + 1) % n])) return true;
    }
  }
  return false;
}

export const MAX_RING_VERTICES = 500;

/** Pull the first polygon's outer ring out of any common GeoJSON shape. */
export function extractPolygon(input: unknown): { ring: Ring } | { error: string } {
  const find = (g: unknown): unknown[] | null => {
    if (!g || typeof g !== "object") return null;
    const o = g as { type?: string; coordinates?: unknown; geometry?: unknown; features?: unknown[]; geometries?: unknown[] };
    if (o.type === "Polygon" && Array.isArray(o.coordinates)) return o.coordinates[0] as unknown[];
    if (o.type === "MultiPolygon" && Array.isArray(o.coordinates)) {
      const first = o.coordinates[0] as unknown[] | undefined;
      return first ? (first[0] as unknown[]) : null;
    }
    if (o.type === "Feature") return find(o.geometry);
    if (o.type === "FeatureCollection" && Array.isArray(o.features)) {
      for (const f of o.features) {
        const r = find(f);
        if (r) return r;
      }
    }
    if (o.type === "GeometryCollection" && Array.isArray(o.geometries)) {
      for (const f of o.geometries) {
        const r = find(f);
        if (r) return r;
      }
    }
    return null;
  };

  const raw = find(input);
  if (!raw) return { error: "No polygon found. Upload a GeoJSON Polygon, MultiPolygon or Feature." };

  const ring: Ring = [];
  for (const p of raw) {
    if (!Array.isArray(p) || typeof p[0] !== "number" || typeof p[1] !== "number") {
      return { error: "That file has coordinates the tool can't read." };
    }
    if (Math.abs(p[0]) > 180 || Math.abs(p[1]) > 85) {
      return { error: "Coordinates must be longitude/latitude (WGS84)." };
    }
    ring.push([Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4]);
  }
  const f = ring[0];
  const l = ring[ring.length - 1];
  if (ring.length > 1 && f[0] === l[0] && f[1] === l[1]) ring.pop();
  if (ring.length < 3) return { error: "A polygon needs at least 3 points." };
  if (ring.length > MAX_RING_VERTICES) {
    return { error: `That outline has ${ring.length} points. Simplify it to ${MAX_RING_VERTICES} or fewer.` };
  }
  if (ringSelfIntersects(ring)) return { error: "That outline crosses itself. Fix it and upload again." };
  return { ring };
}
