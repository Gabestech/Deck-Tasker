import { DAY, DEMO_NOW } from "./config";
import { creditCost } from "./pricing";
import { getRegion } from "./regions";
import type {
  CollectionMode,
  CollectionRequest,
  DataProduct,
  Sensitivity,
  TeamId,
} from "./types";

/*
 * Fake demo requests. Swap this file for an API call later; everything
 * downstream (scoring, allocation, UI) only needs CollectionRequest[].
 */

interface Seed {
  id: number;
  name: string;
  team: TeamId;
  by: string;
  region: string;
  h?: number; // along-track length override, km
  mode?: CollectionMode;
  sens?: Sensitivity;
  product?: DataProduct;
  captures?: number;
  value: 1 | 2 | 3 | 4 | 5;
  win: [number, number]; // days from DEMO_NOW: [start, end]
  ago: number; // submitted N days ago
  urgent?: boolean;
  done?: boolean;
  why: string;
  cloud?: number;
}

const seeds: Seed[] = [
  // ---------------- Oil & Gas ----------------
  { id: 1001, name: "Delaware Basin compressor corridor", team: "og", by: "M. Alvarez", region: "permian", h: 120, mode: "monitoring", captures: 4, sens: "high", value: 5, win: [1, 20], ago: 8, why: "Quarterly compliance verification across midstream compressor stations." },
  { id: 1002, name: "Midland pad inventory sweep", team: "og", by: "M. Alvarez", region: "permian", h: 100, mode: "flexible", sens: "medium", value: 4, win: [3, 25], ago: 9, why: "Baseline emissions inventory for newly drilled pads." },
  { id: 1003, name: "Eagle Ford gathering lines", team: "og", by: "T. Nguyen", region: "eagle-ford", h: 120, mode: "monitoring", captures: 3, sens: "medium", value: 4, win: [2, 22], ago: 7, why: "Follow-up on persistent emitters flagged in September." },
  { id: 1004, name: "Bakken flaring cross-check", team: "og", by: "T. Nguyen", region: "bakken", h: 110, mode: "flexible", sens: "medium", value: 3, win: [5, 28], ago: 6, why: "Compare flare volumes against reported figures." },
  { id: 1005, name: "Haynesville processing plants", team: "og", by: "R. Okafor", region: "haynesville", h: 100, mode: "assured", sens: "standard", value: 4, win: [4, 14], ago: 5, why: "Time-critical operator engagement ahead of a regulatory filing." },
  { id: 1006, name: "Marcellus well-pad survey", team: "og", by: "R. Okafor", region: "marcellus", h: 110, mode: "flexible", sens: "standard", value: 3, win: [6, 30], ago: 4, why: "Routine survey of an operator portfolio." },
  { id: 1007, name: "DJ Basin tank battery check", team: "og", by: "M. Alvarez", region: "dj", h: 120, mode: "monitoring", captures: 3, sens: "medium", value: 4, win: [2, 16], ago: 3, why: "Verify mitigation at tank batteries after retrofits." },
  { id: 1008, name: "Uinta Basin repeat coverage", team: "og", by: "T. Nguyen", region: "uinta", h: 100, mode: "monitoring", captures: 3, sens: "standard", value: 3, win: [8, 30], ago: 3, why: "Seasonal emissions variability." },
  { id: 1009, name: "Kern County field survey", team: "og", by: "R. Okafor", region: "bakersfield", h: 90, mode: "flexible", sens: "medium", value: 4, win: [5, 24], ago: 2, why: "Legacy field emissions survey (authorization on file)." },
  { id: 1010, name: "Permian northern shelf", team: "og", by: "M. Alvarez", region: "permian", h: 110, mode: "assured", sens: "high", value: 4, win: [3, 12], ago: 2, why: "Assured pass needed for partner reporting deadline." },
  { id: 1011, name: "Alberta oil sands tailings", team: "og", by: "T. Nguyen", region: "alberta", h: 100, mode: "flexible", sens: "medium", value: 3, win: [7, 30], ago: 1, why: "Tailings-pond emissions screening." },
  { id: 1012, name: "Permian pad sweep (completed)", team: "og", by: "M. Alvarez", region: "permian", h: 100, mode: "flexible", sens: "medium", value: 4, win: [-9, -3], ago: 12, done: true, why: "Completed earlier this cycle." },
  { id: 1013, name: "Eagle Ford baseline (completed)", team: "og", by: "T. Nguyen", region: "eagle-ford", h: 100, mode: "flexible", sens: "standard", value: 3, win: [-8, -2], ago: 12, done: true, why: "Completed earlier this cycle." },

  // ---------------- Impact ----------------
  { id: 2001, name: "Caspian super-emitter follow-up", team: "impact", by: "L. Haddad", region: "turkmenistan", h: 120, mode: "assured", sens: "high", value: 5, win: [1, 6], ago: 1, urgent: true, why: "Large plume detected last week. Operator outreach needs confirmation fast." },
  { id: 2002, name: "Hassi Messaoud mitigation check", team: "impact", by: "L. Haddad", region: "hassi", h: 110, mode: "monitoring", captures: 3, sens: "medium", value: 4, win: [2, 21], ago: 6, why: "Verify operator commitments after a vent-reduction program." },
  { id: 2003, name: "Permian emitter confirmation", team: "impact", by: "S. Brandt", region: "permian", h: 100, mode: "flexible", sens: "medium", value: 4, win: [3, 18], ago: 5, why: "Confirm persistent emitters before notifying operators." },
  { id: 2004, name: "DJ Basin outreach targets", team: "impact", by: "S. Brandt", region: "dj", h: 110, mode: "flexible", sens: "medium", value: 3, win: [5, 26], ago: 4, why: "Evidence package for state-level partner discussions." },
  { id: 2005, name: "San Juan emitter verification", team: "impact", by: "L. Haddad", region: "san-juan", h: 120, mode: "monitoring", captures: 3, sens: "standard", value: 4, win: [4, 20], ago: 3, why: "Track three persistent emitters." },
  { id: 2006, name: "Caspian repeat coverage", team: "impact", by: "S. Brandt", region: "turkmenistan", h: 110, mode: "monitoring", captures: 4, sens: "medium", value: 3, win: [6, 30], ago: 2, why: "Longer-term monitoring of a high-activity region." },
  { id: 2007, name: "Alberta partner site", team: "impact", by: "L. Haddad", region: "alberta", h: 100, mode: "flexible", sens: "standard", value: 3, win: [9, 30], ago: 1, why: "Partner-requested site visit imagery." },
  { id: 2008, name: "Hassi Messaoud baseline (completed)", team: "impact", by: "L. Haddad", region: "hassi", h: 90, mode: "flexible", sens: "standard", value: 3, win: [-7, -2], ago: 11, done: true, why: "Completed earlier this cycle." },

  // ---------------- Science ----------------
  { id: 3001, name: "Four Corners hotspot study", team: "science", by: "Dr. K. Mercer", region: "san-juan", h: 130, mode: "monitoring", captures: 4, sens: "max", value: 5, win: [2, 25], ago: 10, why: "Core dataset for a hotspot attribution paper under review." },
  { id: 3002, name: "Oil sands plume dynamics", team: "science", by: "Dr. K. Mercer", region: "alberta", h: 110, mode: "flexible", sens: "high", value: 4, win: [6, 28], ago: 8, why: "Plume morphology under varied wind regimes." },
  { id: 3003, name: "Marcellus coal-mine vents", team: "science", by: "Dr. P. Iyer", region: "marcellus", h: 100, mode: "flexible", sens: "high", value: 4, win: [5, 27], ago: 7, why: "Disentangle mine-vent from gas-well emissions." },
  { id: 3004, name: "Los Angeles urban methane", team: "science", by: "Dr. P. Iyer", region: "la-basin", h: 70, mode: "assured", sens: "high", value: 5, win: [3, 15], ago: 6, why: "Urban emissions field campaign coordination (authorization on file)." },
  { id: 3005, name: "Houston wetlands vs landfills", team: "science", by: "Dr. K. Mercer", region: "houston", h: 80, mode: "flexible", sens: "high", value: 3, win: [8, 30], ago: 4, why: "Separate biogenic from waste sources." },
  { id: 3006, name: "Uinta winter inversion", team: "science", by: "Dr. P. Iyer", region: "uinta", h: 90, mode: "monitoring", captures: 3, sens: "high", value: 4, win: [4, 18], ago: 3, why: "Capture inversion-layer emission behavior." },
  { id: 3007, name: "Bakken spectral validation", team: "science", by: "Dr. K. Mercer", region: "bakken", h: 90, mode: "flexible", sens: "max", product: "core", value: 3, win: [10, 30], ago: 2, why: "Validate retrievals against ground measurements." },
  { id: 3008, name: "Hassi baseline spectra (completed)", team: "science", by: "Dr. P. Iyer", region: "hassi", h: 80, mode: "flexible", sens: "high", value: 4, win: [-8, -3], ago: 12, done: true, why: "Completed earlier this cycle." },

  // ---------------- Waste ----------------
  { id: 4001, name: "Delhi-NCR landfill cluster", team: "waste", by: "A. Rao", region: "delhi", h: 120, mode: "monitoring", captures: 3, sens: "medium", value: 5, win: [2, 20], ago: 7, why: "Quantify emissions from the largest landfill cluster for city partnership." },
  { id: 4002, name: "Mumbai landfill monitoring", team: "waste", by: "A. Rao", region: "mumbai", h: 100, mode: "monitoring", captures: 3, sens: "medium", value: 4, win: [4, 24], ago: 5, why: "Pre/post capture-system installation." },
  { id: 4003, name: "Houston landfill survey", team: "waste", by: "N. Park", region: "houston", h: 90, mode: "flexible", sens: "medium", value: 3, win: [6, 28], ago: 4, why: "Annual landfill survey." },
  { id: 4004, name: "São Paulo landfill check", team: "waste", by: "N. Park", region: "sao-paulo", h: 90, mode: "flexible", sens: "standard", value: 3, win: [7, 30], ago: 3, why: "Follow-up on previously detected plumes." },
  { id: 4005, name: "Buenos Aires landfills", team: "waste", by: "A. Rao", region: "buenos-aires", h: 80, mode: "flexible", sens: "standard", value: 3, win: [9, 30], ago: 2, why: "New partner city onboarding." },
  { id: 4006, name: "Los Angeles landfill review", team: "waste", by: "N. Park", region: "la-basin", h: 60, mode: "flexible", sens: "medium", value: 4, win: [5, 22], ago: 2, why: "Landfill gas capture effectiveness (authorization on file)." },
];

export const MOCK_REQUESTS: CollectionRequest[] = seeds.map((s) => {
  const region = getRegion(s.region);
  const widthKm = region.defaultWidthKm;
  const heightKm = s.h ?? region.defaultHeightKm;
  const mode = s.mode ?? "flexible";
  const sensitivity = s.sens ?? "standard";
  const product = s.product ?? "core";
  const captures = s.captures ?? 1;
  return {
    id: `REQ-${s.id}`,
    name: s.name,
    team: s.team,
    requester: s.by,
    regionId: region.id,
    lon: region.lon,
    lat: region.lat,
    widthKm,
    heightKm,
    mode,
    sensitivity,
    product,
    captures,
    cloudMax: s.cloud ?? 20,
    offNadirMax: 25,
    sunElevMin: 30,
    windowStart: DEMO_NOW + s.win[0] * DAY,
    windowEnd: DEMO_NOW + s.win[1] * DAY,
    valueRating: s.value,
    urgent: !!s.urgent,
    justification: s.why,
    submittedAt: DEMO_NOW - s.ago * DAY,
    completed: !!s.done,
    creditCost: creditCost({ widthKm, heightKm, mode, sensitivity, product, captures }),
  };
});
