// Pure logic behind the "Visual Query Builder" overlay on the schema
// canvas: the user clicks columns across tables in order, and this turns
// that click path into a guaranteed-valid SELECT ... INNER JOIN ... query
// by following the FK relationships the user already drew on the canvas.
//
// The core guarantee this module exists to provide: canAddTableToPath()
// is checked at SELECTION time (see SchemaBuilder's handleColumnClick), so
// a column from a table with no FK path to what's already selected is
// rejected before it ever enters the path — generateJoinQuery() should
// therefore never fail to find a join condition for a path that was built
// through canAddTableToPath. It still returns null defensively if that
// invariant is ever violated, rather than emitting a query with a missing
// JOIN clause.

export interface QueryBuilderColumnRef {
  tableId: string;
  tableName: string;
  columnId: string;
  columnName: string;
}

export interface QueryBuilderTable {
  id: string;
  name: string;
  columns: {
    id: string;
    name: string;
    isForeignKey: boolean;
    referencesTable: string | null;
    referencesColumn: string | null;
  }[];
}

interface JoinCondition {
  leftExpr: string;
  rightExpr: string;
}

// Looks for a direct FK relationship between two tables, in either
// direction (the user may click a parent table before or after its
// child — both are valid query directions).
export function findJoinCondition(tableA: QueryBuilderTable, tableB: QueryBuilderTable): JoinCondition | null {
  const aToB = tableA.columns.find((c) => c.isForeignKey && c.referencesTable === tableB.name && c.referencesColumn);
  if (aToB) {
    return { leftExpr: `${tableA.name}.${aToB.name}`, rightExpr: `${tableB.name}.${aToB.referencesColumn}` };
  }
  const bToA = tableB.columns.find((c) => c.isForeignKey && c.referencesTable === tableA.name && c.referencesColumn);
  if (bToA) {
    return { leftExpr: `${tableB.name}.${bToA.name}`, rightExpr: `${tableA.name}.${bToA.referencesColumn}` };
  }
  return null;
}

// A table can be added to the path if it's the first one, or if it has a
// direct FK relationship (either direction) to AT LEAST ONE table already
// in the path — not necessarily the most-recently-added one, since a query
// path can branch back to an earlier table (e.g. Users -> Orders -> Products
// where Products doesn't relate to Orders directly but does to something
// upstream). Given every table currently in the path already passed this
// same check when it was added, transitively every one of them is
// reachable from the first table via JOINs.
export function canAddTableToPath(candidate: QueryBuilderTable, tablesInPath: QueryBuilderTable[]): boolean {
  if (tablesInPath.length === 0) return true;
  return tablesInPath.some((t) => findJoinCondition(candidate, t) !== null);
}

export interface GeneratedQuery {
  sql: string;
  tableNames: string[];
}

export function generateJoinQuery(
  selectedColumns: QueryBuilderColumnRef[],
  allTables: QueryBuilderTable[],
): GeneratedQuery | null {
  if (selectedColumns.length === 0) return null;

  const tableById = new Map(allTables.map((t) => [t.id, t]));

  const tableOrder: string[] = [];
  const seen = new Set<string>();
  for (const col of selectedColumns) {
    if (!seen.has(col.tableId)) {
      seen.add(col.tableId);
      tableOrder.push(col.tableId);
    }
  }

  const firstTable = tableById.get(tableOrder[0]);
  if (!firstTable) return null;

  const selectList = selectedColumns.map((c) => `${c.tableName}.${c.columnName}`).join(",\n  ");
  const lines = [`SELECT`, `  ${selectList}`, `FROM ${firstTable.name}`];

  const included: QueryBuilderTable[] = [firstTable];
  for (let i = 1; i < tableOrder.length; i++) {
    const table = tableById.get(tableOrder[i]);
    if (!table) return null;

    let condition: JoinCondition | null = null;
    for (let j = included.length - 1; j >= 0; j--) {
      condition = findJoinCondition(table, included[j]);
      if (condition) break;
    }
    if (!condition) return null; // see module comment — shouldn't happen if canAddTableToPath was enforced

    lines.push(`INNER JOIN ${table.name} ON ${condition.leftExpr} = ${condition.rightExpr}`);
    included.push(table);
  }

  return { sql: lines.join("\n") + ";", tableNames: included.map((t) => t.name) };
}
