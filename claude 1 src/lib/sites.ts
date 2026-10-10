import type { AllocatedRequest, TeamId } from "./types";
import { getRegion } from "./regions";

/** One place on the map. Several requests over the same spot collapse into one site. */
export interface TargetSite {
  key: string;
  name: string;
  lon: number;
  lat: number;
  widthKm: number;
  heightKm: number;
  funded: number;
  waitlisted: number;
  team: TeamId;
  topRequest: string;
  clearSky: number;
}

export function buildSites(requests: AllocatedRequest[]): TargetSite[] {
  const map = new Map<string, TargetSite>();
  // requests arrive ranked, so the first one we see for a site is its top request
  for (const r of requests) {
    if (r.completed) continue;
    const key = `${r.lon.toFixed(2)},${r.lat.toFixed(2)}`;
    const region = getRegion(r.regionId);
    let site = map.get(key);
    if (!site) {
      site = {
        key,
        name: region.id === "custom" ? r.name : region.name,
        lon: r.lon,
        lat: r.lat,
        widthKm: r.widthKm,
        heightKm: r.heightKm,
        funded: 0,
        waitlisted: 0,
        team: r.team,
        topRequest: r.id,
        clearSky: region.clearSky,
      };
      map.set(key, site);
    }
    site.heightKm = Math.max(site.heightKm, r.heightKm);
    site.widthKm = Math.max(site.widthKm, r.widthKm);
    if (r.status === "waitlisted") site.waitlisted += 1;
    else site.funded += 1;
  }
  return [...map.values()];
}
