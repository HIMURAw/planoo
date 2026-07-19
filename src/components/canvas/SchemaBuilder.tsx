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
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SchemaTableNode, SchemaCanvasProvider, type SchemaTableNodeType } from "./SchemaTableNode";
import { SchemaNoteNode, type SchemaNoteNodeType, type CanvasNote } from "./SchemaNoteNode";
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
  initialNotes: CanvasNote[];
  userName: string;
  userImage: string | null;
  // Fires with whether there's at least one COLUMN anywhere, not just one
  // table — a table with zero columns gives /api/recheck nothing to match
  // against (real bug found live: an empty table marked setup "done").
  onSchemaChanged: (hasAtLeastOneColumn: boolean) => void;
}

// Table nodes and sticky notes share one React Flow `nodes` array (xyflow
// only supports a single controlled node list), distinguished by `type`.
// Everywhere below that needs to read/mutate table-specific data narrows
// with `n.type === "tableNode"` first — TS can't infer that from an id
// match alone, since id is just a string, not a shared discriminant.
type CanvasNodeType = SchemaTableNodeType | SchemaNoteNodeType;

function isTableNode(n: CanvasNodeType): n is SchemaTableNodeType {
  return n.type === "tableNode";
}

const nodeTypes = { tableNode: SchemaTableNode, noteNode: SchemaNoteNode };
// Notes render as a small round avatar-with-a-note-badge by default (see
// SchemaNoteNode) — only the full sticky-note box expands on hover/edit,
// which doesn't need a size hint since it's an absolutely-positioned
// overlay, not something React Flow lays out.
const NOTE_COMPACT_SIZE = 44;

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

