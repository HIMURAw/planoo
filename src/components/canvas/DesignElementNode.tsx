"use client";

import { createContext, useContext, useState } from "react";
import { NodeResizer, type NodeProps, type Node } from "@xyflow/react";

export type DesignElementType = "rectangle" | "ellipse" | "text" | "frame" | "image" | "path";
export type AutoLayoutDirection = "none" | "horizontal" | "vertical";
export type AutoLayoutAlign = "start" | "center" | "end";
export type StrokeStyleValue = "solid" | "dashed" | "dotted";

export interface ShadowEffect {
  type: "shadow";
  color: string;
  x: number;
  y: number;
  blur: number;
  spread: number;
}

export interface PathPoint {
  x: number;
  y: number;
}

export interface DesignElement {
  id: string;
  parentId: string | null;
  type: DesignElementType;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  order: number;
  fillColor: string;
  text: string | null;
  fontSize: number | null;
  borderRadius: number | null;
  strokeColor: string | null;
  strokeWidth: number;
  strokeStyle: StrokeStyleValue;
  effects: ShadowEffect[] | null;
  pathData: PathPoint[] | null;
  imageData: string | null;
  layoutMode: AutoLayoutDirection;
  layoutGap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  layoutAlign: AutoLayoutAlign;
}

export interface DesignElementNodeData extends Record<string, unknown> {
  element: DesignElement;
}

export type DesignElementNodeType = Node<DesignElementNodeData, "designElement">;

export interface DesignCanvasHandlers {
  onUpdateElementText: (id: string, text: string) => void;
  onResizeEnd: (id: string, rect: { x: number; y: number; width: number; height: number }) => void;
  onDeleteElement: (id: string) => void;
}

// Same declaration-order reasoning as SchemaTableNode/SchemaNoteNode's own
// context: these callbacks close over `setNodes`, which doesn't exist yet
// when the initial node array is constructed, so they can't live in
// node.data directly.
const DesignCanvasContext = createContext<DesignCanvasHandlers | null>(null);
export const DesignCanvasProvider = DesignCanvasContext.Provider;

function useDesignCanvasHandlers(): DesignCanvasHandlers {
  const ctx = useContext(DesignCanvasContext);
  if (!ctx) throw new Error("DesignElementNode must be rendered inside a DesignCanvasProvider");
  return ctx;
}

const MIN_SIZE = 24;

function dashArrayCss(style: StrokeStyleValue): "solid" | "dashed" | "dotted" {
  return style;
}

// Multiple shadows are supported (Figma allows several effects stacked) —
// box-shadow accepts a comma-separated list directly, and CSS `filter`
// accepts multiple space-separated drop-shadow() functions for text, where
// box-shadow wouldn't follow the glyph outlines.
function shadowCss(effects: ShadowEffect[] | null, asFilter: boolean): string | undefined {
  if (!effects || effects.length === 0) return undefined;
  if (asFilter) {
    return effects.map((fx) => `drop-shadow(${fx.x}px ${fx.y}px ${Math.max(fx.blur / 2, 0)}px ${fx.color})`).join(" ");
  }
  return effects.map((fx) => `${fx.x}px ${fx.y}px ${fx.blur}px ${fx.spread}px ${fx.color}`).join(", ");
}

export function DesignElementNode({ data, selected }: NodeProps<DesignElementNodeType>) {
  const { element } = data;
  const { onUpdateElementText, onResizeEnd, onDeleteElement } = useDesignCanvasHandlers();
  const [isEditingText, setIsEditingText] = useState(false);
  const [draft, setDraft] = useState(element.text ?? "");

  function commitText() {
    setIsEditingText(false);
    if (draft !== (element.text ?? "")) onUpdateElementText(element.id, draft);
  }

  const isTextType = element.type === "text";
  const canResize = element.type !== "path";

  const shapeStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    opacity: element.opacity,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    filter: isTextType ? shadowCss(element.effects, true) : undefined,
  };

  return (
    <div className="group relative h-full w-full">
      <NodeResizer
        isVisible={selected && canResize}
        minWidth={MIN_SIZE}
        minHeight={MIN_SIZE}
        lineClassName="!border-violet-400"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-2 !border-violet-400 !bg-[#0d0d16]"
        onResizeEnd={(_event, params) =>
          onResizeEnd(element.id, { x: params.x, y: params.y, width: params.width, height: params.height })
        }
      />

      {selected && (
        <button
          type="button"
          onClick={() => onDeleteElement(element.id)}
          className="nodrag absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-[#1a1030] text-[10px] text-zinc-300 opacity-0 shadow transition-opacity group-hover:opacity-100 hover:text-red-400"
        >
          ✕
        </button>
      )}

      {renderShape()}
    </div>
  );

  function renderShape() {
    if (element.type === "text") {
      if (isEditingText) {
        return (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(element.text ?? "");
                setIsEditingText(false);
              }
            }}
            style={{ fontSize: `${element.fontSize ?? 16}px`, color: element.fillColor, opacity: element.opacity }}
            className="nodrag h-full w-full resize-none border border-dashed border-violet-400/60 bg-transparent p-1 leading-tight focus:outline-none"
          />
        );
      }
      return (
        <div
          onDoubleClick={() => {
            setDraft(element.text ?? "");
            setIsEditingText(true);
          }}
          style={{ ...shapeStyle, fontSize: `${element.fontSize ?? 16}px`, color: element.fillColor }}
          className="nodrag flex whitespace-pre-wrap wrap-break-word p-1 leading-tight"
        >
          {element.text || <span className="opacity-40">Metin (çift tıkla düzenle)</span>}
        </div>
      );
    }

    if (element.type === "image") {
      return (
        <div style={shapeStyle} className="overflow-hidden" >
          {element.imageData ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URLs, next/image can't optimize these
            <img
              src={element.imageData}
              alt=""
              draggable={false}
              style={{ borderRadius: `${element.borderRadius ?? 0}px` }}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center border border-dashed border-white/20 text-[10px] text-zinc-500">
              Görsel yok
            </div>
          )}
        </div>
      );
    }

    if (element.type === "path") {
      const pts = element.pathData ?? [];
      const pointsAttr = pts.map((p) => `${p.x},${p.y}`).join(" ");
      return (
        <svg width="100%" height="100%" style={{ opacity: element.opacity, overflow: "visible" }}>
          <polyline
            points={pointsAttr}
            fill="none"
            stroke={element.strokeColor ?? "#8b5cf6"}
            strokeWidth={element.strokeWidth || 2}
            strokeDasharray={
              element.strokeStyle === "dashed" ? "8,4" : element.strokeStyle === "dotted" ? "2,4" : undefined
            }
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    // rectangle, ellipse, frame
    const style: React.CSSProperties = {
      ...shapeStyle,
      backgroundColor: element.fillColor,
      borderRadius: element.type === "ellipse" ? "9999px" : `${element.borderRadius ?? 0}px`,
      borderWidth: element.strokeWidth || 0,
      borderColor: element.strokeColor ?? "transparent",
      borderStyle: dashArrayCss(element.strokeStyle),
      boxShadow: shadowCss(element.effects, false),
      filter: undefined,
    };
    return (
      <div style={style}>
        {element.type === "frame" && element.layoutMode !== "none" && (
          <span className="pointer-events-none absolute -top-5 left-0 rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] text-violet-300">
            {element.layoutMode === "horizontal" ? "→ Auto Layout" : "↓ Auto Layout"}
          </span>
        )}
      </div>
    );
  }
}
