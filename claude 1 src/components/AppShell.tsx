"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icon = "h-5 w-5";

const NAV = [
  {
    href: "/",
    label: "Ops",
    icon: (
      <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
      </svg>
    ),
  },
  {
    href: "/tasking",
    label: "Task",
    icon: (
      <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="7" />
        <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
      </svg>
    ),
  },
  {
    href: "/queue",
    label: "Queue",
    icon: (
      <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    href: "/capacity",
    label: "Capacity",
    icon: (
      <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M5 20V10M12 20V4M19 20v-7" />
      </svg>
    ),
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-sm font-semibold text-cyan-300">
            DT
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide">DECK TASKER</h1>
            <p className="text-xs text-slate-500">Tanager Collection Operations</p>
          </div>
        </Link>

        <div className="flex items-center gap-5">
          <span className="hidden rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 text-[11px] tracking-wider text-amber-200 sm:inline">
            PROTOTYPE · SIMULATED DATA
          </span>
          <div className="hidden items-center gap-2 text-xs text-slate-400 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            SYSTEM ONLINE
          </div>
          <Link
            href="/tasking"
            className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-medium text-[#04141c] transition hover:bg-cyan-200"
          >
            New Request
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[72px] shrink-0 flex-col items-center border-r border-white/10 py-4">
          <nav className="flex flex-col gap-2">
            {NAV.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-14 flex-col items-center gap-1 rounded-lg py-2 text-[10px] tracking-wider transition ${
                    active
                      ? "bg-cyan-400/10 text-cyan-300"
                      : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
                  }`}
                >
                  {item.icon}
                  {item.label.toUpperCase()}
                </Link>
              );
            })}
          </nav>

          <div
            className="mt-auto flex w-14 cursor-not-allowed flex-col items-center gap-1 rounded-lg py-2 text-[10px] tracking-wider text-slate-700"
            title="Airborne campaign tasking: coming soon"
          >
            <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 14l8-2 5-9 2 1-2 8 6 2v2l-7-1-2 5h-2l0-5-8-1z" />
            </svg>
            AIR
            <span className="-mt-0.5 text-[8px] tracking-widest text-slate-600">SOON</span>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
