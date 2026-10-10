"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SATELLITES, SIM_SPEED, formatEta, satState, simNow, type SatState } from "@/lib/sim";
import { buildSites } from "@/lib/sites";
import { useAllocation } from "@/lib/store";
import { TeamShareBars } from "./TeamShareBars";
import { Bar, Eyebrow, Panel, TeamChip, fmtPct } from "./ui";

// MapLibre needs the browser, so skip server rendering for the map.
const OrbitalMap = dynamic(() => import("./OrbitalMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#050b12]" />,
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
  const weatherHolds = fundedSites.filter((s) => s.clearSky < 0.5).length;
  const collecting = (sats ?? []).filter((s) => s.status === "COLLECTING").length;

  return (
    <section className="flex h-full min-h-0 flex-col p-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="mb-1 text-xs font-medium tracking-[0.2em] text-cyan-400">LIVE OPERATIONS</p>
          <h2 className="text-2xl font-semibold">Tanager Collection Network</h2>
          <p className="mt-1 text-sm text-slate-400">
            Satellite activity and the funded target deck for this tasking cycle
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">FLEET STATUS</p>
          <p className="mt-1 text-sm text-emerald-400">
            {SATELLITES.length} SATELLITES ACTIVE
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#091722]">
          <div className="relative min-h-0 flex-1">
            <OrbitalMap sites={sites} activeKeys={activeKeys} satStates={sats} />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-white/10 bg-black/20 px-5 py-3 text-xs">
            <span className="text-emerald-400">● LIVE</span>
            {(sats ?? []).map((s) => (
              <span key={s.id} className="text-slate-400">
                {s.id} {s.status}
              </span>
            ))}
            <span className="text-slate-400">{fundedSites.length} FUNDED TARGETS</span>
            <span className="text-amber-300">{weatherHolds} WEATHER WATCH</span>
            <span className="ml-auto text-slate-600">{collecting} collecting now</span>
          </div>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          {sats
            ? sats.map((s) => <SatelliteCard key={s.id} s={s} />)
            : SATELLITES.map((d) => (
                <Panel key={d.id} className="h-[176px] animate-pulse" >
                  <span className="sr-only">Loading {d.name}</span>
                </Panel>
              ))}

          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <Eyebrow>FLEET CAPACITY</Eyebrow>
              <span className="text-xs text-slate-400">OCT</span>
            </div>
            <TeamShareBars teams={allocation.teams} compact />
            <div className="mt-4 border-t border-white/10 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Fleet allocated</span>
                <span>{fmtPct(allocation.totalAllocated / allocation.capacity)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-slate-400">Demand vs capacity</span>
                <span className="text-amber-200">{allocation.oversubscription.toFixed(2)}×</span>
              </div>
            </div>
            <Link
              href="/capacity"
              className="mt-4 block text-xs text-cyan-300 hover:text-cyan-200"
            >
              See how shares are set →
            </Link>
          </Panel>

          <p className="px-1 text-[11px] leading-relaxed text-slate-600">
            Orbits are simulated at {SIM_SPEED}× speed and are not real telemetry.
          </p>
        </div>
      </div>
    </section>
  );
}

function SatelliteCard({ s }: { s: SatState }) {
  const collecting = s.status === "COLLECTING";
  return (
    <Panel className="p-5">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <Eyebrow>SATELLITE</Eyebrow>
          <h3 className="mt-1 font-semibold">{s.name}</h3>
        </div>
        <span
          className={
            collecting
              ? "rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300"
              : "rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-300"
          }
        >
          {s.status}
        </span>
      </div>

      <Eyebrow className="!tracking-widest">{collecting ? "CURRENT TARGET" : "NEXT TARGET"}</Eyebrow>
      {s.site ? (
        <>
          <p className="mt-1 text-sm font-medium">{s.site.name}</p>
          <div className="mt-1 flex items-center gap-3">
            <TeamChip team={s.site.team} />
            <span className="text-xs text-slate-500">
              {s.site.funded} funded request{s.site.funded === 1 ? "" : "s"}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-500">No funded target ahead</p>
      )}

      {collecting ? (
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-slate-500">ACQUISITION</span>
            <span>{Math.round(s.progress * 100)}%</span>
          </div>
          <Bar value={s.progress * 100} />
        </div>
      ) : (
        s.etaMs != null && (
          <p className="mt-5 text-xs text-slate-400">
            Next acquisition in <span className="text-slate-200">{formatEta(s.etaMs)}</span>{" "}
            <span className="text-slate-600">(sim time)</span>
          </p>
        )
      )}
    </Panel>
  );
}
