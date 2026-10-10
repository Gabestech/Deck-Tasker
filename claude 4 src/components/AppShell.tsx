"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icon = "h-[22px] w-[22px]";

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
      <header className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0B0D1F]/70 px-6 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#8F9CFF] to-[#C77DFF] text-sm font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.45)_inset,0_10px_20px_-8px_rgba(143,156,255,0.9)]">
            DT
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-3">
              <h1 className="text-[15px] font-semibold tracking-tight">Deck Tasker</h1>
              <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-2.5 pr-3 text-xs leading-none shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(174,184,255,0.9)]" aria-hidden />
                <span className="text-slate-500">Created by</span>
                <span className="font-semibold tracking-tight text-slate-100">Gabriel</span>
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Tanager collection operations</p>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <span className="hidden rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 text-xs text-amber-200 lg:inline">
            Prototype with simulated data
          </span>
          <div className="hidden items-center gap-2 text-xs text-slate-400 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            System online
          </div>
          <Link href="/tasking" className="btn btn-primary">
            New request
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[76px] shrink-0 flex-col items-center border-r border-white/[0.07] py-4">
          <nav className="flex flex-col gap-1.5">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-[60px] flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-medium transition duration-200 active:scale-95 ${
                    active
                      ? "bg-white/[0.08] text-white shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_10px_22px_-12px_rgba(111,125,242,0.9)]"
                      : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
                  }`}
                >
                  <span className={active ? "text-cyan-300" : ""}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div
            className="mt-auto flex w-[60px] cursor-not-allowed flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-medium text-slate-700"
            title="Airborne campaign tasking: coming soon"
          >
            <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 14l8-2 5-9 2 1-2 8 6 2v2l-7-1-2 5h-2l0-5-8-1z" />
            </svg>
            Air
            <span className="-mt-0.5 text-[9px] text-slate-600">soon</span>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
