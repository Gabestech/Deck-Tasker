import type { ReactNode } from "react";
import { TEAM_BY_ID } from "@/lib/config";
import type { AllocatedRequest, TeamId } from "@/lib/types";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset,0_18px_40px_-22px_rgba(0,0,0,0.75)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

/** Small "i" that reveals a longer explanation on hover or keyboard focus. */
export function Tip({
  text,
  align = "start",
}: {
  text: string;
  align?: "start" | "center" | "end";
}) {
  const pos =
    align === "end" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0";
  return (
    <span className="group/tip relative inline-flex align-middle">
      <button
        type="button"
        aria-label="More info"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-white/15 text-[10px] font-semibold leading-none text-slate-500 transition hover:border-white/40 hover:text-slate-200 focus-visible:text-slate-200"
      >
        i
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none invisible absolute top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-[#0B0D1F] p-3 text-xs font-normal leading-relaxed text-slate-300 opacity-0 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] transition duration-150 group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100 ${pos}`}
      >
        {text}
      </span>
    </span>
  );
}

export function Eyebrow({
  children,
  className = "",
  tip,
}: {
  children: ReactNode;
  className?: string;
  tip?: string;
}) {
  const p = <p className={`text-xs font-medium text-slate-400 ${className}`}>{children}</p>;
  return tip ? (
    <div className="flex items-center gap-1.5">
      {p}
      <Tip text={tip} />
    </div>
  ) : (
    p
  );
}

export function TeamChip({ team, className = "" }: { team: TeamId; className?: string }) {
  const t = TEAM_BY_ID[team];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-slate-300 ${className}`}>
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: t.color }}
        aria-hidden
      />
      {t.name}
    </span>
  );
}

const STATUS_STYLES: Record<AllocatedRequest["status"], string> = {
  funded: "bg-emerald-400/10 text-emerald-300",
  waitlisted: "bg-amber-300/10 text-amber-200",
  completed: "bg-slate-400/10 text-slate-300",
};

export function StatusChip({ r }: { r: Pick<AllocatedRequest, "status" | "via"> }) {
  const label =
    r.status === "completed"
      ? "Collected"
      : r.status === "waitlisted"
        ? "Waitlisted"
        : r.via === "reserve"
          ? "Funded · reserve"
          : "Funded";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_STYLES[r.status]}`}>{label}</span>
  );
}

export function Bar({
  value,
  color = "#AEB8FF",
  className = "",
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
export const fmtDate = (ms: number) => dateFmt.format(ms);
export const fmtNum = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtPct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;
