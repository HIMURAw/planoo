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
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-red-400 font-mono">[ERROR] {error}</p>}

      {tables.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onDeleteTable={() => handleDeleteTable(table.id)}
              onAddColumn={(col) => handleAddColumn(table.id, col)}
              onDeleteColumn={(colId) => handleDeleteColumn(table.id, colId)}
            />
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-blue-500/20 rounded-xl p-12 text-center bg-blue-950/5">
          <p className="text-sm text-blue-300/60 font-mono">[SYS] TABLO BULUNAMADI. LÜTFEN İLK TABLOYU EKLEYİN.</p>
        </div>
      )}

      <div className="border-t border-blue-500/10 pt-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleAddTable} className="flex gap-2 w-full max-w-md">
          <input
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            placeholder="ör. users, orders"
            className="flex-1 rounded-lg border border-blue-500/30 bg-[#0d2240] px-3.5 py-2 text-sm text-white placeholder:text-blue-300/40 focus:border-blue-400 focus:outline-none font-mono"
          />
          <button
            type="submit"
            disabled={creatingTable || newTableName.trim().length === 0}
            className="shrink-0 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-mono text-sm px-4 py-2 disabled:opacity-30 disabled:hover:bg-blue-500 transition-colors shadow-[0_0_10px_rgba(59,130,246,0.3)]"
          >
            + TABLO EKLE
          </button>
        </form>

        {tables.length > 0 && (
          <a
            href="/api/schema/export"
            className="rounded-lg border border-blue-400/30 bg-blue-950/20 px-4 py-2 text-xs font-mono text-blue-300 hover:bg-blue-900/30 transition-colors"
          >
            [EXPORT .SQL]
          </a>
        )}
      </div>
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
    <div className="rounded-xl border border-blue-400/40 bg-[#081526]/90 p-4 shadow-lg flex flex-col justify-between min-h-[160px]">
      <div>
        <div className="flex items-center justify-between border-b border-blue-400/20 pb-2 mb-3">
          <h4 className="font-mono text-sm font-bold text-blue-200 uppercase tracking-wide">
            {table.name}
          </h4>
          <button
            type="button"
            onClick={onDeleteTable}
            className="text-[10px] font-mono text-blue-400/50 hover:text-red-400 transition-colors"
          >
            [SİL]
          </button>
        </div>

        {table.columns.length === 0 && (
          <p className="text-[11px] font-mono text-amber-400/80 mb-3">
            * Kolon tanımlanmadı.
          </p>
        )}

        {table.columns.length > 0 && (
          <ul className="flex flex-col gap-1.5 mb-4">
            {table.columns.map((col) => (
              <li
                key={col.id}
                className="flex items-center justify-between rounded bg-[#0d2240]/40 border border-blue-500/10 px-2 py-1 text-[11px] text-blue-200"
              >
                <span className="font-mono flex items-center gap-1.5">
                  {col.isPrimaryKey && (
                    <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1 rounded">PK</span>
                  )}
                  {col.isForeignKey && (
                    <span className="text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40 px-1 rounded">FK</span>
                  )}
                  <span className="font-bold text-white">{col.name}</span>
                  <span className="text-blue-400/60 font-medium">{col.dataType}</span>
                  {!col.nullable && <span className="text-[9px] text-blue-400/30">NN</span>}
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteColumn(col.id)}
                  className="text-blue-500/30 hover:text-red-400 font-mono transition-colors text-[10px] ml-2"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
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
            className="text-[11px] font-mono text-blue-400 hover:text-blue-200 transition-colors uppercase"
          >
            [+ Kolon Ekle]
          </button>
        )}
      </div>
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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 border-t border-blue-400/10 pt-2.5 mt-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ad"
        className="w-24 rounded bg-[#0d2240] border border-blue-500/30 px-2 py-0.5 text-[11px] text-white focus:outline-none focus:border-blue-400 font-mono"
        autoFocus
      />
      <input
        value={dataType}
        onChange={(e) => setDataType(e.target.value)}
        placeholder="tip"
        className="w-20 rounded bg-[#0d2240] border border-blue-500/30 px-2 py-0.5 text-[11px] text-white focus:outline-none focus:border-blue-400 font-mono"
      />
      <div className="flex gap-2">
        <label className="flex items-center gap-1 text-[9px] font-mono text-blue-400/70 select-none cursor-pointer">
          <input type="checkbox" checked={!nullable} onChange={(e) => setNullable(!e.target.checked)} className="accent-blue-500 scale-90" />
          NN
        </label>
        <label className="flex items-center gap-1 text-[9px] font-mono text-blue-400/70 select-none cursor-pointer">
          <input type="checkbox" checked={isPrimaryKey} onChange={(e) => setIsPrimaryKey(e.target.checked)} className="accent-blue-500 scale-90" />
          PK
        </label>
      </div>
      <div className="flex gap-1.5 ml-auto">
        <button type="submit" className="rounded bg-blue-500 hover:bg-blue-400 text-white font-mono px-2 py-0.5 text-[10px]">
          EKLE
        </button>
        <button type="button" onClick={onCancel} className="text-[10px] font-mono text-blue-400/50 hover:text-blue-200">
          İPTAL
        </button>
      </div>
    </form>
  );
}
