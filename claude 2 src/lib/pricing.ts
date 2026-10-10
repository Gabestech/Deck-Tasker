import type { CollectionMode, DataProduct, Sensitivity } from "./types";

/*
 * Option lists follow Planet's public Tanager tasking docs:
 *  - scheduling modes: Flexible, Monitoring, Assured
 *  - sensitivity modes: STANDARD(1x8ms) / MEDIUM(2x8) / HIGH(3x8) / MAX(4x8)
 *  - data products: HYPERSPECTRAL_SCENES (Core Imagery), TANAGER_METHANE_DETECTION (Methane QuickLook)
 *  - asset types: basic/ortho radiance + surface-reflectance HDF5
 * Credit multipliers are ILLUSTRATIVE, not Planet pricing.
 */

export const MODE_INFO: Record<
  CollectionMode,
  { label: string; mult: number; blurb: string }
> = {
  flexible: {
    label: "Flexible",
    mult: 1,
    blurb: "Best-effort collection inside your window. Lowest cost, no guaranteed pass.",
  },
  monitoring: {
    label: "Monitoring",
    mult: 1.3,
    blurb: "Repeat collections of the same area over the window for change tracking.",
  },
  assured: {
    label: "Assured",
    mult: 1.8,
    blurb: "Search imaging windows first, then commit to a confirmed collection slot.",
  },
};

export const SENSITIVITY_INFO: Record<
  Sensitivity,
  { label: string; integrations: string; mult: number }
> = {
  standard: { label: "Standard", integrations: "1 × 8 ms", mult: 1 },
  medium: { label: "Medium", integrations: "2 × 8 ms", mult: 1.2 },
  high: { label: "High", integrations: "3 × 8 ms", mult: 1.4 },
  max: { label: "Max", integrations: "4 × 8 ms", mult: 1.6 },
};

export const PRODUCT_INFO: Record<
  DataProduct,
  { label: string; apiName: string; mult: number; blurb: string }
> = {
  core: {
    label: "Core Imagery",
    apiName: "HYPERSPECTRAL_SCENES",
    mult: 1,
    blurb: "Full hyperspectral scenes for your own retrievals and analysis.",
  },
  methane: {
    label: "Methane QuickLook",
    apiName: "TANAGER_METHANE_DETECTION",
    mult: 0.85,
    blurb: "Rapid methane detection product for screening plumes.",
  },
};

export const ASSET_TYPES = [
  { id: "ortho_radiance_hdf5", label: "Ortho radiance (HDF5)", default: true },
  { id: "basic_radiance_hdf5", label: "Basic radiance (HDF5)", default: true },
  { id: "ortho_sr_hdf5", label: "Ortho surface reflectance (HDF5)", default: false },
  { id: "basic_sr_hdf5", label: "Basic surface reflectance (HDF5)", default: false },
] as const;

export interface CostInput {
  widthKm: number;
  heightKm: number;
  /** Overrides widthKm x heightKm, e.g. for a drawn polygon. */
  areaKm2?: number;
  mode: CollectionMode;
  sensitivity: Sensitivity;
  product: DataProduct;
  captures: number;
}

export function areaKm2(widthKm: number, heightKm: number) {
  return Math.max(0, widthKm) * Math.max(0, heightKm);
}

export function creditCost(i: CostInput) {
  const base = (i.areaKm2 ?? areaKm2(i.widthKm, i.heightKm)) / 18;
  const captures = i.mode === "monitoring" ? Math.max(1, i.captures) : 1;
  return Math.max(
    1,
    Math.ceil(
      base *
        MODE_INFO[i.mode].mult *
        SENSITIVITY_INFO[i.sensitivity].mult *
        PRODUCT_INFO[i.product].mult *
        captures,
    ),
  );
}
