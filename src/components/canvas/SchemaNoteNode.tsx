"use client";

import { useState } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { useSchemaCanvasHandlers } from "./SchemaTableNode";

export interface CanvasNote {
  id: string;
  content: string;
  posX: number;
  posY: number;
}

export interface SchemaNoteNodeData extends Record<string, unknown> {
  note: CanvasNote;
}

export type SchemaNoteNodeType = Node<SchemaNoteNodeData, "noteNode">;

// A free-floating sticky note on the schema canvas — unlike table nodes,
// carries no DB-schema meaning at all, just a place for the user to jot
// something ("this table still needs a migration", "confirm with backend
// team") wherever is spatially relevant on the blueprint. Mutation
// callbacks come through the same SchemaCanvasProvider context table nodes
// use, for the same reason (see that file's comment) — they close over
// `setNodes`, which doesn't exist yet at the moment the initial node data
// is constructed.
export function SchemaNoteNode({ data }: NodeProps<SchemaNoteNodeType>) {
  const { note } = data;
  const { onUpdateNoteContent, onDeleteNote } = useSchemaCanvasHandlers();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);

  function commit() {
    setIsEditing(false);
    if (draft !== note.content) onUpdateNoteContent(note.id, draft);
  }

  return (
    <div className="w-56 rounded-lg border border-amber-400/40 bg-amber-300/95 p-3 font-mono text-[12px] text-amber-950 shadow-xl shadow-black/40">
      <div className="mb-1 flex cursor-grab items-center justify-between active:cursor-grabbing">
        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700/70">Not</span>
        <button
          type="button"
          onClick={() => onDeleteNote(note.id)}
          className="nodrag text-[10px] text-amber-700/50 transition-colors hover:text-red-600"
        >
          ✕
        </button>
      </div>
      {isEditing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(note.content);
              setIsEditing(false);
            }
          }}
          rows={4}
          className="nodrag w-full resize-none rounded border border-amber-500/40 bg-amber-100/80 p-1.5 text-[12px] text-amber-950 focus:outline-none"
        />
      ) : (
        <p
          onClick={() => setIsEditing(true)}
          className="nodrag min-h-[4.5rem] cursor-text whitespace-pre-wrap break-words"
        >
          {note.content || <span className="text-amber-700/50">Not eklemek için tıklayın…</span>}
        </p>
      )}
    </div>
  );
}
