import { describe, expect, it } from "vitest";
import { estimateColumnBytes, computeCostEstimate } from "./cost-estimate";
import { COST_PRESETS } from "./cost-presets";

describe("estimateColumnBytes", () => {
  it("estimates fixed-width numeric/date types by a flat byte count", () => {
    expect(estimateColumnBytes("int")).toBe(4);
    expect(estimateColumnBytes("bigint")).toBe(8);
    expect(estimateColumnBytes("boolean")).toBe(1);
    expect(estimateColumnBytes("datetime")).toBe(8);
  });

  it("estimates varchar(n) as roughly half the declared length plus overhead", () => {
    expect(estimateColumnBytes("varchar(100)")).toBe(100 * 0.5 + 2);
  });

  it("estimates decimal(p,s) from precision, ignoring scale", () => {
    expect(estimateColumnBytes("decimal(10,2)")).toBe(Math.ceil(10 / 2) + 1);
  });

  it("falls back to a flat 16 bytes for an unrecognized type instead of throwing", () => {
    expect(estimateColumnBytes("some_made_up_type")).toBe(16);
  });
});

describe("computeCostEstimate", () => {
  const preset = COST_PRESETS[0];

  it("derives storage from the designed schema and multiplies by assumed row count", () => {
    const result = computeCostEstimate(
      {
        presetId: preset.id,
        monthlyActiveUsers: 0,
        avgRequestsPerUser: 0,
        assumedRowsPerTable: 1000,
        manualFileStorageGb: 0,
        egressGbPerMonth: 0,
      },
      [{ name: "users", columns: [{ dataType: "int" }, { dataType: "varchar(255)" }] }],
    );

    expect(result.perTableBreakdown).toHaveLength(1);
    expect(result.perTableBreakdown[0].rowSizeBytes).toBeGreaterThan(0);
    expect(result.derivedStorageGb).toBeCloseTo(result.perTableBreakdown[0].estimatedGb, 10);
    expect(result.totalStorageGb).toBe(result.derivedStorageGb);
  });

  it("adds manual file storage on top of the schema-derived storage", () => {
    const withoutFiles = computeCostEstimate(
      { presetId: preset.id, monthlyActiveUsers: 0, avgRequestsPerUser: 0, assumedRowsPerTable: 100, manualFileStorageGb: 0, egressGbPerMonth: 0 },
      [{ name: "t", columns: [{ dataType: "int" }] }],
    );
    const withFiles = computeCostEstimate(
      { presetId: preset.id, monthlyActiveUsers: 0, avgRequestsPerUser: 0, assumedRowsPerTable: 100, manualFileStorageGb: 5, egressGbPerMonth: 0 },
      [{ name: "t", columns: [{ dataType: "int" }] }],
    );

    expect(withFiles.totalStorageGb).toBeCloseTo(withoutFiles.totalStorageGb + 5, 10);
  });

  it("charges nothing beyond the base cost when usage stays within the preset's included quotas", () => {
    const result = computeCostEstimate(
      {
        presetId: preset.id,
        monthlyActiveUsers: preset.includedMAU / 2,
        avgRequestsPerUser: 10,
        assumedRowsPerTable: 10,
        manualFileStorageGb: 0,
        egressGbPerMonth: preset.includedEgressGb / 2,
      },
      [{ name: "t", columns: [{ dataType: "int" }] }],
    );

    expect(result.breakdown.computeOverage).toBe(0);
    expect(result.breakdown.egressOverage).toBe(0);
    expect(result.totalCostUsd).toBe(preset.baseCostUsd);
  });

  it("never charges a negative overage when usage is far below the included quota", () => {
    const result = computeCostEstimate(
      { presetId: preset.id, monthlyActiveUsers: 1, avgRequestsPerUser: 1, assumedRowsPerTable: 1, manualFileStorageGb: 0, egressGbPerMonth: 0 },
      [],
    );

    expect(result.breakdown.computeOverage).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.storageOverage).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.egressOverage).toBeGreaterThanOrEqual(0);
    expect(result.totalCostUsd).toBeGreaterThanOrEqual(preset.baseCostUsd);
  });

  it("charges overage proportionally once usage exceeds the included quota", () => {
    const result = computeCostEstimate(
      {
        presetId: preset.id,
        monthlyActiveUsers: preset.includedMAU + 1000,
        avgRequestsPerUser: 0,
        assumedRowsPerTable: 0,
        manualFileStorageGb: 0,
        egressGbPerMonth: 0,
      },
      [],
    );

    expect(result.breakdown.computeOverage).toBeCloseTo(1000 * preset.perActiveUserOverageUsd, 10);
  });

  it("never multiplies avgRequestsPerUser into the dollar total", () => {
    const low = computeCostEstimate(
      { presetId: preset.id, monthlyActiveUsers: 100, avgRequestsPerUser: 1, assumedRowsPerTable: 10, manualFileStorageGb: 0, egressGbPerMonth: 0 },
      [{ name: "t", columns: [{ dataType: "int" }] }],
    );
    const high = computeCostEstimate(
      { presetId: preset.id, monthlyActiveUsers: 100, avgRequestsPerUser: 100_000, assumedRowsPerTable: 10, manualFileStorageGb: 0, egressGbPerMonth: 0 },
      [{ name: "t", columns: [{ dataType: "int" }] }],
    );

    expect(high.totalCostUsd).toBe(low.totalCostUsd);
  });

  it("flags a table that dominates total storage", () => {
    const result = computeCostEstimate(
      { presetId: preset.id, monthlyActiveUsers: 0, avgRequestsPerUser: 0, assumedRowsPerTable: 100_000, manualFileStorageGb: 0, egressGbPerMonth: 0 },
      [
        { name: "big_events", columns: [{ dataType: "text" }, { dataType: "json" }] },
        { name: "small_flags", columns: [{ dataType: "boolean" }] },
      ],
    );

    expect(result.flags.some((f) => f.includes("big_events"))).toBe(true);
  });

  it("flags a high requests-per-user ratio without affecting cost", () => {
    const result = computeCostEstimate(
      { presetId: preset.id, monthlyActiveUsers: 10, avgRequestsPerUser: 5000, assumedRowsPerTable: 10, manualFileStorageGb: 0, egressGbPerMonth: 0 },
      [{ name: "t", columns: [{ dataType: "int" }] }],
    );

    expect(result.flags.some((f) => f.toLowerCase().includes("istek"))).toBe(true);
  });

  it("produces no flags and zero derived storage for a project with no designed tables", () => {
    const result = computeCostEstimate(
      { presetId: preset.id, monthlyActiveUsers: 0, avgRequestsPerUser: 0, assumedRowsPerTable: 1000, manualFileStorageGb: 0, egressGbPerMonth: 0 },
      [],
    );

    expect(result.derivedStorageGb).toBe(0);
    expect(result.perTableBreakdown).toHaveLength(0);
  });

  it("falls back to the first preset for an unknown presetId instead of throwing", () => {
    const result = computeCostEstimate(
      { presetId: "does-not-exist", monthlyActiveUsers: 0, avgRequestsPerUser: 0, assumedRowsPerTable: 10, manualFileStorageGb: 0, egressGbPerMonth: 0 },
      [],
    );

    expect(result.totalCostUsd).toBe(COST_PRESETS[0].baseCostUsd);
  });
});
