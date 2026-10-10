"use client";

import { useMemo } from "react";
import { CYCLE, DEFAULT_WEIGHTS, TEAM_BY_ID } from "@/lib/config";
import { getRegion } from "@/lib/regions";
import {
  DEFAULT_POLICY,
  resetPolicyState,
  resetSubmitted,
  setPolicyState,
  useAllocation,
  usePolicyState,
  useSubmittedCount,
} from "@/lib/store";
import type { Policy, Weights } from "@/lib/types";
import { Slider } from "./form-bits";
import { TeamShareBars } from "./TeamShareBars";
import { Eyebrow, Panel, Tip, fmtNum, fmtPct } from "./ui";

const POLICIES: { id: Policy; title: string; blurb: string }[] = [
  {
    id: "fair",
    title: "Equal share",
    blurb: "Equal slice per team. Unused credit is shared.",
  },
  {
    id: "priority",
    title: "Highest score first",
    blurb: "Highest score funded first.",
  },
  {
    id: "fcfs",
    title: "First come, first served",
    blurb: "Funded in the order submitted.",
  },
];

export function CapacityView() {
  const state = usePolicyState();
  const current = useAllocation();
  const fair = useAllocation({ policy: "fair" });
  const priority = useAllocation({ policy: "priority" });
  const fcfs = useAllocation({ policy: "fcfs" });
  const submittedCount = useSubmittedCount();
  const compare = { fair, priority, fcfs };

  const external = useMemo(() => {
    const seen = new Map<string, { name: string; contention: string; funded: number }>();
    for (const r of fair.requests) {
      if (r.completed) continue;
      const region = getRegion(r.regionId);
      const e = seen.get(region.id) ?? { name: region.name, contention: region.contention, funded: 0 };
      if (r.status !== "waitlisted") e.funded += 1;
      seen.set(region.id, e);
    }
    return [...seen.values()]
      .filter((e) => e.contention !== "low")
      .sort((a, b) => (a.contention === b.contention ? b.funded - a.funded : a.contention === "high" ? -1 : 1))
      .slice(0, 6);
  }, [fair.requests]);

  const setWeight = (k: keyof Weights, v: number) =>
    setPolicyState({ weights: { ...state.weights, [k]: v } });

  const changed =
    state.policy !== DEFAULT_POLICY.policy ||
    state.reservePct !== DEFAULT_POLICY.reservePct ||
    (Object.keys(DEFAULT_WEIGHTS) as (keyof Weights)[]).some((k) => state.weights[k] !== DEFAULT_WEIGHTS[k]);

  const smallBtn = "btn btn-ghost !px-3 !py-1.5 !text-xs";

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-4 p-6 xl:h-full">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-cyan-300">Capacity & fairness</p>
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            {CYCLE.label} tasking cycle
            <Tip text="There is more demand than collection capacity. These rules decide who gets what, and everyone can see them." />
          </h2>
        </div>
        <div className="flex gap-2">
          {changed && (
            <button type="button" onClick={resetPolicyState} className={smallBtn}>
              Reset rules
            </button>
          )}
          {submittedCount > 0 && (
            <button type="button" onClick={resetSubmitted} className={smallBtn}>
              Clear {submittedCount} demo submission{submittedCount === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Cycle capacity" value={`${fmtNum(current.capacity)}`} sub="tasking credits" />
        <Stat
          label="Requested"
          value={`${fmtNum(current.totalDemand)}`}
          sub={`${current.oversubscription.toFixed(2)}× oversubscribed`}
          tone="warn"
        />
        <Stat
          label="Allocated"
          value={fmtPct(current.totalAllocated / current.capacity)}
          sub={`${fmtNum(current.totalAllocated)} credits`}
        />
        <Stat
          label="Fairness index"
          value={current.jain.toFixed(2)}
          sub="1.00 is perfectly even"
          tip="1.00 means every team is at its equal share. Lower means some teams are getting more than others."
          tone={current.jain > 0.97 ? "good" : "warn"}
        />
      </div>

      <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-3">
        <div className="space-y-4 xl:min-h-0 xl:overflow-y-auto">
          <Panel className="p-5">
            <Eyebrow tip="The tick on each bar is that team's equal-share ideal. A team that asks for less doesn't hold the rest back: unused credits go evenly to teams with unmet demand.">
              Share of capacity by team
            </Eyebrow>
            <div className="mt-4">
              <TeamShareBars teams={current.teams} />
            </div>
          </Panel>

          <Panel className="p-5">
            <Eyebrow tip="CM sets its own shares, but other Planet customers compete for the same passes. Busy regions lower the odds even for funded requests.">
              Capacity we don&apos;t control
            </Eyebrow>
            <ul className="mt-3 space-y-2 text-xs">
              {external.map((e) => (
                <li key={e.name} className="flex items-center justify-between">
                  <span className="text-slate-300">{e.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      e.contention === "high"
                        ? "bg-rose-400/10 text-rose-300"
                        : "bg-amber-300/10 text-amber-200"
                    }`}
                  >
                    {e.contention} demand
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="xl:min-h-0 xl:overflow-y-auto">
          <Panel className="p-5">
            <Eyebrow tip="Same requests, same capacity, three ways to share it out. Click one to apply it across the app.">
              What each policy would do today
            </Eyebrow>
            <div className="mt-4 space-y-3">
              {POLICIES.map((p) => {
                const a = compare[p.id];
                const active = state.policy === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPolicyState({ policy: p.id })}
                    aria-pressed={active}
                    className={`block w-full rounded-xl border p-4 text-left transition duration-200 active:scale-[0.99] ${
                      active
                        ? "border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_0_3px_rgba(143,156,255,0.14)]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="mb-2.5 flex items-baseline justify-between gap-4">
                      <span className="text-sm font-medium">{p.title}</span>
                      <span
                        className={`text-xs tabular-nums ${a.jain > 0.97 ? "text-emerald-300" : "text-amber-200"}`}
                      >
                        fairness {a.jain.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex h-5 overflow-hidden rounded-md bg-white/5" aria-hidden>
                      {a.teams.map((t) => (
                        <div
                          key={t.team}
                          className="flex items-center justify-center text-[10px] font-medium text-[#10122B]"
                          style={{ width: `${t.share * 100}%`, background: TEAM_BY_ID[t.team].color }}
                        >
                          {t.share >= 0.08 ? `${Math.round(t.share * 100)}%` : ""}
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{p.blurb}</p>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="space-y-4 xl:min-h-0 xl:overflow-y-auto">
          <Panel className="p-5">
            <Eyebrow tip="Under equal share, scores only rank requests within a team. Change a weight and watch the queue re-rank.">
              How requests are scored
            </Eyebrow>
            <div className="mt-4 space-y-4">
              <Slider label="Scientific / operational value" value={state.weights.value} min={0} max={100} step={5} unit="" onChange={(v) => setWeight("value", v)} />
              <Slider label="Urgency" tip="Time left in the request's window." value={state.weights.urgency} min={0} max={100} step={5} unit="" onChange={(v) => setWeight("urgency", v)} />
              <Slider label="Feasibility" tip="Cloud cover and demand from other customers." value={state.weights.feasibility} min={0} max={100} step={5} unit="" onChange={(v) => setWeight("feasibility", v)} />
              <Slider label="Time in queue" value={state.weights.age} min={0} max={100} step={5} unit="" onChange={(v) => setWeight("age", v)} />
            </div>
          </Panel>

          <Panel className="p-5">
            <Eyebrow tip="Capacity set aside for urgent events. Using it still counts against a team's share.">
              Rapid-response reserve
            </Eyebrow>
            <div className="mt-4">
              <Slider
                label="Reserve"
                value={state.reservePct}
                min={0}
                max={30}
                unit="%"
                hint={`${fmtNum(current.reserve)} credits held for urgent requests`}
                onChange={(v) => setPolicyState({ reservePct: v })}
              />
            </div>
          </Panel>
        </div>
      </div>

      <p className="shrink-0 text-[11px] text-slate-600">
        Credits, costs and regional demand are illustrative.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tip,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tip?: string;
  tone?: "good" | "warn";
}) {
  return (
    <Panel className="p-4">
      <Eyebrow tip={tip}>{label}</Eyebrow>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-200" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </Panel>
  );
}
