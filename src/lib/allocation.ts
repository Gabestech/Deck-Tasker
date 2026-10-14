import { TEAMS, TEAM_BY_ID } from "./config";
import type {
  AllocatedRequest,
  AllocationResult,
  Policy,
  ScoredRequest,
  TeamAllocation,
  TeamId,
} from "./types";

export interface AllocationOptions {
  policy: Policy;
  capacity: number;
  reservePct: number;
}

type Num = Record<TeamId, number>;
const zero = (): Num => ({ og: 0, impact: 0, science: 0, waste: 0 });
const EPS = 1e-6;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * Max-min fair ("water-filling") split of `pool` credits across teams.
 *
 * Every team's total rises together to a common level L until the pool is
 * spent. A team never goes above its own demand, so a team that needs less
 * than an equal share frees the remainder for the others. `initial` is what a
 * team has already consumed (completed work, reserve draws); it counts toward
 * the team's level, so teams that already got more start higher.
 *
 * Returns each team's final total level (including `initial`).
 */
export function waterFill(demand: Num, initial: Num, pool: number): Num {
  const needed = (level: number) =>
    TEAMS.reduce(
      (sum, t) => sum + Math.max(0, Math.min(level, demand[t.id]) - initial[t.id]),
      0,
    );

  const maxDemand = Math.max(...TEAMS.map((t) => demand[t.id]), 0);
  let level: number;
  if (needed(maxDemand) <= pool + EPS) {
    level = maxDemand; // everyone's demand fits
  } else {
    let lo = 0;
    let hi = maxDemand;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (needed(mid) > pool) hi = mid;
      else lo = mid;
    }
    level = lo;
  }

  const out = zero();
  for (const t of TEAMS) {
    out[t.id] = Math.max(initial[t.id], Math.min(level, demand[t.id]));
  }
  return out;
}

/** Jain's fairness index: 1 when everyone is at their ideal, 1/n when one team takes everything. */
function jain(xs: number[]) {
  const n = xs.length;
  if (n === 0) return 1;
  const sum = xs.reduce((a, b) => a + b, 0);
  const sq = xs.reduce((a, b) => a + b * b, 0);
  return sq === 0 ? 1 : (sum * sum) / (n * sq);
}

