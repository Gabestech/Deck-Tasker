"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const icon = "h-[20px] w-[20px]";

const NAV = [
  {
    href: "/",
    label: "Live Orbits",
    icon: (
      <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.8 2.6 2.8 14.4 0 17M12 3.5c-2.8 2.6-2.8 14.4 0 17" />
      </svg>
    ),
  },
  {
    href: "/budget",
    label: "Budget",
    icon: (
      <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="9" width="18" height="6" rx="1.5" />
        <path d="M9 9v6M14 9v6M3 5h11M3 19h18" />
      </svg>
    ),
  },
  {
    href: "/requests",
    label: "Requests",
    icon: (
      <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="M4 6h1M4 12h1M4 18h1" strokeLinecap="round" strokeWidth="2.2" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function LogoMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05]">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="3.2" fill="#AEB8FF" />
        <ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(-28 12 12)" stroke="#AEB8FF" strokeOpacity="0.55" strokeWidth="1.3" />
        <circle cx="19.2" cy="8.4" r="1.4" fill="#fff" />
      </svg>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh flex-col">
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0B0D1F]/90 px-4 backdrop-blur-xl sm:px-5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <LogoMark />
          <span className="truncate text-[15px] font-semibold tracking-tight">Deck Tasker</span>
          <span className="hidden items-center gap-1.5 rounded-md border border-white/[0.08] px-2 py-0.5 text-[11px] leading-5 sm:inline-flex">
            <span className="text-slate-500">Created by</span>
            <span className="font-medium text-slate-200">Gabriel</span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-4">
          <span className="hidden text-xs text-slate-500 md:inline">Simulated data</span>
          <Link
            href="/tasking"
            aria-current={pathname.startsWith("/tasking") ? "page" : undefined}
            className="btn btn-primary !px-3.5 !py-1.5 !text-[13px]"
          >
            <span aria-hidden className="text-base leading-none">+</span>
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New request</span>
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Side rail: tablet and up */}
        <aside className="hidden w-[88px] shrink-0 flex-col items-center border-r border-white/[0.07] bg-[#080A18] py-3 md:flex">
          <nav className="flex flex-col gap-2">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="nav-btn w-[72px] px-1 py-2.5"
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div
            className="mt-auto flex w-[72px] cursor-not-allowed flex-col items-center gap-1 py-2.5 text-[11px] font-medium leading-tight text-slate-600"
            title="Airborne campaign tasking: coming soon"
          >
            <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 14l8-2 5-9 2 1-2 8 6 2v2l-7-1-2 5h-2l0-5-8-1z" />
            </svg>
            Airborne
            <span className="text-[10px] text-slate-700">Soon</span>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Bottom tab bar: phones */}
      <nav className="flex shrink-0 gap-2 border-t border-white/[0.07] bg-[#080A18] px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="nav-btn flex-1 py-1.5"
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
