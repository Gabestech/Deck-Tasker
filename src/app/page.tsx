import OrbitalMap from "@/components/OrbitalMap";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#071018] text-white">
      {/* Top Navigation */}
      <header className="flex h-16 items-center justify-between border-b border-white/10 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
            DT
          </div>

          <div>
            <h1 className="text-sm font-semibold tracking-wide">
              DECK TASKER
            </h1>
            <p className="text-xs text-slate-500">
              Collection Operations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            SYSTEM ONLINE
          </div>

          <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10">
            New Request
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Navigation Rail */}
        <aside className="flex w-16 flex-col items-center border-r border-white/10 py-5">
          <button className="mb-8 text-xl text-slate-400 hover:text-white">
            ☰
          </button>

          <nav className="flex flex-col gap-6 text-lg text-slate-500">
            <button className="text-cyan-300">◎</button>
            <button className="hover:text-white">◇</button>
            <button className="hover:text-white">☷</button>
            <button className="hover:text-white">▤</button>
            <button className="hover:text-white">↻</button>
            <button className="hover:text-white">✓</button>
            <button className="hover:text-white">▥</button>
          </nav>
        </aside>

        {/* Live Operations */}
        <section className="flex-1 p-6">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="mb-1 text-xs font-medium tracking-[0.2em] text-cyan-400">
                LIVE OPERATIONS
              </p>

              <h2 className="text-2xl font-semibold">
                Tanager Collection Network
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Real-time collection activity and target deck status
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500">
                FLEET STATUS
              </p>
              <p className="mt-1 text-sm text-emerald-400">
                2 SATELLITES ACTIVE
              </p>
            </div>
          </div>

          {/* Main Operations Area */}
          <div className="grid grid-cols-[1fr_300px] gap-4">
            {/* Map Placeholder */}
            <div className="relative min-h-[620px] overflow-hidden rounded-xl border border-white/10 bg-[#091722]">
              <div className="absolute left-5 top-5 z-10">
                <p className="text-xs tracking-widest text-slate-500">
                  LIVE ORBITAL VIEW
                </p>
              </div>

              <OrbitalMap />

              {/* Bottom Status */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center gap-6 border-t border-white/10 bg-black/20 px-5 py-3 text-xs">
                <span className="text-emerald-400">● LIVE</span>
                <span className="text-slate-400">
                  T1 COLLECTING
                </span>
                <span className="text-slate-400">
                  T2 TRANSIT
                </span>
                <span className="text-slate-400">
                  37 ACTIVE TARGETS
                </span>
                <span className="text-amber-300">
                  2 WEATHER HOLDS
                </span>
              </div>
            </div>

            {/* Satellite Status Panel */}
            <div className="space-y-4">
              <SatelliteCard
                name="TANAGER-1"
                status="COLLECTING"
                target="Permian Basin"
                team="Oil & Gas"
                progress={68}
              />

              <SatelliteCard
                name="TANAGER-2"
                status="TRANSIT"
                target="San Juan Basin"
                team="Science"
                progress={0}
              />

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-medium tracking-widest text-slate-500">
                    FLEET CAPACITY
                  </p>
                  <span className="text-xs text-slate-400">
                    OCT
                  </span>
                </div>

                <CapacityBar name="Tanager-1" value={78} />
                <CapacityBar name="Tanager-2" value={51} />

                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">
                      Fleet allocated
                    </span>
                    <span>67%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SatelliteCard({
  name,
  status,
  target,
  team,
  progress,
}: {
  name: string;
  status: string;
  target: string;
  team: string;
  progress: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-xs tracking-widest text-slate-500">
            SATELLITE
          </p>
          <h3 className="mt-1 font-semibold">{name}</h3>
        </div>

        <span
          className={
            status === "COLLECTING"
              ? "rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300"
              : "rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-300"
          }
        >
          {status}
        </span>
      </div>

      <p className="text-xs text-slate-500">
        {status === "COLLECTING"
          ? "CURRENT TARGET"
          : "NEXT TARGET"}
      </p>

      <p className="mt-1 text-sm font-medium">{target}</p>
      <p className="mt-1 text-xs text-slate-400">{team}</p>

      {progress > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-slate-500">
              COLLECTION
            </span>
            <span>{progress}%</span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CapacityBar({
  name,
  value,
}: {
  name: string;
  value: number;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex justify-between text-xs">
        <span className="text-slate-400">{name}</span>
        <span>{value}%</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-cyan-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}