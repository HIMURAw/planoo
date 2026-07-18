/**
 * planoo-agent v0
 *
 * Runs on the CUSTOMER's machine/CI, never on planoo's servers. Reads the
 * customer's MySQL schema via `information_schema` (deliberately NOT Prisma
 * introspection — see design doc "Şema katmanı" decision: Prisma's `db pull`
 * needs a schema.prisma file + `prisma generate` + engine binary, which
 * would turn this from a single-file script into a whole toolchain).
 *
 * Distribution (v0, decided in /plan-eng-review after outside voice found
 * `npx github:...#subpath` doesn't actually work): fetched and run with
 *   curl -s https://planoo.xyz/agent.js | node -
 * The web app serves this file's compiled output from an API route — see
 * src/app/agent.js/route.ts. Nothing here imports backend/matcher code, so
 * that route can safely expose it without leaking anything else.
 *
 * Auth: a single-use API key from the web UI (PLANOO_API_KEY), NOT OAuth —
 * the agent never talks to Figma or does any browser-based flow.
 */

import mysql from "mysql2/promise";

interface ColumnInfo {
  table: string;
  column: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencesTable: string | null;
  referencesColumn: string | null;
}

interface SchemaDiff {
  source: "mysql";
  database: string;
  columns: ColumnInfo[];
  readAt: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`planoo-agent: missing required env var ${name}`);
    process.exit(1);
  }
  return value;
}

async function readSchema(connectionUri: string): Promise<SchemaDiff> {
  let connection: mysql.Connection;
  try {
    connection = await mysql.createConnection(connectionUri);
  } catch (err) {
    console.error(
      `planoo-agent: could not connect to the database (${(err as Error).message}). Nothing was sent to planoo.`,
    );
    process.exit(1);
  }

  try {
    const databaseName = connection.config.database;
    if (!databaseName) {
      throw new Error("connection string must include a database name");
    }

    const [columnRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME AS \`table\`, COLUMN_NAME AS \`column\`,
              DATA_TYPE AS dataType, IS_NULLABLE AS nullable,
              COLUMN_KEY AS columnKey
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [databaseName],
    );

    const [fkRows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME AS \`table\`, COLUMN_NAME AS \`column\`,
              REFERENCED_TABLE_NAME AS referencesTable,
              REFERENCED_COLUMN_NAME AS referencesColumn
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [databaseName],
    );

    const fkByTableColumn = new Map<string, { table: string; column: string }>();
    for (const fk of fkRows) {
      fkByTableColumn.set(`${fk.table}.${fk.column}`, {
        table: fk.referencesTable,
        column: fk.referencesColumn,
      });
    }

    const columns: ColumnInfo[] = columnRows.map((row) => {
      const fk = fkByTableColumn.get(`${row.table}.${row.column}`);
      return {
        table: row.table,
        column: row.column,
        dataType: row.dataType,
        nullable: row.nullable === "YES",
        isPrimaryKey: row.columnKey === "PRI",
        isForeignKey: fk !== undefined,
        referencesTable: fk?.table ?? null,
        referencesColumn: fk?.column ?? null,
      };
    });

    return {
      source: "mysql",
      database: databaseName,
      columns,
      readAt: new Date().toISOString(),
    };
  } finally {
    await connection.end();
  }
}

async function pushDiff(apiUrl: string, apiKey: string, diff: SchemaDiff): Promise<void> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}/api/agent/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(diff),
      });

      if (response.ok) {
        console.log(
          `planoo-agent: pushed schema for "${diff.database}" (${diff.columns.length} columns across ${new Set(diff.columns.map((c) => c.table)).size} tables).`,
        );
        return;
      }

      if (response.status === 401) {
        console.error("planoo-agent: PLANOO_API_KEY was rejected (invalid or revoked). Generate a new one from the planoo dashboard.");
        process.exit(1);
      }

      console.error(`planoo-agent: push failed with status ${response.status} (attempt ${attempt}/${maxRetries})`);
    } catch (err) {
      console.error(
        `planoo-agent: network error pushing to planoo (attempt ${attempt}/${maxRetries}): ${(err as Error).message}`,
      );
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
    }
  }

  console.error(
    "planoo-agent: failed to push schema diff after 3 attempts. The DB schema was read successfully but NOT sent — re-run this command once connectivity to planoo.xyz is restored.",
  );
  process.exit(1);
}

async function main() {
  const apiKey = requireEnv("PLANOO_API_KEY");
  const dbUri = requireEnv("AGENT_DATABASE_URL");
  const apiUrl = process.env.PLANOO_API_URL ?? "https://planoo.xyz";

  const diff = await readSchema(dbUri);
  await pushDiff(apiUrl, apiKey, diff);
}

main().catch((err) => {
  console.error(`planoo-agent: unexpected error: ${(err as Error).message}`);
  process.exit(1);
});
