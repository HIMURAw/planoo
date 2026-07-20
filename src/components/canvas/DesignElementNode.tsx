"use client";

import { createContext, useContext, useState } from "react";
import { NodeResizer, type NodeProps, type Node } from "@xyflow/react";

export type DesignElementType = "rectangle" | "ellipse" | "text";

export interface DesignElement {
  id: string;
  type: DesignElementType;
  posX: number;
  posY: number;
  width: number;
  height: number;
  fillColor: string;
  text: string | null;
  fontSize: number | null;
  borderRadius: number | null;
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

export function DesignElementNode({ data, selected }: NodeProps<DesignElementNodeType>) {
  const { element } = data;
  const { onUpdateElementText, onResizeEnd, onDeleteElement } = useDesignCanvasHandlers();
  const [isEditingText, setIsEditingText] = useState(false);
  const [draft, setDraft] = useState(element.text ?? "");

  function commitText() {
    setIsEditingText(false);
    if (draft !== (element.text ?? "")) onUpdateElementText(element.id, draft);
  }

  const shapeStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    backgroundColor: element.type === "text" ? "transparent" : element.fillColor,
    borderRadius: element.type === "ellipse" ? "9999px" : `${element.borderRadius ?? 0}px`,
  };

  return (
    <div className="group relative h-full w-full">
      <NodeResizer
        isVisible={selected}
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

      {element.type === "text" ? (
        isEditingText ? (
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
            style={{ fontSize: `${element.fontSize ?? 16}px`, color: element.fillColor }}
            className="nodrag h-full w-full resize-none border border-dashed border-violet-400/60 bg-transparent p-1 leading-tight focus:outline-none"
          />
        ) : (
          <div
            onDoubleClick={() => {
              setDraft(element.text ?? "");
              setIsEditingText(true);
            }}
            style={{ fontSize: `${element.fontSize ?? 16}px`, color: element.fillColor }}
            className="nodrag flex h-full w-full items-center whitespace-pre-wrap break-words p-1 leading-tight"
          >
            {element.text || <span className="opacity-40">Metin (çift tıkla düzenle)</span>}
          </div>
        )
      ) : (
        <div style={shapeStyle} className="border border-white/10" />
      )}
    </div>
  );
}
