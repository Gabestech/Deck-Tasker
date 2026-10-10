/*
 * One satellite illustration, used both as a React element (side cards) and as a
 * DOM string (map markers). Static markup with no user input, so it is safe to inject.
 */
export function satelliteSvg(opts: { className?: string; size?: number } = {}) {
  const size = opts.size ?? 46;
  const cls = opts.className ? ` class="${opts.className}"` : "";
  return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" aria-hidden="true">
  <g transform="rotate(-38 24 24)">
    <rect x="1.5" y="17" width="15" height="14" rx="1.6" fill="rgba(143,156,255,0.28)" stroke="#AEB8FF" stroke-opacity="0.85" stroke-width="1"/>
    <path d="M6.5 17v14M11.5 17v14M1.5 24h15" stroke="#AEB8FF" stroke-opacity="0.4" stroke-width="0.8"/>
    <rect x="31.5" y="17" width="15" height="14" rx="1.6" fill="rgba(143,156,255,0.28)" stroke="#AEB8FF" stroke-opacity="0.85" stroke-width="1"/>
    <path d="M36.5 17v14M41.5 17v14M31.5 24h15" stroke="#AEB8FF" stroke-opacity="0.4" stroke-width="0.8"/>
    <path d="M16.5 24h3.5M28 24h3.5" stroke="#CBD2FF" stroke-width="1.4" stroke-linecap="round"/>
    <rect x="19.5" y="14.5" width="9" height="17" rx="2.2" fill="#E9ECFF"/>
    <rect x="19.5" y="14.5" width="9" height="5" rx="2.2" fill="#FFC857"/>
    <rect x="21.5" y="22" width="5" height="1.6" rx="0.8" fill="#5262E6" fill-opacity="0.55"/>
    <circle cx="24" cy="35" r="3" fill="#0B0D1F" stroke="#FF9F43" stroke-width="1.2"/>
    <circle cx="24" cy="35" r="1.1" fill="#FF9F43"/>
    <path d="M24 14.5v-4" stroke="#CBD2FF" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="24" cy="9.8" r="1.1" fill="#CBD2FF"/>
  </g>
</svg>`;
}
