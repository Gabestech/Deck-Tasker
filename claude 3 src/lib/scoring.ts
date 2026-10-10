import { DAY, DEMO_NOW } from "./config";
import { getRegion } from "./regions";
import type { CollectionRequest, ScoreBreakdown, ScoredRequest, Weights } from "./types";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const CONTENTION_PENALTY = { low: 0.05, medium: 0.15, high: 0.3 } as const;

/**
 * Estimated chance of at least one usable collection inside the window (0-100).
 * Accounts for cloud climatology, how strict the cloud limit is, how many
 * overpass opportunities the window has, and external (Planet-wide) contention
 * that CM does not control. All inputs are demo values.
 */
export function estimateFeasibility(
  r: Pick<CollectionRequest, "regionId" | "cloudMax" | "windowStart" | "windowEnd">,
  now = DEMO_NOW,
) {
  const region = getRegion(r.regionId);
  const windowDays = Math.max(1, (r.windowEnd - Math.max(r.windowStart, now)) / DAY);
  const opportunities = Math.max(1, Math.floor(windowDays / 4));
  const cloudFactor = clamp(0.5 + r.cloudMax / 40, 0.6, 1.25);
  const perPass = clamp(region.clearSky * cloudFactor, 0.05, 0.95);
  const p = 1 - Math.pow(1 - perPass, opportunities);
  return Math.round(100 * p * (1 - CONTENTION_PENALTY[region.contention]));
}

export function scoreRequest(
  r: CollectionRequest,
  w: Weights,
  now = DEMO_NOW,
): ScoreBreakdown {
  const value = ((r.valueRating - 1) / 4) * 100;

  const daysLeft = Math.max(0, (r.windowEnd - now) / DAY);
  let urgency = daysLeft <= 3 ? 100 : daysLeft <= 7 ? 80 : daysLeft <= 14 ? 55 : daysLeft <= 30 ? 30 : 10;
  if (r.urgent) urgency = 100;

  const feasibility = estimateFeasibility(r, now);
  const age = Math.min(100, ((now - r.submittedAt) / DAY / 14) * 100);

  const sum = w.value + w.urgency + w.feasibility + w.age || 1;
  const total =
    (w.value * value + w.urgency * urgency + w.feasibility * feasibility + w.age * age) / sum;

  return { value, urgency, feasibility, age, total: Math.round(total * 10) / 10 };
}

export function scoreAll(requests: CollectionRequest[], w: Weights, now = DEMO_NOW): ScoredRequest[] {
  return requests.map((r) => ({ ...r, score: scoreRequest(r, w, now) }));
}
