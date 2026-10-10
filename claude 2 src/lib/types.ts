export type TeamId = "og" | "impact" | "science" | "waste";
export type CollectionMode = "flexible" | "monitoring" | "assured";
export type Sensitivity = "standard" | "medium" | "high" | "max";
export type DataProduct = "core" | "methane";
export type Contention = "low" | "medium" | "high";
export type Policy = "fair" | "priority" | "fcfs";

export interface Team {
  id: TeamId;
  name: string;
  short: string;
  color: string;
}

export interface Region {
  id: string;
  name: string;
  area: string;
  lon: number;
  lat: number;
  /** Rough probability a given overpass is usable (cloud climatology). Demo value. */
  clearSky: number;
  /** Demand from other Planet customers / constellation users. We cannot control this. */
  contention: Contention;
  defaultWidthKm: number;
  defaultHeightKm: number;
}

export interface CollectionRequest {
  id: string;
  name: string;
  team: TeamId;
  requester: string;
  regionId: string;
  lon: number;
  lat: number;
  widthKm: number;
  heightKm: number;
  /** Drawn outline (lon/lat, open ring). When absent the AOI is the width x height box. */
  polygon?: [number, number][];
  /** True polygon area in km2. When absent, widthKm x heightKm. */
  areaKm2?: number;
  mode: CollectionMode;
  sensitivity: Sensitivity;
  product: DataProduct;
  captures: number;
  cloudMax: number;
  offNadirMax: number;
  sunElevMin: number;
  windowStart: number;
  windowEnd: number;
  valueRating: 1 | 2 | 3 | 4 | 5;
  urgent: boolean;
  justification: string;
  submittedAt: number;
  completed: boolean;
  creditCost: number;
}

export interface Weights {
  value: number;
  urgency: number;
  feasibility: number;
  age: number;
}

export interface ScoreBreakdown {
  value: number;
  urgency: number;
  feasibility: number;
  age: number;
  total: number;
}

export interface ScoredRequest extends CollectionRequest {
  score: ScoreBreakdown;
}

export type FundingStatus = "completed" | "funded" | "waitlisted";
export type FundingVia = "team" | "reserve" | "backfill" | "pool" | "completed" | null;

export interface AllocatedRequest extends ScoredRequest {
  status: FundingStatus;
  via: FundingVia;
  reason: string;
  /** 1-based rank by score among all open (not completed) requests. */
  rank: number;
}

export interface TeamAllocation {
  team: TeamId;
  demand: number;
  allocated: number;
  /** Share of total cycle capacity actually allocated to this team. */
  share: number;
  /** Equal-share ideal (max-min fair) as a share of total capacity. */
  idealShare: number;
  idealCredits: number;
  unmet: number;
  funded: number;
  waitlisted: number;
}

export interface AllocationResult {
  policy: Policy;
  capacity: number;
  reserve: number;
  requests: AllocatedRequest[];
  teams: TeamAllocation[];
  totalDemand: number;
  totalAllocated: number;
  oversubscription: number;
  /** Jain's fairness index vs the equal-share ideal, 0.25..1 (1 = perfectly fair). */
  jain: number;
}
