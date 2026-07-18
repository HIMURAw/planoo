"use client";

import { useState } from "react";

export interface DesignedColumn {
  id: string;
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencesTable: string | null;
  referencesColumn: string | null;
}

export interface DesignedTable {
  id: string;
  name: string;
  columns: DesignedColumn[];
}

interface SchemaBuilderProps {
  initialTables: DesignedTable[];
  // Fires with whether there's at least one COLUMN anywhere, not just one
  // table — a table with zero columns gives /api/recheck nothing to match
  // against (real bug found live: an empty table marked setup "done").
  onSchemaChanged: (hasAtLeastOneColumn: boolean) => void;
}

// The default, friction-free way to get a DB schema into planoo — replaces
// the old "run an agent CLI against your real database" as the required
// onboarding step (that's now optional/advanced, see AgentSetup + TODOS.md).
// Design + matching flow: tables/columns designed here feed /api/recheck
// the exact same DbColumn[] shape scripts/agent.ts used to produce, so
// nothing downstream (matcher, canvas) needed to change.
export function SchemaBuilder({ initialTables, onSchemaChanged }: SchemaBuilderProps) {
  const [tables, setTables] = useState(initialTables);
  const [newTableName, setNewTableName] = useState("");
  const [creatingTable, setCreatingTable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function notify(next: DesignedTable[]) {
    setTables(next);
    onSchemaChanged(next.some((t) => t.columns.length > 0));
  }

  async function handleAddTable(e: React.FormEvent) {
    e.preventDefault();
    const name = newTableName.trim();
    if (!name) return;
    setCreatingTable(true);
    setError(null);
    try {
      const response = await fetch("/api/schema/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { table?: DesignedTable; error?: string };
      if (!response.ok || !data.table) {
        setError(data.error ?? "Tablo oluşturulamadı");
        return;
      }
      notify([...tables, data.table]);
      setNewTableName("");
    } finally {
      setCreatingTable(false);
    }
  }

  async function handleDeleteTable(id: string) {
    await fetch(`/api/schema/tables/${id}`, { method: "DELETE" });
    notify(tables.filter((t) => t.id !== id));
  }

  async function handleAddColumn(tableId: string, column: Omit<DesignedColumn, "id">) {
    const response = await fetch(`/api/schema/tables/${tableId}/columns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(column),
    });
    const data = (await response.json()) as { column?: DesignedColumn; error?: string };
    if (!response.ok || !data.column) {
      setError(data.error ?? "Kolon eklenemedi");
      return;
    }
    notify(
      tables.map((t) => (t.id === tableId ? { ...t, columns: [...t.columns, data.column!] } : t)),
    );
  }

  async function handleDeleteColumn(tableId: string, columnId: string) {
    await fetch(`/api/schema/columns/${columnId}`, { method: "DELETE" });
    notify(
      tables.map((t) =>
        t.id === tableId ? { ...t, columns: t.columns.filter((c) => c.id !== columnId) } : t,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {tables.map((table) => (
        <TableCard
          key={table.id}
          table={table}
          onDeleteTable={() => handleDeleteTable(table.id)}
          onAddColumn={(col) => handleAddColumn(table.id, col)}
          onDeleteColumn={(colId) => handleDeleteColumn(table.id, colId)}
        />
      ))}

      <form onSubmit={handleAddTable} className="flex gap-2">
        <input
          value={newTableName}
          onChange={(e) => setNewTableName(e.target.value)}
          placeholder="ör. users, orders"
          className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-violet-400/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={creatingTable || newTableName.trim().length === 0}
          className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          + Tablo ekle
        </button>
      </form>

      {tables.length > 0 && (
        <a
          href="/api/schema/export"
          className="self-start rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
        >
          .sql olarak indir
        </a>
      )}
    </div>
  );
}

function TableCard({
  table,
  onDeleteTable,
  onAddColumn,
  onDeleteColumn,
}: {
  table: DesignedTable;
  onDeleteTable: () => void;
  onAddColumn: (column: Omit<DesignedColumn, "id">) => void;
  onDeleteColumn: (columnId: string) => void;
}) {
  const [showAddColumn, setShowAddColumn] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-white/3 p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-mono text-sm font-medium text-white">{table.name}</h4>
        <button type="button" onClick={onDeleteTable} className="text-xs text-zinc-500 hover:text-red-400">
          Sil
        </button>
      </div>

      {table.columns.length === 0 && (
        <p className="mt-2 text-xs text-amber-400">
          Bu tabloda henüz kolon yok — eşleştirme için en az bir tane ekle.
        </p>
      )}

      {table.columns.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {table.columns.map((col) => (
            <li
              key={col.id}
              className="flex items-center justify-between rounded-md bg-white/5 px-3 py-1.5 text-xs text-zinc-300"
            >
              <span className="font-mono">
                {col.name} <span className="text-zinc-500">{col.dataType}</span>
                {col.isPrimaryKey && <span className="ml-1 text-amber-400">PK</span>}
                {col.isForeignKey && (
                  <span className="ml-1 text-blue-400">
                    FK → {col.referencesTable}.{col.referencesColumn}
                  </span>
                )}
                {!col.nullable && <span className="ml-1 text-zinc-500">NOT NULL</span>}
              </span>
              <button
                type="button"
                onClick={() => onDeleteColumn(col.id)}
                className="text-zinc-500 hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {showAddColumn ? (
        <AddColumnForm
          onSubmit={(col) => {
            onAddColumn(col);
            setShowAddColumn(false);
          }}
          onCancel={() => setShowAddColumn(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAddColumn(true)}
          className="mt-3 text-xs text-violet-300 hover:text-violet-200"
        >
          + Kolon ekle
        </button>
      )}
    </div>
  );
}

function AddColumnForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (column: Omit<DesignedColumn, "id">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState("varchar(255)");
  const [nullable, setNullable] = useState(true);
  const [isPrimaryKey, setIsPrimaryKey] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !dataType.trim()) return;
    onSubmit({
      name: name.trim(),
      dataType: dataType.trim(),
      nullable,
      isPrimaryKey,
      isForeignKey: false,
      referencesTable: null,
      referencesColumn: null,
    });
    setName("");
    setDataType("varchar(255)");
    setNullable(true);
    setIsPrimaryKey(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="kolon adı"
        className="w-32 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-zinc-500 focus:border-violet-400/50 focus:outline-none"
        autoFocus
      />
      <input
        value={dataType}
        onChange={(e) => setDataType(e.target.value)}
        placeholder="tip"
        className="w-28 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-zinc-500 focus:border-violet-400/50 focus:outline-none"
      />
      <label className="flex items-center gap-1 text-xs text-zinc-400">
        <input type="checkbox" checked={!nullable} onChange={(e) => setNullable(!e.target.checked)} />
        NOT NULL
      </label>
      <label className="flex items-center gap-1 text-xs text-zinc-400">
        <input type="checkbox" checked={isPrimaryKey} onChange={(e) => setIsPrimaryKey(e.target.checked)} />
        PK
      </label>
      <button type="submit" className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black">
        Ekle
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-300">
        İptal
      </button>
    </form>
  );
}
