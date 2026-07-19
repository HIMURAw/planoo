export interface ExportColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencesTable: string | null;
  referencesColumn: string | null;
}

export interface ExportTable {
  name: string;
  columns: ExportColumn[];
}

// MySQL-dialect DDL generator for a hand-designed schema — the ".sql
// export" half of "design your schema on the site, get it back as .sql"
// (the other half is the schema builder UI writing DesignedTable/Column).
export function generateSql(tables: ExportTable[]): string {
  const statements = tables.map((table) => {
    const columnLines = table.columns.map((col) => {
      const parts = [`  \`${col.name}\` ${col.dataType}`, col.nullable ? "NULL" : "NOT NULL"];
      if (col.isPrimaryKey) parts.push("PRIMARY KEY");
      return parts.join(" ");
    });

    const fkLines = table.columns
      .filter((col) => col.isForeignKey && col.referencesTable && col.referencesColumn)
      .map(
        (col) =>
          `  FOREIGN KEY (\`${col.name}\`) REFERENCES \`${col.referencesTable}\`(\`${col.referencesColumn}\`)`,
      );

    const body = [...columnLines, ...fkLines].join(",\n");
    return `CREATE TABLE \`${table.name}\` (\n${body}\n);`;
  });

  return statements.join("\n\n") + "\n";
}

// --- Prisma schema / TypeORM entity export ---
//
// DesignedColumn.dataType is free-text (see prisma/schema.prisma comment on
// that field) — there's no enum/validation, so a user can type anything.
// mapSqlType() below is a best-effort MySQL-flavored-string -> scalar-type
// mapping, not a real SQL parser. Anything it doesn't recognize falls back
// to a plain String/string with `unrecognized: true` so callers can emit a
// visible "verify manually" comment instead of silently guessing wrong.

interface TypeMapping {
  prisma: string;
  ts: string;
  unrecognized?: boolean;
}

// Exported for reuse by lib/cost-estimate.ts, which needs the same
// free-text-SQL-type -> base-name-plus-args split to size columns.
export function parseDataType(dataType: string): { base: string; args: string[] } {
  const match = dataType.trim().toLowerCase().match(/^([a-z]+)\s*(?:\(([^)]*)\))?/);
  const base = match?.[1] ?? "";
  const args = match?.[2] ? match[2].split(",").map((a) => a.trim()) : [];
  return { base, args };
}

export function mapSqlType(dataType: string): TypeMapping {
  const { base, args } = parseDataType(dataType);

  // tinyint(1) is MySQL's long-standing boolean convention.
  if (base === "tinyint" && args[0] === "1") {
    return { prisma: "Boolean", ts: "boolean" };
  }

  switch (base) {
    case "boolean":
    case "bool":
      return { prisma: "Boolean", ts: "boolean" };
    case "varchar":
    case "char":
    case "text":
    case "tinytext":
    case "mediumtext":
    case "longtext":
    case "enum":
    case "uuid":
      return { prisma: "String", ts: "string" };
    case "tinyint":
    case "smallint":
    case "mediumint":
    case "int":
    case "integer":
      return { prisma: "Int", ts: "number" };
    case "bigint":
      return { prisma: "BigInt", ts: "bigint" };
    case "float":
    case "double":
      return { prisma: "Float", ts: "number" };
    case "decimal":
    case "numeric":
      // Not `number` — TypeORM (like most ORMs) returns DECIMAL columns as
      // strings by default to avoid floating-point precision loss, and this
      // type only ever surfaces in the standalone TypeORM export (the
      // Prisma export uses `mapping.prisma` = "Decimal" instead, Prisma's
      // own arbitrary-precision type).
      return { prisma: "Decimal", ts: "string" };
    case "datetime":
    case "timestamp":
    case "date":
    case "time":
      return { prisma: "DateTime", ts: "Date" };
    case "json":
      // `unknown`, not a Prisma-namespace type — this field is consumed by
      // the standalone TypeORM export, which has no `Prisma` import.
      return { prisma: "Json", ts: "unknown" };
    case "blob":
    case "binary":
    case "varbinary":
    case "tinyblob":
    case "mediumblob":
    case "longblob":
      return { prisma: "Bytes", ts: "Buffer" };
    default:
      return { prisma: "String", ts: "string", unrecognized: true };
  }
}

