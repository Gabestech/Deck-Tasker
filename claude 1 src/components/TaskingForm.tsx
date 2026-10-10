"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { allocate } from "@/lib/allocation";
import {
  CYCLE_CAPACITY,
  DAY,
  DEMO_NOW,
  SWATH_KM,
  TEAMS,
  TEAM_BY_ID,
} from "@/lib/config";
import {
  ASSET_TYPES,
  MODE_INFO,
  PRODUCT_INFO,
  SENSITIVITY_INFO,
  areaKm2,
  creditCost,
} from "@/lib/pricing";
import { REGIONS, getRegion, nearestRegion, restrictionsFor } from "@/lib/regions";
import { scoreAll } from "@/lib/scoring";
import { submitRequest, useAllRequests, usePolicyState } from "@/lib/store";
import type {
  AllocatedRequest,
  CollectionMode,
  CollectionRequest,
  DataProduct,
  Sensitivity,
  TeamId,
} from "@/lib/types";
import { Field, Notice, OptionCards, Slider, inputCls } from "./form-bits";
import { Bar, Eyebrow, Panel, StatusChip, TeamChip, fmtDate, fmtNum } from "./ui";

const AoiMap = dynamic(() => import("./AoiMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] animate-pulse rounded-lg border border-white/10 bg-[#050b12]" />
  ),
});

const STEPS = ["Request", "Area", "Window & mode", "Constraints", "Product", "Review"] as const;

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const startOf = (d: string) => Date.parse(`${d}T00:00:00Z`);
const endOf = (d: string) => Date.parse(`${d}T23:59:59Z`);

interface Draft {
  name: string;
  team: TeamId | "";
  requester: string;
  project: string;
  value: 0 | 1 | 2 | 3 | 4 | 5;
  urgent: boolean;
  justification: string;

  regionId: string;
  lon: number;
  lat: number;
  widthKm: number;
  heightKm: number;
  authAck: boolean;

  mode: CollectionMode;
  start: string;
  end: string;
  captures: number;
  windowChoice: string | null;

  cloudMax: number;
  offNadirMax: number;
  sunElevMin: number;
  sensitivity: Sensitivity;

  product: DataProduct;
  assets: string[];
  delivery: string;
  notify: boolean;
}

const permian = REGIONS[0];

const INITIAL: Draft = {
  name: "",
  team: "",
  requester: "",
  project: "",
  value: 0,
  urgent: false,
  justification: "",

  regionId: permian.id,
  lon: permian.lon,
  lat: permian.lat,
  widthKm: permian.defaultWidthKm,
  heightKm: permian.defaultHeightKm,
  authAck: false,

  mode: "flexible",
  start: iso(DEMO_NOW + 2 * DAY),
  end: iso(DEMO_NOW + 16 * DAY),
  captures: 3,
  windowChoice: null,

  cloudMax: 20,
  offNadirMax: 25,
  sunElevMin: 30,
  sensitivity: "standard",

  product: "core",
  assets: ASSET_TYPES.filter((a) => a.default).map((a) => a.id),
  delivery: "cm-platform",
  notify: true,
};

const DELIVERY = [
  { value: "cm-platform", title: "Carbon Mapper data platform", blurb: "Delivered into the internal catalog." },
  { value: "planet", title: "Planet Platform", blurb: "Keep assets in your Planet account." },
  { value: "bucket", title: "Cloud storage bucket", blurb: "Push to an S3 / GCS bucket you own." },
];

const VALUE_LABELS = ["", "Routine", "Useful", "Important", "High value", "Mission critical"];

/** Mock "imaging window search" results for Assured orders (deterministic). */
function imagingWindows(d: Draft) {
  const base = startOf(d.start);
  const seed = Math.abs(Math.round(d.lon * 10 + d.lat * 10));
  return [1, 4, 7].map((day, i) => {
    const startMs = base + day * DAY + ((seed + i * 17) % 5) * 3_600_000 + 16 * 3_600_000;
    const minute = (seed * (i + 3)) % 50;
    const start = startMs + minute * 60_000;
    return {
      id: `win-${i}`,
      start,
      end: start + 7 * 60_000,
      sat: i === 1 ? "TANAGER-2" : "TANAGER-1",
      offNadir: 6 + ((seed + i * 5) % 17),
    };
  });
}

