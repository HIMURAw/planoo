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
  columnName: string;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<RoadmapItemView>) => void;
  onDelete: (id: string) => void;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "az önce";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dakika önce`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} saat önce`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} gün önce`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export function RoadmapCardModal({ item, columnName, onClose, onUpdate, onDelete }: RoadmapCardModalProps) {
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

  const orderedComments = [...comments].reverse(); // newest first, Trello-style

  return (
    <div className={`modal-overlay${isClosing ? " closing" : ""}`} onClick={onClose}>
      <div
        className={`modal-panel modal-panel-lg${isClosing ? " closing" : ""} max-h-[85vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: small card icon + title + close */}
        <div className="flex items-start gap-3">
          <div className="mt-1 w-6 h-6 rounded-md bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="w-full bg-transparent text-lg font-bold text-white placeholder-zinc-500 focus:outline-none rounded px-1 -mx-1 focus:bg-white/5 transition-colors"
            />
            <p className="text-xs text-zinc-500 mt-0.5 px-1">
              <span className="font-medium text-zinc-400">{columnName}</span> listesinde
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-zinc-500 hover:text-white transition-colors mt-0.5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Property pills: label + due date */}
        <div className="flex flex-wrap gap-4 mt-4 mb-6 ml-9">
          <div>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Etiket</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleLabelBlur}
              placeholder="+ Etiket ekle"
              className={`text-xs font-medium px-2.5 py-1.5 rounded-full border focus:outline-none transition-colors placeholder-zinc-500 ${
                label
                  ? "bg-violet-500/15 text-violet-300 border-violet-500/30 focus:border-violet-400"
                  : "bg-white/5 text-zinc-400 border-white/10 focus:border-violet-500/50 hover:bg-white/[0.07]"
              }`}
              style={{ width: `${Math.max(label.length || 12, 10) + 3}ch` }}
            />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Tarih</span>
            <div
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
                dueDate
                  ? "bg-white/10 text-zinc-200 border-white/15"
                  : "bg-white/5 text-zinc-400 border-white/10"
              }`}
            >
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="bg-transparent focus:outline-none [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="ml-9 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            <h4 className="text-sm font-semibold text-zinc-300">Açıklama</h4>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Daha detaylı bir açıklama ekle..."
            className="w-full bg-white/5 hover:bg-white/[0.07] focus:bg-white/[0.07] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 transition-colors resize-none h-24"
          />
        </div>

        {/* Activity / comments */}
        <div className="ml-9">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h4 className="text-sm font-semibold text-zinc-300">
              Yorumlar {comments.length > 0 && <span className="text-zinc-600 font-normal">({comments.length})</span>}
            </h4>
          </div>

          <div className="flex gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5">
              S
            </div>
            <div className="flex-1 min-w-0">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                placeholder="Bir yorum yaz..."
                className="w-full bg-white/5 hover:bg-white/[0.07] focus:bg-white/[0.07] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 transition-colors resize-none h-16"
              />
              {newComment.trim() && (
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={isPostingComment}
                  className="mt-2 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 rounded-lg transition-all disabled:opacity-50"
                >
                  {isPostingComment ? "Kaydediliyor..." : "Kaydet"}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {commentsLoading ? (
              <p className="text-xs text-zinc-500 ml-9">Yükleniyor...</p>
            ) : orderedComments.length === 0 ? (
              <p className="text-xs text-zinc-600 italic ml-9">Henüz yorum yok.</p>
            ) : (
              orderedComments.map((comment) => (
                <div key={comment.id} className="flex gap-2.5 group">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-bold text-zinc-300 shrink-0">
                    S
                  </div>
                  <div className="flex-1 min-w-0 bg-white/5 rounded-xl rounded-tl-sm px-3 py-2">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-medium text-zinc-300">Sen</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-zinc-500">{formatRelativeTime(comment.createdAt)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all text-[11px]"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">{comment.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="ml-9 flex items-center justify-end pt-5 mt-5 border-t border-white/5">
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
          >
            Kartı Sil
          </button>
        </div>
      </div>
    </div>
  );
}
