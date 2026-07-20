"use client";

import { useState } from "react";
import type { DesignElement, DesignElementType } from "./DesignElementNode";

interface DesignLayersPanelProps {
  elements: DesignElement[];
  selectedIds: Set<string>;
  onSelect: (id: string, additive: boolean) => void;
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

export function DesignLayersPanel({ elements, selectedIds, onSelect }: DesignLayersPanelProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const topLevel = elements.filter((e) => !e.parentId).sort((a, b) => b.order - a.order);

  if (elements.length === 0) {
    return <p className="px-1 text-[11px] text-zinc-600">Henüz eleman yok.</p>;
  }

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          onSelect={onSelect}
          onToggleCollapsed={toggleCollapsed}
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
  onSelect,
  onToggleCollapsed,
}: {
  element: DesignElement;
  depth: number;
  elements: DesignElement[];
  selectedIds: Set<string>;
  collapsedIds: Set<string>;
  onSelect: (id: string, additive: boolean) => void;
  onToggleCollapsed: (id: string) => void;
}) {
  const children = elements.filter((e) => e.parentId === element.id).sort((a, b) => b.order - a.order);
  const hasChildren = children.length > 0;
  const isSelected = selectedIds.has(element.id);
  const isCollapsed = collapsedIds.has(element.id);

  return (
    <div>
      <div
        className={`flex w-full items-center gap-1 rounded-lg pr-2 text-left text-[12px] transition-colors ${
          isSelected ? "bg-violet-500/20 text-violet-200" : "text-zinc-300 hover:bg-white/5"
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleCollapsed(element.id);
          }}
          style={{ marginLeft: 8 + depth * 14 }}
          className={`flex h-5 w-3 shrink-0 items-center justify-center text-[9px] text-zinc-500 ${hasChildren ? "hover:text-zinc-200" : ""}`}
        >
          {hasChildren ? (isCollapsed ? "▸" : "▾") : ""}
        </button>
        <button
          onClick={(e) => onSelect(element.id, e.shiftKey || e.metaKey || e.ctrlKey)}
          className="flex flex-1 items-center gap-2 py-1.5"
        >
          <TypeSwatch element={element} />
          <span className="truncate">{labelFor(element)}</span>
        </button>
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
            onSelect={onSelect}
            onToggleCollapsed={onToggleCollapsed}
          />
        ))}
    </div>
  );
}