function noteToNode(note: CanvasNote): SchemaNoteNodeType {
  return {
    id: note.id,
    type: "noteNode",
    position: { x: note.posX, y: note.posY },
    data: { note },
    initialWidth: NOTE_COMPACT_SIZE,
    initialHeight: NOTE_COMPACT_SIZE,
  };
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

function SchemaBuilderInner({ projectId, initialTables, initialNotes, userName, userImage, onSchemaChanged }: SchemaBuilderProps) {
  const [newTableName, setNewTableName] = useState("");
  const [creatingTable, setCreatingTable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<CanvasNodeType[]>(() => [
    ...buildInitialNodes(initialTables),
    ...initialNotes.map(noteToNode),
  ]);
  const [isQueryMode, setIsQueryMode] = useState(false);
  const [queryPath, setQueryPath] = useState<QueryBuilderColumnRef[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryCopied, setQueryCopied] = useState(false);
  // "+ NOT" arms this instead of creating a note immediately — the next
  // click on empty canvas (onPaneClick below) is what actually places it,
  // at the exact clicked spot rather than always the viewport center.
  const [isPlacingNote, setIsPlacingNote] = useState(false);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Where the camera was left (pan + zoom), per project, so switching away
  // from the Schema tab and back doesn't reset it — this component fully
  // remounts on every tab switch (see the handleNodeDragStop comment below
  // for why), and React Flow's `fitView` recenters on every mount by
  // default regardless of where the user actually left the camera.
  // sessionStorage rather than the database: this is ephemeral "where was
  // I looking" UI state, not project data anyone else needs to see.
  const viewportStorageKey = `planoo:schema-viewport:${projectId}`;
  const [initialViewport] = useState<Viewport | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = window.sessionStorage.getItem(viewportStorageKey);
    if (!saved) return null;
    try {
      return JSON.parse(saved) as Viewport;
    } catch {
      return null;
    }
  });

  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      window.sessionStorage.setItem(viewportStorageKey, JSON.stringify(viewport));
    },
    [viewportStorageKey],
  );
  // Edges are recomputed fresh from `nodes` every render (see the `edges`
  // useMemo below) rather than kept as their own state, since they're purely
  // derived from FK column data. Selection is the one piece of UI-only state
  // that can't be derived that way, so it's tracked separately and merged
  // back in below — without an onEdgesChange handler at all, React Flow has
  // no way to report a click-to-select back into a controlled `edges` prop,
  // which means Delete-to-remove silently has nothing selected to act on.
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev) as CanvasNodeType[]);
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
      const endpoint = node.type === "noteNode" ? `/api/schema/notes/${node.id}` : `/api/schema/tables/${node.id}`;
      fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posX: node.position.x, posY: node.position.y }),
      }).then(() => {
        onSchemaChanged(nodes.filter(isTableNode).some((n) => n.data.table.columns.length > 0));
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
      const next = nodes.map((n) => {
        if (!isTableNode(n) || n.id !== tableId) return n;
        return { ...n, data: { table: { ...n.data.table, columns: [...n.data.table.columns, data.column!] } } };
      });
      setNodes(next);
      onSchemaChanged(next.filter(isTableNode).some((n) => n.data.table.columns.length > 0));
    },
    [nodes, onSchemaChanged],
  );

  const handleDeleteColumn = useCallback(
    (tableId: string, columnId: string) => {
      const next = nodes.map((n) => {
        if (!isTableNode(n) || n.id !== tableId) return n;
        return { ...n, data: { table: { ...n.data.table, columns: n.data.table.columns.filter((c) => c.id !== columnId) } } };
      });
      setNodes(next);
      // Chained after the DELETE resolves rather than fired alongside it —
      // same reasoning as handleUpdateNoteContent's comment: onSchemaChanged
      // triggers a refetch that could otherwise race the delete itself and
      // re-cache the about-to-be-removed column.
      fetch(`/api/schema/columns/${columnId}`, { method: "DELETE" }).then(() => {
        onSchemaChanged(next.filter(isTableNode).some((n) => n.data.table.columns.length > 0));
      });
    },
    [nodes, onSchemaChanged],
  );

  const handleDeleteTable = useCallback(
    (id: string) => {
      const deletedTableName = nodes.find((n): n is SchemaTableNodeType => isTableNode(n) && n.id === id)?.data.table.name;
      const next = nodes
        .filter((n) => n.id !== id)
        .map((n) => {
          if (!isTableNode(n)) return n;
          return {
            ...n,
            data: {
              table: {
                ...n.data.table,
                columns: n.data.table.columns.map((c) =>
                  c.referencesTable === deletedTableName ? { ...c, isForeignKey: false, referencesTable: null, referencesColumn: null } : c,
                ),
              },
            },
          };
        });
      setNodes(next);
      fetch(`/api/schema/tables/${id}`, { method: "DELETE" }).then(() => {
        onSchemaChanged(next.filter(isTableNode).some((n) => n.data.table.columns.length > 0));
      });
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

      const node = nodes.find((n): n is SchemaTableNodeType => isTableNode(n) && n.id === tableId);
      const column = node?.data.table.columns.find((c) => c.id === columnId);
      if (!node || !column) return;

      const tableIdsInPath = new Set(queryPath.map((c) => c.tableId));
      const tablesInPath = nodes
        .filter(isTableNode)
        .filter((n) => tableIdsInPath.has(n.id))
        .map((n) => toQueryBuilderTable(n.data.table));

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
    return generateJoinQuery(queryPath, nodes.filter(isTableNode).map((n) => toQueryBuilderTable(n.data.table)));
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

  // "+ NOT" arms isPlacingNote instead of calling this directly — this runs
  // from onPaneClick once the user actually clicks a spot on the canvas, so
  // the note lands exactly where they meant it, not just at a guessed
  // center point.
  const handleAddNoteAt = useCallback(
    async (flowPosition: { x: number; y: number }) => {
      const response = await fetch("/api/schema/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = (await response.json()) as { note?: CanvasNote; error?: string };
      if (!response.ok || !data.note) {
        setError(data.error ?? "Not oluşturulamadı");
        return;
      }

      const note: CanvasNote = {
        ...data.note,
        posX: flowPosition.x - NOTE_COMPACT_SIZE / 2,
        posY: flowPosition.y - NOTE_COMPACT_SIZE / 2,
      };

      const next = [...nodes, noteToNode(note)];
      setNodes(next);

      // Waited on (not fire-and-forget) before onSchemaChanged, same
      // reasoning as handleUpdateNoteContent below: onSchemaChanged
      // triggers DashboardClient's refetch of this note's saved state, and
      // firing that race-free of this write finishing is what actually
      // matters — the setNodes() above already gives instant local
      // feedback regardless.
      await fetch(`/api/schema/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posX: note.posX, posY: note.posY }),
      });
      onSchemaChanged(next.filter(isTableNode).some((n) => n.data.table.columns.length > 0));
    },
    [nodes, onSchemaChanged, projectId],
  );

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isPlacingNote) return;
      setIsPlacingNote(false);
      const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      handleAddNoteAt(flowPosition);
    },
    [isPlacingNote, screenToFlowPosition, handleAddNoteAt],
  );

  const handleUpdateNoteContent = useCallback(
    (noteId: string, content: string) => {
      const next = nodes.map((n) =>
        n.type === "noteNode" && n.id === noteId ? { ...n, data: { note: { ...n.data.note, content } } } : n,
      );
      setNodes(next);
      // Found live: calling onSchemaChanged (which triggers a refetch of
      // this note from the DB) before this PATCH had actually finished
      // writing meant the refetch could grab the pre-edit content and
      // overwrite it back into DashboardClient's cache — the edit itself
      // was saved correctly, but the NEXT tab remount reverted to it
      // anyway. Chaining onSchemaChanged after the PATCH resolves (not
      // delaying the local setNodes() above, which is what actually gives
      // instant visual feedback) closes that race.
      fetch(`/api/schema/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }).then(() => {
        onSchemaChanged(next.filter(isTableNode).some((n) => n.data.table.columns.length > 0));
      });
    },
    [nodes, onSchemaChanged],
  );

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      const next = nodes.filter((n) => n.id !== noteId);
      setNodes(next);
      fetch(`/api/schema/notes/${noteId}`, { method: "DELETE" }).then(() => {
        onSchemaChanged(next.filter(isTableNode).some((n) => n.data.table.columns.length > 0));
      });
    },
    [nodes, onSchemaChanged],
  );

  const canvasHandlers = useMemo(
    () => ({
      onAddColumn: handleAddColumn,
      onDeleteColumn: handleDeleteColumn,
      onDeleteTable: handleDeleteTable,
      isQueryMode,
      onColumnClick: handleColumnClick,
      queryColumnOrder,
      onUpdateNoteContent: handleUpdateNoteContent,
      onDeleteNote: handleDeleteNote,
      userName,
      userImage,
    }),
    [
      handleAddColumn,
      handleDeleteColumn,
      handleDeleteTable,
      isQueryMode,
      handleColumnClick,
      queryColumnOrder,
      handleUpdateNoteContent,
      handleDeleteNote,
      userName,
      userImage,
    ],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const sourceColumnId = connection.sourceHandle?.replace("source-", "");
      const targetColumnId = connection.targetHandle?.replace("target-", "");
      if (!sourceColumnId || !targetColumnId || sourceColumnId === targetColumnId || !connection.target) return;

      const targetTable = nodes.find((n): n is SchemaTableNodeType => isTableNode(n) && n.id === connection.target)?.data.table;
      const targetColumn = targetTable?.columns.find((c) => c.id === targetColumnId);
      if (!targetTable || !targetColumn) return;

      fetch(`/api/schema/columns/${sourceColumnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isForeignKey: true, referencesTable: targetTable.name, referencesColumn: targetColumn.name }),
      });

      setNodes((prev) =>
        prev.map((n) => {
          if (!isTableNode(n)) return n;
          return {
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
          };
        }),
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
        next = next.map((n) => {
          if (!isTableNode(n)) return n;
          return {
            ...n,
            data: {
              table: {
                ...n.data.table,
                columns: n.data.table.columns.map((c) =>
                  c.id === sourceColumnId ? { ...c, isForeignKey: false, referencesTable: null, referencesColumn: null } : c,
                ),
              },
            },
          };
        });
      }
      setNodes(next);
    },
    [nodes],
  );

  const handleNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const node of deleted) {
        if (node.type === "noteNode") handleDeleteNote(node.id);
        else handleDeleteTable(node.id);
      }
    },
    [handleDeleteTable, handleDeleteNote],
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
      onSchemaChanged(next.filter(isTableNode).some((n) => n.data.table.columns.length > 0));
      setNewTableName("");
    } finally {
      setCreatingTable(false);
    }
  }

  const edges: Edge[] = useMemo(() => {
    const tableNodes = nodes.filter(isTableNode);
    const columnIndex = new Map<string, { tableId: string; columnId: string }>();
    for (const n of tableNodes) {
      for (const c of n.data.table.columns) {
        columnIndex.set(`${n.data.table.name}.${c.name}`, { tableId: n.id, columnId: c.id });
      }
    }
    const result: Edge[] = [];
    for (const n of tableNodes) {
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
            onMoveEnd={handleMoveEnd}
            onPaneClick={handlePaneClick}
            deleteKeyCode={["Backspace", "Delete"]}
            colorMode="dark"
            className={isPlacingNote ? "cursor-crosshair" : undefined}
            {...(initialViewport ? { defaultViewport: initialViewport } : { fitView: true })}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#3b82f620" gap={24} />
            <Controls style={{ bottom: 56 }} />
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
                <button
                  type="button"
                  onClick={() => setIsPlacingNote((v) => !v)}
                  title="Kanvasa not ekle"
                  className={`shrink-0 rounded-lg border px-3 py-1.5 font-mono text-sm transition-colors ${
                    isPlacingNote
                      ? "border-amber-400 bg-amber-400/30 text-amber-200"
                      : "border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                  }`}
                >
                  + NOT
                </button>
              </form>
            </Panel>

            <Panel position="bottom-left">
              <p className="glass-panel rounded-lg px-3 py-1.5 text-[11px] text-zinc-400">
                {isPlacingNote
                  ? "Notu bırakmak istediğiniz yere tıklayın"
                  : isQueryMode
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
