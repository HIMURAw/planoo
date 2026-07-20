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
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
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
  if (element.type === "image") {
    if (element.imageData) {
      // eslint-disable-next-line @next/next/no-img-element -- data: URLs, next/image can't optimize these
      return <img src={element.imageData} alt="" className="h-4 w-4 shrink-0 rounded-sm object-cover" />;
    }
    return <span className="h-3 w-3 shrink-0 rounded-sm bg-zinc-600" />;
  }
  if (element.type === "text") {
    return <span className="flex h-3 w-3 shrink-0 items-center justify-center text-[9px] text-zinc-400">T</span>;
  }
  if (element.type === "path") {
    return <span className="flex h-3 w-3 shrink-0 items-center justify-center text-[9px] text-zinc-400">╱</span>;
  }
  if (element.type === "frame") {
    return <span className="h-3 w-3 shrink-0 rounded-xs border border-dashed border-zinc-400" />;
  }
  return (
    <span
      className="h-3 w-3 shrink-0 rounded-sm border border-white/20"
      style={{ backgroundColor: element.fillColor, borderRadius: element.type === "ellipse" ? "9999px" : 2 }}
    />
  );
}

// Fixed-width columns, one per ancestor level, drawn as thin vertical/elbow
// lines connecting a row to its parent (Figma-style tree lines rather than
// indentation alone). `ancestorLines[i]` for i < length-1 is a plain
// passthrough line for a shallower ancestor that still has siblings below;
// the LAST entry belongs to THIS row's own elbow — its top half always
// connects up to the parent, its bottom half continues only if this row
// itself has more siblings after it (so they can connect through the same
// column).
function TreeConnectors({ ancestorLines }: { ancestorLines: boolean[] }) {
  if (ancestorLines.length === 0) return null;
  return (
    <span className="flex h-6 shrink-0">
      {ancestorLines.map((continues, i) => {
        const isElbowColumn = i === ancestorLines.length - 1;
        return (
          <span key={i} className="relative w-3.5 shrink-0">
            {isElbowColumn ? (
              <>
                <span
                  className="absolute left-1/2 top-0 w-px -translate-x-1/2 bg-white/15"
                  style={{ height: continues ? "100%" : "50%" }}
                />
                <span className="absolute left-1/2 top-1/2 h-px w-1/2 -translate-y-1/2 bg-white/15" />
              </>
            ) : (
              continues && <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/15" />
            )}
          </span>
        );
      })}
    </span>
  );
}

