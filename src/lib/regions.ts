import { haversineKm } from "./geo";
import type { Region } from "./types";

/** Demo regions. Clear-sky and contention values are made up for the prototype. */
export const REGIONS: Region[] = [
  { id: "permian", name: "Permian Basin", area: "TX / NM, USA", lon: -102.1, lat: 31.9, clearSky: 0.72, contention: "high", defaultWidthKm: 18, defaultHeightKm: 80 },
  { id: "eagle-ford", name: "Eagle Ford Shale", area: "TX, USA", lon: -98.5, lat: 28.6, clearSky: 0.6, contention: "medium", defaultWidthKm: 18, defaultHeightKm: 70 },
  { id: "bakken", name: "Bakken Formation", area: "ND, USA", lon: -103.0, lat: 47.8, clearSky: 0.58, contention: "low", defaultWidthKm: 18, defaultHeightKm: 70 },
  { id: "haynesville", name: "Haynesville Shale", area: "LA / TX, USA", lon: -93.7, lat: 32.3, clearSky: 0.5, contention: "medium", defaultWidthKm: 18, defaultHeightKm: 60 },
  { id: "marcellus", name: "Marcellus Shale", area: "PA / WV, USA", lon: -80.3, lat: 40.3, clearSky: 0.38, contention: "low", defaultWidthKm: 18, defaultHeightKm: 60 },
  { id: "dj", name: "Denver-Julesburg Basin", area: "CO, USA", lon: -104.7, lat: 40.1, clearSky: 0.68, contention: "medium", defaultWidthKm: 18, defaultHeightKm: 60 },
  { id: "uinta", name: "Uinta Basin", area: "UT, USA", lon: -109.6, lat: 40.2, clearSky: 0.7, contention: "low", defaultWidthKm: 18, defaultHeightKm: 50 },
  { id: "san-juan", name: "San Juan Basin", area: "NM / CO, USA", lon: -107.6, lat: 36.7, clearSky: 0.72, contention: "medium", defaultWidthKm: 18, defaultHeightKm: 70 },
  { id: "bakersfield", name: "Kern County", area: "CA, USA", lon: -119.0, lat: 35.4, clearSky: 0.78, contention: "low", defaultWidthKm: 18, defaultHeightKm: 50 },
  { id: "la-basin", name: "Los Angeles Basin", area: "CA, USA", lon: -118.2, lat: 34.0, clearSky: 0.7, contention: "medium", defaultWidthKm: 18, defaultHeightKm: 40 },
  { id: "alberta", name: "Alberta Oil Sands", area: "AB, Canada", lon: -111.4, lat: 57.0, clearSky: 0.5, contention: "low", defaultWidthKm: 18, defaultHeightKm: 80 },
  { id: "turkmenistan", name: "Caspian Coast", area: "Turkmenistan", lon: 54.1, lat: 39.0, clearSky: 0.8, contention: "low", defaultWidthKm: 18, defaultHeightKm: 70 },
  { id: "hassi", name: "Hassi Messaoud", area: "Algeria", lon: 6.1, lat: 31.7, clearSky: 0.9, contention: "low", defaultWidthKm: 18, defaultHeightKm: 60 },
  { id: "houston", name: "Houston Landfills", area: "TX, USA", lon: -95.4, lat: 29.7, clearSky: 0.45, contention: "medium", defaultWidthKm: 18, defaultHeightKm: 30 },
  { id: "delhi", name: "Delhi-NCR Landfills", area: "India", lon: 77.3, lat: 28.6, clearSky: 0.55, contention: "medium", defaultWidthKm: 18, defaultHeightKm: 40 },
  { id: "mumbai", name: "Mumbai Landfills", area: "India", lon: 72.9, lat: 19.1, clearSky: 0.4, contention: "low", defaultWidthKm: 18, defaultHeightKm: 30 },
  { id: "sao-paulo", name: "São Paulo Landfills", area: "Brazil", lon: -46.6, lat: -23.5, clearSky: 0.42, contention: "low", defaultWidthKm: 18, defaultHeightKm: 30 },
  { id: "buenos-aires", name: "Buenos Aires Landfills", area: "Argentina", lon: -58.4, lat: -34.7, clearSky: 0.5, contention: "low", defaultWidthKm: 18, defaultHeightKm: 30 },
];

export const CUSTOM_REGION: Region = {
  id: "custom",
  name: "Custom AOI",
  area: "User defined",
  lon: 0,
  lat: 0,
  clearSky: 0.6,
  contention: "low",
  defaultWidthKm: 18,
  defaultHeightKm: 50,
};

export function getRegion(id: string): Region {
  return REGIONS.find((r) => r.id === id) ?? CUSTOM_REGION;
}

/* ---- Restricted-area checks (approximate, demo only) ----
 * Planet's published Tanager restrictions: tasking in all of California, and
 * portions of the Midland/Delaware Basins (Methane Monitoring offering), needs
 * prior authorization. Polygons below are rough stand-ins.
 */
const CALIFORNIA: [number, number][] = [
  [-124.4, 42.0], [-120.0, 42.0], [-120.0, 39.0], [-114.6, 35.0], [-114.7, 32.7],
  [-117.1, 32.5], [-120.6, 34.5], [-122.4, 37.2], [-123.8, 39.5], [-124.4, 40.4],
];
const MIDLAND_DELAWARE: [number, number, number, number] = [-104.8, 30.8, -100.8, 33.3];

function inPolygon(lon: number, lat: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export interface RestrictionHit {
  id: "california" | "midland-delaware";
  title: string;
  detail: string;
}

export function restrictionsFor(lon: number, lat: number): RestrictionHit[] {
  const hits: RestrictionHit[] = [];
  if (inPolygon(lon, lat, CALIFORNIA)) {
    hits.push({
      id: "california",
      title: "California tasking is restricted",
      detail:
        "Planet limits Tanager tasking in California to customers with prior authorization.",
    });
  }
  const [w, s, e, n] = MIDLAND_DELAWARE;
  if (lon >= w && lon <= e && lat >= s && lat <= n) {
    hits.push({
      id: "midland-delaware",
      title: "Midland / Delaware Basin restrictions may apply",
      detail:
        "Portions of these basins are restricted for the Methane Monitoring offering. Boundary shown here is approximate.",
    });
  }
  return hits;
}

/** Closest preset region within maxKm, used to borrow cloud climatology for hand-picked AOIs. */
export function nearestRegion(lon: number, lat: number, maxKm = 150): Region | null {
  let best: { r: Region; d: number } | null = null;
  for (const r of REGIONS) {
    const d = haversineKm([lon, lat], [r.lon, r.lat]);
    if (d <= maxKm && (!best || d < best.d)) best = { r, d };
  }
  return best?.r ?? null;
}
