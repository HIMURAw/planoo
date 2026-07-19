import { describe, expect, it } from "vitest";
import {
  generateSql,
  generatePrismaSchema,
  generateTypeOrmEntities,
  generatePostgresSql,
  generateSqliteSql,
  generateDrizzleSchema,
  generateSequelizeModels,
  generateMongooseSchema,
  mapSqlType,
} from "./schema-export";

describe("generateSql", () => {
  it("generates a CREATE TABLE statement with columns", () => {
    const sql = generateSql([
      {
        name: "users",
        columns: [
          { name: "id", dataType: "int", nullable: false, isPrimaryKey: true, isForeignKey: false, referencesTable: null, referencesColumn: null },
          { name: "email", dataType: "varchar(255)", nullable: false, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null },
        ],
      },
    ]);

    expect(sql).toContain("CREATE TABLE `users` (");
    expect(sql).toContain("`id` int NOT NULL PRIMARY KEY");
    expect(sql).toContain("`email` varchar(255) NOT NULL");
  });

  it("marks nullable columns as NULL", () => {
    const sql = generateSql([
      {
        name: "posts",
        columns: [
          { name: "summary", dataType: "text", nullable: true, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null },
        ],
      },
    ]);

    expect(sql).toContain("`summary` text NULL");
  });

  it("emits a FOREIGN KEY clause for foreign-key columns", () => {
    const sql = generateSql([
      {
        name: "orders",
        columns: [
          { name: "user_id", dataType: "int", nullable: false, isPrimaryKey: false, isForeignKey: true, referencesTable: "users", referencesColumn: "id" },
        ],
      },
    ]);

    expect(sql).toContain("FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)");
  });

  it("does not emit a FOREIGN KEY clause when isForeignKey is true but references are missing", () => {
    const sql = generateSql([
      {
        name: "orders",
        columns: [
          { name: "user_id", dataType: "int", nullable: false, isPrimaryKey: false, isForeignKey: true, referencesTable: null, referencesColumn: null },
        ],
      },
    ]);

    expect(sql).not.toContain("FOREIGN KEY");
  });

  it("joins multiple tables with a blank line between them", () => {
    const sql = generateSql([
      { name: "a", columns: [{ name: "id", dataType: "int", nullable: false, isPrimaryKey: true, isForeignKey: false, referencesTable: null, referencesColumn: null }] },
      { name: "b", columns: [{ name: "id", dataType: "int", nullable: false, isPrimaryKey: true, isForeignKey: false, referencesTable: null, referencesColumn: null }] },
    ]);

    expect(sql).toContain("CREATE TABLE `a`");
    expect(sql).toContain("CREATE TABLE `b`");
    expect(sql.indexOf("CREATE TABLE `a`")).toBeLessThan(sql.indexOf("CREATE TABLE `b`"));
  });
});

describe("mapSqlType", () => {
  it("maps common MySQL types to Prisma/TypeScript equivalents", () => {
    expect(mapSqlType("varchar(255)")).toMatchObject({ prisma: "String", ts: "string" });
    expect(mapSqlType("int")).toMatchObject({ prisma: "Int", ts: "number" });
    expect(mapSqlType("bigint")).toMatchObject({ prisma: "BigInt", ts: "bigint" });
    expect(mapSqlType("decimal(10,2)")).toMatchObject({ prisma: "Decimal" });
    expect(mapSqlType("datetime")).toMatchObject({ prisma: "DateTime", ts: "Date" });
    expect(mapSqlType("json")).toMatchObject({ prisma: "Json" });
  });

  it("treats tinyint(1) as a boolean but other tinyint widths as a number", () => {
    expect(mapSqlType("tinyint(1)")).toMatchObject({ prisma: "Boolean", ts: "boolean" });
    expect(mapSqlType("tinyint(4)")).toMatchObject({ prisma: "Int", ts: "number" });
  });

  it("falls back to String and flags unrecognized types instead of guessing", () => {
    const result = mapSqlType("some_made_up_type");
    expect(result.prisma).toBe("String");
    expect(result.unrecognized).toBe(true);
  });
});

