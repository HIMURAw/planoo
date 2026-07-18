"use client";

import { CONFIDENCE_THRESHOLD } from "@/lib/matcher/types";
import type { LinkView } from "./types";

interface LinkReviewPanelProps {
  links: LinkView[];
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  pending: Set<string>;
}

// "suggested" and "stale" are the only states a user acts on here — see
// Link state machine in the Prisma schema. "confirmed"/"broken"/"rejected"
// are shown on the canvas but have no action in this panel.
export function LinkReviewPanel({ links, onConfirm, onReject, pending }: LinkReviewPanelProps) {
  const actionable = links
    .filter((l) => l.state === "suggested" || l.state === "stale")
    .sort((a, b) => b.confidence - a.confidence);

  const highConfidence = actionable.filter((l) => l.confidence >= CONFIDENCE_THRESHOLD);
  const lowConfidence = actionable.filter((l) => l.confidence < CONFIDENCE_THRESHOLD);

  return (
    <div className="glass-panel flex flex-col gap-4 p-5">
      {actionable.length === 0 ? (
        <p className="text-sm text-zinc-400">Onay bekleyen öneri yok.</p>
      ) : (
        <>
          {highConfidence.length > 0 && (
            <LinkGroup title="Öneriler" links={highConfidence} onConfirm={onConfirm} onReject={onReject} pending={pending} />
          )}
          {lowConfidence.length > 0 && (
            <LinkGroup
              title="Düşük güvenli öneriler"
              links={lowConfidence}
              onConfirm={onConfirm}
              onReject={onReject}
              pending={pending}
              muted
            />
          )}
        </>
      )}
    </div>
  );
}

function LinkGroup({
  title,
  links,
  onConfirm,
  onReject,
  pending,
  muted,
}: LinkReviewPanelProps & { title: string; muted?: boolean }) {
  return (
    <div>
      <h3 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${muted ? "text-zinc-500" : "text-zinc-300"}`}>
        {title} ({links.length})
      </h3>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li
            key={link.id}
            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
              muted ? "border-white/5 bg-white/2 text-zinc-500" : "border-white/10 bg-white/5 text-zinc-200"
            }`}
          >
            <span className="truncate">
              {link.state === "stale" && <span className="mr-1 text-amber-400">↻</span>}
              <strong className="text-white">{link.figmaNodeId}</strong> → {link.dbTableName}.{link.dbColumnName}
              <span className="ml-2 text-xs text-zinc-500">{Math.round(link.confidence * 100)}%</span>
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={pending.has(link.id)}
                onClick={() => onConfirm(link.id)}
                className="rounded-full bg-emerald-500/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Onayla
              </button>
              <button
                type="button"
                disabled={pending.has(link.id)}
                onClick={() => onReject(link.id)}
                className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/20 disabled:opacity-50"
              >
                Reddet
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
