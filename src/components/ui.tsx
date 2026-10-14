import type { ReactNode } from "react";
import { TEAM_BY_ID } from "@/lib/config";
import type { AllocatedRequest, TeamId } from "@/lib/types";
import { Tip } from "./Tip";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/[0.08] bg-[#11132A]/80 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] ${className}`}
    >
      {children}
    </div>
  );
}

/** Title + one quiet line of context. Same on every page. */
export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h1>
        {meta && <p className="mt-0.5 text-[13px] text-slate-500">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Small inline toggle group. Scrolls sideways on narrow screens instead of wrapping. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`inline-flex max-w-full shrink-0 overflow-x-auto rounded-lg border border-white/[0.08] bg-black/20 p-0.5 [scrollbar-width:none] ${className}`}
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.id)}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition ${
              on
                ? "bg-[#2B3170] text-white shadow-[0_1px_0_rgba(255,255,255,0.14)_inset,0_1px_3px_rgba(0,0,0,0.4)]"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export { Tip };

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

export function TeamDot({ team, className = "" }: { team: TeamId; className?: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
      style={{ background: TEAM_BY_ID[team].color }}
      aria-hidden
    />
  );
}

export function TeamChip({ team, className = "" }: { team: TeamId; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-slate-300 ${className}`}>
      <TeamDot team={team} />
      {TEAM_BY_ID[team].name}
    </span>
  );
}

const STATUS_STYLES: Record<AllocatedRequest["status"], string> = {
  funded: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  waitlisted: "bg-amber-300/10 text-amber-200 ring-amber-300/20",
  completed: "bg-white/[0.05] text-slate-400 ring-white/10",
};

export const STATUS_LABEL: Record<AllocatedRequest["status"], string> = {
  funded: "Funded",
  waitlisted: "Waitlisted",
  completed: "Collected",
};

export function StatusChip({ r }: { r: Pick<AllocatedRequest, "status" | "via"> }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLES[r.status]}`}
    >
      {STATUS_LABEL[r.status]}
    </span>
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
