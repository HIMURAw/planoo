"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  applyNodeChanges,
  MarkerType,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SchemaTableNode, SchemaCanvasProvider, type SchemaTableNodeType } from "./SchemaTableNode";
import {
  canAddTableToPath,
  generateJoinQuery,
  type QueryBuilderColumnRef,
  type QueryBuilderTable,
} from "@/lib/query-builder";

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
  posX: number;
  posY: number;
  columns: DesignedColumn[];
}

interface SchemaBuilderProps {
  projectId: string;
  initialTables: DesignedTable[];
  // Fires with whether there's at least one COLUMN anywhere, not just one
  // table — a table with zero columns gives /api/recheck nothing to match
  // against (real bug found live: an empty table marked setup "done").
  onSchemaChanged: (hasAtLeastOneColumn: boolean) => void;
}

const nodeTypes = { tableNode: SchemaTableNode };

// Legacy rows created before the canvas existed all default to (0,0) —
// spread those out into a grid instead of stacking them on first render.
const GRID_COLS = 3;
const GRID_COL_WIDTH = 340;
const GRID_ROW_HEIGHT = 320;

// React Flow's fitView() runs against these before the node has actually
// been painted and measured via ResizeObserver — without a width/height hint
// here, that first computation divides by an effectively-zero bounding box
// and the whole viewport (pan/zoom transform) comes out NaN, which then
// poisons Background/MiniMap/edges rendering too. The real DOM size (see
// SchemaTableNode's w-72 + row heights) is re-measured automatically once
// mounted, so this only needs to be a reasonable estimate.
const NODE_WIDTH = 288;
const NODE_HEADER_HEIGHT = 45;
const NODE_ROW_HEIGHT = 30;
const NODE_FOOTER_HEIGHT = 41;

function estimateNodeHeight(table: DesignedTable): number {
  const rows = Math.max(table.columns.length, 1); // the "kolon tanımlanmadı" placeholder row
  return NODE_HEADER_HEIGHT + rows * NODE_ROW_HEIGHT + NODE_FOOTER_HEIGHT;
}

function tableToNode(table: DesignedTable): SchemaTableNodeType {
  return {
    id: table.id,
    type: "tableNode",
    position: { x: table.posX, y: table.posY },
    data: { table },
    initialWidth: NODE_WIDTH,
    initialHeight: estimateNodeHeight(table),
  };
}

function buildInitialNodes(tables: DesignedTable[]): SchemaTableNodeType[] {
  const stacked = tables.filter((t) => t.posX === 0 && t.posY === 0);
  let gridIndex = 0;
  return tables.map((table) => {
    if (stacked.length > 1 && table.posX === 0 && table.posY === 0) {
      const posX = (gridIndex % GRID_COLS) * GRID_COL_WIDTH;
      const posY = Math.floor(gridIndex / GRID_COLS) * GRID_ROW_HEIGHT;
      gridIndex += 1;
      return tableToNode({ ...table, posX, posY });
    }
    return tableToNode(table);
  });
}

// The default, friction-free way to get a DB schema into planoo — replaces
// the old "run an agent CLI against your real database" as the required
// onboarding step (that's now optional/advanced, see TODOS.md). Tables live
// on a React Flow canvas ("blueprint"): dragged freely, wired together
// column-to-column to represent FK relationships. Design + matching flow:
// tables/columns designed here feed /api/recheck the exact same DbColumn[]
// shape scripts/agent.ts used to produce, so nothing downstream (matcher,
// canvas) needed to change.
// useReactFlow() (needed to spawn new tables at the center of whatever the
// user is currently looking at, see handleAddTable) only works from inside
// the context ReactFlow itself establishes — hence the Provider/Inner split,
// the standard xyflow pattern for using the hook alongside <ReactFlow> in
// the same tree.
export function SchemaBuilder(props: SchemaBuilderProps) {
  return (
    <ReactFlowProvider>
      <SchemaBuilderInner {...props} />
    </ReactFlowProvider>
  );
}

