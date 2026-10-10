"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SATELLITES, SIM_SPEED, formatEta, satState, simNow, type SatState } from "@/lib/sim";
import { buildSites } from "@/lib/sites";
import { useAllocation } from "@/lib/store";
import { formatLatLon, orbitalStats } from "@/lib/orbit";
import { SatelliteGlyph } from "./SatelliteGlyph";
import { TeamShareBars } from "./TeamShareBars";
import { Bar, Eyebrow, Panel, TeamChip, fmtPct } from "./ui";

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
  const weatherHolds = fundedSites.filter((s) => s.clearSky < 0.5).length;
  const collecting = (sats ?? []).filter((s) => s.status === "COLLECTING").length;

  return (
    <section className="flex h-full min-h-0 flex-col p-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="mb-1.5 text-sm font-medium text-cyan-300">Live operations</p>
          <h2 className="text-2xl font-semibold">Tanager Collection Network</h2>
          <p className="mt-1 text-sm text-slate-400">
            Satellites and this cycle&apos;s funded targets
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Fleet status</p>
          <p className="mt-1 text-sm text-emerald-400">
            {SATELLITES.length} satellites active
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0F1226]">
          <div className="relative min-h-0 flex-1">
            <OrbitalMap sites={sites} activeKeys={activeKeys} satStates={sats} />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-white/10 bg-black/20 px-5 py-3 text-xs">
            <span className="text-emerald-400">● Live</span>
            {(sats ?? []).map((s) => (
              <span key={s.id} className="text-slate-400">
                {s.id} {s.status.toLowerCase()}
              </span>
            ))}
            <span className="text-slate-400">{fundedSites.length} funded targets</span>
            <span className="text-amber-300">{weatherHolds} on weather watch</span>
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
              <Eyebrow>Fleet capacity</Eyebrow>
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
            Simulated orbits at {SIM_SPEED}× speed.
          </p>
        </div>
      </div>
    </section>
  );
}

function SatelliteCard({ s }: { s: SatState }) {
  const collecting = s.status === "COLLECTING";
  const def = SATELLITES.find((d) => d.id === s.id);
  const stats = def ? orbitalStats(def.orbit) : null;
  const niceName = s.name.replace("TANAGER", "Tanager");

  return (
    <Panel className="p-5">
      <div className="flex items-start gap-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_10px_24px_-12px_rgba(143,156,255,0.9)]">
          <SatelliteGlyph size={42} />
          <span
            className={`absolute -right-1 -top-1 h-3 w-3 rounded-full ring-4 ${
              collecting ? "bg-emerald-400 ring-emerald-400/20" : "bg-cyan-300 ring-cyan-300/15"
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">{niceName}</h3>
          <p className="mt-0.5 text-xs text-slate-500">Hyperspectral imager</p>
        </div>
        <span
          className={
            collecting
              ? "rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300"
              : "rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-300"
          }
        >
          {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-[1.45fr_1fr_1fr] gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-xs">
        <div>
          <dt className="text-slate-500">Position</dt>
          <dd className="mt-0.5 whitespace-nowrap font-medium tabular-nums text-slate-200">{formatLatLon(s.pos[0], s.pos[1])}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Altitude</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-slate-200">
            {stats ? `${Math.round(stats.altKm)} km` : "n/a"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Speed</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-slate-200">
            {stats ? `${stats.speedKmS.toFixed(1)} km/s` : "n/a"}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <Eyebrow>{collecting ? "Current target" : "Next target"}</Eyebrow>
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
      </div>

      {collecting ? (
        <div className="mt-4">
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-slate-500">Acquisition</span>
            <span>{Math.round(s.progress * 100)}%</span>
          </div>
          <Bar value={s.progress * 100} />
        </div>
      ) : (
        s.etaMs != null && (
          <p className="mt-4 text-xs text-slate-400">
            Next acquisition in <span className="text-slate-200">{formatEta(s.etaMs)}</span>{" "}
            <span className="text-slate-600" title="Demo clock runs faster than real time">(demo clock)</span>
          </p>
        )
      )}
    </Panel>
  );
}