describe("generatePrismaSchema", () => {
  it("generates a model block with @id and @@map", () => {
    const schema = generatePrismaSchema([
      {
        name: "users",
        columns: [
          { name: "id", dataType: "int", nullable: false, isPrimaryKey: true, isForeignKey: false, referencesTable: null, referencesColumn: null },
          { name: "email", dataType: "varchar(255)", nullable: false, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null },
        ],
      },
    ]);

    expect(schema).toContain("model Users {");
    expect(schema).toContain("id Int @id");
    expect(schema).toContain("email String @db.VarChar(255)");
    expect(schema).toContain('@@map("users")');
  });

  it("marks nullable columns as optional", () => {
    const schema = generatePrismaSchema([
      {
        name: "posts",
        columns: [
          { name: "summary", dataType: "text", nullable: true, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null },
        ],
      },
    ]);

    expect(schema).toContain("summary String?");
  });

  it("emits a @relation field for a foreign key pointing at a table in the export", () => {
    const schema = generatePrismaSchema([
      {
        name: "users",
        columns: [
          { name: "id", dataType: "int", nullable: false, isPrimaryKey: true, isForeignKey: false, referencesTable: null, referencesColumn: null },
        ],
      },
      {
        name: "orders",
        columns: [
          { name: "user_id", dataType: "int", nullable: false, isPrimaryKey: false, isForeignKey: true, referencesTable: "users", referencesColumn: "id" },
        ],
      },
    ]);

    expect(schema).toContain("model Orders {");
    expect(schema).toContain("user Users @relation(fields: [user_id], references: [id])");
  });

  it("comments out a relation whose referenced table isn't part of the export", () => {
    const schema = generatePrismaSchema([
      {
        name: "orders",
        columns: [
          { name: "user_id", dataType: "int", nullable: false, isPrimaryKey: false, isForeignKey: true, referencesTable: "users", referencesColumn: "id" },
        ],
      },
    ]);

    expect(schema).toContain('// user_id references "users", which isn\'t in this export');
    expect(schema).not.toContain("@relation");
  });

  it("flags a table with zero columns instead of emitting an invalid empty model", () => {
    const schema = generatePrismaSchema([{ name: "empty", columns: [] }]);

    expect(schema).toContain("model Empty {");
    expect(schema).toContain("This table has no columns yet");
  });

  it("flags a table with columns but no primary key instead of silently omitting @id", () => {
    const schema = generatePrismaSchema([
      {
        name: "logs",
        columns: [
          { name: "message", dataType: "text", nullable: false, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null },
        ],
      },
    ]);

    expect(schema).toContain("no column was marked as primary key");
  });

  it("flags an unrecognized data type with a verify-manually comment", () => {
    const schema = generatePrismaSchema([
      {
        name: "weird",
        columns: [
          { name: "x", dataType: "made_up_type", nullable: false, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null },
        ],
      },
    ]);

    expect(schema).toContain("verify manually");
  });
});