function RowIconButton({
  onClick,
  active,
  activeTitle,
  inactiveTitle,
  children,
}: {
  onClick: () => void;
  active: boolean;
  activeTitle: string;
  inactiveTitle: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={active ? activeTitle : inactiveTitle}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] transition-opacity hover:bg-white/10 ${
        active ? "opacity-100" : "opacity-0 group-hover/row:opacity-60 hover:opacity-100!"
      }`}
    >
      {children}
    </button>
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

export function DesignLayersPanel({
  elements,
  selectedIds,
  onSelect,
  onReorder,
  onToggleHidden,
  onToggleLocked,
}: DesignLayersPanelProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const query = searchQuery.trim().toLowerCase();
  const isSearching = query.length > 0;
  const searchResults = isSearching
    ? elements.filter((e) => labelFor(e).toLowerCase().includes(query)).sort((a, b) => b.order - a.order)
    : [];

  return (
    <div>
      <div className="relative mb-1.5">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Katmanlarda ara…"
          className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 pr-6 text-[11px] text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
        />
        {isSearching && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500 hover:text-zinc-200"
          >
            ✕
          </button>
        )}
      </div>

      {isSearching ? (
        searchResults.length === 0 ? (
          <p className="px-1 text-[11px] text-zinc-600">Sonuç yok.</p>
        ) : (
          <div className="space-y-0.5">
            {searchResults.map((el) => (
              <div key={el.id} data-layer-id={el.id} data-layer-type={el.type}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={labelFor(el)}
                  onClick={(e) => onSelect(el.id, e.shiftKey || e.metaKey || e.ctrlKey)}
                  className={`group/row flex w-full items-center gap-1.5 rounded-lg py-1.5 pl-2 pr-1 text-left text-[12px] transition-colors ${
                    selectedIds.has(el.id) ? "bg-violet-500/20 text-violet-200" : "text-zinc-300 hover:bg-white/5"
                  } ${el.hidden ? "opacity-50" : ""}`}
                >
                  <TypeSwatch element={el} />
                  <span className="flex-1 truncate">{labelFor(el)}</span>
                  <RowIconButton
                    onClick={() => onToggleLocked(el.id)}
                    active={el.locked}
                    activeTitle="Kilidi aç"
                    inactiveTitle="Kilitle"
                  >
                    {el.locked ? "🔒" : "🔓"}
                  </RowIconButton>
                  <RowIconButton
                    onClick={() => onToggleHidden(el.id)}
                    active={el.hidden}
                    activeTitle="Göster"
                    inactiveTitle="Gizle"
                  >
                    {el.hidden ? "◌" : "👁"}
                  </RowIconButton>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-0.5">
          {topLevel.map((el) => (
            <LayerRow
              key={el.id}
              element={el}
              ancestorLines={[]}
              elements={elements}
              selectedIds={selectedIds}
              collapsedIds={collapsedIds}
              dragId={dragId}
              dropTarget={dropTarget}
              onToggleCollapsed={toggleCollapsed}
              onRowMouseDown={handleRowMouseDown}
              onRowClick={handleRowClick}
              onToggleHidden={onToggleHidden}
              onToggleLocked={onToggleLocked}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LayerRow({
  element,
  ancestorLines,
  elements,
  selectedIds,
  collapsedIds,
  dragId,
  dropTarget,
  onToggleCollapsed,
  onRowMouseDown,
  onRowClick,
  onToggleHidden,
  onToggleLocked,
}: {
  element: DesignElement;
  // One entry per ancestor level; empty for top-level rows, which have no
  // connector columns at all (see TreeConnectors).
  ancestorLines: boolean[];
  elements: DesignElement[];
  selectedIds: Set<string>;
  collapsedIds: Set<string>;
  dragId: string | null;
  dropTarget: DropTarget | null;
  onToggleCollapsed: (id: string) => void;
  onRowMouseDown: (e: React.MouseEvent, id: string) => void;
  onRowClick: (e: React.MouseEvent, id: string) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
}) {
  const depth = ancestorLines.length;
  const children = elements.filter((e) => e.parentId === element.id).sort((a, b) => b.order - a.order);
  const hasChildren = children.length > 0;
  const isSelected = selectedIds.has(element.id);
  const isCollapsed = collapsedIds.has(element.id);
  const isDragging = dragId === element.id;
  const isDropTarget = dropTarget?.id === element.id;

  return (
    <div>
      <div data-layer-id={element.id} data-layer-type={element.type} className="relative">
        {isDropTarget && dropTarget?.position === "before" && (
          <div
            style={{ left: 8 + depth * 14 }}
            className="pointer-events-none absolute -top-px right-1 h-0.5 rounded-full bg-violet-400"
          />
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
          className={`group/row flex w-full cursor-grab items-center gap-1 rounded-lg py-1.5 pl-2 pr-1 text-left text-[12px] transition-colors select-none active:cursor-grabbing ${
            isDropTarget && dropTarget?.position === "inside"
              ? "bg-violet-500/30 outline-1 outline-violet-400"
              : isSelected
                ? "bg-violet-500/20 text-violet-200"
                : "text-zinc-300 hover:bg-white/5"
          } ${isDragging ? "opacity-40" : ""} ${element.hidden ? "opacity-50" : ""}`}
        >
          <TreeConnectors ancestorLines={ancestorLines} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) onToggleCollapsed(element.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className={`flex h-5 w-3 shrink-0 items-center justify-center text-[9px] text-zinc-500 ${hasChildren ? "hover:text-zinc-200" : ""}`}
          >
            {hasChildren ? (isCollapsed ? "▸" : "▾") : ""}
          </button>
          <TypeSwatch element={element} />
          <span className="flex-1 truncate">{labelFor(element)}</span>
          <RowIconButton
            onClick={() => onToggleLocked(element.id)}
            active={element.locked}
            activeTitle="Kilidi aç"
            inactiveTitle="Kilitle"
          >
            {element.locked ? "🔒" : "🔓"}
          </RowIconButton>
          <RowIconButton
            onClick={() => onToggleHidden(element.id)}
            active={element.hidden}
            activeTitle="Göster"
            inactiveTitle="Gizle"
          >
            {element.hidden ? "◌" : "👁"}
          </RowIconButton>
        </div>
        {isDropTarget && dropTarget?.position === "after" && (
          <div
            style={{ left: 8 + depth * 14 }}
            className="pointer-events-none absolute -bottom-px right-1 h-0.5 rounded-full bg-violet-400"
          />
        )}
      </div>
      {hasChildren &&
        !isCollapsed &&
        children.map((c, i) => (
          <LayerRow
            key={c.id}
            element={c}
            ancestorLines={[...ancestorLines, i < children.length - 1]}
            elements={elements}
            selectedIds={selectedIds}
            collapsedIds={collapsedIds}
            dragId={dragId}
            dropTarget={dropTarget}
            onToggleCollapsed={onToggleCollapsed}
            onRowMouseDown={onRowMouseDown}
            onRowClick={onRowClick}
            onToggleHidden={onToggleHidden}
            onToggleLocked={onToggleLocked}
          />
        ))}
    </div>
  );
}