function toRequest(d: Draft, id: string): CollectionRequest {
  const region = nearestRegion(d.lon, d.lat) ?? getRegion(d.regionId);
  return {
    id,
    name: d.name.trim() || "Untitled request",
    team: (d.team || "science") as TeamId,
    requester: d.requester.trim() || "Unknown",
    regionId: region.id,
    lon: d.lon,
    lat: d.lat,
    widthKm: d.widthKm,
    heightKm: d.heightKm,
    mode: d.mode,
    sensitivity: d.sensitivity,
    product: d.product,
    captures: d.mode === "monitoring" ? d.captures : 1,
    cloudMax: d.cloudMax,
    offNadirMax: d.offNadirMax,
    sunElevMin: d.sunElevMin,
    windowStart: startOf(d.start),
    windowEnd: endOf(d.end),
    valueRating: (d.value || 3) as 1 | 2 | 3 | 4 | 5,
    urgent: d.urgent,
    justification: d.justification.trim(),
    submittedAt: DEMO_NOW,
    completed: false,
    creditCost: creditCost({
      widthKm: d.widthKm,
      heightKm: d.heightKm,
      mode: d.mode,
      sensitivity: d.sensitivity,
      product: d.product,
      captures: d.captures,
    }),
  };
}

export function TaskingForm() {
  const [kind, setKind] = useState<"satellite" | "airborne">("satellite");
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(INITIAL);
  const [focusKey, setFocusKey] = useState("init");
  const [result, setResult] = useState<
    (Pick<AllocatedRequest, "id" | "name" | "team" | "status" | "via" | "reason" | "rank"> & {
      cost: number;
    }) | null
  >(null);

  const all = useAllRequests();
  const policy = usePolicyState();

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  /* ---------- derived ---------- */
  const draftReq = useMemo(() => toRequest(d, "DRAFT"), [d]);
  const restrictions = useMemo(() => restrictionsFor(d.lon, d.lat), [d.lon, d.lat]);
  const area = areaKm2(d.widthKm, d.heightKm);
  const windows = useMemo(() => imagingWindows(d), [d]);

  const projection = useMemo(() => {
    const opts = { policy: "fair" as const, capacity: CYCLE_CAPACITY, reservePct: policy.reservePct };
    const before = allocate(scoreAll(all, policy.weights), opts);
    const withDraft = allocate(scoreAll([...all, draftReq], policy.weights), opts);
    const mine = withDraft.requests.find((r) => r.id === "DRAFT");
    const displaced = withDraft.requests.filter((r) => {
      if (r.id === "DRAFT") return false;
      const prev = before.requests.find((x) => x.id === r.id);
      return prev && prev.status !== "waitlisted" && r.status === "waitlisted";
    });
    const team = d.team || null;
    return {
      mine,
      displaced,
      teamBefore: team ? before.teams.find((t) => t.team === team) : null,
      teamAfter: team ? withDraft.teams.find((t) => t.team === team) : null,
    };
  }, [all, draftReq, policy.weights, policy.reservePct, d.team]);

  const issues = useMemo(() => {
    const list: { step: number; msg: string }[] = [];
    if (d.name.trim().length < 3) list.push({ step: 0, msg: "Give the request a name" });
    if (!d.team) list.push({ step: 0, msg: "Choose the requesting team" });
    if (!d.requester.trim()) list.push({ step: 0, msg: "Add the requester" });
    if (!d.value) list.push({ step: 0, msg: "Rate the scientific / operational value" });
    if (d.justification.trim().length < 20)
      list.push({ step: 0, msg: "Add a justification (at least 20 characters)" });
    if (!(Math.abs(d.lat) <= 85 && Math.abs(d.lon) <= 180))
      list.push({ step: 1, msg: "Enter valid coordinates" });
    if (!(d.widthKm >= 5 && d.widthKm <= 100) || !(d.heightKm >= 5 && d.heightKm <= 300))
      list.push({ step: 1, msg: "AOI must be 5–100 km wide and 5–300 km long" });
    if (restrictions.length && !d.authAck)
      list.push({ step: 1, msg: "Confirm authorization for the restricted area" });
    if (!d.start || !d.end || endOf(d.end) <= startOf(d.start))
      list.push({ step: 2, msg: "End date must be after the start date" });
    else if (endOf(d.end) < DEMO_NOW) list.push({ step: 2, msg: "Window must end in the future" });
    if (d.mode === "assured" && !d.windowChoice)
      list.push({ step: 2, msg: "Pick an imaging window for an Assured order" });
    if (d.assets.length === 0) list.push({ step: 4, msg: "Select at least one asset type" });
    return list;
  }, [d, restrictions.length]);

  /* ---------- handlers ---------- */
  const pickPoint = (lon: number, lat: number) => {
    setD((p) => ({
      ...p,
      lon,
      lat,
      regionId: nearestRegion(lon, lat)?.id ?? "custom",
      authAck: false,
    }));
  };

  const choosePreset = (id: string) => {
    if (id === "custom") {
      set("regionId", "custom");
      return;
    }
    const r = getRegion(id);
    setD((p) => ({
      ...p,
      regionId: r.id,
      lon: r.lon,
      lat: r.lat,
      widthKm: r.defaultWidthKm,
      heightKm: r.defaultHeightKm,
      authAck: false,
    }));
    setFocusKey(`preset-${id}-${Date.now()}`);
  };

  const toggleAsset = (id: string) =>
    set("assets", d.assets.includes(id) ? d.assets.filter((a) => a !== id) : [...d.assets, id]);

  const submit = () => {
    if (issues.length) return;
    const id = `REQ-${5001 + all.filter((r) => r.id.startsWith("REQ-5")).length}`;
    const req = toRequest(d, id);
    // Re-run so the confirmation reflects the exact request being filed.
    const res = allocate(scoreAll([...all, req], policy.weights), {
      policy: "fair",
      capacity: CYCLE_CAPACITY,
      reservePct: policy.reservePct,
    }).requests.find((r) => r.id === id);
    submitRequest(req);
    setResult({
      id,
      name: req.name,
      team: req.team,
      status: res?.status ?? "waitlisted",
      via: res?.via ?? null,
      reason: res?.reason ?? "",
      rank: res?.rank ?? 0,
      cost: req.creditCost,
    });
  };

  const reset = () => {
    setD(INITIAL);
    setStep(0);
    setResult(null);
    setFocusKey(`reset-${Date.now()}`);
  };

  /* ---------- render ---------- */
  return (
    <div className="mx-auto max-w-[1280px] p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium tracking-[0.2em] text-cyan-400">COLLECTION TASKING</p>
          <h2 className="text-2xl font-semibold">New collection request</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            One intake for every team. Each request is scored in the open and funded from a
            fair-share budget for the cycle.
          </p>
        </div>

        <div className="flex gap-2" role="tablist" aria-label="Request type">
          <button
            type="button"
            role="tab"
            aria-selected={kind === "satellite"}
            onClick={() => setKind("satellite")}
            className={`rounded-lg border px-4 py-2 text-sm transition ${
              kind === "satellite"
                ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100"
                : "border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            Satellite · Tanager
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === "airborne"}
            onClick={() => setKind("airborne")}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
              kind === "airborne"
                ? "border-white/30 bg-white/5 text-slate-100"
                : "border-white/10 text-slate-500 hover:text-slate-300"
            }`}
          >
            Airborne campaign
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] tracking-widest text-slate-400">
              SOON
            </span>
          </button>
        </div>
      </div>

      {kind === "airborne" ? (
        <AirbornePlaceholder onBack={() => setKind("satellite")} />
      ) : result ? (
        <Confirmation result={result} onAnother={reset} />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            {/* step tabs */}
            <ol className="mb-4 flex flex-wrap gap-1.5" aria-label="Steps">
              {STEPS.map((label, i) => {
                const bad = issues.some((x) => x.step === i);
                return (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => setStep(i)}
                      aria-current={i === step ? "step" : undefined}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition ${
                        i === step
                          ? "bg-cyan-400/10 text-cyan-200"
                          : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                          i === step
                            ? "bg-cyan-300 text-[#04141c]"
                            : i < step && !bad
                              ? "bg-emerald-400/20 text-emerald-300"
                              : "bg-white/10"
                        }`}
                      >
                        {i < step && !bad ? "✓" : i + 1}
                      </span>
                      {label}
                    </button>
                  </li>
                );
              })}
            </ol>

            <Panel className="p-6">
              {step === 0 && (
                <div className="space-y-5">
                  <SectionTitle title="Request details" sub="Who is asking and why this collection matters." />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Request name">
                      <input
                        className={inputCls}
                        value={d.name}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="e.g. Delaware Basin compressor corridor"
                      />
                    </Field>
                    <Field label="Linked project (optional)">
                      <input
                        className={inputCls}
                        value={d.project}
                        onChange={(e) => set("project", e.target.value)}
                        placeholder="e.g. Q4 operator engagement"
                      />
                    </Field>
                    <Field label="Requesting team">
                      <select
                        className={inputCls}
                        value={d.team}
                        onChange={(e) => set("team", e.target.value as TeamId | "")}
                      >
                        <option value="">Select a team…</option>
                        {TEAMS.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Requester">
                      <input
                        className={inputCls}
                        value={d.requester}
                        onChange={(e) => set("requester", e.target.value)}
                        placeholder="Name"
                      />
                    </Field>
                  </div>

                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-slate-300">
                      Scientific / operational value
                    </span>
                    <OptionCards<number>
                      name="Value"
                      columns={5}
                      value={d.value || null}
                      onChange={(v) => set("value", v as Draft["value"])}
                      options={[1, 2, 3, 4, 5].map((n) => ({
                        value: n,
                        title: `${n} · ${VALUE_LABELS[n]}`,
                      }))}
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Self-assessed here. In production, a review panel would calibrate ratings so
                      no team can inflate its scores.
                    </p>
                  </div>

                  <Field
                    label="Justification"
                    hint="Visible to every team in the queue. Be specific about the decision this collection supports."
                  >
                    <textarea
                      className={`${inputCls} min-h-[96px]`}
                      value={d.justification}
                      onChange={(e) => set("justification", e.target.value)}
                    />
                  </Field>

                  <label className="flex items-start gap-3 rounded-lg border border-white/10 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={d.urgent}
                      onChange={(e) => set("urgent", e.target.checked)}
                      className="mt-0.5 accent-cyan-400"
                    />
                    <span>
                      <span className="font-medium text-slate-100">Rapid response</span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        For time-critical events such as a newly detected super-emitter. Draws on the
                        shared reserve, but still counts against your team&apos;s equal share.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <SectionTitle
                    title="Area of interest"
                    sub={`Pick a known region or click the map. Tanager images a ~${SWATH_KM} km wide swath.`}
                  />
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <Field label="Preset region">
                      <select
                        className={inputCls}
                        value={REGIONS.some((r) => r.id === d.regionId) ? d.regionId : "custom"}
                        onChange={(e) => choosePreset(e.target.value)}
                      >
                        {REGIONS.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} · {r.area}
                          </option>
                        ))}
                        <option value="custom">Custom AOI (map / coordinates)</option>
                      </select>
                    </Field>
                    <div className="self-end text-xs text-slate-500">
                      GeoJSON upload is planned.
                    </div>
                  </div>

                  <AoiMap
                    lon={d.lon}
                    lat={d.lat}
                    widthKm={d.widthKm}
                    heightKm={d.heightKm}
                    focusKey={focusKey}
                    onPick={pickPoint}
                  />

                  <div className="grid gap-4 sm:grid-cols-4">
                    <Field label="Centre latitude">
                      <input
                        type="number"
                        step="0.001"
                        className={inputCls}
                        value={d.lat}
                        onChange={(e) => {
                          set("lat", Number(e.target.value));
                          set("regionId", "custom");
                        }}
                        onBlur={() => setFocusKey(`coords-${Date.now()}`)}
                      />
                    </Field>
                    <Field label="Centre longitude">
                      <input
                        type="number"
                        step="0.001"
                        className={inputCls}
                        value={d.lon}
                        onChange={(e) => {
                          set("lon", Number(e.target.value));
                          set("regionId", "custom");
                        }}
                        onBlur={() => setFocusKey(`coords-${Date.now()}`)}
                      />
                    </Field>
                    <Field label="Width (km)" hint="5–100">
                      <input
                        type="number"
                        className={inputCls}
                        value={d.widthKm}
                        onChange={(e) => set("widthKm", Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Length (km)" hint="5–300">
                      <input
                        type="number"
                        className={inputCls}
                        value={d.heightKm}
                        onChange={(e) => set("heightKm", Number(e.target.value))}
                      />
                    </Field>
                  </div>

                  <p className="text-xs text-slate-400">
                    Area <span className="text-slate-100">{fmtNum(area)} km²</span> ·{" "}
                    {Math.ceil(d.widthKm / SWATH_KM)} swath{Math.ceil(d.widthKm / SWATH_KM) === 1 ? "" : "es"} wide
                  </p>

                  {restrictions.map((r) => (
                    <Notice key={r.id} tone="warn" title={r.title}>
                      {r.detail}
                    </Notice>
                  ))}
                  {restrictions.length > 0 && (
                    <label className="flex items-start gap-3 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={d.authAck}
                        onChange={(e) => set("authAck", e.target.checked)}
                        className="mt-0.5 accent-cyan-400"
                      />
                      We hold prior authorization for tasking in this area.
                    </label>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <SectionTitle title="Collection window & mode" sub="When you need it, and how firm the commitment is." />
                  <OptionCards<CollectionMode>
                    name="Collection mode"
                    value={d.mode}
                    onChange={(v) => set("mode", v)}
                    options={(Object.keys(MODE_INFO) as CollectionMode[]).map((m) => ({
                      value: m,
                      title: MODE_INFO[m].label,
                      blurb: MODE_INFO[m].blurb,
                      meta: `${MODE_INFO[m].mult}× credits`,
                    }))}
                  />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Window start">
                      <input type="date" className={inputCls} value={d.start} onChange={(e) => set("start", e.target.value)} />
                    </Field>
                    <Field label="Window end">
                      <input type="date" className={inputCls} value={d.end} onChange={(e) => set("end", e.target.value)} />
                    </Field>
                    {d.mode === "monitoring" && (
                      <Field label="Repeat collections" hint="Evenly spaced across the window">
                        <input
                          type="number"
                          min={2}
                          max={12}
                          className={inputCls}
                          value={d.captures}
                          onChange={(e) => set("captures", Math.min(12, Math.max(2, Number(e.target.value) || 2)))}
                        />
                      </Field>
                    )}
                  </div>

                  {d.mode === "assured" && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-slate-300">
                        Imaging windows over this AOI{" "}
                        <span className="font-normal text-slate-500">(simulated search)</span>
                      </p>
                      <div className="space-y-2">
                        {windows.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => set("windowChoice", w.id)}
                            className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition ${
                              d.windowChoice === w.id
                                ? "border-cyan-400/60 bg-cyan-400/10"
                                : "border-white/10 hover:border-white/25"
                            }`}
                          >
                            <span>
                              {fmtDate(w.start)} ·{" "}
                              {new Date(w.start).toISOString().slice(11, 16)}–
                              {new Date(w.end).toISOString().slice(11, 16)} UTC
                            </span>
                            <span className="text-xs text-slate-400">
                              {w.sat} · off-nadir {w.offNadir}°
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <SectionTitle title="Acquisition constraints" sub="Tighter limits mean cleaner data but fewer usable passes." />
                  <div className="grid gap-6 sm:grid-cols-3">
                    <Slider
                      label="Max cloud cover"
                      value={d.cloudMax}
                      min={0}
                      max={100}
                      step={5}
                      unit="%"
                      onChange={(v) => set("cloudMax", v)}
                    />
                    <Slider
                      label="Max off-nadir angle"
                      value={d.offNadirMax}
                      min={0}
                      max={30}
                      unit="°"
                      onChange={(v) => set("offNadirMax", v)}
                    />
                    <Slider
                      label="Min sun elevation"
                      value={d.sunElevMin}
                      min={0}
                      max={60}
                      unit="°"
                      hint="Low sun weakens methane retrievals."
                      onChange={(v) => set("sunElevMin", v)}
                    />
                  </div>
                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-slate-300">Sensitivity mode</span>
                    <OptionCards<Sensitivity>
                      name="Sensitivity"
                      columns={4}
                      value={d.sensitivity}
                      onChange={(v) => set("sensitivity", v)}
                      options={(Object.keys(SENSITIVITY_INFO) as Sensitivity[]).map((s) => ({
                        value: s,
                        title: SENSITIVITY_INFO[s].label,
                        blurb: `${SENSITIVITY_INFO[s].integrations} integration`,
                        meta: `${SENSITIVITY_INFO[s].mult}×`,
                      }))}
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Higher sensitivity adds integrations per line for better signal-to-noise.
                    </p>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  <SectionTitle title="Product & delivery" sub="What you get back and where it lands." />
                  <OptionCards<DataProduct>
                    name="Data product"
                    columns={2}
                    value={d.product}
                    onChange={(v) => set("product", v)}
                    options={(Object.keys(PRODUCT_INFO) as DataProduct[]).map((p) => ({
                      value: p,
                      title: PRODUCT_INFO[p].label,
                      blurb: PRODUCT_INFO[p].blurb,
                      meta: PRODUCT_INFO[p].apiName,
                    }))}
                  />
                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-slate-300">Asset types</span>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ASSET_TYPES.map((a) => (
                        <label
                          key={a.id}
                          className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={d.assets.includes(a.id)}
                            onChange={() => toggleAsset(a.id)}
                            className="accent-cyan-400"
                          />
                          <span>
                            {a.label}
                            <span className="block font-mono text-[10px] text-slate-500">{a.id}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-slate-300">Delivery</span>
                    <OptionCards<string>
                      name="Delivery"
                      value={d.delivery}
                      onChange={(v) => set("delivery", v)}
                      options={DELIVERY}
                    />
                  </div>
                  <label className="flex items-center gap-3 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={d.notify}
                      onChange={(e) => set("notify", e.target.checked)}
                      className="accent-cyan-400"
                    />
                    Email me when the collection is scheduled and delivered
                  </label>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-5">
                  <SectionTitle title="Review & submit" sub="Everything below is visible to the other teams once filed." />
                  <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                    <Row k="Name" v={d.name || "—"} />
                    <Row k="Team" v={d.team ? TEAM_BY_ID[d.team].name : "—"} />
                    <Row k="Requester" v={d.requester || "—"} />
                    <Row k="Value" v={d.value ? `${d.value} · ${VALUE_LABELS[d.value]}` : "—"} />
                    <Row k="Area" v={`${getRegion(draftReq.regionId).name} · ${fmtNum(area)} km²`} />
                    <Row k="Centre" v={`${d.lat.toFixed(3)}, ${d.lon.toFixed(3)}`} />
                    <Row k="Mode" v={`${MODE_INFO[d.mode].label}${d.mode === "monitoring" ? ` × ${d.captures}` : ""}`} />
                    <Row k="Window" v={`${d.start} → ${d.end}`} />
                    <Row k="Constraints" v={`Cloud ≤ ${d.cloudMax}% · off-nadir ≤ ${d.offNadirMax}° · sun ≥ ${d.sunElevMin}°`} />
                    <Row k="Sensitivity" v={SENSITIVITY_INFO[d.sensitivity].label} />
                    <Row k="Product" v={PRODUCT_INFO[d.product].label} />
                    <Row k="Assets" v={d.assets.join(", ") || "—"} />
                  </dl>

                  {issues.length > 0 ? (
                    <Notice tone="warn" title="Before you can submit">
                      <ul className="mt-1 space-y-1">
                        {issues.map((x) => (
                          <li key={x.msg}>
                            <button
                              type="button"
                              className="underline decoration-dotted underline-offset-2 hover:text-white"
                              onClick={() => setStep(x.step)}
                            >
                              {x.msg}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </Notice>
                  ) : (
                    <Notice title="Ready to submit">
                      Your request will join the shared queue and be ranked with everyone else&apos;s.
                    </Notice>
                  )}
                </div>
              )}

              <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5">
                <button
                  type="button"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition enabled:hover:bg-white/5 disabled:opacity-30"
                >
                  Back
                </button>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="rounded-lg bg-cyan-300 px-5 py-2 text-sm font-medium text-[#04141c] transition hover:bg-cyan-200"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={issues.length > 0}
                    onClick={submit}
                    className="rounded-lg bg-cyan-300 px-5 py-2 text-sm font-medium text-[#04141c] transition enabled:hover:bg-cyan-200 disabled:opacity-40"
                  >
                    Submit request
                  </button>
                )}
              </div>
            </Panel>
          </div>

          <SummaryRail d={d} draftReq={draftReq} projection={projection} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-0.5 text-sm text-slate-400">{sub}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-slate-500">{k}</dt>
      <dd className="mt-0.5 break-words text-slate-100">{v}</dd>
    </div>
  );
}

function SummaryRail({
  d,
  draftReq,
  projection,
}: {
  d: Draft;
  draftReq: CollectionRequest;
  projection: {
    mine: AllocatedRequest | undefined;
    displaced: AllocatedRequest[];
    teamBefore: ReturnType<typeof allocate>["teams"][number] | null | undefined;
    teamAfter: ReturnType<typeof allocate>["teams"][number] | null | undefined;
  };
}) {
  const { mine, displaced, teamBefore, teamAfter } = projection;
  const region = getRegion(draftReq.regionId);
  const base = areaKm2(d.widthKm, d.heightKm) / 18;
  const captures = d.mode === "monitoring" ? d.captures : 1;

  return (
    <aside className="xl:sticky xl:top-6 xl:self-start">
      <Panel className="space-y-5 p-5">
        <div>
          <Eyebrow>LIVE ESTIMATE</Eyebrow>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">{fmtNum(draftReq.creditCost)}</span>
            <span className="text-sm text-slate-400">tasking credits</span>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-slate-400">
            <Line k={`${fmtNum(areaKm2(d.widthKm, d.heightKm))} km² area`} v={`${base.toFixed(0)}`} />
            <Line k={`${MODE_INFO[d.mode].label} mode`} v={`× ${MODE_INFO[d.mode].mult}`} />
            <Line k={`${SENSITIVITY_INFO[d.sensitivity].label} sensitivity`} v={`× ${SENSITIVITY_INFO[d.sensitivity].mult}`} />
            <Line k={PRODUCT_INFO[d.product].label} v={`× ${PRODUCT_INFO[d.product].mult}`} />
            {captures > 1 && <Line k="Repeat collections" v={`× ${captures}`} />}
          </ul>
          <p className="mt-2 text-[10px] text-slate-600">Illustrative credits, not Planet pricing.</p>
        </div>

        <div className="border-t border-white/10 pt-5">
          <Eyebrow>IF YOU SUBMIT NOW</Eyebrow>
          {!d.team ? (
            <p className="mt-2 text-sm text-slate-500">Choose a team to see where this would land.</p>
          ) : mine ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <StatusChip r={mine} />
                <span className="text-xs text-slate-400">Queue rank #{mine.rank}</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">{mine.reason}</p>

              <div className="space-y-2">
                <ScoreRow label="Value" v={mine.score.value} />
                <ScoreRow label="Urgency" v={mine.score.urgency} />
                <ScoreRow label="Feasibility" v={mine.score.feasibility} />
                <ScoreRow label="Queue age" v={mine.score.age} />
                <div className="flex justify-between border-t border-white/10 pt-2 text-sm">
                  <span className="text-slate-400">Score</span>
                  <span className="tabular-nums">{mine.score.total.toFixed(1)}</span>
                </div>
              </div>

              {teamBefore && teamAfter && (
                <div>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <TeamChip team={d.team as TeamId} />
                    <span className="tabular-nums text-slate-400">
                      {fmtNum(teamAfter.allocated)} / {fmtNum(teamAfter.idealCredits)} credits
                    </span>
                  </div>
                  <Bar
                    value={(teamAfter.allocated / Math.max(1, teamAfter.idealCredits)) * 100}
                    color={TEAM_BY_ID[d.team as TeamId].color}
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Equal-share budget used by this team this cycle.
                  </p>
                </div>
              )}

              {displaced.length > 0 && (
                <p className="rounded-md bg-amber-300/5 px-3 py-2 text-xs text-amber-200">
                  Funding this would push {displaced.length} lower-ranked request
                  {displaced.length === 1 ? "" : "s"} to the waitlist
                  {displaced.length <= 2 ? `: ${displaced.map((r) => r.id).join(", ")}` : ""}.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/10 pt-5 text-xs text-slate-400">
          <Eyebrow>COLLECTION ODDS</Eyebrow>
          <p className="mt-2">
            About{" "}
            <span className="text-slate-100">{mine ? mine.score.feasibility : "—"}%</span> chance of
            at least one usable collection in your window.
          </p>
          <p className="mt-1 text-slate-500">
            {region.name}: {region.contention} demand from other Planet customers. CM can set its own
            allocation but not that.
          </p>
        </div>
      </Panel>
    </aside>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex justify-between">
      <span>{k}</span>
      <span className="tabular-nums text-slate-300">{v}</span>
    </li>
  );
}

function ScoreRow({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-slate-500">{label}</span>
        <span className="tabular-nums text-slate-400">{Math.round(v)}</span>
      </div>
      <Bar value={v} />
    </div>
  );
}

function Confirmation({
  result,
  onAnother,
}: {
  result: {
    id: string;
    name: string;
    team: TeamId;
    status: AllocatedRequest["status"];
    via: AllocatedRequest["via"];
    reason: string;
    rank: number;
    cost: number;
  };
  onAnother: () => void;
}) {
  return (
    <Panel className="mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10 text-xl text-emerald-300">
        ✓
      </div>
      <h3 className="text-xl font-semibold">Request submitted</h3>
      <p className="mt-1 text-sm text-slate-400">
        {result.id} · {result.name}
      </p>
      <div className="mt-5 flex items-center justify-center gap-3">
        <StatusChip r={result} />
        <span className="text-xs text-slate-400">Queue rank #{result.rank}</span>
        <TeamChip team={result.team} />
      </div>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-400">{result.reason}</p>
      <div className="mt-7 flex justify-center gap-3">
        <Link
          href="/queue"
          className="rounded-lg bg-cyan-300 px-5 py-2 text-sm font-medium text-[#04141c] hover:bg-cyan-200"
        >
          See it in the queue
        </Link>
        <button
          type="button"
          onClick={onAnother}
          className="rounded-lg border border-white/10 px-5 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          File another
        </button>
      </div>
      <p className="mt-5 text-[11px] text-slate-600">
        Stored in this browser only. Use Reset on the Capacity page to clear demo submissions.
      </p>
    </Panel>
  );
}

function AirbornePlaceholder({ onBack }: { onBack: () => void }) {
  return (
    <Panel className="mx-auto max-w-2xl p-8">
      <Eyebrow>COMING SOON</Eyebrow>
      <h3 className="mt-2 text-xl font-semibold">Airborne campaign tasking</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Airborne campaigns will share the same queue, scoring rules and fair-share budget as the
        satellites, so a team can see satellite and aircraft options for one area side by side.
      </p>
      <ul className="mt-5 space-y-2 text-sm text-slate-300">
        {[
          "Flight-line planning over the area of interest",
          "Instrument and aircraft selection",
          "Campaign scheduling against crew and aircraft availability",
          "Combined satellite + airborne requests with one justification",
        ].map((t) => (
          <li key={t} className="flex gap-2">
            <span className="text-slate-600">○</span>
            {t}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onBack}
        className="mt-7 rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
      >
        Back to satellite tasking
      </button>
    </Panel>
  );
}