describe("generateTypeOrmEntities", () => {
  it("generates an @Entity class with @PrimaryColumn and @Column", () => {
    const ts = generateTypeOrmEntities([
      {
        name: "users",
        columns: [
          { name: "id", dataType: "int", nullable: false, isPrimaryKey: true, isForeignKey: false, referencesTable: null, referencesColumn: null },
          { name: "email", dataType: "varchar(255)", nullable: false, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null },
        ],
      },
    ]);

    expect(ts).toContain('import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from "typeorm";');
    expect(ts).toContain('@Entity({ name: "users" })');
    expect(ts).toContain("export class Users {");
    expect(ts).toContain("@PrimaryColumn(");
    expect(ts).toContain("id!: number;");
    expect(ts).toContain("email!: string;");
  });

  it("marks nullable columns as optional TypeScript fields", () => {
    const ts = generateTypeOrmEntities([
      {
        name: "posts",
        columns: [
          { name: "summary", dataType: "text", nullable: true, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null },
        ],
      },
    ]);

    expect(ts).toContain("summary?: string;");
  });

  it("emits a @ManyToOne + @JoinColumn for a foreign key pointing at a table in the export", () => {
    const ts = generateTypeOrmEntities([
      {
        name: "users",
        columns: [
          { name: "id", dataType: "int", nullable: false, isPrimaryKey: true, isForeignKey: false, referencesTable: null, referencesColumn: null },
        ],
      },
      {
        name: "orders",
        columns: [
          { name: "user_id", dataType: "int", nullable: false, isPrimaryKey: false, isForeignKey: true, referencesTable: "users", referencesColumn: "id" },
        ],
      },
    ]);

    expect(ts).toContain("@ManyToOne(() => Users)");
    expect(ts).toContain('@JoinColumn({ name: "user_id", referencedColumnName: "id" })');
  });

  it("flags a table with zero columns and a table with no primary key", () => {
    const ts = generateTypeOrmEntities([
      { name: "empty", columns: [] },
      {
        name: "logs",
        columns: [
          { name: "message", dataType: "text", nullable: false, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null },
        ],
      },
    ]);

    expect(ts).toContain("This table has no columns yet");
    expect(ts).toContain("no column was marked as primary key");
  });
});

const usersAndOrders = [
  {
    name: "users",
    columns: [
      { name: "id", dataType: "int", nullable: false, isPrimaryKey: true, isForeignKey: false, referencesTable: null, referencesColumn: null },
      { name: "email", dataType: "varchar(255)", nullable: false, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null },
    ],
  },
  {
    name: "orders",
    columns: [
      { name: "id", dataType: "int", nullable: false, isPrimaryKey: true, isForeignKey: false, referencesTable: null, referencesColumn: null },
      { name: "user_id", dataType: "int", nullable: false, isPrimaryKey: false, isForeignKey: true, referencesTable: "users", referencesColumn: "id" },
      { name: "total", dataType: "decimal(10,2)", nullable: false, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null },
      { name: "placed_at", dataType: "datetime", nullable: true, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null },
    ],
  },
];

describe("generatePostgresSql", () => {
  it("quotes identifiers with double quotes and maps common types", () => {
    const sql = generatePostgresSql(usersAndOrders);
    expect(sql).toContain('CREATE TABLE "users" (');
    expect(sql).toContain('"id" integer NOT NULL PRIMARY KEY');
    expect(sql).toContain('"email" varchar(255) NOT NULL');
    expect(sql).toContain('"total" numeric(10, 2) NOT NULL');
    expect(sql).toContain('"placed_at" timestamp NULL');
    expect(sql).toContain('FOREIGN KEY ("user_id") REFERENCES "users"("id")');
  });

  it("prefers jsonb over json", () => {
    const sql = generatePostgresSql([
      { name: "events", columns: [{ name: "payload", dataType: "json", nullable: true, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null }] },
    ]);
    expect(sql).toContain('"payload" jsonb');
  });

  it("flags an unrecognized type instead of guessing", () => {
    const sql = generatePostgresSql([
      { name: "weird", columns: [{ name: "x", dataType: "made_up_type", nullable: false, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null }] },
    ]);
    expect(sql).toContain("verify manually");
  });
});

describe("generateSqliteSql", () => {
  it("collapses MySQL's tiered int/text types down to SQLite's storage classes", () => {
    const sql = generateSqliteSql(usersAndOrders);
    expect(sql).toContain('CREATE TABLE "users" (');
    expect(sql).toContain('"id" INTEGER NOT NULL PRIMARY KEY');
    expect(sql).toContain('"email" TEXT NOT NULL');
    expect(sql).toContain('"total" NUMERIC NOT NULL');
    expect(sql).toContain("PRAGMA foreign_keys = ON");
  });

  it("stores date/time types as TEXT (SQLite has no native date storage class)", () => {
    const sql = generateSqliteSql(usersAndOrders);
    expect(sql).toContain('"placed_at" TEXT NULL');
  });
});

