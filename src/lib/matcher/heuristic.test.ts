import { describe, expect, it } from "vitest";
import { generateMatchCandidates } from "./heuristic";
import { MIN_SUGGESTION_SCORE } from "./types";
import type { DbColumn, FigmaNode } from "./types";

const dbColumns: DbColumn[] = [
  { table: "users", column: "email", dataType: "varchar" },
  { table: "users", column: "full_name", dataType: "varchar" },
  { table: "orders", column: "total", dataType: "decimal" },
];

describe("generateMatchCandidates", () => {
  it("matches an exact-name Figma layer to the identically-named DB column", () => {
    const nodes: FigmaNode[] = [{ id: "1", name: "email", type: "TEXT" }];
    const [candidate] = generateMatchCandidates(nodes, dbColumns);

    expect(candidate.dbTableName).toBe("users");
    expect(candidate.dbColumnName).toBe("email");
    expect(candidate.confidence).toBe(1);
  });

  it("matches via the alias table (e.g. 'mail' -> 'email')", () => {
    const nodes: FigmaNode[] = [{ id: "1", name: "Mail Input", type: "INSTANCE" }];
    const [candidate] = generateMatchCandidates(nodes, dbColumns);

    expect(candidate.dbColumnName).toBe("email");
  });

  it("skips generically auto-named Figma layers entirely (no candidate produced)", () => {
    const nodes: FigmaNode[] = [{ id: "1", name: "Frame 42", type: "FRAME" }];
    expect(generateMatchCandidates(nodes, dbColumns)).toEqual([]);
  });

  it("produces no candidate when nothing scores above MIN_SUGGESTION_SCORE", () => {
    const nodes: FigmaNode[] = [{ id: "1", name: "Zebra Xylophone", type: "TEXT" }];
    const candidates = generateMatchCandidates(nodes, dbColumns);
    for (const c of candidates) {
      expect(c.confidence).toBeGreaterThanOrEqual(MIN_SUGGESTION_SCORE);
    }
  });

  it("returns at most one candidate per Figma node", () => {
    const nodes: FigmaNode[] = [{ id: "1", name: "full_name", type: "TEXT" }];
    const candidates = generateMatchCandidates(nodes, dbColumns);
    expect(candidates.filter((c) => c.figmaNodeId === "1")).toHaveLength(1);
  });

  it("handles an empty DB column list without throwing", () => {
    const nodes: FigmaNode[] = [{ id: "1", name: "email", type: "TEXT" }];
    expect(generateMatchCandidates(nodes, [])).toEqual([]);
  });

  it("handles an empty Figma node list without throwing", () => {
    expect(generateMatchCandidates([], dbColumns)).toEqual([]);
  });
});
