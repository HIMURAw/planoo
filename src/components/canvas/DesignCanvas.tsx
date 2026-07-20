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
  useViewport,
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
import { DesignLayersPanel } from "./DesignLayersPanel";
import { DesignPropertiesPanel } from "./DesignPropertiesPanel";
import { computeAutoLayoutPositions } from "@/lib/auto-layout";
import { compressImageToDataUrl, getImageDimensions } from "@/lib/design-image";

interface DesignCanvasProps {
  projectId: string;
  initialElements: DesignElement[];
  onDesignChanged: () => void;
}

const nodeTypes = { designElement: DesignElementNode };

type Tool = "select" | "rectangle" | "ellipse" | "text" | "frame" | "line" | "pen" | "image";
const DRAW_GROUP: Tool[] = ["rectangle", "ellipse", "text", "frame", "line"];

const DEFAULT_SIZE: Record<"rectangle" | "ellipse" | "text" | "frame", { width: number; height: number }> = {
  rectangle: { width: 140, height: 90 },
  ellipse: { width: 120, height: 120 },
  text: { width: 180, height: 36 },
  frame: { width: 320, height: 200 },
};

const TOOL_BUTTONS: { tool: Tool; label: string; icon: string }[] = [
  { tool: "select", label: "Seç", icon: "↖" },
  { tool: "rectangle", label: "Dikdörtgen", icon: "▭" },
  { tool: "ellipse", label: "Elips", icon: "◯" },
  { tool: "text", label: "Metin", icon: "T" },
  { tool: "frame", label: "Çerçeve", icon: "⬚" },
  { tool: "line", label: "Çizgi", icon: "╱" },
  { tool: "pen", label: "Kalem", icon: "✎" },
  { tool: "image", label: "Görsel", icon: "🖼" },
];

