import type { Team, Weights } from "./types";

/**
 * Fixed "now" for the demo so scores, dates and hydration are deterministic.
 * Swap for Date.now() once real data is wired in.
 */
export const DEMO_NOW = Date.UTC(2026, 9, 10, 17, 0, 0);
export const DAY = 86_400_000;

export const CYCLE = {
  id: "2026-10",
  label: "October 2026",
  start: Date.UTC(2026, 9, 1),
  end: Date.UTC(2026, 10, 1),
};

/** Abstract "tasking credits" CM can spend this cycle. Illustrative number. */
export const CYCLE_CAPACITY = 6000;
export const DEFAULT_RESERVE_PCT = 10;

export const TEAMS: Team[] = [
  { id: "og", name: "Oil & Gas", short: "O&G", color: "#FF9F43" },
  { id: "impact", name: "Impact", short: "Impact", color: "#FF6B9A" },
  { id: "science", name: "Science", short: "Science", color: "#4CC9F0" },
  { id: "waste", name: "Waste", short: "Waste", color: "#3DDC97" },
];

export const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<
  Team["id"],
  Team
>;

export const DEFAULT_WEIGHTS: Weights = {
  value: 40,
  urgency: 25,
  feasibility: 20,
  age: 15,
};

/** Tanager swath width, km. Check against Planet's current Tanager spec before going live. */
export const SWATH_KM = 18;

/** Demo basemap. One line to swap for OpenFreeMap / MapTiler later. */
export const BASEMAP_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
