"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";

const WIDTH = 256;
const GAP = 8;

/**
 * Small "i" that reveals a longer explanation on hover, focus or tap.
 * The bubble is drawn on top of the whole page, so scrolling panels can't clip it,
 * and it is nudged to stay inside the window.
 */
export function Tip({ text }: { text: string; align?: "start" | "center" | "end" }) {
  const id = useId();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const left = Math.min(Math.max(GAP, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - GAP);
    setPos({ top: r.bottom + GAP, left });
  };
  const hide = () => setPos(null);

  return (
    <span className="inline-flex align-middle">
      <button
        type="button"
        aria-label="More info"
        aria-describedby={pos ? id : undefined}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={hide}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={hide}
        onClick={(e) => (pos ? hide() : show(e.currentTarget))}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-white/15 text-[10px] font-semibold leading-none text-slate-500 transition hover:border-white/40 hover:text-slate-200 focus-visible:text-slate-200"
      >
        i
      </button>
      {pos &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            style={{ top: pos.top, left: pos.left, width: WIDTH }}
            className="pointer-events-none fixed z-[1000] rounded-lg border border-white/10 bg-[#0B0D1F] p-3 text-xs font-normal leading-relaxed text-slate-300 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)]"
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
