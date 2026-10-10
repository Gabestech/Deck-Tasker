"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MODE_INFO } from "@/lib/pricing";
import { getRegion } from "@/lib/regions";
import { TEAMS } from "@/lib/config";
import { useAllocation, usePolicyState } from "@/lib/store";
import type { AllocatedRequest, TeamId } from "@/lib/types";
import { Eyebrow, Panel, StatusChip, TeamChip, Tip, fmtDate, fmtNum } from "./ui";

type StatusFilter = "all" | "funded" | "waitlisted" | "completed";

const POLICY_LABEL = {
  fair: "Equal-share policy",
  priority: "Highest-score-first policy",
  fcfs: "First-come-first-served policy",
} as const;

export function QueueView() {
  const allocation = useAllocation();
  const { weights, policy } = usePolicyState();
  const [team, setTeam] = useState<TeamId | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      allocation.requests.filter(
        (r) => (team === "all" || r.team === team) && (status === "all" || r.status === status),
      ),
    [allocation.requests, team, status],
  );

  const counts = useMemo(() => {
    const c = { funded: 0, waitlisted: 0, completed: 0 };
    for (const r of allocation.requests) c[r.status] += 1;
    return c;
  }, [allocation.requests]);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs transition ${
      active
        ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100"
        : "border-white/10 text-slate-400 hover:text-white"
    }`;

  return (
    <div className="mx-auto flex h-full max-w-[1280px] flex-col p-6">
      <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-cyan-300">Shared queue</p>
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            Every request, ranked in the open
            <Tip text="Click a row to see exactly why it ranked where it did, and why it is or isn't funded this cycle." />
          </h2>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>{POLICY_LABEL[policy]}</p>
          <Link href="/capacity" className="text-cyan-300 hover:text-cyan-200">
            Change the rules →
          </Link>
        </div>
      </div>

      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-2">
        <button type="button" className={chip(team === "all")} onClick={() => setTeam("all")}>
          All teams
        </button>
        {TEAMS.map((t) => (
          <button key={t.id} type="button" className={chip(team === t.id)} onClick={() => setTeam(t.id)}>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: t.color }} />
            {t.short}
          </button>
        ))}
        <span className="mx-2 h-5 w-px bg-white/10" />
        {(
          [
            ["all", `All ${allocation.requests.length}`],
            ["funded", `Funded ${counts.funded}`],
            ["waitlisted", `Waitlisted ${counts.waitlisted}`],
            ["completed", `Collected ${counts.completed}`],
          ] as [StatusFilter, string][]
        ).map(([k, label]) => (
          <button key={k} type="button" className={chip(status === k)} onClick={() => setStatus(k)}>
            {label}
          </button>
        ))}
      </div>

      <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="hidden shrink-0 grid-cols-[48px_minmax(0,2.2fr)_120px_130px_80px_minmax(140px,1fr)_130px] gap-4 border-b border-white/10 px-5 py-3 text-xs font-medium text-slate-500 lg:grid">
          <span>Rank</span>
          <span>Request</span>
          <span>Team</span>
          <span>Mode · window</span>
          <span className="text-right">Credits</span>
          <span>Score</span>
          <span>Status</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No requests match these filters.</p>
        )}

        {rows.map((r) => (
          <div key={r.id} className="border-b border-white/5 last:border-0">
            <button
              type="button"
              onClick={() => setOpen(open === r.id ? null : r.id)}
              aria-expanded={open === r.id}
              className="grid w-full grid-cols-[48px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left transition hover:bg-white/[0.03] lg:grid-cols-[48px_minmax(0,2.2fr)_120px_130px_80px_minmax(140px,1fr)_130px]"
            >
              <span className="text-sm tabular-nums text-slate-500">{r.rank || "–"}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-100">
                  {r.name}
                  {r.urgent && (
                    <span className="ml-2 rounded-full bg-rose-400/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                      Rapid
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {r.id} · {getRegion(r.regionId).name}
                </span>
              </span>
              <span className="col-start-2 lg:col-start-auto">
                <TeamChip team={r.team} />
              </span>
              <span className="col-start-2 text-xs text-slate-400 lg:col-start-auto">
                {MODE_INFO[r.mode].label}
                <span className="block text-slate-500">
                  {fmtDate(r.windowStart)} – {fmtDate(r.windowEnd)}
                </span>
              </span>
              <span className="col-start-2 text-sm tabular-nums text-slate-300 lg:col-start-auto lg:text-right">
                {fmtNum(r.creditCost)}
              </span>
              <span className="col-start-2 lg:col-start-auto">
                <ScoreBar r={r} weights={weights} />
              </span>
              <span className="col-start-2 lg:col-start-auto">
                <StatusChip r={r} />
              </span>
            </button>

            {open === r.id && <Why r={r} weights={weights} />}
          </div>
        ))}
        </div>
      </Panel>
    </div>
  );
}

const PARTS = [
  { key: "value", label: "Value", color: "#8F9CFF" },
  { key: "urgency", label: "Urgency", color: "#FFC857" },
  { key: "feasibility", label: "Feasibility", color: "#3DDC97" },
  { key: "age", label: "Queue age", color: "#94a3b8" },
] as const;

function contributions(r: AllocatedRequest, w: Record<(typeof PARTS)[number]["key"], number>) {
  const sum = PARTS.reduce((s, p) => s + w[p.key], 0) || 1;
  return PARTS.map((p) => ({ ...p, points: (w[p.key] * r.score[p.key]) / sum, weight: w[p.key] / sum }));
}

function ScoreBar({
  r,
  weights,
}: {
  r: AllocatedRequest;
  weights: Record<(typeof PARTS)[number]["key"], number>;
}) {
  const parts = contributions(r, weights);
  return (
    <div className="flex items-center gap-3">
      <span className="w-9 text-sm tabular-nums text-slate-200">{r.score.total.toFixed(1)}</span>
      <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
        {parts.map((p) => (
          <div key={p.key} style={{ width: `${p.points}%`, background: p.color }} />
        ))}
      </div>
    </div>
  );
}

function Why({
  r,
  weights,
}: {
  r: AllocatedRequest;
  weights: Record<(typeof PARTS)[number]["key"], number>;
}) {
  const parts = contributions(r, weights);
  return (
    <div className="grid gap-6 border-t border-white/5 bg-black/20 px-5 py-5 text-sm md:grid-cols-[1.2fr_1fr]">
      <div>
        <Eyebrow>Why this rank</Eyebrow>
        <ul className="mt-3 space-y-2.5">
          {parts.map((p) => (
            <li key={p.key} className="grid grid-cols-[92px_1fr_auto] items-center gap-3 text-xs">
              <span className="text-slate-400">{p.label}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${r.score[p.key]}%`, background: p.color }}
                />
              </div>
              <span className="w-40 text-right tabular-nums text-slate-400">
                {Math.round(r.score[p.key])} × {(p.weight * 100).toFixed(0)}% ={" "}
                <span className="text-slate-200">{p.points.toFixed(1)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">{r.justification}</p>
        <p className="mt-1 text-xs text-slate-600">Requested by {r.requester}</p>
      </div>
      <div>
        <Eyebrow>Funding decision</Eyebrow>
        <p className="mt-3 leading-relaxed text-slate-300">{r.reason}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-slate-500">Cloud ≤</dt>
            <dd className="text-slate-300">{r.cloudMax}%</dd>
          </div>
          <div>
            <dt className="text-slate-500">Off-nadir ≤</dt>
            <dd className="text-slate-300">{r.offNadirMax}°</dd>
          </div>
          <div>
            <dt className="text-slate-500">Area</dt>
            <dd className="text-slate-300">{fmtNum(r.areaKm2 ?? r.widthKm * r.heightKm)} km²</dd>
          </div>
          <div>
            <dt className="text-slate-500">Sensitivity</dt>
            <dd className="text-slate-300 capitalize">{r.sensitivity}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
