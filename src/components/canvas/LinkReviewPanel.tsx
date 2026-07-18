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

  if (actionable.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Onay bekleyen öneri yok.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
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
      <h3 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${muted ? "text-zinc-400" : "text-zinc-600 dark:text-zinc-300"}`}>
        {title} ({links.length})
      </h3>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li
            key={link.id}
            className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
              muted
                ? "border-zinc-100 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <span className="truncate">
              {link.state === "stale" && <span className="mr-1 text-amber-600">↻</span>}
              <strong>{link.figmaNodeId}</strong> → {link.dbTableName}.{link.dbColumnName}
              <span className="ml-2 text-xs text-zinc-400">{Math.round(link.confidence * 100)}%</span>
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={pending.has(link.id)}
                onClick={() => onConfirm(link.id)}
                className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Onayla
              </button>
              <button
                type="button"
                disabled={pending.has(link.id)}
                onClick={() => onReject(link.id)}
                className="rounded bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-200"
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