// MySQL native-type attribute for the couple of cases where dropping the
// length/precision loses information a developer would actually want back
// (varchar length, decimal precision/scale) — everything else exports as
// the plain scalar, which is an acceptable simplification for a generated
// scaffold meant to be reviewed, not a lossless round-trip.
function prismaNativeTypeAttr(dataType: string): string {
  const { base, args } = parseDataType(dataType);
  if (base === "varchar" && args[0]) return ` @db.VarChar(${args[0]})`;
  if (base === "char" && args[0]) return ` @db.Char(${args[0]})`;
  if ((base === "decimal" || base === "numeric") && args.length > 0) {
    const [p, s] = args;
    return ` @db.Decimal(${p}${s ? `, ${s}` : ""})`;
  }
  return "";
}

// TypeORM's `type:` column option is a closed string union (`ColumnType`,
// see typeorm/driver/types/ColumnTypes.d.ts) — it does NOT accept a raw
// "varchar(255)"-style string with the length baked in like MySQL DDL does.
// The base type name (without parens) already matches a valid ColumnType
// for every case mapSqlType() recognizes (verified against the actual
// typeorm package); length/precision/scale must be passed as separate
// options instead.
function typeOrmColumnOptions(dataType: string, unrecognized: boolean, isPrimaryKey: boolean, nullable: boolean): string {
  const { base, args } = parseDataType(dataType);
  const typeName = unrecognized ? "varchar" : base;

  const options: string[] = [`type: "${typeName}"`];
  if ((typeName === "varchar" || typeName === "char") && args[0]) {
    options.push(`length: ${args[0]}`);
  } else if ((typeName === "decimal" || typeName === "numeric") && args.length > 0) {
    if (args[0]) options.push(`precision: ${args[0]}`);
    if (args[1]) options.push(`scale: ${args[1]}`);
  }
  if (!isPrimaryKey && nullable) options.push("nullable: true");

  return `{ ${options.join(", ")} }`;
}

function toPascalCase(input: string): string {
  const parts = input.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const pascal = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return pascal || "Table";
}

// Derives a relation field name from a FK column name — strips a trailing
// _id/Id so `user_id` -> `user`, `authorId` -> `author`; falls back to
// `<column>Ref` when there's nothing to strip, so it never collides with
// the raw scalar field of the same column.
function relationFieldName(columnName: string): string {
  const stripped = columnName.replace(/_?[iI]d$/, "");
  return stripped && stripped !== columnName ? stripped : `${columnName}Ref`;
}

