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
// team") wherever is spatially relevant on the blueprint.
//
// Default appearance is a small round avatar (whose author placed it, via
// the same profile picture shown elsewhere in the app) with a note-corner
// badge — not the note text itself, which would clutter a canvas with more
// than a couple of notes on it. Hovering reveals the actual content in a
// popover; clicking opens it for editing. Both the popover and the edit box
// are absolutely-positioned overlays that expand beyond the node's own
// small footprint rather than resizing it, so they don't affect the
// canvas's layout/panning math the way growing the real node would.
//
// Mutation callbacks come through the same SchemaCanvasProvider context
// table nodes use, for the same reason (see that file's comment) — they
// close over `setNodes`, which doesn't exist yet at the moment the initial
// node data is constructed.
export function SchemaNoteNode({ data }: NodeProps<SchemaNoteNodeType>) {
  const { note } = data;
  const { onUpdateNoteContent, onDeleteNote, userName, userImage } = useSchemaCanvasHandlers();
  const [isEditing, setIsEditing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [draft, setDraft] = useState(note.content);

  function commit() {
    setIsEditing(false);
    if (draft !== note.content) onUpdateNoteContent(note.id, draft);
  }

  function startEditing() {
    setDraft(note.content);
    setIsHovering(false);
    setIsEditing(true);
  }

  const showPopover = isHovering && !isEditing;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <button
        type="button"
        onClick={startEditing}
        title={note.content || "Not eklemek için tıklayın"}
        className="nodrag relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-amber-400 bg-[#0d2240] shadow-lg shadow-black/40"
      >
        {userImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar comes from an arbitrary OAuth-provided URL, not a local/optimizable asset
          <img src={userImage} alt={userName} className="h-full w-full rounded-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-violet-300">{userName.charAt(0).toUpperCase()}</span>
        )}
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#081526] bg-amber-400 text-[10px]">
          📝
        </span>
      </button>

      {(showPopover || isEditing) && (
        <div
          className="nodrag absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-lg border border-amber-400/40 bg-amber-300/95 p-3 font-mono text-[12px] text-amber-950 shadow-xl shadow-black/40"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700/70">{userName}</span>
            <button
              type="button"
              onClick={() => onDeleteNote(note.id)}
              className="text-[10px] text-amber-700/50 transition-colors hover:text-red-600"
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
              className="w-full resize-none rounded border border-amber-500/40 bg-amber-100/80 p-1.5 text-[12px] text-amber-950 focus:outline-none"
            />
          ) : (
            <p className="whitespace-pre-wrap break-words">
              {note.content || <span className="text-amber-700/50">Not eklemek için tıklayın…</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
