"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CYCLE, DEFAULT_WEIGHTS, TEAM_BY_ID } from "@/lib/config";
import {
  DEFAULT_POLICY,
  resetPolicyState,
  resetSubmitted,
  setPolicyState,
  useAllocation,
  usePolicyState,
  useSubmittedCount,
} from "@/lib/store";
import type { AllocationResult, Policy, Weights } from "@/lib/types";
import { BudgetBar } from "./BudgetBar";
import { PageHeader, Panel, Segmented, TeamDot, Tip, fmtNum } from "./ui";

const POLICY_OPTIONS: { id: Policy; label: string }[] = [
  { id: "fair", label: "Equal share" },
  { id: "priority", label: "Highest score" },
  { id: "fcfs", label: "First come" },
];

function rulesFor(policy: Policy, reservePct: number) {
  if (policy === "priority") {
    return ["No fixed team allocation.", "Highest scores are funded first, across all teams."];
  }
  if (policy === "fcfs") {
    return ["No fixed team allocation.", "Requests are funded in the order submitted."];
  }
  return [
    "Each team receives an equal allocation.",
    "Unused allocation passes to teams with requests waiting.",
    "Within a team, the highest score is funded first.",
    ...(reservePct > 0 ? [`${reservePct}% is reserved for rapid response.`] : []),
  ];
}

const PRESETS: { id: string; label: string; desc: string; weights: Weights }[] = [
  { id: "balanced", label: "Balanced", desc: "All four factors count", weights: DEFAULT_WEIGHTS },
  { id: "urgent", label: "Urgent first", desc: "Windows closing soonest", weights: { value: 20, urgency: 55, feasibility: 15, age: 10 } },
  { id: "value", label: "Most valuable", desc: "Highest mission value", weights: { value: 60, urgency: 15, feasibility: 15, age: 10 } },
  { id: "waiting", label: "Longest waiting", desc: "Oldest requests first", weights: { value: 25, urgency: 15, feasibility: 15, age: 45 } },
];

const sameWeights = (x: Weights, y: Weights) =>
  (Object.keys(x) as (keyof Weights)[]).every((k) => x[k] === y[k]);

function balance(a: AllocationResult) {
  const shares = a.teams.filter((t) => t.demand > 0).map((t) => Math.round(t.share * 100));
  const lo = Math.min(...shares);
  const hi = Math.max(...shares);
  // Judge by the gap between the best- and worst-served team, which is what people notice.
  const gap = hi - lo;
  const word = gap <= 4 ? "Even" : gap <= 10 ? "Somewhat uneven" : "Uneven";
  const tone = gap <= 4 ? "bg-emerald-400" : gap <= 10 ? "bg-amber-300" : "bg-rose-400";
  return { word, tone, range: lo === hi ? `${lo}% each` : `${lo}–${hi}% per team` };
}

