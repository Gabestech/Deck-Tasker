import { TEAM_BY_ID } from "@/lib/config";
import type { TeamAllocation } from "@/lib/types";
import { fmtNum, fmtPct } from "./ui";

/**
 * Share of cycle capacity per team. The tick marks each team's equal-share
 * (max-min fair) ideal, so over/under-service is visible at a glance.
 */
export function TeamShareBars({
  teams,
  compact = false,
}: {
  teams: TeamAllocation[];
  compact?: boolean;
}) {
  const max = Math.max(0.4, ...teams.map((t) => Math.max(t.share, t.idealShare))) * 1.1;

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      {teams.map((t) => {
        const team = TEAM_BY_ID[t.team];
        const diff = t.share - t.idealShare;
        return (
          <div key={t.team}>
            <div className="mb-1.5 flex items-baseline justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="h-2 w-2 rounded-full" style={{ background: team.color }} />
                {team.name}
              </span>
              <span className="tabular-nums text-slate-100">
                {fmtPct(t.share, 1)}
                {!compact && (
                  <span className="ml-2 text-slate-500">{fmtNum(t.allocated)} credits</span>
                )}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{ width: `${(t.share / max) * 100}%`, background: team.color }}
              />
              <div
                className="absolute -top-1 h-4 w-px bg-white/70"
                style={{ left: `${(t.idealShare / max) * 100}%` }}
                title={`Equal-share ideal ${fmtPct(t.idealShare, 1)}`}
              />
            </div>
            {!compact && (
              <p className="mt-1.5 text-[11px] text-slate-500">
                Requested {fmtNum(t.demand)} · {t.funded} funded · {t.waitlisted} waitlisted ·{" "}
                <span className={Math.abs(diff) < 0.01 ? "text-emerald-300/80" : "text-amber-200/80"}>
                  {diff >= 0 ? "+" : ""}
                  {(diff * 100).toFixed(1)} pts vs equal share
                </span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
