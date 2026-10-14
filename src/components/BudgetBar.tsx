import { TEAM_BY_ID } from "@/lib/config";
import type { AllocationResult } from "@/lib/types";
import { fmtNum } from "./ui";

// Matches the amber "more asked than available" text above the bar (Tailwind amber-200).
const OVER = "253, 230, 138";

/**
 * One bar for the whole cycle: what each team received, drawn to scale against
 * everything that was asked for. Past the capacity line is demand that doesn't fit.
 */
export function BudgetBar({
  allocation,
  compact = false,
}: {
  allocation: Pick<AllocationResult, "capacity" | "totalDemand" | "totalAllocated" | "teams">;
  compact?: boolean;
}) {
  const { capacity, totalDemand, totalAllocated, teams } = allocation;
  const scale = Math.max(totalDemand, capacity, 1);
  const pct = (n: number) => `${(Math.max(0, n) / scale) * 100}%`;
  const over = totalDemand - capacity;
  const unused = capacity - totalAllocated;
  const capPct = (capacity / scale) * 100;

  return (
    <div>
      <div className="relative">
        <div className={`flex overflow-hidden rounded-md bg-white/[0.04] ${compact ? "h-2.5" : "h-8"}`}>
          {teams.map((t) => (
            <div
              key={t.team}
              className="h-full border-r border-[#0B0D1F]/70 last:border-r-0"
              style={{ width: pct(t.allocated), background: TEAM_BY_ID[t.team].color }}
              title={`${TEAM_BY_ID[t.team].name}: ${fmtNum(t.allocated)} credits`}
            />
          ))}
          {unused > 0.5 && (
            <div className="h-full bg-white/10" style={{ width: pct(unused) }} title={`${fmtNum(unused)} unassigned`} />
          )}
          {over > 0 && (
            <div
              className="h-full"
              style={{
                width: pct(over),
                backgroundColor: `rgba(${OVER}, 0.08)`,
                backgroundImage: `repeating-linear-gradient(135deg, rgba(${OVER}, 0.55) 0 3px, transparent 3px 9px)`,
              }}
              title={`${fmtNum(over)} credits asked for beyond capacity`}
            />
          )}
        </div>

        {/* Capacity threshold: sticks out above and below the bar so it reads as a limit */}
        {over > 0 && (
          <div
            className={`pointer-events-none absolute w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)] ${
              compact ? "-inset-y-1" : "-inset-y-2"
            }`}
            style={{ left: `${capPct}%` }}
            aria-hidden
          />
        )}
      </div>

      {!compact && (
        <div className="relative mt-3 h-5 tabular-nums">
          <span className="absolute left-0 text-[11px] text-slate-500">0</span>
          {over > 0 ? (
            <>
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap text-sm font-semibold text-white"
                style={{ left: `${capPct}%` }}
              >
                {fmtNum(capacity)} available
              </span>
              <span className="absolute right-0 whitespace-nowrap text-xs text-amber-200">
                {fmtNum(totalDemand)} asked
              </span>
            </>
          ) : (
            <span className="absolute right-0 whitespace-nowrap text-sm font-semibold text-white">
              {fmtNum(capacity)} available
            </span>
          )}
        </div>
      )}
    </div>
  );
}
