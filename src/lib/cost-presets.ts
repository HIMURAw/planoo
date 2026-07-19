// Hardcoded reference infrastructure stacks for the cost simulator
// (see lib/cost-estimate.ts). A plain config file, not a DB table — updating
// a rate is a one-line code change, no migration needed, matching the "cheap
// v0" bias for this whole feature (see TODOS.md).
//
// IMPORTANT: these numbers are illustrative placeholders based on rough,
// unverified familiarity with each stack's public pricing pages — NOT
// pulled from a live source and NOT guaranteed current. Sanity-check every
// rate against the actual current pricing page before shipping copy that
// names a specific provider by name.
export interface CostPreset {
  id: string;
  label: string;
  description: string;
  baseCostUsd: number;
  includedMAU: number;
  perActiveUserOverageUsd: number;
  includedStorageGb: number;
  storageOverageUsdPerGb: number;
  includedEgressGb: number;
  egressOverageUsdPerGb: number;
}

export const COST_PRESETS: CostPreset[] = [
  {
    id: "managed-baas",
    label: "Yönetilen BaaS",
    description: "Supabase Pro benzeri: tek bir aylık ücrete DB + auth + storage dahil.",
    baseCostUsd: 25,
    includedMAU: 100_000,
    perActiveUserOverageUsd: 0.00325,
    includedStorageGb: 8,
    storageOverageUsdPerGb: 0.125,
    includedEgressGb: 250,
    egressOverageUsdPerGb: 0.09,
  },
  {
    id: "self-managed-vm",
    label: "Kendin Yönet VM",
    description: "AWS RDS + EC2 benzeri tipik küçük yığın: daha yüksek taban, daha düşük aşım oranları.",
    baseCostUsd: 90,
    includedMAU: 10_000,
    perActiveUserOverageUsd: 0.001,
    includedStorageGb: 20,
    storageOverageUsdPerGb: 0.115,
    includedEgressGb: 100,
    egressOverageUsdPerGb: 0.09,
  },
];

export const DEFAULT_COST_PRESET_ID = COST_PRESETS[0].id;

export function getCostPreset(id: string): CostPreset {
  return COST_PRESETS.find((p) => p.id === id) ?? COST_PRESETS[0];
}
