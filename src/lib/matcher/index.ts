import { prisma } from "@/lib/prisma";
import { generateMatchCandidates } from "./heuristic";
import { tokenize, jaccardSimilarity } from "./normalize";
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
  projectId: string | null = null,
) {
  await reconcileConfirmedLinks(userId, snapshotId, figmaNodes, dbColumns, projectId);

  const confirmedFigmaNodeIds = new Set(
    (
      await prisma.link.findMany({
        where: { userId, projectId, state: "confirmed" },
        select: { figmaNodeId: true },
      })
    ).map((l) => l.figmaNodeId),
  );

  const rejectedPairs = new Set(
    (
      await prisma.link.findMany({
        where: { userId, projectId, state: "rejected" },
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
        projectId,
        figmaNodeId: candidate.figmaNodeId,
        dbTableName: candidate.dbTableName,
        dbColumnName: candidate.dbColumnName,
        confidence: candidate.confidence,
        state: "suggested",
        lastSeenSnapshotId: snapshotId,
      },
      update: {
        // Also backfills projectId onto a link created before a given user's
        // project got one (e.g. pre-dashboard-restructuring data) — the
        // identity key above is user-wide, not project-wide, so this is the
        // one place that reattaches a stray link to "whichever project
        // rechecked it most recently".
        projectId,
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
  projectId: string | null,
) {
  const confirmedLinks = await prisma.link.findMany({
    where: { userId, projectId, state: "confirmed" },
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

// Token-based (not character-based) similarity, matching the main matcher's
// approach in heuristic.ts — character-level Jaccard was tried first and
// failed on the exact case this exists for: "email" -> "email_address"
// scores only ~0.56 on shared characters (both names share e/m/a/i/l, but
// "address" dilutes the character set), landing below any sane threshold.
// Token overlap catches this because "email" is literally one of the tokens
// in "email_address".
function findRenameCandidate(oldColumnName: string, currentColumns: DbColumn[]): DbColumn | null {
  const oldTokens = tokenize(oldColumnName);
  let best: { col: DbColumn; score: number } | null = null;

  for (const col of currentColumns) {
    if (col.column.toLowerCase() === oldColumnName.toLowerCase()) continue; // still exists, not a rename case
    const score = jaccardSimilarity(oldTokens, tokenize(col.column));
    if (score > 0.3 && score > (best?.score ?? 0)) {
      best = { col, score };
    }
  }

  return best?.col ?? null;
}
