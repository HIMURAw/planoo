"use client";

import { createContext, useContext, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { DesignedColumn, DesignedTable } from "./SchemaBuilder";

export interface SchemaTableNodeData extends Record<string, unknown> {
  table: DesignedTable;
}

export type SchemaTableNodeType = Node<SchemaTableNodeData, "tableNode">;

export interface SchemaCanvasHandlers {
  onAddColumn: (tableId: string, column: Omit<DesignedColumn, "id">) => void;
  onDeleteColumn: (tableId: string, columnId: string) => void;
  onDeleteTable: (tableId: string) => void;
  // Visual query builder: when active, clicking a column row (instead of
  // dragging its Handle to draw an FK) adds it to the query path — see
  // lib/query-builder.ts for how that path becomes a JOIN query.
  isQueryMode: boolean;
  onColumnClick: (tableId: string, columnId: string) => void;
  // 1-based position in the current query path, keyed by columnId — absent
  // for columns not yet selected.
  queryColumnOrder: Map<string, number>;
  // Sticky notes (see SchemaNoteNode) — same context, same reason (avoids
  // the declaration-order cycle described below).
  onUpdateNoteContent: (noteId: string, content: string) => void;
  onDeleteNote: (noteId: string) => void;
}

// Node data only ever carries the table (see SchemaTableNodeData) — the
// mutation callbacks live here instead. Keeping them out of node.data avoids
// a declaration-order problem: those callbacks close over the `setNodes`
// state setter, which must be declared before them (the React Compiler
// enforces this), but node.data for the *initial* nodes array has to exist
// at the moment `useState` itself runs — before any of those callbacks can
// be defined. A context sidesteps the cycle entirely.
const SchemaCanvasContext = createContext<SchemaCanvasHandlers | null>(null);
export const SchemaCanvasProvider = SchemaCanvasContext.Provider;

// Exported for SchemaNoteNode too — both node types share this one context.
export function useSchemaCanvasHandlers(): SchemaCanvasHandlers {
  const ctx = useContext(SchemaCanvasContext);
  if (!ctx) throw new Error("SchemaTableNode must be rendered inside a SchemaCanvasProvider");
  return ctx;
}

// A single ERD box on the blueprint canvas. The whole card is the React
// Flow drag surface except elements marked "nodrag" (inputs/buttons) —
// that's xyflow's documented escape hatch for interactive node content.
// Each column row carries its own target (left) and source (right) Handle
// so FK relationships can be drawn column-to-column, not just table-to-table.
export function SchemaTableNode({ data }: NodeProps<SchemaTableNodeType>) {
  const { table } = data;
  const { onAddColumn, onDeleteColumn, onDeleteTable, isQueryMode, onColumnClick, queryColumnOrder } =
    useSchemaCanvasHandlers();
  const [showAddColumn, setShowAddColumn] = useState(false);

  return (
    <div className="w-72 rounded-xl border border-blue-400/40 bg-[#081526]/95 shadow-xl shadow-black/60 font-mono">
      <div className="flex cursor-grab items-center justify-between border-b border-blue-400/20 px-3 py-2.5 active:cursor-grabbing">
        <h4 className="truncate text-sm font-bold uppercase tracking-wide text-blue-200">{table.name}</h4>
        <button
          type="button"
          onClick={() => onDeleteTable(table.id)}
          className="nodrag ml-2 shrink-0 text-[10px] text-blue-400/50 transition-colors hover:text-red-400"
        >
          [SİL]
        </button>
      </div>

      <div className="py-1">
        {table.columns.length === 0 && (
          <p className="px-3 py-2 text-[11px] text-amber-400/80">* Kolon tanımlanmadı.</p>
        )}
        {table.columns.map((col) => {
          const queryOrder = queryColumnOrder.get(col.id);
          const isSelectedForQuery = queryOrder !== undefined;
          return (
            <div
              key={col.id}
              onClick={isQueryMode ? () => onColumnClick(table.id, col.id) : undefined}
              className={`relative flex items-center justify-between border-b px-3 py-1.5 text-[11px] text-blue-200 last:border-b-0 ${
                isQueryMode ? "nodrag cursor-pointer" : ""
              } ${
                isSelectedForQuery
                  ? "border-violet-500/20 bg-violet-500/15 hover:bg-violet-500/20"
                  : "border-blue-500/5 hover:bg-blue-500/5"
              }`}
            >
              <Handle
                type="target"
                position={Position.Left}
                id={`target-${col.id}`}
                className="!h-2.5 !w-2.5 !border-2 !border-blue-400 !bg-[#0d2240]"
              />
              <span className="flex min-w-0 items-center gap-1.5">
                {isSelectedForQuery && (
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold text-white">
                    {queryOrder}
                  </span>
                )}
                {col.isPrimaryKey && (
                  <span className="shrink-0 rounded border border-amber-500/40 bg-amber-500/20 px-1 text-[9px] font-bold text-amber-400">
                    PK
                  </span>
                )}
                {col.isForeignKey && (
                  <span className="shrink-0 rounded border border-blue-500/40 bg-blue-500/20 px-1 text-[9px] font-bold text-blue-400">
                    FK
                  </span>
                )}
                <span className="truncate font-bold text-white">{col.name}</span>
                <span className="truncate font-medium text-blue-400/60">{col.dataType}</span>
              </span>
              {!isQueryMode && (
                <button
                  type="button"
                  onClick={() => onDeleteColumn(table.id, col.id)}
                  className="nodrag ml-2 shrink-0 text-[10px] text-blue-500/30 transition-colors hover:text-red-400"
                >
                  ✕
                </button>
              )}
              <Handle
                type="source"
                position={Position.Right}
                id={`source-${col.id}`}
                className="!h-2.5 !w-2.5 !border-2 !border-violet-400 !bg-[#0d2240]"
              />
            </div>
          );
        })}
      </div>

      <div className="border-t border-blue-400/10 px-3 py-2">
        {showAddColumn ? (
          <AddColumnForm
            onSubmit={(col) => {
              onAddColumn(table.id, col);
              setShowAddColumn(false);
            }}
            onCancel={() => setShowAddColumn(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowAddColumn(true)}
            className="nodrag text-[11px] font-mono uppercase text-blue-400 transition-colors hover:text-blue-200"
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
    <form onSubmit={handleSubmit} className="mt-1 flex flex-wrap items-center gap-2 border-t border-blue-400/10 pt-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ad"
        className="nodrag w-24 rounded border border-blue-500/30 bg-[#0d2240] px-2 py-0.5 font-mono text-[11px] text-white focus:border-blue-400 focus:outline-none"
        autoFocus
      />
      <input
        value={dataType}
        onChange={(e) => setDataType(e.target.value)}
        placeholder="tip"
        className="nodrag w-20 rounded border border-blue-500/30 bg-[#0d2240] px-2 py-0.5 font-mono text-[11px] text-white focus:border-blue-400 focus:outline-none"
      />
      <div className="flex gap-2">
        <label className="nodrag flex cursor-pointer select-none items-center gap-1 text-[9px] font-mono text-blue-400/70">
          <input type="checkbox" checked={!nullable} onChange={(e) => setNullable(!e.target.checked)} className="nodrag scale-90 accent-blue-500" />
          NN
        </label>
        <label className="nodrag flex cursor-pointer select-none items-center gap-1 text-[9px] font-mono text-blue-400/70">
          <input type="checkbox" checked={isPrimaryKey} onChange={(e) => setIsPrimaryKey(e.target.checked)} className="nodrag scale-90 accent-blue-500" />
          PK
        </label>
      </div>
      <div className="ml-auto flex gap-1.5">
        <button type="submit" className="nodrag rounded bg-blue-500 px-2 py-0.5 font-mono text-[10px] text-white hover:bg-blue-400">
          EKLE
        </button>
        <button type="button" onClick={onCancel} className="nodrag text-[10px] font-mono text-blue-400/50 hover:text-blue-200">
          İPTAL
        </button>
      </div>
    </form>
  );
}