export function BudgetView() {
  const state = usePolicyState();
  const a = useAllocation();
  const submittedCount = useSubmittedCount();
  // Statuses just before the last preset click, so we can say exactly what it changed.
  const [before, setBefore] = useState<Map<string, { status: string; rank: number }> | null>(null);
  const activePreset = PRESETS.find((p) => sameWeights(p.weights, state.weights))?.id ?? "";

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p || p.id === activePreset) return;
    setBefore(new Map(a.requests.map((r) => [r.id, { status: r.status, rank: r.rank }])));
    setPolicyState({ weights: p.weights });
  };
  const setPolicy = (policy: Policy) => {
    setBefore(null);
    setPolicyState({ policy });
  };
  const changes = useMemo(() => {
    if (!before) return null;
    const open = a.requests.filter((r) => r.status !== "completed" && before.has(r.id));
    return {
      flipped: open.filter((r) => before.get(r.id)?.status !== r.status),
      moved: open.filter((r) => before.get(r.id)?.rank !== r.rank).length,
    };
  }, [a.requests, before]);

  const waiting = a.requests.filter((r) => r.status === "waitlisted").length;
  const maxDemand = Math.max(...a.teams.map((t) => t.demand), 1);
  const bal = balance(a);

  const changed =
    state.policy !== DEFAULT_POLICY.policy ||
    state.reservePct !== DEFAULT_POLICY.reservePct ||
    (Object.keys(DEFAULT_WEIGHTS) as (keyof Weights)[]).some((k) => state.weights[k] !== DEFAULT_WEIGHTS[k]);

  const small = "btn btn-ghost !px-3 !py-1.5 !text-xs";

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-4 p-4 sm:p-6 xl:h-full">
      <PageHeader
        title="Budget"
        meta={`${CYCLE.label} cycle · tasking credits`}
        actions={
          <>
            {changed && (
              <button type="button" onClick={resetPolicyState} className={small}>
                Reset rules
              </button>
            )}
            {submittedCount > 0 && (
              <button type="button" onClick={resetSubmitted} className={small}>
                Clear {submittedCount} demo request{submittedCount === 1 ? "" : "s"}
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto">
          {/* The whole cycle in one bar */}
          <Panel className="p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-[28px]">
                {fmtNum(a.totalDemand)}
                <span className="ml-1.5 text-sm font-normal text-slate-500">asked</span>
                <span className="mx-3 text-slate-600">/</span>
                {fmtNum(a.capacity)}
                <span className="ml-1.5 text-sm font-normal text-slate-500">available</span>
              </p>
              {a.oversubscription > 1 && (
                <span className="text-sm tabular-nums text-amber-200">
                  {a.oversubscription.toFixed(1)}× more asked than available
                </span>
              )}
            </div>
            <div className="mt-5">
              <BudgetBar allocation={a} />
            </div>
            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/[0.06] pt-4 text-[13px]">
              <Fact k="Assigned" v={`${fmtNum(a.totalAllocated)} credits`} />
              <Fact k="Waitlisted" v={`${waiting} request${waiting === 1 ? "" : "s"}`} />
              <Fact
                k="Team balance"
                v={
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${bal.tone}`} aria-hidden />
                    {bal.word}
                    <span className="text-slate-500">· {bal.range}</span>
                  </span>
                }
              />
            </div>
          </Panel>

          {/* Who got what */}
          <Panel className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium text-slate-300">By team</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded-sm bg-slate-300" aria-hidden />
                  Got
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded-sm bg-slate-300/25" aria-hidden />
                  Asked
                </span>
              </span>
            </div>
            <ul className="space-y-5">
              {a.teams.map((t) => {
                const team = TEAM_BY_ID[t.team];
                return (
                  <li key={t.team} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[120px_minmax(0,1fr)_56px]">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <TeamDot team={t.team} />
                      {team.name}
                    </span>
                    <span className="text-right text-sm font-semibold tabular-nums sm:order-last">
                      {Math.round(t.share * 100)}%
                    </span>
                    <div className="col-span-2 sm:col-span-1">
                      <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.04]">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full opacity-25"
                          style={{ width: `${(t.demand / maxDemand) * 100}%`, background: team.color }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ width: `${(t.allocated / maxDemand) * 100}%`, background: team.color }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs tabular-nums text-slate-500">
                        <span className="text-slate-300">{fmtNum(t.allocated)}</span> of {fmtNum(t.demand)} asked
                        <span className="mx-1.5 text-slate-700">·</span>
                        {t.funded} funded, {t.waitlisted} waitlisted
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        {/* The rules everyone works under */}
        <Panel className="flex flex-col p-5 sm:p-6 xl:min-h-0 xl:overflow-y-auto">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-slate-300">Three proposed models</p>
            <Tip
              align="end"
              text="Same requests, same credits. Only the rule for sharing them changes. Switch models to compare the bar and team split. Equal share is the recommended default."
            />
          </div>
          <Segmented
            className="mt-3"
            label="Allocation model"
            value={state.policy}
            onChange={setPolicy}
            options={POLICY_OPTIONS}
          />
          <ol className="mt-4 space-y-2.5">
            {rulesFor(state.policy, state.reservePct).map((rule, i) => (
              <li key={rule} className="flex gap-3 text-sm leading-snug text-slate-300">
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] tabular-nums text-slate-400">
                  {i + 1}
                </span>
                {rule}
              </li>
            ))}
          </ol>

          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-slate-300">Scoring</p>
              <Tip
                align="end"
                text="Each request is rated 0–100 on four factors. Mission value: the team's 1–5 rating. Urgency: how soon the window closes. Feasibility: clear-sky odds and competing demand. Time waiting: days in line. The emphasis decides how much each factor counts."
              />
            </div>

            {state.policy === "fcfs" ? (
              <p className="mt-2 text-xs text-slate-500">First come doesn&apos;t use scores.</p>
            ) : (
              <>
                <p className="mt-1 text-xs text-slate-500">What should count most?</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {PRESETS.map((p) => {
                    const on = p.id === activePreset;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => applyPreset(p.id)}
                        className={`rounded-lg border px-3 py-2.5 text-left transition active:scale-[0.98] ${
                          on
                            ? "border-cyan-300/40 bg-cyan-400/[0.1] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]"
                            : "border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                        }`}
                      >
                        <span className={`block text-[13px] font-medium ${on ? "text-white" : "text-slate-200"}`}>{p.label}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">{p.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {changes && (
                  <div className="mt-3 rounded-lg bg-black/25 px-3 py-2.5 text-xs" aria-live="polite">
                    {changes.flipped.length === 0 ? (
                      <p className="text-slate-500">
                        Same requests funded.
                        {changes.moved > 0 && ` ${changes.moved} moved in the ranking.`}
                      </p>
                    ) : (
                      <>
                        <p className="text-slate-400">
                          {changes.flipped.length} request{changes.flipped.length === 1 ? "" : "s"} changed
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {changes.flipped.slice(0, 4).map((r) => (
                            <li key={r.id} className="flex items-center gap-2">
                              <TeamDot team={r.team} />
                              <span className="min-w-0 flex-1 truncate text-slate-300">{r.name}</span>
                              <span className={r.status === "funded" ? "text-emerald-300" : "text-amber-200"}>
                                {r.status === "funded" ? "Now funded" : "Now waitlisted"}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {changes.flipped.length > 4 && (
                          <p className="mt-1 text-slate-500">+{changes.flipped.length - 4} more on Requests</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {state.policy === "fair" && (
            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-slate-300">Rapid-response reserve</p>
                <Tip align="end" text="Credits held back for urgent events like a new super-emitter. Using them still counts against the team's allocation." />
              </div>
              <Segmented
                className="mt-3"
                label="Reserve"
                value={String(state.reservePct)}
                onChange={(v) => {
                  setBefore(null);
                  setPolicyState({ reservePct: Number(v) });
                }}
                options={["0", "5", "10", "15"].map((v) => ({ id: v, label: `${v}%` }))}
              />
            </div>
          )}

          <p className="mt-auto pt-6 text-[11px] text-slate-600">Credits and costs are illustrative.</p>
        </Panel>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{k}</p>
      <p className="mt-0.5 font-medium tabular-nums text-slate-200">{v}</p>
    </div>
  );
}
