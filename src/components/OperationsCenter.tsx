"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TEAM_BY_ID } from "@/lib/config";
import { SATELLITES, SIM_SPEED, formatEta, satState, simNow, type SatState } from "@/lib/sim";
import { buildSites } from "@/lib/sites";
import { useAllocation } from "@/lib/store";
import { formatLatLon, orbitalStats } from "@/lib/orbit";
import { BudgetBar } from "./BudgetBar";
import { SatelliteGlyph } from "./SatelliteGlyph";
import { Bar, PageHeader, Panel, TeamDot, fmtNum } from "./ui";

// MapLibre needs the browser, so skip server rendering for the map.
const OrbitalMap = dynamic(() => import("./OrbitalMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#070914]" />,
});

export function OperationsCenter() {
  const allocation = useAllocation();
  const sites = useMemo(() => buildSites(allocation.requests), [allocation.requests]);
  const fundedSites = useMemo(() => sites.filter((s) => s.funded > 0), [sites]);

  const [sats, setSats] = useState<SatState[] | null>(null);

  useEffect(() => {
    const tick = () => {
      const t = simNow();
      setSats(SATELLITES.map((d) => satState(d, t, fundedSites)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [fundedSites]);

  const activeKeys = useMemo(
    () => (sats ?? []).filter((s) => s.status === "COLLECTING" && s.site).map((s) => s.site!.key),
    [sats],
  );

  return (
    <section className="flex flex-col gap-4 p-4 sm:p-6 lg:h-full lg:min-h-0">
      <PageHeader
        title="Live Orbits"
        meta={`${SATELLITES.length} Tanagers · ${fundedSites.length} funded targets this cycle`}
      />

      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative h-[58dvh] min-h-[340px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#070914] lg:h-auto">
          <OrbitalMap sites={sites} activeKeys={activeKeys} satStates={sats} />
        </div>

        <div className="space-y-3 lg:min-h-0 lg:overflow-y-auto">
          {sats
            ? sats.map((s) => <SatelliteCard key={s.id} s={s} />)
            : SATELLITES.map((d) => (
                <Panel key={d.id} className="h-[150px] animate-pulse">
                  <span className="sr-only">Loading {d.name}</span>
                </Panel>
              ))}

          <Panel className="p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-xs font-medium text-slate-400">This cycle</p>
              <Link href="/budget" className="text-xs text-slate-400 transition hover:text-white">
                Budget →
              </Link>
            </div>
            <BudgetBar allocation={allocation} compact />
            <p className="mt-2.5 text-xs tabular-nums text-slate-500">
              <span className="text-slate-200">{fmtNum(allocation.totalDemand)}</span> asked ·{" "}
              <span className="text-slate-200">{fmtNum(allocation.capacity)}</span> available
            </p>
          </Panel>

          <p className="px-1 text-[11px] text-slate-600">Orbits simulated at {SIM_SPEED}× speed.</p>
        </div>
      </div>
    </section>
  );
}

function SatelliteCard({ s }: { s: SatState }) {
  const collecting = s.status === "COLLECTING";
  const def = SATELLITES.find((d) => d.id === s.id);
  const stats = def ? orbitalStats(def.orbit) : null;

  return (
    <Panel className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
          <SatelliteGlyph size={30} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight">{s.name.replace("TANAGER", "Tanager")}</h3>
          <p className="mt-0.5 truncate text-[11px] tabular-nums text-slate-500">
            {formatLatLon(s.pos[0], s.pos[1])}
            {stats && ` · ${Math.round(stats.altKm)} km`}
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs ${collecting ? "text-emerald-300" : "text-slate-400"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${collecting ? "bg-emerald-400" : "bg-slate-500"}`} aria-hidden />
          {collecting ? "Collecting" : "In transit"}
        </span>
      </div>

      <div className="mt-3 border-t border-white/[0.06] pt-3">
        <p className="text-[11px] text-slate-500">{collecting ? "Imaging now" : "Next target"}</p>
        {s.site ? (
          <p className="mt-0.5 flex items-center gap-2 text-sm font-medium">
            <TeamDot team={s.site.team} />
            <span className="truncate">{s.site.name}</span>
            <span className="ml-auto shrink-0 text-xs font-normal text-slate-500">{TEAM_BY_ID[s.site.team].short}</span>
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-slate-500">No funded target ahead</p>
        )}

        {collecting ? (
          <div className="mt-2.5 flex items-center gap-3">
            <Bar value={s.progress * 100} color="#3DDC97" className="flex-1" />
            <span className="text-xs tabular-nums text-slate-300">{Math.round(s.progress * 100)}%</span>
          </div>
        ) : (
          s.etaMs != null && (
            <p className="mt-1.5 text-xs text-slate-500">
              Starts in <span className="tabular-nums text-slate-300">{formatEta(s.etaMs)}</span>
            </p>
          )
        )}
      </div>
    </Panel>
  );
}
