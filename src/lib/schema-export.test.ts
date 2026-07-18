import { describe, expect, it } from "vitest";
import { generateSql } from "./schema-export";

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