function patchElement(id: string, patch: Record<string, unknown>) {
  return fetch(`/api/design/elements/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

// Parent must appear before its children in React Flow's `nodes` array for
// its native parentId nesting to render correctly.
function topoSortElements(elements: DesignElement[]): DesignElement[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const visited = new Set<string>();
  const result: DesignElement[] = [];
  function visit(el: DesignElement) {
    if (visited.has(el.id)) return;
    visited.add(el.id);
    if (el.parentId) {
      const parent = byId.get(el.parentId);
      if (parent) visit(parent);
    }
    result.push(el);
  }
  for (const el of elements) visit(el);
  return result;
}

function elementToNode(element: DesignElement, parent: DesignElement | undefined): DesignElementNodeType {
  const isAutoLayoutChild = !!parent && parent.type === "frame" && parent.layoutMode !== "none";
  return {
    id: element.id,
    type: "designElement",
    position: { x: element.posX, y: element.posY },
    data: { element },
    style: { width: element.width, height: element.height },
    ...(element.parentId ? { parentId: element.parentId, extent: "parent" as const } : {}),
    draggable: !isAutoLayoutChild && !element.locked,
    // Deliberately NOT restricting `selectable` for locked elements: React
    // Flow treats that flag as "can never be selected, full stop" — it also
    // suppresses selection set directly via controlled state (i.e. from the
    // layers panel), not just canvas clicks. Locked elements must stay
    // selectable from the layers panel (to view properties or unlock them);
    // `draggable: false` above already covers "can't move/resize it".
  };
}

function buildNodesFromElements(elements: DesignElement[]): DesignElementNodeType[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const sorted = topoSortElements(elements);
  return sorted.map((el) => elementToNode(el, el.parentId ? byId.get(el.parentId) : undefined));
}

// The absolute (top-level-flow-space) position of an element, found by
// summing its own posX/posY with every ancestor's posX/posY up the parent
// chain — each element's posX/posY is stored relative to its immediate
// parent's origin (or, for a top-level element, is already absolute).
// Used when reparenting via the layers panel drag-and-drop below, so an
// element visually stays in place when it moves to a new parent.
function getAbsolutePosition(id: string, elements: DesignElement[]): { x: number; y: number } {
  const byId = new Map(elements.map((e) => [e.id, e]));
  let x = 0;
  let y = 0;
  let current = byId.get(id);
  while (current) {
    x += current.posX;
    y += current.posY;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return { x, y };
}

// True if `targetId` is `candidateId` itself, or a descendant of it —
// i.e. setting `targetId` as `candidateId`'s new parent would create a
// cycle. Used to reject invalid drag-and-drop reparenting in the layers
// panel before it ever reaches the network.
function isSelfOrDescendant(candidateId: string, targetId: string, elements: DesignElement[]): boolean {
  if (candidateId === targetId) return true;
  const byId = new Map(elements.map((e) => [e.id, e]));
  let current = byId.get(targetId);
  while (current?.parentId) {
    if (current.parentId === candidateId) return true;
    current = byId.get(current.parentId);
  }
  return false;
}

function collectDescendantIds(id: string, allNodes: DesignElementNodeType[]): Set<string> {
  const result = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of allNodes) {
      const pid = n.data.element.parentId;
      if (pid && result.has(pid) && !result.has(n.id)) {
        result.add(n.id);
        changed = true;
      }
    }
  }
  return result;
}

// Recomputes an auto-layout frame's children positions and returns both the
// updated node array (local, optimistic) and the list of children whose
// position actually moved (so the caller knows what to PATCH to the
// backend) — kept pure so it's safe to call from inside handlers that also
// need to setNodes synchronously (fetches must never live inside a setState
// updater — see the impure-updater note this session established in
// SchemaBuilder.tsx).
function computeAutoLayoutNodeUpdates(
  frameId: string,
  allNodes: DesignElementNodeType[],
): { nodes: DesignElementNodeType[]; changed: { id: string; posX: number; posY: number }[] } {
  const frameNode = allNodes.find((n) => n.id === frameId);
  if (!frameNode || frameNode.data.element.type !== "frame" || frameNode.data.element.layoutMode === "none") {
    return { nodes: allNodes, changed: [] };
  }
  const frameEl = frameNode.data.element;
  const children = allNodes.filter((n) => n.data.element.parentId === frameId);
  const positions = computeAutoLayoutPositions(
    {
      layoutMode: frameEl.layoutMode,
      layoutGap: frameEl.layoutGap,
      paddingTop: frameEl.paddingTop,
      paddingRight: frameEl.paddingRight,
      paddingBottom: frameEl.paddingBottom,
      paddingLeft: frameEl.paddingLeft,
      layoutAlign: frameEl.layoutAlign,
      width: frameEl.width,
      height: frameEl.height,
    },
    children.map((c) => ({ id: c.id, width: c.data.element.width, height: c.data.element.height, order: c.data.element.order })),
  );
  const posMap = new Map(positions.map((p) => [p.id, p]));
  const changed: { id: string; posX: number; posY: number }[] = [];
  const nextNodes = allNodes.map((n) => {
    const pos = posMap.get(n.id);
    if (!pos || (n.position.x === pos.posX && n.position.y === pos.posY)) return n;
    changed.push({ id: n.id, posX: pos.posX, posY: pos.posY });
    return { ...n, position: { x: pos.posX, y: pos.posY }, data: { element: { ...n.data.element, posX: pos.posX, posY: pos.posY } } };
  });
  return { nodes: nextNodes, changed };
}

// Same Provider/Inner split as SchemaBuilder, for the same reason —
// useReactFlow()'s screenToFlowPosition only works inside the context
// <ReactFlow> itself establishes.
export function DesignCanvas(props: DesignCanvasProps) {
  return (
    <ReactFlowProvider>
      <DesignCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function DesignCanvasInner({ projectId, initialElements, onDesignChanged }: DesignCanvasProps) {
  const [nodes, setNodes] = useState<DesignElementNodeType[]>(() => buildNodesFromElements(initialElements));
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const viewport = useViewport();

  // Draw-to-size ghost preview (rectangle/ellipse/text/frame/line) — tracked
  // in screen (wrapper-relative) pixels; only converted to flow coordinates
  // once, at mouseup, to place the real element.
  const [drawTool, setDrawTool] = useState<Tool | null>(null);
  const [drawRect, setDrawRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const drawStartScreenRef = useRef<{ x: number; y: number } | null>(null);
  const drawCurrentScreenRef = useRef<{ x: number; y: number } | null>(null);

  // Pen tool: click to add anchor points (flow coordinates), Enter/double-
  // click to finish, Escape to cancel. Straight segments only — no bezier
  // control-handle editing.
  const [penPoints, setPenPoints] = useState<{ x: number; y: number }[] | null>(null);
  const [penCursor, setPenCursor] = useState<{ x: number; y: number } | null>(null);

  // Image tool: picking a file arms "click to place" mode. The actual data
  // lives in a ref (only ever read from event handlers, never rendered
  // directly); `hasPendingImage` is a small state mirror purely so the hint
  // text below can react to it without reading the ref during render.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImageRef = useRef<{ dataUrl: string; naturalWidth: number; naturalHeight: number } | null>(null);
  const [hasPendingImage, setHasPendingImage] = useState(false);

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
    (_event: unknown, vp: Viewport) => {
      window.sessionStorage.setItem(viewportStorageKey, JSON.stringify(vp));
    },
    [viewportStorageKey],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev) as DesignElementNodeType[]);
  }, []);

  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node, draggedNodes: Node[]) => {
      const toPersist = draggedNodes.length > 0 ? draggedNodes : [node];
      Promise.all(toPersist.map((n) => patchElement(n.id, { posX: n.position.x, posY: n.position.y }))).then(() =>
        onDesignChanged(),
      );
    },
    [onDesignChanged],
  );

  const handleResizeEnd = useCallback(
    (id: string, rect: { x: number; y: number; width: number; height: number }) => {
      const current = nodes;
      const target = current.find((n) => n.id === id);
      if (!target) return;

      let next = current.map((n) =>
        n.id === id
          ? {
              ...n,
              position: { x: rect.x, y: rect.y },
              style: { width: rect.width, height: rect.height },
              data: { element: { ...n.data.element, posX: rect.x, posY: rect.y, width: rect.width, height: rect.height } },
            }
          : n,
      );

      let changedChildren: { id: string; posX: number; posY: number }[] = [];
      const el = target.data.element;
      if (el.type === "frame" && el.layoutMode !== "none") {
        const result = computeAutoLayoutNodeUpdates(id, next);
        next = result.nodes;
        changedChildren = result.changed;
      } else if (el.parentId) {
        const parentEl = next.find((n) => n.id === el.parentId)?.data.element;
        if (parentEl?.type === "frame" && parentEl.layoutMode !== "none") {
          const result = computeAutoLayoutNodeUpdates(el.parentId, next);
          next = result.nodes;
          changedChildren = result.changed;
        }
      }

      setNodes(next);
      Promise.all([
        patchElement(id, { posX: rect.x, posY: rect.y, width: rect.width, height: rect.height }),
        ...changedChildren.map((c) => patchElement(c.id, { posX: c.posX, posY: c.posY })),
      ]).then(() => onDesignChanged());
    },
    [nodes, onDesignChanged],
  );

  const handleUpdateElementText = useCallback(
    (id: string, text: string) => {
      const next = nodes.map((n) => (n.id === id ? { ...n, data: { element: { ...n.data.element, text } } } : n));
      setNodes(next);
      patchElement(id, { text }).then(() => onDesignChanged());
    },
    [nodes, onDesignChanged],
  );

  const handleUpdateElement = useCallback(
    (id: string, patch: Partial<DesignElement>) => {
      const current = nodes;
      const target = current.find((n) => n.id === id);
      if (!target) return;
      const updatedElement: DesignElement = { ...target.data.element, ...patch };

      let next = current.map((n) =>
        n.id === id
          ? {
              ...n,
              position:
                patch.posX !== undefined || patch.posY !== undefined
                  ? { x: updatedElement.posX, y: updatedElement.posY }
                  : n.position,
              style:
                patch.width !== undefined || patch.height !== undefined
                  ? { width: updatedElement.width, height: updatedElement.height }
                  : n.style,
              data: { element: updatedElement },
            }
          : n,
      );

      let changedChildren: { id: string; posX: number; posY: number }[] = [];
      const layoutFieldsChanged =
        patch.layoutMode !== undefined ||
        patch.layoutGap !== undefined ||
        patch.paddingTop !== undefined ||
        patch.paddingRight !== undefined ||
        patch.paddingBottom !== undefined ||
        patch.paddingLeft !== undefined ||
        patch.layoutAlign !== undefined ||
        patch.width !== undefined ||
        patch.height !== undefined;

      if (updatedElement.type === "frame" && layoutFieldsChanged) {
        const result = computeAutoLayoutNodeUpdates(id, next);
        next = result.nodes;
        changedChildren = result.changed;
      }

      setNodes(next);
      Promise.all([
        patchElement(id, patch as Record<string, unknown>),
        ...changedChildren.map((c) => patchElement(c.id, { posX: c.posX, posY: c.posY })),
      ]).then(() => onDesignChanged());
    },
    [nodes, onDesignChanged],
  );

  const deleteElementsByIds = useCallback(
    (ids: string[]) => {
      const current = nodes;
      const idsToDelete = new Set<string>();
      for (const id of ids) {
        for (const descId of collectDescendantIds(id, current)) idsToDelete.add(descId);
      }
      if (idsToDelete.size === 0) return;

      const affectedParentIds = new Set<string>();
      for (const id of idsToDelete) {
        const el = current.find((n) => n.id === id)?.data.element;
        if (el?.parentId && !idsToDelete.has(el.parentId)) affectedParentIds.add(el.parentId);
      }

      let next = current.filter((n) => !idsToDelete.has(n.id));
      let changedChildren: { id: string; posX: number; posY: number }[] = [];
      for (const parentId of affectedParentIds) {
        const parentEl = next.find((n) => n.id === parentId)?.data.element;
        if (parentEl?.type === "frame" && parentEl.layoutMode !== "none") {
          const result = computeAutoLayoutNodeUpdates(parentId, next);
          next = result.nodes;
          changedChildren = [...changedChildren, ...result.changed];
        }
      }

      setNodes(next);
      Promise.all([
        ...Array.from(idsToDelete).map((id) => fetch(`/api/design/elements/${id}`, { method: "DELETE" })),
        ...changedChildren.map((c) => patchElement(c.id, { posX: c.posX, posY: c.posY })),
      ]).then(() => onDesignChanged());
    },
    [nodes, onDesignChanged],
  );

  const handleDeleteElement = useCallback((id: string) => deleteElementsByIds([id]), [deleteElementsByIds]);
  const handleNodesDelete = useCallback((deleted: Node[]) => deleteElementsByIds(deleted.map((d) => d.id)), [deleteElementsByIds]);

  const canvasHandlers = useMemo(
    () => ({
      onUpdateElementText: handleUpdateElementText,
      onResizeEnd: handleResizeEnd,
      onDeleteElement: handleDeleteElement,
    }),
    [handleUpdateElementText, handleResizeEnd, handleDeleteElement],
  );

  const handleCreateElement = useCallback(
    async (
      type: DesignElementType,
      rect: { x: number; y: number; width: number; height: number },
      extra?: Record<string, unknown>,
    ) => {
      const response = await fetch("/api/design/elements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, type, posX: rect.x, posY: rect.y, width: rect.width, height: rect.height, ...extra }),
      });
      const data = (await response.json()) as { element?: DesignElement };
      if (!response.ok || !data.element) return;
      const created = data.element;
      setNodes((prev) => [...prev, elementToNode(created, undefined)].map((n) => ({ ...n, selected: n.id === created.id })));
      onDesignChanged();
    },
    [projectId, onDesignChanged],
  );

  // --- Draw-to-size tools: rectangle / ellipse / text / frame / line ---
  function handleWrapperMouseDown(e: React.MouseEvent) {
    if (!DRAW_GROUP.includes(activeTool)) return;
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

      if (tool === "line") {
        if (isClick) return;
        const startFlow = screenToFlowPosition({ x: start.x + bounds.left, y: start.y + bounds.top });
        const endFlow = screenToFlowPosition({ x: current.x + bounds.left, y: current.y + bounds.top });
        const minX = Math.min(startFlow.x, endFlow.x);
        const minY = Math.min(startFlow.y, endFlow.y);
        const width = Math.max(Math.abs(endFlow.x - startFlow.x), 1);
        const height = Math.max(Math.abs(endFlow.y - startFlow.y), 1);
        const pathData = [
          { x: startFlow.x - minX, y: startFlow.y - minY },
          { x: endFlow.x - minX, y: endFlow.y - minY },
        ];
        handleCreateElement("path", { x: minX, y: minY, width, height }, { pathData, strokeColor: "#8b5cf6", strokeWidth: 2 });
        return;
      }

      const elementType = tool as "rectangle" | "ellipse" | "text" | "frame";
      const defaultSize = DEFAULT_SIZE[elementType];

      if (isClick) {
        const clickFlow = screenToFlowPosition({ x: start.x + bounds.left, y: start.y + bounds.top });
        handleCreateElement(elementType, {
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
      handleCreateElement(elementType, {
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

  // --- Pen tool: multi-click polyline ---
  const commitPenPath = useCallback(() => {
    const pts = penPoints;
    setPenPoints(null);
    setPenCursor(null);
    setActiveTool("select");
    if (!pts || pts.length < 2) return;
    const minX = Math.min(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxX = Math.max(...pts.map((p) => p.x));
    const maxY = Math.max(...pts.map((p) => p.y));
    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);
    const localPoints = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
    handleCreateElement("path", { x: minX, y: minY, width, height }, { pathData: localPoints, strokeColor: "#8b5cf6", strokeWidth: 2 });
  }, [penPoints, handleCreateElement]);

  const cancelPenPath = useCallback(() => {
    setPenPoints(null);
    setPenCursor(null);
    setActiveTool("select");
  }, []);

  useEffect(() => {
    if (!penPoints) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") commitPenPath();
      else if (e.key === "Escape") cancelPenPath();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [penPoints, commitPenPath, cancelPenPath]);

  function handleWrapperMouseMove(e: React.MouseEvent) {
    if (activeTool === "pen" && penPoints) {
      setPenCursor(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    }
  }

  function handleWrapperDoubleClick() {
    if (activeTool === "pen" && penPoints && penPoints.length >= 2) commitPenPath();
  }

  // --- Image tool ---
  function handleSelectImageTool() {
    setActiveTool("image");
    fileInputRef.current?.click();
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      setActiveTool("select");
      return;
    }
    if (!file.type.startsWith("image/")) {
      window.alert("Lütfen bir görsel dosyası seçin.");
      setActiveTool("select");
      return;
    }
    const dataUrl = await compressImageToDataUrl(file);
    if (!dataUrl) {
      window.alert("Görsel işlenemedi.");
      setActiveTool("select");
      return;
    }
    const dims = await getImageDimensions(dataUrl).catch(() => ({ width: 200, height: 150 }));
    pendingImageRef.current = { dataUrl, naturalWidth: dims.width, naturalHeight: dims.height };
    setHasPendingImage(true);
  }

  // --- Pane click: pen point / image placement / deselect ---
  function handlePaneClick(event: MouseEvent | React.MouseEvent) {
    if (activeTool === "pen") {
      const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setPenPoints((prev) => (prev ? [...prev, flow] : [flow]));
      return;
    }
    if (activeTool === "image") {
      const pending = pendingImageRef.current;
      if (!pending) return;
      const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const maxDim = 240;
      const scale = Math.min(maxDim / pending.naturalWidth, maxDim / pending.naturalHeight, 1);
      const width = Math.round(pending.naturalWidth * scale);
      const height = Math.round(pending.naturalHeight * scale);
      handleCreateElement("image", { x: flow.x - width / 2, y: flow.y - height / 2, width, height }, { imageData: pending.dataUrl });
      pendingImageRef.current = null;
      setHasPendingImage(false);
      setActiveTool("select");
      return;
    }
    if (drawTool) return;
    setNodes((prev) => prev.map((n) => (n.selected ? { ...n, selected: false } : n)));
  }

  function handleLayerSelect(id: string, additive: boolean) {
    setNodes((prev) =>
      prev.map((n) => (additive ? (n.id === id ? { ...n, selected: !n.selected } : n) : { ...n, selected: n.id === id })),
    );
  }

  const handleToggleHidden = useCallback(
    (id: string) => {
      const el = nodes.find((n) => n.id === id)?.data.element;
      if (!el) return;
      handleUpdateElement(id, { hidden: !el.hidden });
    },
    [nodes, handleUpdateElement],
  );

  const handleToggleLocked = useCallback(
    (id: string) => {
      const el = nodes.find((n) => n.id === id)?.data.element;
      if (!el) return;
      handleUpdateElement(id, { locked: !el.locked });
    },
    [nodes, handleUpdateElement],
  );

  // --- Group / Ungroup ---
  const handleGroupSelected = useCallback(async () => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length < 2) return;
    const parentId = selected[0].data.element.parentId ?? null;

    const PAD = 24;
    const minX = Math.min(...selected.map((n) => n.data.element.posX));
    const minY = Math.min(...selected.map((n) => n.data.element.posY));
    const maxX = Math.max(...selected.map((n) => n.data.element.posX + n.data.element.width));
    const maxY = Math.max(...selected.map((n) => n.data.element.posY + n.data.element.height));
    const frameRect = { x: minX - PAD, y: minY - PAD, width: maxX - minX + PAD * 2, height: maxY - minY + PAD * 2 };

    const response = await fetch("/api/design/elements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        type: "frame",
        parentId,
        posX: frameRect.x,
        posY: frameRect.y,
        width: frameRect.width,
        height: frameRect.height,
        fillColor: "transparent",
      }),
    });
    const data = (await response.json()) as { element?: DesignElement };
    if (!response.ok || !data.element) return;
    const frameElement = data.element;

    const patches = selected.map((n) => ({
      id: n.id,
      parentId: frameElement.id,
      posX: n.data.element.posX - frameRect.x,
      posY: n.data.element.posY - frameRect.y,
    }));

    await Promise.all(patches.map((p) => patchElement(p.id, { parentId: p.parentId, posX: p.posX, posY: p.posY })));

    const patchMap = new Map(patches.map((p) => [p.id, p]));
    const updatedElements: DesignElement[] = nodes.map((n) => {
      const p = patchMap.get(n.id);
      return p ? { ...n.data.element, parentId: p.parentId, posX: p.posX, posY: p.posY } : n.data.element;
    });
    const allElements = [...updatedElements, frameElement];
    const rebuilt = buildNodesFromElements(allElements).map((n) => ({ ...n, selected: n.id === frameElement.id }));
    setNodes(rebuilt);
    onDesignChanged();
  }, [nodes, projectId, onDesignChanged]);

  const handleUngroupSelected = useCallback(async () => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length !== 1 || selected[0].data.element.type !== "frame") return;
    const frame = selected[0].data.element;
    const children = nodes.filter((n) => n.data.element.parentId === frame.id);

    if (children.length === 0) {
      handleDeleteElement(frame.id);
      return;
    }

    const patches = children.map((n) => ({
      id: n.id,
      parentId: frame.parentId,
      posX: n.data.element.posX + frame.posX,
      posY: n.data.element.posY + frame.posY,
    }));

    // Reparent children FIRST, then delete the now-empty frame — doing this
    // concurrently would race the frame's ON DELETE CASCADE against the
    // reparent PATCHes and could delete children before they'd moved out.
    await Promise.all(patches.map((p) => patchElement(p.id, { parentId: p.parentId, posX: p.posX, posY: p.posY })));
    await fetch(`/api/design/elements/${frame.id}`, { method: "DELETE" });

    const patchMap = new Map(patches.map((p) => [p.id, p]));
    const remainingElements: DesignElement[] = nodes
      .filter((n) => n.id !== frame.id)
      .map((n) => {
        const p = patchMap.get(n.id);
        return p ? { ...n.data.element, parentId: p.parentId, posX: p.posX, posY: p.posY } : n.data.element;
      });
    const rebuilt = buildNodesFromElements(remainingElements).map((n) => ({ ...n, selected: patchMap.has(n.id) }));
    setNodes(rebuilt);
    onDesignChanged();
  }, [nodes, onDesignChanged, handleDeleteElement]);

  // --- Layers-panel drag-and-drop: reorder within a level, nest inside a
  // Frame, or un-nest back out — mirrors Figma's own layers-panel model.
  // `position` "before"/"after" reorders as a sibling of `targetId` (using
  // ITS parent, whatever level that is — this is what makes un-nesting work,
  // by dropping next to a shallower-nested or top-level row); "inside" nests
  // as a child of `targetId`, which must be a frame.
  const handleReorderElement = useCallback(
    (draggedId: string, targetId: string, position: "before" | "after" | "inside") => {
      if (draggedId === targetId) return;
      const elements = nodes.map((n) => n.data.element);
      const byId = new Map(elements.map((e) => [e.id, e]));
      const dragged = byId.get(draggedId);
      const target = byId.get(targetId);
      if (!dragged || !target) return;
      if (position === "inside" && target.type !== "frame") return;

      const newParentId = position === "inside" ? targetId : (target.parentId ?? null);
      if (newParentId && isSelfOrDescendant(draggedId, newParentId, elements)) return;

      const oldParentId = dragged.parentId ?? null;

      // Destination sibling order, visual top-to-bottom (== descending
      // `order`, same convention DesignLayersPanel sorts by).
      const destSiblings = elements
        .filter((e) => (e.parentId ?? null) === newParentId && e.id !== draggedId)
        .sort((a, b) => b.order - a.order);

      let insertIndex: number;
      if (position === "inside") {
        insertIndex = 0;
      } else {
        const targetIndex = destSiblings.findIndex((e) => e.id === targetId);
        insertIndex = position === "before" ? targetIndex : targetIndex + 1;
      }
      destSiblings.splice(insertIndex, 0, dragged);
      const orderUpdates = new Map(destSiblings.map((e, i) => [e.id, destSiblings.length - 1 - i]));

      // Coordinate conversion only needed when actually reparenting — a
      // pure reorder within the same parent leaves posX/posY untouched.
      let posPatch: { posX: number; posY: number } | null = null;
      if (newParentId !== oldParentId) {
        const draggedAbs = getAbsolutePosition(draggedId, elements);
        const newParentAbs = newParentId ? getAbsolutePosition(newParentId, elements) : { x: 0, y: 0 };
        posPatch = { posX: draggedAbs.x - newParentAbs.x, posY: draggedAbs.y - newParentAbs.y };
      }

      const updatedElements = elements.map((e) => {
        const newOrder = orderUpdates.get(e.id);
        if (e.id === draggedId) {
          return { ...e, parentId: newParentId, order: newOrder ?? e.order, ...(posPatch ?? {}) };
        }
        return newOrder !== undefined ? { ...e, order: newOrder } : e;
      });

      let next: DesignElementNodeType[] = buildNodesFromElements(updatedElements).map((n) => ({
        ...n,
        selected: n.id === draggedId,
      }));

      let changedChildren: { id: string; posX: number; posY: number }[] = [];
      for (const affectedParentId of new Set([oldParentId, newParentId].filter((x): x is string => !!x))) {
        const parentEl = next.find((n) => n.id === affectedParentId)?.data.element;
        if (parentEl?.type === "frame" && parentEl.layoutMode !== "none") {
          const result = computeAutoLayoutNodeUpdates(affectedParentId, next);
          next = result.nodes;
          changedChildren = [...changedChildren, ...result.changed];
        }
      }

      setNodes(next);

      const draggedPatch: Record<string, unknown> = { order: orderUpdates.get(draggedId) };
      if (newParentId !== oldParentId) {
        draggedPatch.parentId = newParentId;
        if (posPatch) Object.assign(draggedPatch, posPatch);
      }

      Promise.all([
        patchElement(draggedId, draggedPatch),
        ...Array.from(orderUpdates.entries())
          .filter(([id]) => id !== draggedId)
          .map(([id, order]) => patchElement(id, { order })),
        ...changedChildren.map((c) => patchElement(c.id, { posX: c.posX, posY: c.posY })),
      ]).then(() => onDesignChanged());
    },
    [nodes, onDesignChanged],
  );

  const selectedNodesList = nodes.filter((n) => n.selected);
  const selectedElement = selectedNodesList.length === 1 ? selectedNodesList[0].data.element : null;
  const parentElement = selectedElement?.parentId ? nodes.find((n) => n.id === selectedElement.parentId)?.data.element ?? null : null;
  const allElements = useMemo(() => nodes.map((n) => n.data.element), [nodes]);
  const selectedIds = useMemo(() => new Set(selectedNodesList.map((n) => n.id)), [selectedNodesList]);

  const canGroup =
    selectedNodesList.length >= 2 &&
    selectedNodesList.every((n) => (n.data.element.parentId ?? null) === (selectedNodesList[0].data.element.parentId ?? null));
  const canUngroup = selectedNodesList.length === 1 && selectedNodesList[0].data.element.type === "frame";

  // The pen-preview <svg> overlay below is an absolute inset-0 sibling of
  // <ReactFlow> inside the same wrapper div, so it shares the exact same
  // top-left origin as the flow pane — no extra bounds subtraction needed,
  // just React Flow's own pan/zoom transform.
  function screenPoint(flowPoint: { x: number; y: number }): { x: number; y: number } {
    return { x: flowPoint.x * viewport.zoom + viewport.x, y: flowPoint.y * viewport.zoom + viewport.y };
  }

  return (
    <div className="relative flex h-full w-full">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChosen} className="hidden" />

      <div
        className={`relative flex-1 ${activeTool !== "select" ? "cursor-crosshair" : ""}`}
        ref={canvasWrapperRef}
        onMouseDown={handleWrapperMouseDown}
        onMouseMove={handleWrapperMouseMove}
        onDoubleClick={handleWrapperDoubleClick}
      >
        <DesignCanvasProvider value={canvasHandlers}>
          <ReactFlow
            nodes={nodes}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={handleNodeDragStop}
            onNodesDelete={handleNodesDelete}
            onPaneClick={handlePaneClick}
            onMoveEnd={handleMoveEnd}
            panOnDrag={activeTool === "select"}
            multiSelectionKeyCode={["Shift", "Meta", "Control"]}
            deleteKeyCode={["Backspace", "Delete"]}
            colorMode="dark"
            {...(initialViewport ? { defaultViewport: initialViewport } : { fitView: true })}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#3b82f620" gap={24} />
            <Controls style={{ bottom: 16 }} />

            <Panel position="top-left">
              <div className="glass-panel flex flex-wrap items-center gap-1 rounded-xl p-1.5">
                {TOOL_BUTTONS.map(({ tool, label, icon }) => (
                  <button
                    key={tool}
                    type="button"
                    title={label}
                    onClick={() => (tool === "image" ? handleSelectImageTool() : setActiveTool(tool))}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-base font-medium transition-colors ${
                      activeTool === tool
                        ? "border border-violet-400/60 bg-violet-500/30 text-violet-200"
                        : "border border-transparent text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </Panel>

            {(canGroup || canUngroup) && (
              <Panel position="top-center">
                <div className="glass-panel flex items-center gap-1 rounded-xl p-1.5">
                  {canGroup && (
                    <button
                      onClick={handleGroupSelected}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-zinc-200 hover:bg-white/10"
                    >
                      Grupla
                    </button>
                  )}
                  {canUngroup && (
                    <button
                      onClick={handleUngroupSelected}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-zinc-200 hover:bg-white/10"
                    >
                      Grubu Çöz
                    </button>
                  )}
                </div>
              </Panel>
            )}

            <Panel position="bottom-left">
              <p className="glass-panel rounded-lg px-3 py-1.5 text-[11px] text-zinc-400">
                {activeTool === "pen"
                  ? "Nokta eklemek için tıklayın, bitirmek için Enter/çift tık, iptal için Esc"
                  : activeTool === "image"
                    ? hasPendingImage
                      ? "Yerleştirmek için kanvasa tıklayın"
                      : "Bir görsel dosyası seçin"
                    : activeTool === "select"
                      ? "Bir eleman eklemek için üstteki araçlardan birini seçin"
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

        {penPoints && penPoints.length > 0 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <polyline
              points={[...penPoints, ...(penCursor ? [penCursor] : [])]
                .map((p) => {
                  const s = screenPoint(p);
                  return `${s.x},${s.y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeDasharray="4,4"
            />
            {penPoints.map((p, i) => {
              const s = screenPoint(p);
              return <circle key={i} cx={s.x} cy={s.y} r={4} fill="#8b5cf6" />;
            })}
          </svg>
        )}
      </div>

      <div className="flex w-64 shrink-0 flex-col border-l border-white/10 bg-[#0b0714]">
        <div className="max-h-[40%] overflow-y-auto border-b border-white/10 p-3">
          <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Katmanlar</h3>
          <DesignLayersPanel
            elements={allElements}
            selectedIds={selectedIds}
            onSelect={handleLayerSelect}
            onReorder={handleReorderElement}
            onToggleHidden={handleToggleHidden}
            onToggleLocked={handleToggleLocked}
          />
        </div>
        <DesignPropertiesPanel
          selectedElement={selectedElement}
          parentElement={parentElement}
          allElements={allElements}
          onUpdate={handleUpdateElement}
          onDelete={handleDeleteElement}
        />
      </div>
    </div>
  );
}
