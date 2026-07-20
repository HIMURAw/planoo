"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignElement, DesignElementType } from "./DesignElementNode";

type DropPosition = "before" | "after" | "inside";
interface DropTarget {
  id: string;
  position: DropPosition;
}

interface DesignLayersPanelProps {
  elements: DesignElement[];
  selectedIds: Set<string>;
  onSelect: (id: string, additive: boolean) => void;
  onReorder: (draggedId: string, targetId: string, position: DropPosition) => void;
}

const TYPE_LABEL: Record<DesignElementType, string> = {
  rectangle: "Dikdörtgen",
  ellipse: "Elips",
  text: "Metin",
  frame: "Çerçeve",
  image: "Görsel",
  path: "Çizgi",
};

function labelFor(el: DesignElement): string {
  if (el.type === "text") return el.text ? `Metin: ${el.text.slice(0, 20)}` : "Metin";
  return TYPE_LABEL[el.type];
}

function TypeSwatch({ element }: { element: DesignElement }) {
  if (element.type === "text") {
    return <span className="flex h-3 w-3 shrink-0 items-center justify-center text-[9px] text-zinc-400">T</span>;
  }
  if (element.type === "path") {
    return <span className="flex h-3 w-3 shrink-0 items-center justify-center text-[9px] text-zinc-400">╱</span>;
  }
  if (element.type === "frame") {
    return <span className="h-3 w-3 shrink-0 rounded-xs border border-dashed border-zinc-400" />;
  }
  if (element.type === "image") {
    return <span className="h-3 w-3 shrink-0 rounded-sm bg-zinc-600" />;
  }
  return (
    <span
      className="h-3 w-3 shrink-0 rounded-sm border border-white/20"
      style={{ backgroundColor: element.fillColor, borderRadius: element.type === "ellipse" ? "9999px" : 2 }}
    />
  );
}

// Is `targetId` `candidateId` itself, or nested somewhere under it? Used to
// grey out / refuse drop zones that would create a cycle — the real
// (authoritative) check happens again in DesignCanvas's onReorder handler;
// this one is just so the hover indicator never promises a drop that would
// then get silently rejected.
function isDescendantOrSelf(candidateId: string, targetId: string, elements: DesignElement[]): boolean {
  if (candidateId === targetId) return true;
  const byId = new Map(elements.map((e) => [e.id, e]));
  let current = byId.get(targetId);
  while (current?.parentId) {
    if (current.parentId === candidateId) return true;
    current = byId.get(current.parentId);
  }
  return false;
}

const DRAG_THRESHOLD = 5;

export function DesignLayersPanel({ elements, selectedIds, onSelect, onReorder }: DesignLayersPanelProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  // Tracks the in-progress pointer gesture across the mousedown -> mousemove
  // -> mouseup sequence. `justFinishedDrag` survives one extra tick past
  // mouseup specifically to suppress the native `click` event that always
  // follows it (click fires after mouseup, so clearing this synchronously
  // inside the mouseup handler would already be too late for the click
  // handler to see it).
  const gestureRef = useRef<{ id: string; startX: number; startY: number; dragging: boolean } | null>(null);
  const justFinishedDragRef = useRef(false);

  const topLevel = elements.filter((e) => !e.parentId).sort((a, b) => b.order - a.order);

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRowMouseDown(e: React.MouseEvent, id: string) {
    if (e.button !== 0) return;
    gestureRef.current = { id, startX: e.clientX, startY: e.clientY, dragging: false };
  }

  function handleRowClick(e: React.MouseEvent, id: string) {
    if (justFinishedDragRef.current) {
      justFinishedDragRef.current = false;
      return;
    }
    onSelect(id, e.shiftKey || e.metaKey || e.ctrlKey);
  }

  useEffect(() => {
    function computeDropTarget(clientX: number, clientY: number, draggedId: string): DropTarget | null {
      const hit = document.elementFromPoint(clientX, clientY);
      const row = hit?.closest("[data-layer-id]") as HTMLElement | null;
      if (!row) return null;
      const targetId = row.getAttribute("data-layer-id")!;
      if (isDescendantOrSelf(draggedId, targetId, elements)) return null;
      const targetType = row.getAttribute("data-layer-type");
      const rect = row.getBoundingClientRect();
      const relY = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
      if (targetType === "frame") {
        if (relY < 0.25) return { id: targetId, position: "before" };
        if (relY > 0.75) return { id: targetId, position: "after" };
        return { id: targetId, position: "inside" };
      }
      return { id: targetId, position: relY < 0.5 ? "before" : "after" };
    }

    function handleMove(e: MouseEvent) {
      const gesture = gestureRef.current;
      if (!gesture) return;
      if (!gesture.dragging) {
        if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) < DRAG_THRESHOLD) return;
        gesture.dragging = true;
        setDragId(gesture.id);
      }
      setDropTarget(computeDropTarget(e.clientX, e.clientY, gesture.id));
    }

    function handleUp() {
      const gesture = gestureRef.current;
      if (gesture?.dragging) {
        justFinishedDragRef.current = true;
        if (dropTarget) onReorder(gesture.id, dropTarget.id, dropTarget.position);
        // Only meant to swallow the native `click` that follows a mouseup
        // on the SAME row a drag started on. When the drag ends over a
        // DIFFERENT row, the browser never fires that click at all (click
        // requires matching mousedown/mouseup targets), so nothing would
        // ever consume this flag — leaving it stuck `true` and silently
        // eating the next, unrelated row click. Clear it on the next tick
        // instead: still in time to suppress a same-row echo click (which
        // fires synchronously, before this runs), but never lingers.
        setTimeout(() => {
          justFinishedDragRef.current = false;
        }, 0);
      }
      gestureRef.current = null;
      setDragId(null);
      setDropTarget(null);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dropTarget, elements, onReorder]);

  if (elements.length === 0) {
    return <p className="px-1 text-[11px] text-zinc-600">Henüz eleman yok.</p>;
  }

  return (
    <div className="space-y-0.5">
      {topLevel.map((el) => (
        <LayerRow
          key={el.id}
          element={el}
          depth={0}
          elements={elements}
          selectedIds={selectedIds}
          collapsedIds={collapsedIds}
          dragId={dragId}
          dropTarget={dropTarget}
          onToggleCollapsed={toggleCollapsed}
          onRowMouseDown={handleRowMouseDown}
          onRowClick={handleRowClick}
        />
      ))}
    </div>
  );
}

