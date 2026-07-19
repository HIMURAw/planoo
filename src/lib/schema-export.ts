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
