import type { ReactNode } from "react";
import { Tip } from "./ui";

export const inputCls =
  "w-full rounded-xl border border-white/10 bg-[#14172E] px-3.5 py-2.5 text-sm text-slate-100 " +
  "shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition placeholder:text-slate-600 " +
  "hover:border-white/20 focus:border-cyan-400/60 focus:outline-none focus:ring-4 focus:ring-cyan-400/15";

export function Field({
  label,
  hint,
  tip,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  tip?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-300">
        {label}
        {tip && <Tip text={tip} />}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-snug text-slate-500">{hint}</span>}
    </label>
  );
}

export function OptionCards<T extends string | number>({
  value,
  onChange,
  options,
  columns = 3,
  name,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; title: string; blurb?: string; meta?: string }[];
  columns?: 2 | 3 | 4 | 5;
  name: string;
}) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" }[
    columns
  ];
  return (
    <div role="radiogroup" aria-label={name} className={`grid grid-cols-1 gap-2 ${cols}`}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`rounded-xl border p-3.5 text-left transition duration-200 active:scale-[0.985] ${
              selected
                ? "border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_0_3px_rgba(143,156,255,0.14),0_12px_26px_-14px_rgba(111,125,242,0.8)]"
                : "border-white/10 bg-white/[0.03] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] hover:-translate-y-px hover:border-white/25 hover:bg-white/[0.06]"
            }`}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-slate-100">{o.title}</span>
              {o.meta && <span className="text-[11px] text-slate-500">{o.meta}</span>}
            </span>
            {o.blurb && <span className="mt-1 block text-xs leading-snug text-slate-400">{o.blurb}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  hint,
  tip,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  hint?: string;
  tip?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
          {label}
          {tip && <Tip text={tip} />}
        </span>
        <span className="text-sm tabular-nums text-slate-100">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        aria-label={label}
      />
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn";
  title: string;
  children?: ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-300/25 bg-amber-300/5 text-amber-100"
      : "border-cyan-400/20 bg-cyan-400/5 text-cyan-100";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-xs leading-relaxed opacity-80">{children}</div>}
    </div>
  );
}
