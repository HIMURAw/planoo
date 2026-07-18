import { prisma } from "@/lib/prisma";
import { generateMatchCandidates } from "./heuristic";
import { CONFIDENCE_THRESHOLD } from "./types";
import type { DbColumn, FigmaNode } from "./types";

export { CONFIDENCE_THRESHOLD };

/**
 * Runs a "recheck": (re)matches Figma nodes against DB columns and updates
 * Link rows, then reconciles existing `confirmed` links against the new
 * snapshot (renamed -> stale, deleted -> broken).
 *
 * Rerun scope (decided in /plan-eng-review Section 1): only links NOT in
 * `confirmed` state are touched by (re)matching. A `confirmed` link is never
 * silently replaced by a new higher-confidence suggestion for the same
 * figmaNodeId — trust, once given, isn't revoked by an algorithm.
 */
export async function runMatcher(
  userId: string,
  snapshotId: string,
  figmaNodes: FigmaNode[],
  dbColumns: DbColumn[],
) {
  await reconcileConfirmedLinks(userId, snapshotId, figmaNodes, dbColumns);

  const confirmedFigmaNodeIds = new Set(
    (
      await prisma.link.findMany({
        where: { userId, state: "confirmed" },
        select: { figmaNodeId: true },
      })
    ).map((l) => l.figmaNodeId),
  );

  const rejectedPairs = new Set(
    (
      await prisma.link.findMany({
        where: { userId, state: "rejected" },
        select: { figmaNodeId: true, dbTableName: true, dbColumnName: true },
      })
    ).map((l) => pairKey(l.figmaNodeId, l.dbTableName, l.dbColumnName)),
  );

  const candidateNodes = figmaNodes.filter((n) => !confirmedFigmaNodeIds.has(n.id));
  const candidates = generateMatchCandidates(candidateNodes, dbColumns).filter(
    (c) => !rejectedPairs.has(pairKey(c.figmaNodeId, c.dbTableName, c.dbColumnName)),
  );

  for (const candidate of candidates) {
    await prisma.link.upsert({
      where: {
        userId_figmaNodeId_dbTableName_dbColumnName: {
          userId,
          figmaNodeId: candidate.figmaNodeId,
          dbTableName: candidate.dbTableName,
          dbColumnName: candidate.dbColumnName,
        },
      },
      create: {
        userId,
        figmaNodeId: candidate.figmaNodeId,
        dbTableName: candidate.dbTableName,
        dbColumnName: candidate.dbColumnName,
        confidence: candidate.confidence,
        state: "suggested",
        lastSeenSnapshotId: snapshotId,
      },
      update: {
        confidence: candidate.confidence,
        lastSeenSnapshotId: snapshotId,
        // NOTE: `state` is intentionally NOT overwritten here — an existing
        // `suggested` link keeps updating its confidence across rechecks,
        // but this upsert path never touches `confirmed` (filtered out
        // above) or `rejected` (filtered out above) rows.
      },
    });
  }
}

function pairKey(figmaNodeId: string, table: string, column: string) {
  return `${figmaNodeId}::${table}.${column}`;
}

/**
 * For each `confirmed` link, checks whether its Figma node and DB column
 * still exist in the latest snapshots. If the DB column is gone but a
 * strong-similarity replacement appeared in the same table, treats it as a
 * rename (-> stale, with a fresh suggestion). Otherwise -> broken.
 */
async function reconcileConfirmedLinks(
  userId: string,
  snapshotId: string,
  figmaNodes: FigmaNode[],
  dbColumns: DbColumn[],
) {
  const confirmedLinks = await prisma.link.findMany({
    where: { userId, state: "confirmed" },
  });

  const figmaNodeIds = new Set(figmaNodes.map((n) => n.id));
  const columnsByTable = new Map<string, DbColumn[]>();
  for (const col of dbColumns) {
    const list = columnsByTable.get(col.table) ?? [];
    list.push(col);
    columnsByTable.set(col.table, list);
  }

  for (const link of confirmedLinks) {
    const figmaNodeStillExists = figmaNodeIds.has(link.figmaNodeId);
    const columnStillExists = dbColumns.some(
      (c) => c.table === link.dbTableName && c.column === link.dbColumnName,
    );

    if (figmaNodeStillExists && columnStillExists) {
      await prisma.link.update({
        where: { id: link.id },
        data: { lastSeenSnapshotId: snapshotId },
      });
      continue;
    }

    if (!columnStillExists) {
      // Was it renamed, or actually deleted? Look for a new, unclaimed
      // column in the same table whose name is close to the old one.
      const renameCandidate = findRenameCandidate(link.dbColumnName, columnsByTable.get(link.dbTableName) ?? []);
      await prisma.link.update({
        where: { id: link.id },
        data: {
          state: renameCandidate ? "stale" : "broken",
          lastSeenSnapshotId: snapshotId,
        },
      });
      continue;
    }

    // Column survived but the Figma node itself is gone -> broken (no
    // rename heuristic on the Figma side for v0; see TODOS.md).
    await prisma.link.update({
      where: { id: link.id },
      data: { state: "broken", lastSeenSnapshotId: snapshotId },
    });
  }
}

function findRenameCandidate(oldColumnName: string, currentColumns: DbColumn[]): DbColumn | null {
  const oldLower = oldColumnName.toLowerCase();
  let best: { col: DbColumn; score: number } | null = null;

  for (const col of currentColumns) {
    const colLower = col.column.toLowerCase();
    if (colLower === oldLower) continue; // still exists, not a rename case
    const score = similarity(oldLower, colLower);
    if (score > 0.6 && score > (best?.score ?? 0)) {
      best = { col, score };
    }
  }

  return best?.col ?? null;
}

// Simple normalized-overlap similarity for two short identifiers — enough to
// tell "user_email" apart from "email_address" without pulling in a full
// edit-distance library for this narrow, low-stakes use.
function similarity(a: string, b: string): number {
  const setA = new Set(a.split(""));
  const setB = new Set(b.split(""));
  let intersection = 0;
  for (const ch of setA) if (setB.has(ch)) intersection += 1;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}