describe("generateDrizzleSchema", () => {
  it("generates mysqlTable definitions with correct builder calls", () => {
    const ts = generateDrizzleSchema(usersAndOrders);
    expect(ts).toContain('import { mysqlTable,');
    expect(ts).toContain('export const users = mysqlTable("users", {');
    expect(ts).toContain('id: int("id").primaryKey(),');
    expect(ts).toContain('email: varchar("email", { length: 255 }).notNull(),');
  });

  it("emits .references() with a thunk pointing at the referenced table/column", () => {
    const ts = generateDrizzleSchema(usersAndOrders);
    expect(ts).toContain(".references(() => users.id)");
  });

  it("maps decimal(p,s) to precision/scale options", () => {
    const ts = generateDrizzleSchema(usersAndOrders);
    expect(ts).toContain('decimal("total", { precision: 10, scale: 2 })');
  });

  it("only imports the column builders it actually used", () => {
    const ts = generateDrizzleSchema([
      { name: "flags", columns: [{ name: "id", dataType: "int", nullable: false, isPrimaryKey: true, isForeignKey: false, referencesTable: null, referencesColumn: null }] },
    ]);
    expect(ts).toContain("import { mysqlTable, int } from");
    expect(ts).not.toContain("varchar");
  });
});

describe("generateSequelizeModels", () => {
  it("generates Model.init() blocks with mapped DataTypes", () => {
    const ts = generateSequelizeModels(usersAndOrders);
    expect(ts).toContain("export class Users extends Model {}");
    expect(ts).toContain("id: { type: DataTypes.INTEGER, primaryKey: true }");
    expect(ts).toContain("email: { type: DataTypes.STRING(255), allowNull: false }");
  });

  it("emits a belongsTo association for each foreign key", () => {
    const ts = generateSequelizeModels(usersAndOrders);
    expect(ts).toContain('Orders.belongsTo(Users, { foreignKey: "user_id" });');
  });

  it("maps text size tiers to Sequelize's DataTypes.TEXT size hints", () => {
    const ts = generateSequelizeModels([
      { name: "posts", columns: [{ name: "body", dataType: "longtext", nullable: true, isPrimaryKey: false, isForeignKey: false, referencesTable: null, referencesColumn: null }] },
    ]);
    expect(ts).toContain('DataTypes.TEXT("long")');
  });
});

describe("generateMongooseSchema", () => {
  it("skips an 'id' primary key column in favor of MongoDB's automatic _id", () => {
    const ts = generateMongooseSchema(usersAndOrders);
    expect(ts).not.toMatch(/^\s*id: \{/m);
    expect(ts).toContain("automatic _id field");
  });

  it("converts a foreign key column into an ObjectId ref instead of its raw SQL type", () => {
    const ts = generateMongooseSchema(usersAndOrders);
    expect(ts).toContain("user_id: { type: mongoose.Schema.Types.ObjectId, ref: \"Users\", required: true }");
  });

  it("maps decimal to Decimal128 and exports a named model per table", () => {
    const ts = generateMongooseSchema(usersAndOrders);
    expect(ts).toContain("total: { type: mongoose.Schema.Types.Decimal128, required: true }");
    expect(ts).toContain('export const Users = mongoose.model("Users", usersSchema);');
    expect(ts).toContain('export const Orders = mongoose.model("Orders", ordersSchema);');
  });

  it("keeps a non-'id'-named primary key as a regular field", () => {
    const ts = generateMongooseSchema([
      { name: "settings", columns: [{ name: "settings_key", dataType: "varchar(100)", nullable: false, isPrimaryKey: true, isForeignKey: false, referencesTable: null, referencesColumn: null }] },
    ]);
    expect(ts).toContain("settings_key: { type: String, required: true }");
  });
});
