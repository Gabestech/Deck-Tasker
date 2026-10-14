"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { MODE_INFO } from "@/lib/pricing";
import { getRegion } from "@/lib/regions";
import { CYCLE, TEAMS, TEAM_BY_ID } from "@/lib/config";
import { useAllocation, usePolicyState } from "@/lib/store";
import type { AllocatedRequest, Policy, TeamId } from "@/lib/types";
import { PageHeader, Panel, Segmented, StatusChip, TeamDot, fmtDate, fmtNum } from "./ui";

type StatusFilter = "all" | "funded" | "waitlisted" | "completed";

const POLICY_NAME: Record<Policy, string> = {
  fair: "equal share",
  priority: "highest score first",
  fcfs: "first come, first served",
};

const COLS =
  "lg:grid-cols-[36px_minmax(0,2.2fr)_110px_118px_64px_minmax(190px,1.1fr)]";

export function RequestsView() {
  const allocation = useAllocation();
  const { policy } = usePolicyState();
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

  const n = (v: number) => <span className="tabular-nums text-slate-500">{v}</span>;

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-4 p-4 sm:p-6 lg:h-full">
      <PageHeader
        title="Requests"
        meta={`${CYCLE.label} cycle · ${POLICY_NAME[policy]}`}
        actions={
          <Link href="/budget" className="text-xs text-slate-400 transition hover:text-white">
            See the rules →
          </Link>
        }
      />

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Segmented
          label="Team"
          value={team}
          onChange={setTeam}
          options={[
            { id: "all", label: "All teams" },
            ...TEAMS.map((t) => ({
              id: t.id,
              label: (
                <>
                  <TeamDot team={t.id} />
                  {t.short}
                </>
              ),
            })),
          ]}
        />
        <Segmented
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { id: "all", label: <>All {n(allocation.requests.length)}</> },
            { id: "funded", label: <>Funded {n(counts.funded)}</> },
            { id: "waitlisted", label: <>Waitlisted {n(counts.waitlisted)}</> },
            { id: "completed", label: <>Collected {n(counts.completed)}</> },
          ]}
        />
      </div>

      <Panel className="flex flex-col overflow-hidden lg:min-h-0 lg:flex-1">
        <div className={`hidden shrink-0 gap-4 border-b border-white/[0.06] px-5 py-2.5 text-[11px] font-medium text-slate-500 lg:grid ${COLS}`}>
          <span>#</span>
          <span>Request</span>
          <span>Team</span>
          <span>Window</span>
          <span className="text-right">Credits</span>
          <span>Status</span>
        </div>

        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {rows.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No requests match these filters.</p>
          )}

          {rows.map((r) => {
            const region = getRegion(r.regionId).name;
            const isOpen = open === r.id;
            return (
              <div key={r.id} className="border-b border-white/[0.05] last:border-0">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  aria-expanded={isOpen}
                  className={`w-full px-4 py-3 text-left transition hover:bg-white/[0.025] sm:px-5 ${isOpen ? "bg-white/[0.025]" : ""}`}
                >
                  {/* Desktop row */}
                  <div className={`hidden items-center gap-4 lg:grid ${COLS}`}>
                    <span className="text-sm tabular-nums text-slate-500">{r.rank || "–"}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-100">{r.name}</span>
                        {r.urgent && <RapidTag />}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {region} · {MODE_INFO[r.mode].label}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-slate-300">
                      <TeamDot team={r.team} />
                      {TEAM_BY_ID[r.team].name}
                    </span>
                    <span className="text-xs tabular-nums text-slate-400">
                      {fmtDate(r.windowStart)} – {fmtDate(r.windowEnd)}
                    </span>
                    <span className="text-right text-sm tabular-nums text-slate-300">{fmtNum(r.creditCost)}</span>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <StatusChip r={r} />
                      <span className="truncate text-xs text-slate-500">{reasonText(r)}</span>
                    </span>
                  </div>

                  {/* Phone / tablet card */}
                  <div className="lg:hidden">
                    <div className="flex items-start gap-3">
                      <span className="w-5 pt-0.5 text-xs tabular-nums text-slate-500">{r.rank || "–"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-sm font-medium leading-snug text-slate-100">{r.name}</span>
                          <span className="shrink-0 text-sm tabular-nums text-slate-300">{fmtNum(r.creditCost)}</span>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <TeamDot team={r.team} />
                          <span className="text-slate-300">{TEAM_BY_ID[r.team].short}</span>
                          <span className="truncate">
                            · {region} · {fmtDate(r.windowStart)}–{fmtDate(r.windowEnd)}
                          </span>
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <StatusChip r={r} />
                          {r.urgent && <RapidTag />}
                          <span className="truncate text-xs text-slate-500">{reasonText(r)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                {isOpen && <Detail r={r} />}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function RapidTag() {
  return (
    <span className="shrink-0 rounded-md bg-rose-400/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-300 ring-1 ring-inset ring-rose-400/20">
      Rapid
    </span>
  );
}

/** One short phrase for why a request is where it is. */
function reasonText(r: AllocatedRequest) {
  if (r.status === "completed") return "Collected this cycle";
  return r.reason;
}

const FACTORS = [
  { key: "value", label: "Mission value" },
  { key: "urgency", label: "Urgency" },
  { key: "feasibility", label: "Feasibility" },
  { key: "age", label: "Time waiting" },
] as const;

function Detail({ r }: { r: AllocatedRequest }) {
  return (
    <div className="grid gap-6 border-t border-white/[0.05] bg-black/20 px-4 py-5 sm:px-5 md:grid-cols-[1.1fr_1fr] lg:pl-[76px]">
      <div>
        <p className="text-xs font-medium text-slate-400">
          {r.rank ? `Why #${r.rank}` : "Ranking factors"}
        </p>
        <ul className="mt-3 space-y-2">
          {FACTORS.map((f) => (
            <li key={f.key} className="grid grid-cols-[100px_1fr_28px] items-center gap-3 text-xs">
              <span className="text-slate-500">{f.label}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-cyan-300/80" style={{ width: `${r.score[f.key]}%` }} />
              </div>
              <span className="text-right tabular-nums text-slate-400">{Math.round(r.score[f.key])}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">{r.justification}</p>
        <p className="mt-1 text-xs text-slate-500">{r.requester}</p>
      </div>
      <dl className="grid h-fit grid-cols-2 gap-x-6 gap-y-3 text-xs">
        <Item k="Request" v={<span className="font-mono text-[11px]">{r.id}</span>} />
        <Item k="Mode" v={MODE_INFO[r.mode].label} />
        <Item k="Area" v={`${fmtNum(r.areaKm2 ?? r.widthKm * r.heightKm)} km²`} />
        <Item k="Max cloud" v={`${r.cloudMax}%`} />
        <Item k="Max off-nadir" v={`${r.offNadirMax}°`} />
        <Item k="Sensitivity" v={<span className="capitalize">{r.sensitivity}</span>} />
      </dl>
    </div>
  );
}

function Item({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{k}</dt>
      <dd className="mt-0.5 text-slate-200">{v}</dd>
    </div>
  );
}