export function allocate(scored: ScoredRequest[], opts: AllocationOptions): AllocationResult {
  const { policy, capacity, reservePct } = opts;
  const reserve = Math.round((capacity * reservePct) / 100);

  const byScore = (a: ScoredRequest, b: ScoredRequest) =>
    b.score.total - a.score.total || a.submittedAt - b.submittedAt;
  const byAge = (a: ScoredRequest, b: ScoredRequest) => a.submittedAt - b.submittedAt;

  // Rank by score across everything still open.
  const open = scored.filter((r) => !r.completed).sort(byScore);
  const rankOf = new Map(open.map((r, i) => [r.id, i + 1]));

  const out = new Map<string, AllocatedRequest>();
  const allocated = zero();
  const demand = zero();
  const set = (
    r: ScoredRequest,
    status: AllocatedRequest["status"],
    via: AllocatedRequest["via"],
    reason: string,
  ) => out.set(r.id, { ...r, status, via, reason, rank: rankOf.get(r.id) ?? 0 });

  for (const r of scored) demand[r.team] += r.creditCost;

  // Completed collections are already spent under every policy.
  const completedCost = zero();
  for (const r of scored.filter((x) => x.completed)) {
    completedCost[r.team] += r.creditCost;
    allocated[r.team] += r.creditCost;
    set(r, "completed", "completed", "Collected this cycle");
  }
  const spentOnCompleted = TEAMS.reduce((s, t) => s + completedCost[t.id], 0);
  const pending = scored.filter((r) => !r.completed);

  // Fairness yardstick, identical for every policy: max-min fair split of total capacity.
  const ideal = waterFill(demand, zero(), capacity);

  /** Credits each team may still spend on pending work (fair policy only), for explanations. */
  const left = zero();

  if (policy === "fair") {
    // 1) Rapid-response requests jump the queue using the reserve. They still
    //    count against their team's equal share below.
    const reserveUsed = zero();
    let reserveLeft = reserve;
    for (const r of pending.filter((x) => x.urgent).sort(byScore)) {
      if (r.creditCost <= reserveLeft + EPS) {
        reserveLeft -= r.creditCost;
        reserveUsed[r.team] += r.creditCost;
        allocated[r.team] += r.creditCost;
        set(r, "funded", "reserve", "Rapid-response reserve");
      }
    }

    // 2) Equal-share levels for everything else.
    const initial = zero();
    for (const t of TEAMS) initial[t.id] = completedCost[t.id] + reserveUsed[t.id];
    const reserveTotal = TEAMS.reduce((s, t) => s + reserveUsed[t.id], 0);
    const pool = capacity - spentOnCompleted - reserveTotal;
    const level = waterFill(demand, initial, pool);
    for (const t of TEAMS) left[t.id] = Math.max(0, level[t.id] - initial[t.id]);

    // 3) Within each team, fund by score. Skip what doesn't fit and keep going (backfill).
    for (const t of TEAMS) {
      const mine = pending.filter((r) => r.team === t.id && !out.has(r.id)).sort(byScore);
      for (const r of mine) {
        if (r.creditCost <= left[t.id] + EPS) {
          left[t.id] -= r.creditCost;
          allocated[t.id] += r.creditCost;
          set(r, "funded", "team", "Within team share");
        }
      }
    }

    // 4) Credits nobody could use (requests are indivisible): least-served team goes first.
    let leftover = capacity - TEAMS.reduce((s, t) => s + allocated[t.id], 0);
    for (;;) {
      const next = pending
        .filter((r) => !out.has(r.id) && r.creditCost <= leftover + EPS)
        .sort(
          (a, b) => allocated[a.team] - allocated[b.team] || b.score.total - a.score.total,
        )[0];
      if (!next) break;
      leftover -= next.creditCost;
      allocated[next.team] += next.creditCost;
      set(next, "funded", "backfill", "Spare credits");
    }

    // 5) Everything else waits, with a plain-language reason.
    for (const r of pending) {
      if (out.has(r.id)) continue;
      const short = TEAM_BY_ID[r.team].short;
      const room = Math.round(left[r.team]);
      set(r, "waitlisted", null, `Needs ${fmt(r.creditCost)} · ${short} has ${fmt(room)} left`);
    }
  } else {
    // Unfair baselines, for comparison. They use all capacity, no reserve.
    let room = capacity - spentOnCompleted;
    const ordered = [...pending].sort(policy === "priority" ? byScore : byAge);
    for (const r of ordered) {
      if (r.creditCost <= room + EPS) {
        room -= r.creditCost;
        allocated[r.team] += r.creditCost;
        set(
          r,
          "funded",
          "pool",
          policy === "priority" ? "High score" : "Submitted early",
        );
      }
    }
    for (const r of pending) {
      if (!out.has(r.id)) set(r, "waitlisted", null, "Credits ran out");
    }
  }

  const requests = [...out.values()].sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return 1;
    if (b.status === "completed" && a.status !== "completed") return -1;
    return a.rank - b.rank;
  });

  const teams: TeamAllocation[] = TEAMS.map((t) => {
    const mine = requests.filter((r) => r.team === t.id);
    return {
      team: t.id,
      demand: demand[t.id],
      allocated: allocated[t.id],
      share: capacity ? allocated[t.id] / capacity : 0,
      idealShare: capacity ? ideal[t.id] / capacity : 0,
      idealCredits: ideal[t.id],
      unmet: demand[t.id] - allocated[t.id],
      funded: mine.filter((r) => r.status !== "waitlisted").length,
      waitlisted: mine.filter((r) => r.status === "waitlisted").length,
    };
  });

  const ratios = TEAMS.filter((t) => ideal[t.id] > EPS).map(
    (t) => allocated[t.id] / ideal[t.id],
  );
  const totalDemand = TEAMS.reduce((s, t) => s + demand[t.id], 0);
  const totalAllocated = TEAMS.reduce((s, t) => s + allocated[t.id], 0);

  return {
    policy,
    capacity,
    reserve,
    requests,
    teams,
    totalDemand,
    totalAllocated,
    oversubscription: capacity ? totalDemand / capacity : 0,
    jain: jain(ratios),
  };
}
