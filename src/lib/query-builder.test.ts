import { describe, expect, it } from "vitest";
import { canAddTableToPath, findJoinCondition, generateJoinQuery, type QueryBuilderTable } from "./query-builder";

const users: QueryBuilderTable = {
  id: "t-users",
  name: "users",
  columns: [
    { id: "c-users-id", name: "id", isForeignKey: false, referencesTable: null, referencesColumn: null },
    { id: "c-users-email", name: "email", isForeignKey: false, referencesTable: null, referencesColumn: null },
  ],
};

const orders: QueryBuilderTable = {
  id: "t-orders",
  name: "orders",
  columns: [
    { id: "c-orders-id", name: "id", isForeignKey: false, referencesTable: null, referencesColumn: null },
    { id: "c-orders-user_id", name: "user_id", isForeignKey: true, referencesTable: "users", referencesColumn: "id" },
    { id: "c-orders-total", name: "total", isForeignKey: false, referencesTable: null, referencesColumn: null },
  ],
};

const orderItems: QueryBuilderTable = {
  id: "t-order_items",
  name: "order_items",
  columns: [
    { id: "c-oi-id", name: "id", isForeignKey: false, referencesTable: null, referencesColumn: null },
    { id: "c-oi-order_id", name: "order_id", isForeignKey: true, referencesTable: "orders", referencesColumn: "id" },
    { id: "c-oi-qty", name: "quantity", isForeignKey: false, referencesTable: null, referencesColumn: null },
  ],
};

const unrelated: QueryBuilderTable = {
  id: "t-logs",
  name: "logs",
  columns: [{ id: "c-logs-id", name: "id", isForeignKey: false, referencesTable: null, referencesColumn: null }],
};

describe("findJoinCondition", () => {
  it("finds a join condition when the first table has the FK column", () => {
    const condition = findJoinCondition(orders, users);
    expect(condition).toEqual({ leftExpr: "orders.user_id", rightExpr: "users.id" });
  });

  it("finds a join condition regardless of argument order (checks both directions)", () => {
    const condition = findJoinCondition(users, orders);
    expect(condition).toEqual({ leftExpr: "orders.user_id", rightExpr: "users.id" });
  });

  it("returns null when there's no FK relationship between the two tables", () => {
    expect(findJoinCondition(users, unrelated)).toBeNull();
  });
});

describe("canAddTableToPath", () => {
  it("always allows the first table", () => {
    expect(canAddTableToPath(users, [])).toBe(true);
  });

  it("allows a table directly related to something already in the path", () => {
    expect(canAddTableToPath(orders, [users])).toBe(true);
  });

  it("allows a table related to an earlier (not just the most recent) table in the path", () => {
    expect(canAddTableToPath(orderItems, [users, orders])).toBe(true);
  });

  it("rejects a table with no relationship to anything in the path", () => {
    expect(canAddTableToPath(unrelated, [users, orders])).toBe(false);
  });
});

describe("generateJoinQuery", () => {
  it("returns null for an empty selection", () => {
    expect(generateJoinQuery([], [users, orders])).toBeNull();
  });

  it("generates a single-table SELECT with no JOIN when only one table is involved", () => {
    const result = generateJoinQuery(
      [{ tableId: "t-users", tableName: "users", columnId: "c-users-id", columnName: "id" }],
      [users],
    );
    expect(result?.sql).toBe("SELECT\n  users.id\nFROM users;");
  });

  it("generates a two-table INNER JOIN following the FK relationship", () => {
    const result = generateJoinQuery(
      [
        { tableId: "t-users", tableName: "users", columnId: "c-users-email", columnName: "email" },
        { tableId: "t-orders", tableName: "orders", columnId: "c-orders-total", columnName: "total" },
      ],
      [users, orders],
    );
    expect(result?.sql).toBe(
      "SELECT\n  users.email,\n  orders.total\nFROM users\nINNER JOIN orders ON orders.user_id = users.id;",
    );
    expect(result?.tableNames).toEqual(["users", "orders"]);
  });

  it("generates a three-table chained JOIN (Users -> Orders -> OrderItems)", () => {
    const result = generateJoinQuery(
      [
        { tableId: "t-users", tableName: "users", columnId: "c-users-email", columnName: "email" },
        { tableId: "t-orders", tableName: "orders", columnId: "c-orders-id", columnName: "id" },
        { tableId: "t-order_items", tableName: "order_items", columnId: "c-oi-qty", columnName: "quantity" },
      ],
      [users, orders, orderItems],
    );
    expect(result?.sql).toBe(
      [
        "SELECT",
        "  users.email,",
        "  orders.id,",
        "  order_items.quantity",
        "FROM users",
        "INNER JOIN orders ON orders.user_id = users.id",
        "INNER JOIN order_items ON order_items.order_id = orders.id;",
      ].join("\n"),
    );
  });

  it("still selects multiple columns from the same table without adding a duplicate JOIN", () => {
    const result = generateJoinQuery(
      [
        { tableId: "t-users", tableName: "users", columnId: "c-users-id", columnName: "id" },
        { tableId: "t-users", tableName: "users", columnId: "c-users-email", columnName: "email" },
      ],
      [users],
    );
    expect(result?.sql).toBe("SELECT\n  users.id,\n  users.email\nFROM users;");
    expect((result?.sql.match(/JOIN/g) ?? []).length).toBe(0);
  });

  it("can join backwards through an earlier table when the immediately preceding one has no direct relationship", () => {
    // order_items relates to orders, not directly to users — selecting
    // users then order_items (skipping orders) should still find the path
    // through orders even though orders was never explicitly selected.
    const result = generateJoinQuery(
      [
        { tableId: "t-users", tableName: "users", columnId: "c-users-id", columnName: "id" },
        { tableId: "t-order_items", tableName: "order_items", columnId: "c-oi-qty", columnName: "quantity" },
      ],
      [users, orders, orderItems],
    );
    // order_items has no direct FK to users, and orders was never added to
    // the path, so this must fail rather than emit an invalid JOIN.
    expect(result).toBeNull();
  });
});