function SchemaBuilderInner({ projectId, initialTables, onSchemaChanged }: SchemaBuilderProps) {
  const [newTableName, setNewTableName] = useState("");
  const [creatingTable, setCreatingTable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<SchemaTableNodeType[]>(() => buildInitialNodes(initialTables));
  const [isQueryMode, setIsQueryMode] = useState(false);
  const [queryPath, setQueryPath] = useState<QueryBuilderColumnRef[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryCopied, setQueryCopied] = useState(false);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  // Edges are recomputed fresh from `nodes` every render (see the `edges`
  // useMemo below) rather than kept as their own state, since they're purely
  // derived from FK column data. Selection is the one piece of UI-only state
  // that can't be derived that way, so it's tracked separately and merged
  // back in below — without an onEdgesChange handler at all, React Flow has
  // no way to report a click-to-select back into a controlled `edges` prop,
  // which means Delete-to-remove silently has nothing selected to act on.
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev) as SchemaTableNodeType[]);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setSelectedEdgeIds((prev) => {
      const next = new Set(prev);
      for (const change of changes) {
        if (change.type === "select") {
          if (change.selected) next.add(change.id);
          else next.delete(change.id);
        }
      }
      return next;
    });
  }, []);

  // Persists to the DB correctly on its own, but SchemaBuilder's `nodes`
  // state is seeded once from the `initialTables` prop (see
  // buildInitialNodes above) and never re-synced afterward. Switching away
  // from the Schema tab and back fully unmounts/remounts this component
  // (see DashboardClient's panel switch), which re-seeds `nodes` from
  // whatever DashboardClient still has cached — so without reporting the
  // new position back up via onSchemaChanged, a drag that saved just fine
  // would still visually "snap back" the next time this panel remounts.
  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      fetch(`/api/schema/tables/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posX: node.position.x, posY: node.position.y }),
      }).then(() => {
        onSchemaChanged(nodes.some((n) => n.data.table.columns.length > 0));
      });
    },
    [nodes, onSchemaChanged],
  );

  const handleAddColumn = useCallback(
    async (tableId: string, column: Omit<DesignedColumn, "id">) => {
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
      const next = nodes.map((n) =>
        n.id === tableId
          ? { ...n, data: { table: { ...n.data.table, columns: [...n.data.table.columns, data.column!] } } }
          : n,
      );
      setNodes(next);
      onSchemaChanged(next.some((n) => n.data.table.columns.length > 0));
    },
    [nodes, onSchemaChanged],
  );

  const handleDeleteColumn = useCallback(
    (tableId: string, columnId: string) => {
      fetch(`/api/schema/columns/${columnId}`, { method: "DELETE" });
      const next = nodes.map((n) =>
        n.id === tableId
          ? { ...n, data: { table: { ...n.data.table, columns: n.data.table.columns.filter((c) => c.id !== columnId) } } }
          : n,
      );
      setNodes(next);
      onSchemaChanged(next.some((n) => n.data.table.columns.length > 0));
    },
    [nodes, onSchemaChanged],
  );

  const handleDeleteTable = useCallback(
    (id: string) => {
      fetch(`/api/schema/tables/${id}`, { method: "DELETE" });
      const deletedName = nodes.find((n) => n.id === id)?.data.table.name;
      const next = nodes
        .filter((n) => n.id !== id)
        .map((n) => ({
          ...n,
          data: {
            table: {
              ...n.data.table,
              columns: n.data.table.columns.map((c) =>
                c.referencesTable === deletedName ? { ...c, isForeignKey: false, referencesTable: null, referencesColumn: null } : c,
              ),
            },
          },
        }));
      setNodes(next);
      onSchemaChanged(next.some((n) => n.data.table.columns.length > 0));
    },
    [nodes, onSchemaChanged],
  );

  // Visual query builder: converts a `DesignedTable` (this file's shape,
  // free-text dataType etc.) into the minimal shape lib/query-builder.ts's
  // pure FK-graph logic actually needs.
  const toQueryBuilderTable = useCallback(
    (table: DesignedTable): QueryBuilderTable => ({
      id: table.id,
      name: table.name,
      columns: table.columns.map((c) => ({
        id: c.id,
        name: c.name,
        isForeignKey: c.isForeignKey,
        referencesTable: c.referencesTable,
        referencesColumn: c.referencesColumn,
      })),
    }),
    [],
  );

  const handleColumnClick = useCallback(
    (tableId: string, columnId: string) => {
      if (queryPath.some((c) => c.columnId === columnId)) {
        setQueryPath(queryPath.filter((c) => c.columnId !== columnId));
        return;
      }

      const node = nodes.find((n) => n.id === tableId);
      const column = node?.data.table.columns.find((c) => c.id === columnId);
      if (!node || !column) return;

      const tableIdsInPath = new Set(queryPath.map((c) => c.tableId));
      const tablesInPath = nodes.filter((n) => tableIdsInPath.has(n.id)).map((n) => toQueryBuilderTable(n.data.table));

      if (!canAddTableToPath(toQueryBuilderTable(node.data.table), tablesInPath)) {
        setQueryError(`"${node.data.table.name}" tablosu, seçili tablolarla bir foreign key ilişkisiyle bağlı değil.`);
        return;
      }
      setQueryError(null);
      setQueryPath([
        ...queryPath,
        { tableId, tableName: node.data.table.name, columnId, columnName: column.name },
      ]);
    },
    [nodes, queryPath, toQueryBuilderTable],
  );

  const queryColumnOrder = useMemo(() => {
    const map = new Map<string, number>();
    queryPath.forEach((c, i) => map.set(c.columnId, i + 1));
    return map;
  }, [queryPath]);

  const generatedQuery = useMemo(() => {
    if (queryPath.length === 0) return null;
    return generateJoinQuery(queryPath, nodes.map((n) => toQueryBuilderTable(n.data.table)));
  }, [queryPath, nodes, toQueryBuilderTable]);

  function handleToggleQueryMode() {
    setIsQueryMode((v) => !v);
    setQueryError(null);
  }

  function handleClearQueryPath() {
    setQueryPath([]);
    setQueryError(null);
  }

  async function handleCopyQuery() {
    if (!generatedQuery) return;
    await navigator.clipboard.writeText(generatedQuery.sql);
    setQueryCopied(true);
    setTimeout(() => setQueryCopied(false), 1500);
  }

  const canvasHandlers = useMemo(
    () => ({
      onAddColumn: handleAddColumn,
      onDeleteColumn: handleDeleteColumn,
      onDeleteTable: handleDeleteTable,
      isQueryMode,
      onColumnClick: handleColumnClick,
      queryColumnOrder,
    }),
    [handleAddColumn, handleDeleteColumn, handleDeleteTable, isQueryMode, handleColumnClick, queryColumnOrder],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const sourceColumnId = connection.sourceHandle?.replace("source-", "");
      const targetColumnId = connection.targetHandle?.replace("target-", "");
      if (!sourceColumnId || !targetColumnId || sourceColumnId === targetColumnId || !connection.target) return;

      const targetTable = nodes.find((n) => n.id === connection.target)?.data.table;
      const targetColumn = targetTable?.columns.find((c) => c.id === targetColumnId);
      if (!targetTable || !targetColumn) return;

      fetch(`/api/schema/columns/${sourceColumnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isForeignKey: true, referencesTable: targetTable.name, referencesColumn: targetColumn.name }),
      });

      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          data: {
            table: {
              ...n.data.table,
              columns: n.data.table.columns.map((c) =>
                c.id === sourceColumnId
                  ? { ...c, isForeignKey: true, referencesTable: targetTable.name, referencesColumn: targetColumn.name }
                  : c,
              ),
            },
          },
        })),
      );
    },
    [nodes],
  );

  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      setSelectedEdgeIds((prev) => {
        const next = new Set(prev);
        for (const edge of deleted) next.delete(edge.id);
        return next;
      });

      // Computed from the `nodes` closure rather than inside a setNodes
      // functional updater, so the fetch() calls below don't live inside
      // it — React 18/19 Strict Mode double-invokes updater functions in
      // dev specifically to catch impure ones like that, which was
      // silently firing every one of these PATCHes twice.
      let next = nodes;
      for (const edge of deleted) {
        const sourceColumnId = edge.sourceHandle?.replace("source-", "");
        if (!sourceColumnId) continue;
        fetch(`/api/schema/columns/${sourceColumnId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isForeignKey: false, referencesTable: null, referencesColumn: null }),
        });
        next = next.map((n) => ({
          ...n,
          data: {
            table: {
              ...n.data.table,
              columns: n.data.table.columns.map((c) =>
                c.id === sourceColumnId ? { ...c, isForeignKey: false, referencesTable: null, referencesColumn: null } : c,
              ),
            },
          },
        }));
      }
      setNodes(next);
    },
    [nodes],
  );

  const handleNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const node of deleted) handleDeleteTable(node.id);
    },
    [handleDeleteTable],
  );

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
        body: JSON.stringify({ name, projectId }),
      });
      const data = (await response.json()) as { table?: DesignedTable; error?: string };
      if (!response.ok || !data.table) {
        setError(data.error ?? "Tablo oluşturulamadı");
        return;
      }

      // The server assigns a grid fallback position (see /api/schema/tables)
      // that has no idea where the user is currently looking on a large
      // canvas — override it with the center of the current viewport so a
      // freshly created table doesn't spawn somewhere the user has to go
      // hunting for. estimateNodeHeight/NODE_WIDTH center the node itself on
      // that point, not just its top-left corner.
      const wrapper = canvasWrapperRef.current;
      const centerScreen = wrapper
        ? (() => {
            const rect = wrapper.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          })()
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const centerFlow = screenToFlowPosition(centerScreen);
      const table: DesignedTable = {
        ...data.table,
        posX: centerFlow.x - NODE_WIDTH / 2,
        posY: centerFlow.y - estimateNodeHeight(data.table) / 2,
      };

      fetch(`/api/schema/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posX: table.posX, posY: table.posY }),
      });

      const next = [...nodes, tableToNode(table)];
      setNodes(next);
      onSchemaChanged(next.some((n) => n.data.table.columns.length > 0));
      setNewTableName("");
    } finally {
      setCreatingTable(false);
    }
  }

  const edges: Edge[] = useMemo(() => {
    const columnIndex = new Map<string, { tableId: string; columnId: string }>();
    for (const n of nodes) {
      for (const c of n.data.table.columns) {
        columnIndex.set(`${n.data.table.name}.${c.name}`, { tableId: n.id, columnId: c.id });
      }
    }
    const result: Edge[] = [];
    for (const n of nodes) {
      for (const c of n.data.table.columns) {
        if (!c.isForeignKey || !c.referencesTable || !c.referencesColumn) continue;
        const target = columnIndex.get(`${c.referencesTable}.${c.referencesColumn}`);
        if (!target) continue; // dangling reference (renamed/deleted elsewhere) — skip silently
        const edgeId = `${c.id}->${target.columnId}`;
        const selected = selectedEdgeIds.has(edgeId);
        result.push({
          id: edgeId,
          source: n.id,
          sourceHandle: `source-${c.id}`,
          target: target.tableId,
          targetHandle: `target-${target.columnId}`,
          selected,
          style: { stroke: selected ? "#c4b5fd" : "#818cf8", strokeWidth: selected ? 2.5 : 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: selected ? "#c4b5fd" : "#818cf8", width: 16, height: 16 },
        });
      }
    }
    return result;
  }, [nodes, selectedEdgeIds]);

  return (
    <div className="relative flex h-full w-full flex-col">
      {error && (
        <p className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-lg border border-red-500/30 bg-red-950/80 px-3 py-1.5 font-mono text-xs text-red-300 shadow-lg backdrop-blur-sm">
          [ERROR] {error}
        </p>
      )}

      <div className="flex-1" ref={canvasWrapperRef}>
        <SchemaCanvasProvider value={canvasHandlers}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={handleNodeDragStop}
            onNodesDelete={handleNodesDelete}
            onEdgesDelete={handleEdgesDelete}
            onConnect={onConnect}
            deleteKeyCode={["Backspace", "Delete"]}
            colorMode="dark"
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#3b82f620" gap={24} />
            <Controls />
            <MiniMap
              nodeColor="#1e3a5f"
              maskColor="rgba(5, 10, 20, 0.75)"
              style={{ background: "#081526" }}
            />

            <Panel position="top-left">
              <form onSubmit={handleAddTable} className="glass-panel flex items-center gap-2 rounded-xl p-2">
                <input
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="ör. users, orders"
                  className="w-40 rounded-lg border border-blue-500/30 bg-[#0d2240] px-3 py-1.5 font-mono text-sm text-white placeholder:text-blue-300/40 focus:border-blue-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={creatingTable || newTableName.trim().length === 0}
                  className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 font-mono text-sm text-white shadow-[0_0_10px_rgba(59,130,246,0.3)] transition-colors hover:bg-blue-400 disabled:opacity-30 disabled:hover:bg-blue-500"
                >
                  + TABLO EKLE
                </button>
              </form>
            </Panel>

            <Panel position="bottom-left">
              <p className="glass-panel rounded-lg px-3 py-1.5 text-[11px] text-zinc-400">
                {isQueryMode
                  ? "Sorguya eklemek için kolonlara sırayla tıklayın · seçimi kaldırmak için tekrar tıklayın"
                  : (
                    <>
                      Bağlantı çizmek için bir kolonun kenarındaki noktayı sürükleyin · silmek için bağlantıyı seçip{" "}
                      <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono">Delete</kbd>
                    </>
                  )}
              </p>
            </Panel>

            <Panel position="top-right">
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={handleToggleQueryMode}
                  className={`glass-panel flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-xs font-bold uppercase tracking-wide transition-colors ${
                    isQueryMode
                      ? "border border-violet-400/60 bg-violet-500/20 text-violet-200"
                      : "border border-white/10 text-zinc-300 hover:text-white"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Sorgu Oluşturucu
                </button>

                {isQueryMode && (
                  <div className="glass-panel w-96 rounded-xl border border-violet-400/20 p-3">
                    {queryPath.length === 0 ? (
                      <p className="text-[11px] text-zinc-400">
                        Bir SELECT sorgusu oluşturmak için tablolardaki kolonlara sırayla tıklayın — ör. Users → Orders → OrderItems.
                      </p>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-wide text-violet-300">
                            {queryPath.length} kolon seçildi
                          </span>
                          <button
                            type="button"
                            onClick={handleClearQueryPath}
                            className="font-mono text-[10px] text-zinc-400 hover:text-red-400"
                          >
                            [Temizle]
                          </button>
                        </div>
                        {generatedQuery ? (
                          <>
                            <pre className="max-h-48 overflow-auto rounded-lg border border-white/10 bg-[#0a0f1a] p-2.5 font-mono text-[11px] leading-relaxed text-emerald-300">
                              {generatedQuery.sql}
                            </pre>
                            <button
                              type="button"
                              onClick={handleCopyQuery}
                              className="mt-2 w-full rounded-lg bg-violet-500 px-3 py-1.5 font-mono text-[11px] font-bold text-white transition-colors hover:bg-violet-400"
                            >
                              {queryCopied ? "Kopyalandı ✓" : "Sorguyu Kopyala"}
                            </button>
                          </>
                        ) : (
                          <p className="text-[11px] text-amber-400">Sorgu üretilemedi — seçili kolonların tabloları arasında bir foreign key yolu bulunamadı.</p>
                        )}
                      </>
                    )}
                    {queryError && <p className="mt-2 text-[11px] text-red-400">{queryError}</p>}
                  </div>
                )}
              </div>
            </Panel>
          </ReactFlow>
        </SchemaCanvasProvider>
      </div>
    </div>
  );
}
