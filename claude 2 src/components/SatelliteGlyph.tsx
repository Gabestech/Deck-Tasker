import { satelliteSvg } from "@/lib/satellite-art";

/** The satellite illustration as a React element. Static markup, no user input. */
export function SatelliteGlyph({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex"
      dangerouslySetInnerHTML={{ __html: satelliteSvg({ size }) }}
    />
  );
}
