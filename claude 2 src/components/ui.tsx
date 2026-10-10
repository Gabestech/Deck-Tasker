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

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-medium text-slate-400 ${className}`}>
      {children}
    </p>
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
