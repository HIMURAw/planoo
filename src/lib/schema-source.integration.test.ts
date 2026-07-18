import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Real-database integration test for the schema builder's data model and
// the getDbColumns() fallback logic (designed tables preferred, agent
// snapshot as fallback). Skipped automatically when DATABASE_URL isn't set
// — same pattern as src/lib/matcher/index.integration.test.ts.
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)("schema builder (integration, real DB)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let getDbColumns: typeof import("./schema-source").getDbColumns;
  let userId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ getDbColumns } = await import("./schema-source"));

    const user = await prisma.user.create({
      data: { email: `schema-builder-vitest-${Date.now()}@example.test`, name: "Schema Builder Vitest" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("returns null when the user has no designed tables and no agent snapshot", async () => {
    expect(await getDbColumns(userId)).toBeNull();
  });

  it("returns columns flattened across all designed tables once any exist", async () => {
    const usersTable = await prisma.designedTable.create({
      data: {
        userId,
        name: "users",
        columns: {
          create: [
            { name: "id", dataType: "int", isPrimaryKey: true, nullable: false, order: 0 },
            { name: "email", dataType: "varchar(255)", nullable: false, order: 1 },
          ],
        },
      },
    });
    await prisma.designedTable.create({
      data: {
        userId,
        name: "orders",
        columns: { create: [{ name: "total", dataType: "decimal", order: 0 }] },
      },
    });

    const columns = await getDbColumns(userId);
    expect(columns).toEqual(
      expect.arrayContaining([
        { table: "users", column: "id", dataType: "int" },
        { table: "users", column: "email", dataType: "varchar(255)" },
        { table: "orders", column: "total", dataType: "decimal" },
      ]),
    );
    expect(columns).toHaveLength(3);

    // cleanup this test's tables so later tests in this file see a clean slate
    await prisma.designedTable.delete({ where: { id: usersTable.id } });
    await prisma.designedTable.deleteMany({ where: { userId, name: "orders" } });
  });

  it("cascades: deleting a table deletes its columns", async () => {
    const table = await prisma.designedTable.create({
      data: { userId, name: "temp", columns: { create: [{ name: "x", dataType: "int", order: 0 }] } },
    });
    const columnCountBefore = await prisma.designedColumn.count({ where: { tableId: table.id } });
    expect(columnCountBefore).toBe(1);

    await prisma.designedTable.delete({ where: { id: table.id } });

    const columnCountAfter = await prisma.designedColumn.count({ where: { tableId: table.id } });
    expect(columnCountAfter).toBe(0);
  });

  it("enforces one table name per user (@@unique([userId, name]))", async () => {
    await prisma.designedTable.create({ data: { userId, name: "dupe" } });
    await expect(prisma.designedTable.create({ data: { userId, name: "dupe" } })).rejects.toThrow();
    await prisma.designedTable.deleteMany({ where: { userId, name: "dupe" } });
  });

  it("falls back to an agent-pushed snapshot when no designed tables exist", async () => {
    const { createSnapshot } = await import("./snapshot");
    await createSnapshot(userId, "mysql", {
      source: "mysql",
      database: "test_db",
      columns: [{ table: "legacy", column: "id", dataType: "int" }],
      readAt: new Date().toISOString(),
    });

    const columns = await getDbColumns(userId);
    expect(columns).toEqual([{ table: "legacy", column: "id", dataType: "int" }]);
  });
});