// Generates a `schema.prisma`-compatible set of `model` blocks from a
// designed schema. This is a scaffold, not a byte-perfect reproduction of
// hand-tuned Prisma conventions (field casing, relation naming) — it's
// meant to give someone a correct starting point they review and adjust,
// the same spirit as the .sql export above.
export function generatePrismaSchema(tables: ExportTable[]): string {
  const modelNameByTable = new Map(tables.map((t) => [t.name, toPascalCase(t.name)]));
  const unrecognizedTypes = new Set<string>();

  const blocks = tables.map((table) => {
    const modelName = modelNameByTable.get(table.name)!;
    const lines: string[] = [];

    for (const col of table.columns) {
      const mapping = mapSqlType(col.dataType);
      if (mapping.unrecognized) unrecognizedTypes.add(col.dataType);

      const optional = col.nullable && !col.isPrimaryKey ? "?" : "";
      const attrs: string[] = [];
      if (col.isPrimaryKey) attrs.push(" @id");
      attrs.push(prismaNativeTypeAttr(col.dataType));
      if (mapping.unrecognized) attrs.push(" // unrecognized SQL type, verify manually");

      lines.push(`  ${col.name} ${mapping.prisma}${optional}${attrs.join("")}`);

      if (col.isForeignKey && col.referencesTable && col.referencesColumn) {
        const referencedModel = modelNameByTable.get(col.referencesTable);
        if (referencedModel) {
          const relName = relationFieldName(col.name);
          const relOptional = col.nullable ? "?" : "";
          lines.push(
            `  ${relName} ${referencedModel}${relOptional} @relation(fields: [${col.name}], references: [${col.referencesColumn}])`,
          );
        } else {
          lines.push(`  // ${col.name} references "${col.referencesTable}", which isn't in this export`);
        }
      }
    }

    // Prisma requires every model to have an @id (or @@id/@@unique) — a
    // table with no columns, or one where nothing was marked as the primary
    // key in the schema builder, would otherwise silently produce a
    // `.prisma` file that fails `prisma validate`. Flag it loudly instead of
    // emitting broken output the reviewer has to debug from scratch.
    if (table.columns.length === 0) {
      lines.push("  // This table has no columns yet — add at least one before using this in a real Prisma schema.");
    } else if (!table.columns.some((c) => c.isPrimaryKey)) {
      lines.push(
        "  // TODO: no column was marked as primary key in planoo — add @id to one field (or @@id([...]) for a composite key) before this validates.",
      );
    }

    return `model ${modelName} {\n${lines.join("\n")}\n\n  @@map("${table.name}")\n}`;
  });

  const header = unrecognizedTypes.size
    ? `// Some columns used a SQL type this generator didn't recognize and\n// fell back to String — search for "verify manually" below.\n// Unrecognized types seen: ${[...unrecognizedTypes].join(", ")}\n\n`
    : "";

  return header + blocks.join("\n\n") + "\n";
}