function LayerRow({
  element,
  depth,
  elements,
  selectedIds,
  collapsedIds,
  dragId,
  dropTarget,
  onToggleCollapsed,
  onRowMouseDown,
  onRowClick,
}: {
  element: DesignElement;
  depth: number;
  elements: DesignElement[];
  selectedIds: Set<string>;
  collapsedIds: Set<string>;
  dragId: string | null;
  dropTarget: DropTarget | null;
  onToggleCollapsed: (id: string) => void;
  onRowMouseDown: (e: React.MouseEvent, id: string) => void;
  onRowClick: (e: React.MouseEvent, id: string) => void;
}) {
  const children = elements.filter((e) => e.parentId === element.id).sort((a, b) => b.order - a.order);
  const hasChildren = children.length > 0;
  const isSelected = selectedIds.has(element.id);
  const isCollapsed = collapsedIds.has(element.id);
  const isDragging = dragId === element.id;
  const isDropTarget = dropTarget?.id === element.id;
  const indent = 8 + depth * 14;

  return (
    <div>
      <div data-layer-id={element.id} data-layer-type={element.type} className="relative">
        {isDropTarget && dropTarget?.position === "before" && (
          <div style={{ left: indent }} className="pointer-events-none absolute -top-px right-1 h-0.5 rounded-full bg-violet-400" />
        )}
        <div
          role="button"
          tabIndex={0}
          aria-label={labelFor(element)}
          onMouseDown={(e) => onRowMouseDown(e, element.id)}
          onClick={(e) => onRowClick(e, element.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onRowClick(e as unknown as React.MouseEvent, element.id);
          }}
          className={`flex w-full cursor-grab items-center gap-1 rounded-lg pr-2 text-left text-[12px] transition-colors select-none active:cursor-grabbing ${
            isDropTarget && dropTarget?.position === "inside"
              ? "bg-violet-500/30 outline-1 outline-violet-400"
              : isSelected
                ? "bg-violet-500/20 text-violet-200"
                : "text-zinc-300 hover:bg-white/5"
          } ${isDragging ? "opacity-40" : ""}`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) onToggleCollapsed(element.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ marginLeft: indent }}
            className={`flex h-5 w-3 shrink-0 items-center justify-center text-[9px] text-zinc-500 ${hasChildren ? "hover:text-zinc-200" : ""}`}
          >
            {hasChildren ? (isCollapsed ? "▸" : "▾") : ""}
          </button>
          <div className="flex flex-1 items-center gap-2 py-1.5">
            <TypeSwatch element={element} />
            <span className="truncate">{labelFor(element)}</span>
          </div>
        </div>
        {isDropTarget && dropTarget?.position === "after" && (
          <div style={{ left: indent }} className="pointer-events-none absolute -bottom-px right-1 h-0.5 rounded-full bg-violet-400" />
        )}
      </div>
      {hasChildren &&
        !isCollapsed &&
        children.map((c) => (
          <LayerRow
            key={c.id}
            element={c}
            depth={depth + 1}
            elements={elements}
            selectedIds={selectedIds}
            collapsedIds={collapsedIds}
            dragId={dragId}
            dropTarget={dropTarget}
            onToggleCollapsed={onToggleCollapsed}
            onRowMouseDown={onRowMouseDown}
            onRowClick={onRowClick}
          />
        ))}
    </div>
  );
}
