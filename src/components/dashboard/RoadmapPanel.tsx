"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { type ProjectView } from "./DashboardLayout";
import { RoadmapCardModal } from "./RoadmapCardModal";

export interface RoadmapItemView {
  id: string;
  // Stable for the lifetime of the card in this session, unlike `id` — a
  // freshly created card is rendered with a temporary client-side id before
  // the POST resolves, then `id` is swapped for the real database id. If
  // React's reconciliation `key` were `id` directly, that swap would look
  // like the old element unmounting and a new one mounting, which silently
  // cuts off (or restarts mid-flight) any CSS animation/transition running
  // on it — including the entrance animation this field exists to protect
  // and the FLIP drag-reorder transition.
  clientKey: string;
  title: string;
  description: string | null;
  label: string | null;
  dueDate: string | null;
  status: "todo" | "in_progress" | "done";
  order: number;
}

interface RoadmapPanelProps {
  project: ProjectView | null;
}

type ColumnId = "todo" | "in_progress" | "done";

// Card entrance animation lives on its own timer (see globals.css
// .card-enter) rather than piggybacking on the FLIP effect below — a
// freshly mounted card has no previous rect yet, so FLIP already skips it,
// meaning there's no conflict between the two.
const ENTER_ANIMATION_MS = 400;

