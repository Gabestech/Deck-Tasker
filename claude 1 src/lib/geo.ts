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
