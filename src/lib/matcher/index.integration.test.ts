import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Real-database integration test — exercises createSnapshot's retention
// logic and runMatcher's rename/delete detection against an actual MySQL
// connection, not mocks. This is what caught a real bug during development:
// the first version of findRenameCandidate used character-level similarity
// and failed to detect "email" -> "email_address" as a rename (scored
// ~0.56, below any sane threshold) because it compared character sets
// instead of tokens.
//
// Skipped automatically when DATABASE_URL isn't set (e.g. CI without a
// database service) — this file intentionally does NOT try to be runnable
// everywhere; see CLAUDE.md for how to point it at a local MySQL/MariaDB.
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)("matcher (integration, real DB)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let createSnapshot: typeof import("@/lib/snapshot").createSnapshot;
  let runMatcher: typeof import("@/lib/matcher").runMatcher;
  let userId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ createSnapshot } = await import("@/lib/snapshot"));
    ({ runMatcher } = await import("@/lib/matcher"));

    const user = await prisma.user.create({
      data: { email: `vitest-${Date.now()}@example.test`, name: "Vitest Integration" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("retains only the last 2 snapshots per (userId, source)", async () => {
    await createSnapshot(userId, "mysql", { n: 1 });
    await createSnapshot(userId, "mysql", { n: 2 });
    await createSnapshot(userId, "mysql", { n: 3 });

    const remaining = await prisma.schemaSnapshot.findMany({
      where: { userId, source: "mysql" },
    });
    expect(remaining).toHaveLength(2);
  });

  it("matches a meaningfully-named Figma node and skips a generically-named one", async () => {
    const figmaNodes = [
      { id: "fig-1", name: "email", type: "TEXT" },
      { id: "fig-2", name: "Frame 42", type: "FRAME" },
    ];
    const dbColumns = [
      { table: "users", column: "email", dataType: "varchar" },
      { table: "users", column: "id", dataType: "int" },
    ];

    const snapshot = await createSnapshot(userId, "figma", figmaNodes);
    await runMatcher(userId, snapshot.id, figmaNodes, dbColumns);

    const links = await prisma.link.findMany({ where: { userId } });
    expect(links).toHaveLength(1);
    expect(links[0].dbColumnName).toBe("email");
    expect(links[0].state).toBe("suggested");
  });

  it("transitions a confirmed link to 'stale' when its column is renamed to something similar", async () => {
    const link = await prisma.link.findFirstOrThrow({ where: { userId, dbColumnName: "email" } });
    await prisma.link.update({ where: { id: link.id }, data: { state: "confirmed" } });

    const figmaNodes = [{ id: "fig-1", name: "email", type: "TEXT" }];
    const renamedColumns = [
      { table: "users", column: "email_address", dataType: "varchar" },
      { table: "users", column: "id", dataType: "int" },
    ];

    const snapshot = await createSnapshot(userId, "figma", figmaNodes);
    await runMatcher(userId, snapshot.id, figmaNodes, renamedColumns);

    const updated = await prisma.link.findUniqueOrThrow({ where: { id: link.id } });
    expect(updated.state).toBe("stale");
  });

  it("transitions a confirmed link to 'broken' when its column is deleted with no rename candidate", async () => {
    const link = await prisma.link.findFirstOrThrow({ where: { userId, dbColumnName: "email" } });
    await prisma.link.update({ where: { id: link.id }, data: { state: "confirmed" } });

    const figmaNodes = [{ id: "fig-1", name: "email", type: "TEXT" }];
    const columnsWithoutEmail = [{ table: "users", column: "id", dataType: "int" }];

    const snapshot = await createSnapshot(userId, "figma", figmaNodes);
    await runMatcher(userId, snapshot.id, figmaNodes, columnsWithoutEmail);

    const updated = await prisma.link.findUniqueOrThrow({ where: { id: link.id } });
    expect(updated.state).toBe("broken");
  });

  it("never overwrites a confirmed link's state via the normal (re)matching path", async () => {
    const link = await prisma.link.create({
      data: {
        userId,
        figmaNodeId: "fig-99",
        dbTableName: "users",
        dbColumnName: "id",
        confidence: 1,
        state: "confirmed",
      },
    });

    const figmaNodes = [{ id: link.figmaNodeId, name: link.figmaNodeId, type: "TEXT" }];
    const dbColumns = [{ table: link.dbTableName, column: link.dbColumnName, dataType: "int" }];

    const snapshot = await createSnapshot(userId, "figma", figmaNodes);
    await runMatcher(userId, snapshot.id, figmaNodes, dbColumns);

    const stillConfirmed = await prisma.link.findUniqueOrThrow({ where: { id: link.id } });
    expect(stillConfirmed.state).toBe("confirmed");
  });
});
