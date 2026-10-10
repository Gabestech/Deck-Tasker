"use client";

import { useMemo } from "react";
import { CYCLE, DEFAULT_WEIGHTS, TEAMS, TEAM_BY_ID } from "@/lib/config";
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
import { Eyebrow, Panel, fmtNum, fmtPct } from "./ui";

const POLICIES: { id: Policy; title: string; blurb: string }[] = [
  {
    id: "fair",
    title: "Equal share",
    blurb: "Each team gets an equal slice. Unused credit is shared out. Scores rank requests inside a team.",
  },
  {
    id: "priority",
    title: "Highest score first",
    blurb: "One global ranking. Whoever scores highest is funded until capacity runs out.",
  },
  {
    id: "fcfs",
    title: "First come, first served",
    blurb: "Funded in the order submitted, with no regard to value or team.",
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

  return (
    <div className="mx-auto max-w-[1280px] p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium tracking-[0.2em] text-cyan-400">CAPACITY & FAIRNESS</p>
          <h2 className="text-2xl font-semibold">{CYCLE.label} tasking cycle</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            There is more demand than collection capacity. These rules decide who gets what, and
            everyone can see them.
          </p>
        </div>
        <div className="flex gap-2">
          {changed && (
            <button
              type="button"
              onClick={resetPolicyState}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
            >
              Reset rules
            </button>
          )}
          {submittedCount > 0 && (
            <button
              type="button"
              onClick={resetSubmitted}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
            >
              Clear {submittedCount} demo submission{submittedCount === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>

      {/* headline numbers */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          sub="1.00 = every team at its equal share"
          tone={current.jain > 0.97 ? "good" : "warn"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Panel className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <Eyebrow>SHARE OF CAPACITY BY TEAM</Eyebrow>
                <p className="mt-1 text-sm text-slate-400">
                  The tick on each bar is that team&apos;s equal-share ideal.
                </p>
              </div>
            </div>
            <TeamShareBars teams={current.teams} />
            {current.teams.some((t) => t.demand < t.idealCredits + 1 && t.share < 0.245) && (
              <p className="mt-5 rounded-md bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                A team that asks for less than an equal share doesn&apos;t hold the rest back.
                The unused credits are shared out evenly among teams with unmet demand.
              </p>
            )}
          </Panel>

          <Panel className="p-6">
            <Eyebrow>WHAT EACH POLICY WOULD DO TODAY</Eyebrow>
            <p className="mb-5 mt-1 text-sm text-slate-400">
              Same requests, same capacity, three ways to share it out.
            </p>
            <div className="space-y-5">
              {POLICIES.map((p) => {
                const a = compare[p.id];
                const active = state.policy === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPolicyState({ policy: p.id })}
                    aria-pressed={active}
                    className={`block w-full rounded-lg border p-4 text-left transition ${
                      active
                        ? "border-cyan-400/60 bg-cyan-400/5"
                        : "border-white/10 hover:border-white/25"
                    }`}
                  >
                    <div className="mb-3 flex items-baseline justify-between gap-4">
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
                          className="flex items-center justify-center text-[10px] font-medium text-[#04141c]"
                          style={{ width: `${t.share * 100}%`, background: TEAM_BY_ID[t.team].color }}
                        >
                          {t.share >= 0.08 ? `${Math.round(t.share * 100)}%` : ""}
                        </div>
                      ))}
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      {a.teams.map((t) => (
                        <li key={t.team}>
                          {TEAM_BY_ID[t.team].short} {fmtPct(t.share)}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-slate-500">{p.blurb}</p>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel className="p-5">
            <Eyebrow>HOW REQUESTS ARE SCORED</Eyebrow>
            <p className="mb-5 mt-1 text-xs text-slate-500">
              Scores only order requests within a team under the equal-share policy. Change the
              weights and watch the queue re-rank.
            </p>
            <div className="space-y-5">
              <Slider label="Scientific / operational value" value={state.weights.value} min={0} max={100} step={5} unit="" onChange={(v) => setWeight("value", v)} />
              <Slider label="Urgency (time left in window)" value={state.weights.urgency} min={0} max={100} step={5} unit="" onChange={(v) => setWeight("urgency", v)} />
              <Slider label="Feasibility (clouds, contention)" value={state.weights.feasibility} min={0} max={100} step={5} unit="" onChange={(v) => setWeight("feasibility", v)} />
              <Slider label="Time waiting in queue" value={state.weights.age} min={0} max={100} step={5} unit="" onChange={(v) => setWeight("age", v)} />
            </div>
          </Panel>

          <Panel className="p-5">
            <Eyebrow>RAPID-RESPONSE RESERVE</Eyebrow>
            <p className="mb-4 mt-1 text-xs text-slate-500">
              Capacity set aside for urgent events. Using it still counts against a team&apos;s share.
            </p>
            <Slider
              label="Reserve"
              value={state.reservePct}
              min={0}
              max={30}
              unit="%"
              hint={`${fmtNum(current.reserve)} credits held for urgent requests`}
              onChange={(v) => setPolicyState({ reservePct: v })}
            />
          </Panel>

          <Panel className="p-5">
            <Eyebrow>CAPACITY WE DON&apos;T CONTROL</Eyebrow>
            <p className="mb-3 mt-1 text-xs text-slate-500">
              CM sets its own shares, but other Planet customers compete for the same passes.
              Busy regions lower the odds even for funded requests.
            </p>
            <ul className="space-y-2 text-xs">
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
      </div>

      <p className="mt-6 text-[11px] text-slate-600">
        Credits, costs and regional demand are illustrative. Teams: {TEAMS.map((t) => t.name).join(", ")}.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "good" | "warn";
}) {
  return (
    <Panel className="p-5">
      <Eyebrow>{label}</Eyebrow>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${
          tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-200" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </Panel>
  );
}
