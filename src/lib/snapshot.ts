import { prisma } from "@/lib/prisma";
import { encryptPayload, decryptPayload } from "@/lib/crypto";
import type { SnapshotSource } from "@prisma/client";

// Retention policy decided in /plan-eng-review Section 4 (Performance):
// only the last 2 snapshots per (userId, source) are kept — current +
// previous is all drift-detection needs. Scoped per user+source, NOT
// global, so one user's recheck never deletes another user's history
// (the bug outside voice flagged in "global last-2").
const RETAINED_SNAPSHOTS_PER_USER_SOURCE = 2;

export async function createSnapshot(
  userId: string,
  source: SnapshotSource,
  rawPayload: unknown,
) {
  const snapshot = await prisma.schemaSnapshot.create({
    data: {
      userId,
      source,
      payload: encryptPayload(JSON.stringify(rawPayload)),
    },
  });

  const stale = await prisma.schemaSnapshot.findMany({
    where: { userId, source },
    orderBy: { createdAt: "desc" },
    skip: RETAINED_SNAPSHOTS_PER_USER_SOURCE,
    select: { id: true },
  });

  if (stale.length > 0) {
    await prisma.schemaSnapshot.deleteMany({
      where: { id: { in: stale.map((s) => s.id) } },
    });
  }

  return snapshot;
}

export async function getLatestSnapshot(userId: string, source: SnapshotSource) {
  const snapshot = await prisma.schemaSnapshot.findFirst({
    where: { userId, source },
    orderBy: { createdAt: "desc" },
  });
  if (!snapshot) return null;
  return { ...snapshot, payload: JSON.parse(decryptPayload(snapshot.payload)) as unknown };
}

export async function getPreviousSnapshot(userId: string, source: SnapshotSource) {
  const snapshots = await prisma.schemaSnapshot.findMany({
    where: { userId, source },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  const previous = snapshots[1];
  if (!previous) return null;
  return { ...previous, payload: JSON.parse(decryptPayload(previous.payload)) as unknown };
}