export function RoadmapPanel({ project }: RoadmapPanelProps) {
  const [items, setItems] = useState<RoadmapItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState<ColumnId | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ column: ColumnId; index: number } | null>(null);
  const [justAddedKeys, setJustAddedKeys] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<RoadmapItemView | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRectsRef = useRef(new Map<string, DOMRect>());

  function setCardRef(clientKey: string, el: HTMLDivElement | null) {
    if (el) cardRefs.current.set(clientKey, el);
    else cardRefs.current.delete(clientKey);
  }

  // FLIP animation: a drop reorders `items`, which re-renders every card at
  // its new DOM position instantly — without this, cards visibly teleport
  // instead of gliding there. Runs after every items change (not just
  // drops): compare each card's rect now against the rect captured last
  // time, and if it moved, play the transition from the old spot to the new
  // one. Cards with no previous rect (freshly mounted) are left alone so
  // newly added items don't animate in from some arbitrary origin.
  useLayoutEffect(() => {
    const newRects = new Map<string, DOMRect>();
    cardRefs.current.forEach((el, id) => {
      newRects.set(id, el.getBoundingClientRect());
    });

    cardRefs.current.forEach((el, id) => {
      const prev = prevRectsRef.current.get(id);
      const next = newRects.get(id);
      if (!prev || !next) return;
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.getBoundingClientRect(); // force a reflow so the transform above is committed before...
      requestAnimationFrame(() => {
        el.style.transition = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
      });
    });

    prevRectsRef.current = newRects;
  }, [items]);

  useEffect(() => {
    if (!project) return;
    const fetchItems = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/roadmap?projectId=${project.id}`);
        if (res.ok) {
          const data = await res.json();
          const loaded: RoadmapItemView[] = (data.items ?? []).map((item: Omit<RoadmapItemView, "clientKey">) => ({
            ...item,
            clientKey: item.id,
          }));
          setItems(loaded);
        }
      } catch (err) {
        console.error("Roadmap fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [project]);

  const handleAddItem = async (status: ColumnId) => {
    if (!newTitle.trim() || !project) return;

    // Optimistic UI. clientKey stays fixed even once `id` below is swapped
    // for the real database id once the POST resolves.
    const clientKey = crypto.randomUUID();
    const newItem: RoadmapItemView = {
      id: clientKey,
      clientKey,
      title: newTitle,
      description: null,
      label: null,
      dueDate: null,
      status,
      order: items.length
    };
    setItems([...items, newItem]);
    setIsAdding(null);
    setNewTitle("");

    setJustAddedKeys((prev) => new Set(prev).add(clientKey));
    setTimeout(() => {
      setJustAddedKeys((prev) => {
        const next = new Set(prev);
        next.delete(clientKey);
        return next;
      });
    }, ENTER_ANIMATION_MS);

    try {
      const res = await fetch('/api/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, title: newTitle, status })
      });
      if (res.ok) {
        const data = await res.json();
        setItems(prev => prev.map(i => i.clientKey === clientKey ? { ...data.item, clientKey } : i));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (id: string, newStatus: ColumnId) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));

    try {
      await fetch(`/api/roadmap/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (err) {
      console.error(err);
    }
  };

  function handleCardUpdate(id: string, updates: Partial<RoadmapItemView>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    setSelectedItem((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev));
  }

  function handleCardDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    fetch(`/api/roadmap/${id}`, { method: "DELETE" });
  }

  function handleCardDragOver(e: React.DragEvent, column: ColumnId, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const isAfter = e.clientY > rect.top + rect.height / 2;
    setDropTarget({ column, index: isAfter ? index + 1 : index });
  }

  function handleColumnDragOver(e: React.DragEvent, column: ColumnId, columnLength: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // Only over empty space below the last card — per-card handler owns
    // anything above that.
    setDropTarget((prev) => (prev?.column === column ? prev : { column, index: columnLength }));
  }

  function handleDrop(e: React.DragEvent, column: ColumnId) {
    e.preventDefault();
    const id = draggedId;
    const target = dropTarget;
    setDraggedId(null);
    setDropTarget(null);
    if (!id || !target) return;

    setItems((prev) => {
      const dragged = prev.find((i) => i.id === id);
      if (!dragged) return prev;

      const rest = prev.filter((i) => i.id !== id);
      const columnItems = rest.filter((i) => i.status === column).sort((a, b) => a.order - b.order);
      const otherItems = rest.filter((i) => i.status !== column);

      const insertAt = Math.min(target.index, columnItems.length);
      columnItems.splice(insertAt, 0, { ...dragged, status: column });

      const renumbered = columnItems.map((item, idx) => ({ ...item, order: idx }));

      for (const item of renumbered) {
        const original = prev.find((p) => p.id === item.id);
        if (!original || original.status !== item.status || original.order !== item.order) {
          fetch(`/api/roadmap/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: item.status, order: item.order }),
          });
        }
      }

      return [...otherItems, ...renumbered];
    });
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDropTarget(null);
  }

  if (!project) return null;

  const columns = [
    { id: "todo", label: "Yapılacaklar", color: "zinc" },
    { id: "in_progress", label: "Devam Ediyor", color: "amber" },
    { id: "done", label: "Tamamlandı", color: "emerald" }
  ] as const;

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
          <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Yapılacaklar Listesi
        </h1>
        <p className="text-sm text-zinc-400">
          Projenizin geliştirme sürecini ve görevlerini takip edin. Kartları sürükleyerek durumunu veya sırasını değiştirebilir, bir karta tıklayarak detaylarını düzenleyebilirsiniz.
        </p>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 min-h-0">
        {columns.map(col => {
          const colItems = items.filter(i => i.status === col.id).sort((a,b) => a.order - b.order);
          const borderColor =
            col.color === "zinc" ? "border-zinc-500/30" :
            col.color === "amber" ? "border-amber-500/30" :
            "border-emerald-500/30";
          const headerTextColor =
            col.color === "zinc" ? "text-zinc-300" :
            col.color === "amber" ? "text-amber-400" :
            "text-emerald-400";
          const isDropColumn = dropTarget?.column === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleColumnDragOver(e, col.id, colItems.length)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`w-80 flex-shrink-0 flex flex-col glass-panel rounded-2xl border transition-colors ${isDropColumn ? "border-violet-400/50 bg-violet-500/[0.03]" : borderColor} overflow-hidden`}
            >
              <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${headerTextColor}`}>{col.label}</span>
                  <span className="text-xs py-0.5 px-2 bg-white/10 rounded-full text-zinc-300">
                    {colItems.length}
                  </span>
                </div>
                <button
                  onClick={() => setIsAdding(col.id)}
                  className="p-1 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-3">
                {isAdding === col.id && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <input
                      type="text"
                      autoFocus
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddItem(col.id)}
                      placeholder="Görev adı..."
                      className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none mb-3"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setIsAdding(null); setNewTitle(""); }}
                        className="text-xs text-zinc-400 hover:text-white px-2 py-1"
                      >
                        İptal
                      </button>
                      <button
                        onClick={() => handleAddItem(col.id)}
                        className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-md transition-colors"
                      >
                        Ekle
                      </button>
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="text-center py-8 text-sm text-zinc-500">Yükleniyor...</div>
                ) : (
                  <>
                    {colItems.length === 0 && !isDropColumn && (
                      <div className="text-center py-8 text-xs text-zinc-600 border border-dashed border-white/5 rounded-xl">
                        Görev yok
                      </div>
                    )}
                    {colItems.map((item, index) => (
                      <div key={item.clientKey}>
                        {isDropColumn && dropTarget?.index === index && (
                          <div className="h-1 mb-3 rounded-full bg-violet-400/70" />
                        )}
                        <div
                          ref={(el) => setCardRef(item.clientKey, el)}
                          draggable
                          onDragStart={() => setDraggedId(item.id)}
                          onDragOver={(e) => handleCardDragOver(e, col.id, index)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedItem(item)}
                          className={`bg-white/5 hover:bg-white/[0.07] border border-white/5 hover:border-white/10 rounded-xl p-4 transition-colors group cursor-grab active:cursor-grabbing shadow-sm ${draggedId === item.id ? "opacity-40" : ""} ${justAddedKeys.has(item.clientKey) ? "card-enter" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h4 className="text-sm font-medium text-white">{item.title}</h4>
                          </div>
                          {item.description && (
                            <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{item.description}</p>
                          )}
                          {(item.label || item.dueDate) && (
                            <div className="flex items-center gap-2 flex-wrap mb-3">
                              {item.label && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20">
                                  {item.label}
                                </span>
                              )}
                              {item.dueDate && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10 flex items-center gap-1">
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  {new Date(item.dueDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="text-xs text-zinc-500">Durum Değiştir:</div>
                            <div className="flex gap-1">
                              {col.id !== "todo" && (
                                <button onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, "todo"); }} className="p-1 rounded bg-zinc-500/20 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-500/40" title="Yapılacaklar">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                              )}
                              {col.id !== "in_progress" && (
                                <button onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, "in_progress"); }} className="p-1 rounded bg-amber-500/20 text-amber-400 hover:text-amber-300 hover:bg-amber-500/40" title="Devam Ediyor">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                                </button>
                              )}
                              {col.id !== "done" && (
                                <button onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, "done"); }} className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/40" title="Tamamlandı">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {isDropColumn && dropTarget?.index === colItems.length && (
                      <div className="h-1 rounded-full bg-violet-400/70" />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <RoadmapCardModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdate={handleCardUpdate}
        onDelete={handleCardDelete}
      />
    </div>
  );
}
