import { prisma } from "@/lib/prisma";
import { getLatestSnapshot } from "@/lib/snapshot";
import type { DbColumn } from "@/lib/matcher/types";

// Reads the current DB-side schema for matching. Prefers tables designed
// directly in planoo's schema builder (the default, friction-free path —
// see DesignedTable in schema.prisma) — read fresh every call, no
// snapshot/retention needed since this data doesn't drift out from under us
// the way an externally-read DB does. Falls back to the last agent-pushed
// SchemaSnapshot (source=mysql) for anyone still using the optional
// scripts/agent.ts path (see TODOS.md — demoted from required to advanced).
export async function getDbColumns(userId: string): Promise<DbColumn[] | null> {
  const designedTables = await prisma.designedTable.findMany({
    where: { userId },
    include: { columns: true },
  });

  const designedColumns = designedTables.flatMap((table) =>
    table.columns.map((col) => ({ table: table.name, column: col.name, dataType: col.dataType })),
  );

  // A table that exists but has zero columns (a real thing that happened —
  // caught from a live report where "hasSchema" was true because a table
  // existed, but /api/recheck silently matched against nothing) must NOT
  // count as "schema ready". Fall through to the agent-snapshot check, and
  // ultimately to the null branch below, same as having no tables at all.
  if (designedColumns.length > 0) {
    return designedColumns;
  }

  const agentSnapshot = await getLatestSnapshot(userId, "mysql");
  if (agentSnapshot) {
    return (agentSnapshot.payload as { columns: DbColumn[] }).columns;
  }

  return null;
}
