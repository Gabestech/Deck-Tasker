"use client";

import { useMemo, useSyncExternalStore } from "react";
import { allocate } from "./allocation";
import { CYCLE_CAPACITY, DEFAULT_RESERVE_PCT, DEFAULT_WEIGHTS } from "./config";
import { MOCK_REQUESTS } from "./mock-data";
import { scoreAll } from "./scoring";
import type { AllocationResult, CollectionRequest, Policy, Weights } from "./types";

/* ---------- tiny external store ---------- */

function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: T) {
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/* ---------- submitted requests (persisted in this browser only) ---------- */

const STORAGE_KEY = "deck-tasker:submitted:v1";
const EMPTY: CollectionRequest[] = [];
let loaded = false;
const submitted = createStore<CollectionRequest[]>(EMPTY);

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) submitted.set(JSON.parse(raw) as CollectionRequest[]);
  } catch {
    /* storage unavailable: demo still works in memory */
  }
}

function persist(list: CollectionRequest[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function submitRequest(r: CollectionRequest) {
  ensureLoaded();
  const next = [...submitted.get(), r];
  submitted.set(next);
  persist(next);
}

export function resetSubmitted() {
  submitted.set(EMPTY);
  persist(EMPTY);
}

function useSubmitted() {
  return useSyncExternalStore(
    (cb) => {
      ensureLoaded();
      return submitted.subscribe(cb);
    },
    () => {
      ensureLoaded();
      return submitted.get();
    },
    () => EMPTY,
  );
}

/* ---------- allocation policy (in memory) ---------- */

export interface PolicyState {
  policy: Policy;
  weights: Weights;
  reservePct: number;
}

export const DEFAULT_POLICY: PolicyState = {
  policy: "fair",
  weights: DEFAULT_WEIGHTS,
  reservePct: DEFAULT_RESERVE_PCT,
};

const policyStore = createStore<PolicyState>(DEFAULT_POLICY);

export function setPolicyState(patch: Partial<PolicyState>) {
  policyStore.set({ ...policyStore.get(), ...patch });
}

export function resetPolicyState() {
  policyStore.set(DEFAULT_POLICY);
}

export function usePolicyState() {
  return useSyncExternalStore(policyStore.subscribe, policyStore.get, () => DEFAULT_POLICY);
}

/* ---------- combined view ---------- */

export function useAllRequests() {
  const mine = useSubmitted();
  return useMemo(() => [...MOCK_REQUESTS, ...mine], [mine]);
}

/** Scored + allocated requests under the current policy, or an override. */
export function useAllocation(override?: Partial<PolicyState>): AllocationResult {
  const requests = useAllRequests();
  const state = usePolicyState();
  const policy = override?.policy ?? state.policy;
  const weights = override?.weights ?? state.weights;
  const reservePct = override?.reservePct ?? state.reservePct;
  return useMemo(
    () =>
      allocate(scoreAll(requests, weights), {
        policy,
        capacity: CYCLE_CAPACITY,
        reservePct,
      }),
    [requests, policy, weights, reservePct],
  );
}

export function useSubmittedCount() {
  return useSubmitted().length;
}
