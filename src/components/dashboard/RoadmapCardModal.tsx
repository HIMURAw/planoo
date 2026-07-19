"use client";

import { useEffect, useState } from "react";
import { useModalAnimation } from "@/lib/useModalAnimation";
import type { RoadmapItemView } from "./RoadmapPanel";

export interface RoadmapCommentView {
  id: string;
  text: string;
  createdAt: string;
}

interface RoadmapCardModalProps {
  item: RoadmapItemView | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<RoadmapItemView>) => void;
  onDelete: (id: string) => void;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function RoadmapCardModal({ item, onClose, onUpdate, onDelete }: RoadmapCardModalProps) {
  const isOpen = item !== null;
  const { shouldRender, isClosing } = useModalAnimation(isOpen);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [comments, setComments] = useState<RoadmapCommentView[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [loadedItemId, setLoadedItemId] = useState<string | null>(null);

  // Sync local editable fields whenever a (different) card is opened.
  // Adjusted directly during render — same reasoning as useModalAnimation —
  // rather than in an effect, since the fields must be right before paint.
  if (item && item.id !== loadedItemId) {
    setLoadedItemId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setLabel(item.label ?? "");
    setDueDate(item.dueDate ? item.dueDate.slice(0, 10) : "");
  } else if (!item && loadedItemId !== null) {
    // Reset so reopening the same card later re-syncs from the latest
    // parent state instead of showing whatever was last typed here.
    setLoadedItemId(null);
  }

  // Comments are a genuine async fetch, so they stay in an effect — but
  // scoped to a nested function so the loading-state resets aren't direct
  // top-level setState calls in the effect body (same pattern already used
  // by RoadmapPanel's item-list fetch).
  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    async function loadComments(itemId: string) {
      setComments([]);
      setCommentsLoading(true);
      try {
        const res = await fetch(`/api/roadmap/${itemId}/comments`);
        const data = res.ok ? await res.json() : { comments: [] };
        if (!cancelled) setComments(data.comments ?? []);
      } catch {
        if (!cancelled) setComments([]);
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    }
    loadComments(item.id);
    return () => {
      cancelled = true;
    };
  }, [item?.id]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!shouldRender || !item) return null;

  function patch(updates: Partial<RoadmapItemView> & { dueDate?: string | null }) {
    if (!item) return;
    onUpdate(item.id, updates);
    fetch(`/api/roadmap/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  }

  function handleTitleBlur() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === item!.title) {
      setTitle(item!.title);
      return;
    }
    patch({ title: trimmed });
  }

  function handleDescriptionBlur() {
    if (description === (item!.description ?? "")) return;
    patch({ description });
  }

  function handleLabelBlur() {
    if (label === (item!.label ?? "")) return;
    patch({ label: label.trim() || null });
  }

  function handleDueDateChange(value: string) {
    setDueDate(value);
    patch({ dueDate: value || null });
  }

  async function handleAddComment() {
    const text = newComment.trim();
    if (!text || !item) return;
    setIsPostingComment(true);
    try {
      const res = await fetch(`/api/roadmap/${item.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setNewComment("");
      }
    } finally {
      setIsPostingComment(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!item) return;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    await fetch(`/api/roadmap/${item.id}/comments/${commentId}`, { method: "DELETE" });
  }

  function handleDelete() {
    if (!item) return;
    if (!window.confirm(`"${item.title}" kartını silmek istediğine emin misin?`)) return;
    onDelete(item.id);
    onClose();
  }

  return (
    <div className={`modal-overlay${isClosing ? " closing" : ""}`} onClick={onClose}>
      <div
        className={`modal-panel modal-panel-lg${isClosing ? " closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="flex-1 bg-transparent text-lg font-bold text-white placeholder-zinc-500 focus:outline-none border-b border-transparent focus:border-violet-500/50 transition-colors"
          />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-zinc-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Etiket</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleLabelBlur}
              placeholder="Örn: Bug, İyileştirme..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Tarih</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Açıklama</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Kart hakkında açıklama ekle..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors resize-none h-20"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-400 mb-2">
            Yorumlar {comments.length > 0 && <span className="text-zinc-600">({comments.length})</span>}
          </label>
          <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
            {commentsLoading ? (
              <p className="text-xs text-zinc-500">Yükleniyor...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">Henüz yorum yok.</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="group bg-white/5 border border-white/5 rounded-lg px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">{comment.text}</p>
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="shrink-0 text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">{formatDateTime(comment.createdAt)}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              placeholder="Yorum ekle..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleAddComment}
              disabled={!newComment.trim() || isPostingComment}
              className="shrink-0 px-3 py-1.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ekle
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-white/5">
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm text-red-400/70 hover:text-red-400 transition-colors"
          >
            Kartı Sil
          </button>
        </div>
      </div>
    </div>
  );
}