// Generates TypeORM entity classes (decorator-based, `experimentalDecorators`
// style) as a single TypeScript file. Same "reviewable scaffold" philosophy
// as generatePrismaSchema — always uses @PrimaryColumn (never
// @PrimaryGeneratedColumn), since DesignedColumn has no concept of
// auto-increment to base that choice on.
export function generateTypeOrmEntities(tables: ExportTable[]): string {
  const classNameByTable = new Map(tables.map((t) => [t.name, toPascalCase(t.name)]));
  const unrecognizedTypes = new Set<string>();

  const classes = tables.map((table) => {
    const className = classNameByTable.get(table.name)!;
    const lines: string[] = [];

    for (const col of table.columns) {
      const mapping = mapSqlType(col.dataType);
      if (mapping.unrecognized) unrecognizedTypes.add(col.dataType);

      const decoratorName = col.isPrimaryKey ? "PrimaryColumn" : "Column";
      const optionsStr = typeOrmColumnOptions(col.dataType, mapping.unrecognized ?? false, col.isPrimaryKey, col.nullable);

      const comment = mapping.unrecognized ? " // unrecognized SQL type, verify manually" : "";
      lines.push(`  @${decoratorName}(${optionsStr})${comment}`);
      const optional = col.nullable && !col.isPrimaryKey ? "?" : "!";
      lines.push(`  ${col.name}${optional}: ${mapping.ts};`);
      lines.push("");

      if (col.isForeignKey && col.referencesTable && col.referencesColumn) {
        const referencedClass = classNameByTable.get(col.referencesTable);
        if (referencedClass) {
          const relName = relationFieldName(col.name);
          lines.push(`  @ManyToOne(() => ${referencedClass})`);
          lines.push(`  @JoinColumn({ name: "${col.name}", referencedColumnName: "${col.referencesColumn}" })`);
          lines.push(`  ${relName}?: ${referencedClass};`);
          lines.push("");
        } else {
          lines.push(`  // ${col.name} references "${col.referencesTable}", which isn't in this export`);
          lines.push("");
        }
      }
    }

    // TypeORM requires an entity to have a primary column to be usable at
    // runtime — flag the gap instead of emitting a class that will only
    // fail once someone actually tries to use it.
    if (table.columns.length === 0) {
      lines.push("  // This table has no columns yet — add at least one before using this entity.");
      lines.push("");
    } else if (!table.columns.some((c) => c.isPrimaryKey)) {
      lines.push(
        "  // TODO: no column was marked as primary key in planoo — add a @PrimaryColumn before using this entity.",
      );
      lines.push("");
    }

    return `@Entity({ name: "${table.name}" })\nexport class ${className} {\n${lines.join("\n")}}`;
  });

  const header = [
    'import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from "typeorm";',
    "",
    unrecognizedTypes.size
      ? `// Some columns used a SQL type this generator didn't recognize and\n// fell back to string — search for "verify manually" below.\n// Unrecognized types seen: ${[...unrecognizedTypes].join(", ")}\n`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `${header}\n${classes.join("\n\n")}\n`;
}

// --- PostgreSQL / SQLite DDL export ---
//
// Same "reviewable scaffold" approach as generateSql: a best-effort dialect
// translation of whatever free-text MySQL-flavored dataType the user typed,
// not a real SQL parser. Neither dialect gets an auto-increment keyword
// (Postgres SERIAL, SQLite's INTEGER PRIMARY KEY rowid alias) — the
// DesignedColumn model has no concept of "is this auto-incrementing", only
// isPrimaryKey, so inventing one would be a guess dressed up as a fact.

interface DialectTypeMapping {
  type: string;
  unrecognized?: boolean;
}

function mapSqlTypeToPostgres(dataType: string): DialectTypeMapping {
  const { base, args } = parseDataType(dataType);
  if (base === "tinyint" && args[0] === "1") return { type: "boolean" };
  switch (base) {
    case "boolean":
    case "bool":
      return { type: "boolean" };
    case "tinyint":
    case "smallint":
      return { type: "smallint" };
    case "mediumint":
    case "int":
    case "integer":
      return { type: "integer" };
    case "bigint":
      return { type: "bigint" };
    case "float":
      return { type: "real" };
    case "double":
      return { type: "double precision" };
    case "decimal":
    case "numeric":
      return { type: args.length ? `numeric(${args.join(", ")})` : "numeric" };
    case "varchar":
      return { type: args[0] ? `varchar(${args[0]})` : "varchar" };
    case "char":
      return { type: args[0] ? `char(${args[0]})` : "char" };
    case "text":
    case "tinytext":
    case "mediumtext":
    case "longtext":
      // Postgres has one unbounded `text` type — no size-tiered variants
      // the way MySQL does, so all four collapse to the same thing.
      return { type: "text" };
    case "date":
      return { type: "date" };
    case "time":
      return { type: "time" };
    case "datetime":
    case "timestamp":
      return { type: "timestamp" };
    case "json":
      // jsonb over json: Postgres's own docs recommend it for anything
      // that isn't specifically relying on exact-input-text preservation —
      // it's indexable and faster to query, at a small write-time cost.
      return { type: "jsonb" };
    case "blob":
    case "binary":
    case "varbinary":
    case "tinyblob":
    case "mediumblob":
    case "longblob":
      return { type: "bytea" };
    case "uuid":
      return { type: "uuid" };
    default:
      return { type: "varchar", unrecognized: true };
  }
}

function mapSqlTypeToSqlite(dataType: string): DialectTypeMapping {
  const { base } = parseDataType(dataType);
  switch (base) {
    case "tinyint":
    case "smallint":
    case "mediumint":
    case "int":
    case "integer":
    case "bigint":
    case "boolean":
    case "bool":
      return { type: "INTEGER" };
    case "float":
    case "double":
      return { type: "REAL" };
    case "decimal":
    case "numeric":
      return { type: "NUMERIC" };
    case "varchar":
    case "char":
    case "text":
    case "tinytext":
    case "mediumtext":
    case "longtext":
    case "enum":
    case "uuid":
      return { type: "TEXT" };
    case "date":
    case "time":
    case "datetime":
    case "timestamp":
      // SQLite has no native date/time storage class — ISO-8601 strings in
      // a TEXT column is the convention its own documentation recommends.
      return { type: "TEXT" };
    case "json":
      return { type: "TEXT" };
    case "blob":
    case "binary":
    case "varbinary":
    case "tinyblob":
    case "mediumblob":
    case "longblob":
      return { type: "BLOB" };
    default:
      return { type: "TEXT", unrecognized: true };
  }
}

function generateDialectSql(
  tables: ExportTable[],
  mapType: (dataType: string) => DialectTypeMapping,
  quote: (identifier: string) => string,
  header?: string,
): string {
  const unrecognizedTypes = new Set<string>();

  const statements = tables.map((table) => {
    const columnLines = table.columns.map((col) => {
      const mapping = mapType(col.dataType);
      if (mapping.unrecognized) unrecognizedTypes.add(col.dataType);
      const parts = [`  ${quote(col.name)} ${mapping.type}`, col.nullable ? "NULL" : "NOT NULL"];
      if (col.isPrimaryKey) parts.push("PRIMARY KEY");
      if (mapping.unrecognized) parts.push("-- unrecognized SQL type, verify manually");
      return parts.join(" ");
    });

    const fkLines = table.columns
      .filter((col) => col.isForeignKey && col.referencesTable && col.referencesColumn)
      .map(
        (col) =>
          `  FOREIGN KEY (${quote(col.name)}) REFERENCES ${quote(col.referencesTable!)}(${quote(col.referencesColumn!)})`,
      );

    const body = [...columnLines, ...fkLines].join(",\n");
    return `CREATE TABLE ${quote(table.name)} (\n${body}\n);`;
  });

  const unrecognizedNote = unrecognizedTypes.size
    ? `-- Some columns used a SQL type this generator didn't recognize and\n-- fell back to a safe default — search for "verify manually" below.\n-- Unrecognized types seen: ${[...unrecognizedTypes].join(", ")}\n\n`
    : "";

  return (header ? header + "\n" : "") + unrecognizedNote + statements.join("\n\n") + "\n";
}

export function generatePostgresSql(tables: ExportTable[]): string {
  return generateDialectSql(tables, mapSqlTypeToPostgres, (id) => `"${id}"`);
}

export function generateSqliteSql(tables: ExportTable[]): string {
  return generateDialectSql(
    tables,
    mapSqlTypeToSqlite,
    (id) => `"${id}"`,
    "-- Foreign keys are declared but not enforced by SQLite unless the\n-- connection has run PRAGMA foreign_keys = ON;\n",
  );
}

// --- Drizzle ORM export (MySQL dialect — matches the DB this schema was
// actually modeled against; drizzle-orm/mysql-core) ---
//
// Drizzle's `.references(() => otherTable.column)` takes the referenced
// column wrapped in a thunk specifically so table declaration order doesn't
// matter (same reason TypeORM's `@ManyToOne(() => OtherEntity)` doesn't
// need topological sorting either) — tables can be emitted in whatever
// order they were designed in.

function mapSqlTypeToDrizzleMysql(dataType: string): { call: string; unrecognized?: boolean } {
  const { base, args } = parseDataType(dataType);
  if (base === "tinyint" && args[0] === "1") return { call: "boolean" };
  switch (base) {
    case "boolean":
    case "bool":
      return { call: "boolean" };
    case "tinyint":
      return { call: "tinyint" };
    case "smallint":
      return { call: "smallint" };
    case "mediumint":
      return { call: "mediumint" };
    case "int":
    case "integer":
      return { call: "int" };
    case "bigint":
      return { call: "bigint" };
    case "float":
      return { call: "float" };
    case "double":
      return { call: "double" };
    case "decimal":
    case "numeric":
      return { call: args.length ? `decimal(NAME, { precision: ${args[0]}${args[1] ? `, scale: ${args[1]}` : ""} })` : "decimal" };
    case "varchar":
      return { call: args[0] ? `varchar(NAME, { length: ${args[0]} })` : `varchar(NAME, { length: 191 })` };
    case "char":
      return { call: args[0] ? `char(NAME, { length: ${args[0]} })` : "char" };
    case "text":
      return { call: "text" };
    case "tinytext":
      return { call: "tinytext" };
    case "mediumtext":
      return { call: "mediumtext" };
    case "longtext":
      return { call: "longtext" };
    case "date":
      return { call: "date" };
    case "time":
      return { call: "time" };
    case "datetime":
      return { call: "datetime" };
    case "timestamp":
      return { call: "timestamp" };
    case "json":
      return { call: "json" };
    case "uuid":
      return { call: `varchar(NAME, { length: 36 })` };
    case "blob":
    case "binary":
    case "varbinary":
    case "tinyblob":
    case "mediumblob":
    case "longblob":
      return { call: "binary" };
    default:
      return { call: "text", unrecognized: true };
  }
}

export function generateDrizzleSchema(tables: ExportTable[]): string {
  const unrecognizedTypes = new Set<string>();
  const usedBuilders = new Set<string>();

  const blocks = tables.map((table) => {
    const varName = table.name; // used directly as the exported const name
    const lines = table.columns.map((col) => {
      const mapping = mapSqlTypeToDrizzleMysql(col.dataType);
      if (mapping.unrecognized) unrecognizedTypes.add(col.dataType);

      const builderName = mapping.call.match(/^[a-zA-Z]+/)![0];
      usedBuilders.add(builderName);

      const callExpr = mapping.call.includes("NAME")
        ? mapping.call.replace("NAME", `"${col.name}"`)
        : `${mapping.call}("${col.name}")`;

      const chain: string[] = [callExpr];
      if (col.isPrimaryKey) chain.push(".primaryKey()");
      else if (!col.nullable) chain.push(".notNull()");
      if (col.isForeignKey && col.referencesTable && col.referencesColumn) {
        chain.push(`.references(() => ${col.referencesTable}.${col.referencesColumn})`);
      }
      const comment = mapping.unrecognized ? " // unrecognized SQL type, verify manually" : "";
      return `  ${col.name}: ${chain.join("")},${comment}`;
    });

    return `export const ${varName} = mysqlTable("${table.name}", {\n${lines.join("\n")}\n});`;
  });

  const header = [
    `import { mysqlTable, ${[...usedBuilders].sort().join(", ")} } from "drizzle-orm/mysql-core";`,
    "",
    unrecognizedTypes.size
      ? `// Some columns used a SQL type this generator didn't recognize and\n// fell back to text() — search for "verify manually" below.\n// Unrecognized types seen: ${[...unrecognizedTypes].join(", ")}\n`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `${header}\n${blocks.join("\n\n")}\n`;
}

// --- Sequelize export (class-based Model.init(), Sequelize 6+ style) ---

function mapSqlTypeToSequelize(dataType: string): { call: string; unrecognized?: boolean } {
  const { base, args } = parseDataType(dataType);
  if (base === "tinyint" && args[0] === "1") return { call: "DataTypes.BOOLEAN" };
  switch (base) {
    case "boolean":
    case "bool":
      return { call: "DataTypes.BOOLEAN" };
    case "tinyint":
      return { call: "DataTypes.TINYINT" };
    case "smallint":
      return { call: "DataTypes.SMALLINT" };
    case "mediumint":
      return { call: "DataTypes.MEDIUMINT" };
    case "int":
    case "integer":
      return { call: "DataTypes.INTEGER" };
    case "bigint":
      return { call: "DataTypes.BIGINT" };
    case "float":
      return { call: "DataTypes.FLOAT" };
    case "double":
      return { call: "DataTypes.DOUBLE" };
    case "decimal":
    case "numeric":
      return { call: args.length ? `DataTypes.DECIMAL(${args.join(", ")})` : "DataTypes.DECIMAL" };
    case "varchar":
      return { call: args[0] ? `DataTypes.STRING(${args[0]})` : "DataTypes.STRING" };
    case "char":
      return { call: args[0] ? `DataTypes.CHAR(${args[0]})` : "DataTypes.CHAR" };
    case "text":
      return { call: "DataTypes.TEXT" };
    case "tinytext":
      return { call: `DataTypes.TEXT("tiny")` };
    case "mediumtext":
      return { call: `DataTypes.TEXT("medium")` };
    case "longtext":
      return { call: `DataTypes.TEXT("long")` };
    case "date":
      return { call: "DataTypes.DATEONLY" };
    case "time":
      return { call: "DataTypes.TIME" };
    case "datetime":
    case "timestamp":
      return { call: "DataTypes.DATE" };
    case "json":
      return { call: "DataTypes.JSON" };
    case "uuid":
      return { call: "DataTypes.UUID" };
    case "blob":
    case "binary":
    case "varbinary":
    case "tinyblob":
    case "mediumblob":
    case "longblob":
      return { call: "DataTypes.BLOB" };
    default:
      return { call: "DataTypes.STRING", unrecognized: true };
  }
}

export function generateSequelizeModels(tables: ExportTable[]): string {
  const classNameByTable = new Map(tables.map((t) => [t.name, toPascalCase(t.name)]));
  const unrecognizedTypes = new Set<string>();

  const modelBlocks = tables.map((table) => {
    const className = classNameByTable.get(table.name)!;
    const fieldLines = table.columns.map((col) => {
      const mapping = mapSqlTypeToSequelize(col.dataType);
      if (mapping.unrecognized) unrecognizedTypes.add(col.dataType);
      const opts = [`type: ${mapping.call}`];
      if (col.isPrimaryKey) opts.push("primaryKey: true");
      else opts.push(`allowNull: ${col.nullable}`);
      const comment = mapping.unrecognized ? " // unrecognized SQL type, verify manually" : "";
      return `    ${col.name}: { ${opts.join(", ")} },${comment}`;
    });

    return [
      `export class ${className} extends Model {}`,
      `${className}.init(`,
      `  {`,
      fieldLines.join("\n"),
      `  },`,
      `  { sequelize, tableName: "${table.name}", timestamps: false },`,
      `);`,
    ].join("\n");
  });

  const associationLines = tables.flatMap((table) =>
    table.columns
      .filter((col) => col.isForeignKey && col.referencesTable && classNameByTable.has(col.referencesTable))
      .map((col) => {
        const fromClass = classNameByTable.get(table.name)!;
        const toClass = classNameByTable.get(col.referencesTable!)!;
        return `${fromClass}.belongsTo(${toClass}, { foreignKey: "${col.name}" });`;
      }),
  );

  const header = [
    'import { DataTypes, Model } from "sequelize";',
    '// Replace with your actual configured Sequelize instance.',
    'import { sequelize } from "./db";',
    "",
    unrecognizedTypes.size
      ? `// Some columns used a SQL type this generator didn't recognize and\n// fell back to DataTypes.STRING — search for "verify manually" below.\n// Unrecognized types seen: ${[...unrecognizedTypes].join(", ")}\n`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const body = [modelBlocks.join("\n\n"), associationLines.length ? associationLines.join("\n") : null]
    .filter(Boolean)
    .join("\n\n");

  return `${header}\n${body}\n`;
}

// --- MongoDB (Mongoose) export ---
//
// A direct structural translation, not a MongoDB-idiomatic redesign: each
// DesignedTable becomes a Mongoose collection/model, and FK columns become
// ObjectId references (Mongoose's standard `ref` pattern) rather than
// embedded sub-documents. Real MongoDB schema design often prefers
// embedding for data that's always read together — that's a modeling
// judgment call about access patterns this generator has no way to know,
// so it deliberately keeps the same normalized shape instead of guessing.

function mapSqlTypeToMongoose(dataType: string): { type: string; unrecognized?: boolean } {
  const { base, args } = parseDataType(dataType);
  if (base === "tinyint" && args[0] === "1") return { type: "Boolean" };
  switch (base) {
    case "boolean":
    case "bool":
      return { type: "Boolean" };
    case "tinyint":
    case "smallint":
    case "mediumint":
    case "int":
    case "integer":
    case "bigint":
    case "float":
    case "double":
      return { type: "Number" };
    case "decimal":
    case "numeric":
      return { type: "mongoose.Schema.Types.Decimal128" };
    case "varchar":
    case "char":
    case "text":
    case "tinytext":
    case "mediumtext":
    case "longtext":
    case "enum":
    case "uuid":
      return { type: "String" };
    case "date":
    case "time":
    case "datetime":
    case "timestamp":
      return { type: "Date" };
    case "json":
      return { type: "mongoose.Schema.Types.Mixed" };
    case "blob":
    case "binary":
    case "varbinary":
    case "tinyblob":
    case "mediumblob":
    case "longblob":
      return { type: "Buffer" };
    default:
      return { type: "String", unrecognized: true };
  }
}

export function generateMongooseSchema(tables: ExportTable[]): string {
  const modelNameByTable = new Map(tables.map((t) => [t.name, toPascalCase(t.name)]));
  const unrecognizedTypes = new Set<string>();
  let skippedIdNote = false;

  const blocks = tables.map((table) => {
    const modelName = modelNameByTable.get(table.name)!;
    const varName = `${table.name}Schema`;

    const fieldLines = table.columns
      .filter((col) => {
        // MongoDB documents get an automatic `_id` — an explicit PK column
        // literally named "id" would just be a redundant, confusing
        // second identifier, so it's skipped rather than emitted as
        // `id: { type: ... }` on top of Mongoose's own `_id`.
        if (col.isPrimaryKey && col.name.toLowerCase() === "id") {
          skippedIdNote = true;
          return false;
        }
        return true;
      })
      .map((col) => {
        if (col.isForeignKey && col.referencesTable && modelNameByTable.has(col.referencesTable)) {
          const refModel = modelNameByTable.get(col.referencesTable)!;
          const opts = [`type: mongoose.Schema.Types.ObjectId`, `ref: "${refModel}"`];
          if (!col.nullable) opts.push("required: true");
          return `  ${col.name}: { ${opts.join(", ")} },`;
        }
        const mapping = mapSqlTypeToMongoose(col.dataType);
        if (mapping.unrecognized) unrecognizedTypes.add(col.dataType);
        const opts = [`type: ${mapping.type}`];
        if (!col.nullable) opts.push("required: true");
        const comment = mapping.unrecognized ? " // unrecognized SQL type, verify manually" : "";
        return `  ${col.name}: { ${opts.join(", ")} },${comment}`;
      });

    return [
      `const ${varName} = new mongoose.Schema({`,
      fieldLines.join("\n"),
      `}, { timestamps: false });`,
      ``,
      `export const ${modelName} = mongoose.model("${modelName}", ${varName});`,
    ].join("\n");
  });

  const header = [
    'import mongoose from "mongoose";',
    "",
    skippedIdNote
      ? `// Primary-key columns named "id" were left out — MongoDB documents\n// already get an automatic _id field, an extra "id" would be redundant.\n`
      : "",
    unrecognizedTypes.size
      ? `// Some columns used a SQL type this generator didn't recognize and\n// fell back to String — search for "verify manually" below.\n// Unrecognized types seen: ${[...unrecognizedTypes].join(", ")}\n`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `${header}\n${blocks.join("\n\n")}\n`;
}
