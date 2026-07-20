"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Panel,
  applyNodeChanges,
  useReactFlow,
  type Node,
  type NodeChange,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  DesignElementNode,
  DesignCanvasProvider,
  type DesignElement,
  type DesignElementType,
  type DesignElementNodeType,
} from "./DesignElementNode";

interface DesignCanvasProps {
  projectId: string;
  initialElements: DesignElement[];
  onDesignChanged: () => void;
}

const nodeTypes = { designElement: DesignElementNode };

const DEFAULT_SIZE: Record<DesignElementType, { width: number; height: number }> = {
  rectangle: { width: 140, height: 90 },
  ellipse: { width: 120, height: 120 },
  text: { width: 180, height: 36 },
};

const FILL_PRESETS = ["#8b5cf6", "#ec4899", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#e5e7eb", "#18181b"];

function elementToNode(element: DesignElement): DesignElementNodeType {
  return {
    id: element.id,
    type: "designElement",
    position: { x: element.posX, y: element.posY },
    data: { element },
    style: { width: element.width, height: element.height },
  };
}

// Same Provider/Inner split as SchemaBuilder, for the same reason —
// useReactFlow()'s screenToFlowPosition is needed to translate the
// draw-to-size drag (tracked in raw screen pixels, see handleWrapperMouseDown
// below) into canvas coordinates, and that hook only works from inside the
// context <ReactFlow> itself establishes.
export function DesignCanvas(props: DesignCanvasProps) {
  return (
    <ReactFlowProvider>
      <DesignCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

type Tool = "select" | DesignElementType;

function DesignCanvasInner({ projectId, initialElements, onDesignChanged }: DesignCanvasProps) {
  const [nodes, setNodes] = useState<DesignElementNodeType[]>(() => initialElements.map(elementToNode));
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Live draw-to-size ghost preview — tracked in screen (wrapper-relative)
  // pixels rather than flow coordinates, since the overlay is a plain CSS
  // absolutely-positioned div drawn directly over the wrapper. Converting
  // to flow coordinates only has to happen once, at mouseup, to place the
  // real element — not on every mousemove, which keeps this simple and
  // avoids re-deriving React Flow's pan/zoom transform by hand.
  const [drawTool, setDrawTool] = useState<DesignElementType | null>(null);
  const [drawRect, setDrawRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const drawStartScreenRef = useRef<{ x: number; y: number } | null>(null);
  const drawCurrentScreenRef = useRef<{ x: number; y: number } | null>(null);

  // Same per-project sessionStorage viewport persistence as SchemaBuilder,
  // for the same reason (fitView recenters on every remount otherwise).
  const viewportStorageKey = `planoo:design-viewport:${projectId}`;
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

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev) as DesignElementNodeType[]);
  }, []);

  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      fetch(`/api/design/elements/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posX: node.position.x, posY: node.position.y }),
      }).then(() => onDesignChanged());
    },
    [onDesignChanged],
  );

  const handleResizeEnd = useCallback(
    (id: string, rect: { x: number; y: number; width: number; height: number }) => {
      const next = nodes.map((n) =>
        n.id === id
          ? { ...n, position: { x: rect.x, y: rect.y }, style: { width: rect.width, height: rect.height } }
          : n,
      );
      setNodes(next);
      fetch(`/api/design/elements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posX: rect.x, posY: rect.y, width: rect.width, height: rect.height }),
      }).then(() => onDesignChanged());
    },
    [nodes, onDesignChanged],
  );

  const handleUpdateElementText = useCallback(
    (id: string, text: string) => {
      const next = nodes.map((n) =>
        n.id === id ? { ...n, data: { element: { ...n.data.element, text } } } : n,
      );
      setNodes(next);
      fetch(`/api/design/elements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).then(() => onDesignChanged());
    },
    [nodes, onDesignChanged],
  );

  // Shared by the properties panel's fill/font-size/border-radius inputs —
  // all just PATCH a single field and update the matching node's data.
  const handleUpdateElementStyle = useCallback(
    (id: string, patch: Partial<Pick<DesignElement, "fillColor" | "fontSize" | "borderRadius">>) => {
      const next = nodes.map((n) =>
        n.id === id ? { ...n, data: { element: { ...n.data.element, ...patch } } } : n,
      );
      setNodes(next);
      fetch(`/api/design/elements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(() => onDesignChanged());
    },
    [nodes, onDesignChanged],
  );

  const handleDeleteElement = useCallback(
    (id: string) => {
      const next = nodes.filter((n) => n.id !== id);
      setNodes(next);
      setSelectedElementId((current) => (current === id ? null : current));
      fetch(`/api/design/elements/${id}`, { method: "DELETE" }).then(() => onDesignChanged());
    },
    [nodes, onDesignChanged],
  );

  const handleNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const node of deleted) handleDeleteElement(node.id);
    },
    [handleDeleteElement],
  );

  const canvasHandlers = useMemo(
    () => ({
      onUpdateElementText: handleUpdateElementText,
      onResizeEnd: handleResizeEnd,
      onDeleteElement: handleDeleteElement,
    }),
    [handleUpdateElementText, handleResizeEnd, handleDeleteElement],
  );

  const handleCreateElement = useCallback(
    async (type: DesignElementType, rect: { x: number; y: number; width: number; height: number }) => {
      const response = await fetch("/api/design/elements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type,
          posX: rect.x,
          posY: rect.y,
          width: rect.width,
          height: rect.height,
        }),
      });
      const data = (await response.json()) as { element?: DesignElement };
      if (!response.ok || !data.element) return;
      setNodes((prev) => [...prev, elementToNode(data.element!)]);
      setSelectedElementId(data.element.id);
      onDesignChanged();
    },
    [projectId, onDesignChanged],
  );

  function handleWrapperMouseDown(e: React.MouseEvent) {
    if (activeTool === "select") return;
    const bounds = canvasWrapperRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const start = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
    drawStartScreenRef.current = start;
    drawCurrentScreenRef.current = start;
    setDrawTool(activeTool);
    setDrawRect({ left: start.x, top: start.y, width: 0, height: 0 });
  }

  useEffect(() => {
    if (!drawTool) return;

    function handleMove(e: MouseEvent) {
      const bounds = canvasWrapperRef.current?.getBoundingClientRect();
      const start = drawStartScreenRef.current;
      if (!bounds || !start) return;
      const current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
      drawCurrentScreenRef.current = current;
      setDrawRect({
        left: Math.min(start.x, current.x),
        top: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y),
      });
    }

    function handleUp() {
      const start = drawStartScreenRef.current;
      const current = drawCurrentScreenRef.current;
      const tool = drawTool;
      const bounds = canvasWrapperRef.current?.getBoundingClientRect();
      setDrawTool(null);
      setDrawRect(null);
      drawStartScreenRef.current = null;
      drawCurrentScreenRef.current = null;
      setActiveTool("select");
      if (!start || !current || !tool || !bounds) return;

      const pxWidth = Math.abs(current.x - start.x);
      const pxHeight = Math.abs(current.y - start.y);
      const isClick = pxWidth < 5 && pxHeight < 5;
      const defaultSize = DEFAULT_SIZE[tool];

      if (isClick) {
        const clickFlow = screenToFlowPosition({ x: start.x + bounds.left, y: start.y + bounds.top });
        handleCreateElement(tool, {
          x: clickFlow.x - defaultSize.width / 2,
          y: clickFlow.y - defaultSize.height / 2,
          width: defaultSize.width,
          height: defaultSize.height,
        });
        return;
      }

      const screenLeft = Math.min(start.x, current.x) + bounds.left;
      const screenTop = Math.min(start.y, current.y) + bounds.top;
      const topLeftFlow = screenToFlowPosition({ x: screenLeft, y: screenTop });
      const bottomRightFlow = screenToFlowPosition({ x: screenLeft + pxWidth, y: screenTop + pxHeight });
      handleCreateElement(tool, {
        x: topLeftFlow.x,
        y: topLeftFlow.y,
        width: bottomRightFlow.x - topLeftFlow.x,
        height: bottomRightFlow.y - topLeftFlow.y,
      });
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [drawTool, screenToFlowPosition, handleCreateElement]);

  function handlePaneClick() {
    if (drawTool) return;
    setSelectedElementId(null);
  }

  function handleNodeClick(_event: unknown, node: Node) {
    setSelectedElementId(node.id);
  }

  const selectedElement = nodes.find((n) => n.id === selectedElementId)?.data.element ?? null;

  // Layers panel order: highest-drawn (last in array/top of stack) first,
  // matching how design tools conventionally list layers top-to-bottom.
  const layersTopToBottom = useMemo(() => [...nodes].reverse(), [nodes]);

  const toolButtons: { tool: Tool; label: string; icon: string }[] = [
    { tool: "select", label: "Seç", icon: "↖" },
    { tool: "rectangle", label: "Dikdörtgen", icon: "▭" },
    { tool: "ellipse", label: "Elips", icon: "◯" },
    { tool: "text", label: "Metin", icon: "T" },
  ];

  return (
    <div className="relative flex h-full w-full">
      <div
        className="relative flex-1"
        ref={canvasWrapperRef}
        onMouseDown={handleWrapperMouseDown}
      >
        <DesignCanvasProvider value={canvasHandlers}>
          <ReactFlow
            nodes={nodes.map((n) => ({ ...n, selected: n.id === selectedElementId }))}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={handleNodeDragStop}
            onNodesDelete={handleNodesDelete}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onMoveEnd={handleMoveEnd}
            panOnDrag={activeTool === "select"}
            deleteKeyCode={["Backspace", "Delete"]}
            colorMode="dark"
            className={activeTool !== "select" ? "cursor-crosshair" : undefined}
            {...(initialViewport ? { defaultViewport: initialViewport } : { fitView: true })}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#3b82f620" gap={24} />
            <Controls style={{ bottom: 16 }} />

            <Panel position="top-left">
              <div className="glass-panel flex items-center gap-1 rounded-xl p-1.5">
                {toolButtons.map(({ tool, label, icon }) => (
                  <button
                    key={tool}
                    type="button"
                    title={label}
                    onClick={() => setActiveTool(tool)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-base font-medium transition-colors ${
                      activeTool === tool
                        ? "bg-violet-500/30 text-violet-200 border border-violet-400/60"
                        : "text-zinc-300 hover:bg-white/10 border border-transparent"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </Panel>

            <Panel position="bottom-left">
              <p className="glass-panel rounded-lg px-3 py-1.5 text-[11px] text-zinc-400">
                {activeTool === "select"
                  ? "Bir şekil eklemek için üstteki araçlardan birini seçin"
                  : "Kanvasa tıklayın ya da sürükleyerek boyutunu belirleyin"}
              </p>
            </Panel>
          </ReactFlow>
        </DesignCanvasProvider>

        {drawRect && (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-violet-400 bg-violet-400/10"
            style={{ left: drawRect.left, top: drawRect.top, width: drawRect.width, height: drawRect.height }}
          />
        )}
      </div>

      <DesignSidePanels
        elements={layersTopToBottom.map((n) => n.data.element)}
        selectedElement={selectedElement}
        onSelect={setSelectedElementId}
        onDelete={handleDeleteElement}
        onUpdateStyle={handleUpdateElementStyle}
      />
    </div>
  );
}

function DesignSidePanels({
  elements,
  selectedElement,
  onSelect,
  onDelete,
  onUpdateStyle,
}: {
  elements: DesignElement[];
  selectedElement: DesignElement | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStyle: (id: string, patch: Partial<Pick<DesignElement, "fillColor" | "fontSize" | "borderRadius">>) => void;
}) {
  const typeLabel: Record<DesignElementType, string> = { rectangle: "Dikdörtgen", ellipse: "Elips", text: "Metin" };

  return (
    <div className="flex w-64 shrink-0 flex-col border-l border-white/10 bg-[#0b0714]">
      {/* Layers */}
      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Katmanlar</h3>
        {elements.length === 0 ? (
          <p className="px-1 text-[11px] text-zinc-600">Henüz eleman yok.</p>
        ) : (
          <div className="space-y-0.5">
            {elements.map((el) => (
              <button
                key={el.id}
                onClick={() => onSelect(el.id)}
                className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors ${
                  selectedElement?.id === el.id ? "bg-violet-500/20 text-violet-200" : "text-zinc-300 hover:bg-white/5"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm border border-white/20"
                    style={{ backgroundColor: el.type === "text" ? "transparent" : el.fillColor }}
                  />
                  {typeLabel[el.type]}
                  {el.type === "text" && el.text ? `: ${el.text.slice(0, 16)}` : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Properties */}
      {selectedElement && (
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {typeLabel[selectedElement.type]} Özellikleri
            </h3>
            <button
              onClick={() => onDelete(selectedElement.id)}
              className="text-[11px] text-zinc-500 hover:text-red-400"
            >
              Sil
            </button>
          </div>

          {selectedElement.type !== "text" && (
            <div className="mb-3">
              <label className="mb-1 block text-[11px] text-zinc-400">Dolgu rengi</label>
              <div className="flex flex-wrap gap-1.5">
                {FILL_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => onUpdateStyle(selectedElement.id, { fillColor: color })}
                    style={{ backgroundColor: color }}
                    className={`h-6 w-6 rounded-md border-2 transition-transform hover:scale-110 ${
                      selectedElement.fillColor === color ? "border-white" : "border-white/10"
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={selectedElement.fillColor}
                  onChange={(e) => onUpdateStyle(selectedElement.id, { fillColor: e.target.value })}
                  className="h-6 w-6 cursor-pointer rounded-md border-2 border-white/10 bg-transparent p-0"
                />
              </div>
            </div>
          )}

          {selectedElement.type === "rectangle" && (
            <div className="mb-3">
              <label className="mb-1 block text-[11px] text-zinc-400">Köşe yuvarlaklığı</label>
              <input
                type="range"
                min={0}
                max={48}
                value={selectedElement.borderRadius ?? 0}
                onChange={(e) => onUpdateStyle(selectedElement.id, { borderRadius: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          )}

          {selectedElement.type === "text" && (
            <>
              <div className="mb-3">
                <label className="mb-1 block text-[11px] text-zinc-400">Metin rengi</label>
                <input
                  type="color"
                  value={selectedElement.fillColor}
                  onChange={(e) => onUpdateStyle(selectedElement.id, { fillColor: e.target.value })}
                  className="h-7 w-full cursor-pointer rounded-md border border-white/10 bg-transparent p-0"
                />
              </div>
              <div className="mb-1">
                <label className="mb-1 block text-[11px] text-zinc-400">Yazı boyutu</label>
                <input
                  type="number"
                  min={8}
                  max={96}
                  value={selectedElement.fontSize ?? 16}
                  onChange={(e) => onUpdateStyle(selectedElement.id, { fontSize: Number(e.target.value) || 16 })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
              <p className="mt-2 text-[10px] text-zinc-600">Düzenlemek için kanvasta metne çift tıklayın.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
