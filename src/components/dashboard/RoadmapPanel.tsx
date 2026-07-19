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
  columnId: string;
  title: string;
  description: string | null;
  label: string | null;
  dueDate: string | null;
  order: number;
}

export interface RoadmapColumnView {
  id: string;
  clientKey: string;
  name: string;
  order: number;
}

interface RoadmapPanelProps {
  project: ProjectView | null;
}

// Card/column entrance + reposition animations live on their own timers
// (see globals.css .card-enter) rather than being folded into the FLIP
// effects below — a freshly mounted element has no previous rect yet, so
// FLIP already skips it, meaning there's no conflict between the two.
const ENTER_ANIMATION_MS = 400;

export function RoadmapPanel({ project }: RoadmapPanelProps) {
  const [columns, setColumns] = useState<RoadmapColumnView[]>([]);
  const [items, setItems] = useState<RoadmapItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ column: string; index: number } | null>(null);
  const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null);
  const [columnDropIndex, setColumnDropIndex] = useState<number | null>(null);
  const [justAddedKeys, setJustAddedKeys] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<RoadmapItemView | null>(null);

  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRectsRef = useRef(new Map<string, DOMRect>());
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const prevColumnRectsRef = useRef(new Map<string, DOMRect>());

  function setCardRef(clientKey: string, el: HTMLDivElement | null) {
    if (el) cardRefs.current.set(clientKey, el);
    else cardRefs.current.delete(clientKey);
  }
  function setColumnRef(clientKey: string, el: HTMLDivElement | null) {
    if (el) columnRefs.current.set(clientKey, el);
    else columnRefs.current.delete(clientKey);
  }

  // FLIP animation for cards: a drop reorders `items`, which re-renders
  // every card at its new DOM position instantly — without this, cards
  // visibly teleport instead of gliding there.
  useLayoutEffect(() => {
    const newRects = new Map<string, DOMRect>();
    cardRefs.current.forEach((el, key) => newRects.set(key, el.getBoundingClientRect()));
    cardRefs.current.forEach((el, key) => {
      const prev = prevRectsRef.current.get(key);
      const next = newRects.get(key);
      if (!prev || !next) return;
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.getBoundingClientRect();
      requestAnimationFrame(() => {
        el.style.transition = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
      });
    });
    prevRectsRef.current = newRects;
  }, [items]);

  // Same FLIP technique for columns being reordered horizontally.
  useLayoutEffect(() => {
    const newRects = new Map<string, DOMRect>();
    columnRefs.current.forEach((el, key) => newRects.set(key, el.getBoundingClientRect()));
    columnRefs.current.forEach((el, key) => {
      const prev = prevColumnRectsRef.current.get(key);
      const next = newRects.get(key);
      if (!prev || !next) return;
      const dx = prev.left - next.left;
      if (Math.abs(dx) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, 0)`;
      el.getBoundingClientRect();
      requestAnimationFrame(() => {
        el.style.transition = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
      });
    });
    prevColumnRectsRef.current = newRects;
  }, [columns]);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    async function load(projectId: string) {
      setLoading(true);
      try {
        const [colsRes, itemsRes] = await Promise.all([
          fetch(`/api/roadmap/columns?projectId=${projectId}`),
          fetch(`/api/roadmap?projectId=${projectId}`),
        ]);
        if (cancelled) return;
        if (colsRes.ok) {
          const data = await colsRes.json();
          const loaded: RoadmapColumnView[] = (data.columns ?? []).map((c: Omit<RoadmapColumnView, "clientKey">) => ({
            ...c,
            clientKey: c.id,
          }));
          setColumns(loaded);
        }
        if (itemsRes.ok) {
          const data = await itemsRes.json();
          const loaded: RoadmapItemView[] = (data.items ?? []).map((i: Omit<RoadmapItemView, "clientKey">) => ({
            ...i,
            clientKey: i.id,
          }));
          setItems(loaded);
        }
      } catch (err) {
        console.error("Roadmap fetch error", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load(project.id);
    return () => {
      cancelled = true;
    };
  }, [project]);

  const handleAddItem = async (columnId: string) => {
    if (!newTitle.trim() || !project) return;

    const clientKey = crypto.randomUUID();
    const newItem: RoadmapItemView = {
      id: clientKey,
      clientKey,
      columnId,
      title: newTitle,
      description: null,
      label: null,
      dueDate: null,
      order: items.filter((i) => i.columnId === columnId).length,
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
        body: JSON.stringify({ projectId: project.id, columnId, title: newTitle })
      });
      if (res.ok) {
        const data = await res.json();
        setItems(prev => prev.map(i => i.clientKey === clientKey ? { ...data.item, clientKey } : i));
      }
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

  function handleCardDragOver(e: React.DragEvent, column: string, index: number) {
    if (draggedColumnKey) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const isAfter = e.clientY > rect.top + rect.height / 2;
    setDropTarget({ column, index: isAfter ? index + 1 : index });
  }

  function handleColumnBodyDragOver(e: React.DragEvent, column: string, columnLength: number) {
    if (draggedColumnKey) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget((prev) => (prev?.column === column ? prev : { column, index: columnLength }));
  }

  function handleDrop(e: React.DragEvent, column: string) {
    if (draggedColumnKey) return;
    e.preventDefault();
    const id = draggedId;
    const target = dropTarget;
    setDraggedId(null);
    setDropTarget(null);
    if (!id || !target) return;

    // Compute the new array from the current `items` closure (not a setState
    // functional updater) so the fetch() calls below can live outside it —
    // React 18/19 Strict Mode double-invokes updater functions in dev to
    // catch impure ones, which was silently firing every PATCH here twice
    // (confirmed via duplicate request log entries for the same item).
    const dragged = items.find((i) => i.id === id);
    if (!dragged) return;

    const rest = items.filter((i) => i.id !== id);
    const columnItems = rest.filter((i) => i.columnId === column).sort((a, b) => a.order - b.order);
    const otherItems = rest.filter((i) => i.columnId !== column);

    const insertAt = Math.min(target.index, columnItems.length);
    columnItems.splice(insertAt, 0, { ...dragged, columnId: column });

    const renumbered = columnItems.map((item, idx) => ({ ...item, order: idx }));

    setItems([...otherItems, ...renumbered]);

    for (const item of renumbered) {
      const original = items.find((p) => p.id === item.id);
      if (!original || original.columnId !== item.columnId || original.order !== item.order) {
        fetch(`/api/roadmap/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnId: item.columnId, order: item.order }),
        });
      }
    }
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDropTarget(null);
  }

  function handleColumnDragOver(e: React.DragEvent, targetIndex: number) {
    if (!draggedColumnKey) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setColumnDropIndex(targetIndex);
  }

  function handleColumnDrop(e: React.DragEvent) {
    if (!draggedColumnKey || columnDropIndex === null) return;
    e.preventDefault();
    const key = draggedColumnKey;
    const targetIdx = columnDropIndex;
    setDraggedColumnKey(null);
    setColumnDropIndex(null);

    // See the matching comment in handleDrop: computed from the `columns`
    // closure rather than inside a setColumns functional updater, so the
    // fetch() calls below aren't at risk of Strict Mode's dev-time double
    // invocation of impure updaters.
    const dragged = columns.find((c) => c.clientKey === key);
    if (!dragged) return;
    const rest = columns.filter((c) => c.clientKey !== key);
    const insertAt = Math.min(targetIdx, rest.length);
    rest.splice(insertAt, 0, dragged);
    const renumbered = rest.map((c, idx) => ({ ...c, order: idx }));

    setColumns(renumbered);

    for (const col of renumbered) {
      const original = columns.find((p) => p.clientKey === col.clientKey);
      if (!original || original.order !== col.order) {
        fetch(`/api/roadmap/columns/${col.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: col.order }),
        });
      }
    }
  }

  function handleColumnDragEnd() {
    setDraggedColumnKey(null);
    setColumnDropIndex(null);
  }

  async function handleAddColumn(e: React.FormEvent) {
    e.preventDefault();
    const name = newColumnName.trim();
    if (!name || !project) return;
    setNewColumnName("");
    setIsAddingColumn(false);

    try {
      const res = await fetch("/api/roadmap/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, name }),
      });
      if (res.ok) {
        const data = await res.json();
        setColumns((prev) => [...prev, { ...data.column, clientKey: data.column.id }]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function startEditingColumn(col: RoadmapColumnView) {
    setEditingColumnId(col.id);
    setEditingColumnName(col.name);
  }

  function commitColumnRename() {
    const id = editingColumnId;
    const name = editingColumnName.trim();
    setEditingColumnId(null);
    if (!id) return;
    const original = columns.find((c) => c.id === id);
    if (!name || name === original?.name) return;
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    fetch(`/api/roadmap/columns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  function handleDeleteColumn(col: RoadmapColumnView) {
    const cardCount = items.filter((i) => i.columnId === col.id).length;
    const message =
      cardCount > 0
        ? `"${col.name}" listesini silmek istediğine emin misin? İçindeki ${cardCount} kart da silinecek.`
        : `"${col.name}" listesini silmek istediğine emin misin?`;
    if (!window.confirm(message)) return;
    setColumns((prev) => prev.filter((c) => c.id !== col.id));
    setItems((prev) => prev.filter((i) => i.columnId !== col.id));
    fetch(`/api/roadmap/columns/${col.id}`, { method: "DELETE" });
  }

  if (!project) return null;

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
          Kartları sürükleyerek listesini veya sırasını, liste başlığını sürükleyerek listenin kendi sırasını değiştirebilir; bir karta tıklayarak detaylarını düzenleyebilirsiniz.
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">Yükleniyor...</div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4 min-h-0 items-start">
          {columns.map((col, colIndex) => {
            const colItems = items.filter(i => i.columnId === col.id).sort((a, b) => a.order - b.order);
            const isDropColumn = dropTarget?.column === col.id;
            const isColumnDropTarget = draggedColumnKey && draggedColumnKey !== col.clientKey && columnDropIndex === colIndex;

            return (
              <div key={col.clientKey} className="relative flex-shrink-0">
                {isColumnDropTarget && (
                  <div className="absolute -left-2.5 top-0 bottom-0 w-1 rounded-full bg-violet-400/70" />
                )}
                <div
                  ref={(el) => setColumnRef(col.clientKey, el)}
                  onDragOver={(e) => {
                    handleColumnDragOver(e, colIndex);
                    handleColumnBodyDragOver(e, col.id, colItems.length);
                  }}
                  onDrop={(e) => {
                    handleColumnDrop(e);
                    handleDrop(e, col.id);
                  }}
                  className={`w-80 flex flex-col glass-panel rounded-2xl border transition-colors ${isDropColumn ? "border-violet-400/50 bg-violet-500/[0.03]" : "border-white/5"} ${draggedColumnKey === col.clientKey ? "opacity-40" : ""} overflow-hidden`}
                >
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      setDraggedColumnKey(col.clientKey);
                    }}
                    onDragEnd={handleColumnDragEnd}
                    className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between cursor-grab active:cursor-grabbing group/header"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {editingColumnId === col.id ? (
                        <input
                          autoFocus
                          value={editingColumnName}
                          onChange={(e) => setEditingColumnName(e.target.value)}
                          onBlur={commitColumnRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitColumnRename();
                            if (e.key === "Escape") setEditingColumnId(null);
                          }}
                          className="nodrag bg-white/10 border border-violet-500/50 rounded px-2 py-0.5 text-sm font-semibold text-white focus:outline-none min-w-0"
                        />
                      ) : (
                        <span
                          onClick={() => startEditingColumn(col)}
                          className="font-semibold text-zinc-200 truncate cursor-text hover:bg-white/5 rounded px-1 -mx-1"
                          title="Yeniden adlandırmak için tıkla"
                        >
                          {col.name}
                        </span>
                      )}
                      <span className="text-xs py-0.5 px-2 bg-white/10 rounded-full text-zinc-300 shrink-0">
                        {colItems.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => setIsAdding(col.id)}
                        className="p-1 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white"
                        title="Kart ekle"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteColumn(col)}
                        className="p-1 hover:bg-red-500/10 rounded-md transition-colors text-zinc-400 hover:text-red-400"
                        title="Listeyi sil"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-[80px]">
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

                    {colItems.length === 0 && !isDropColumn && isAdding !== col.id && (
                      <button
                        onClick={() => setIsAdding(col.id)}
                        className="w-full text-center py-8 text-xs text-zinc-600 hover:text-zinc-400 border border-dashed border-white/5 hover:border-white/10 rounded-xl transition-colors"
                      >
                        + Kart ekle
                      </button>
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
                          {(item.label || item.dueDate) && (
                            <div className="flex items-center gap-1.5 flex-wrap mb-2">
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
                          <h4 className="text-sm font-medium text-white">{item.title}</h4>
                          {item.description && (
                            <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{item.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {isDropColumn && dropTarget?.index === colItems.length && (
                      <div className="h-1 rounded-full bg-violet-400/70" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="w-72 flex-shrink-0">
            {isAddingColumn ? (
              <form onSubmit={handleAddColumn} className="glass-panel rounded-2xl border border-white/10 p-3">
                <input
                  autoFocus
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setIsAddingColumn(false)}
                  placeholder="Liste adı..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 mb-2"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!newColumnName.trim()}
                    className="text-xs font-medium bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Liste Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsAddingColumn(false); setNewColumnName(""); }}
                    className="text-xs text-zinc-400 hover:text-white px-2 py-1.5"
                  >
                    İptal
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setIsAddingColumn(true)}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-white/10 hover:border-white/20 hover:bg-white/[0.02] text-sm text-zinc-400 hover:text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Yeni Liste Ekle
              </button>
            )}
          </div>
        </div>
      )}

      <RoadmapCardModal
        item={selectedItem}
        columnName={columns.find((c) => c.id === selectedItem?.columnId)?.name ?? ""}
        onClose={() => setSelectedItem(null)}
        onUpdate={handleCardUpdate}
        onDelete={handleCardDelete}
      />
    </div>
  );
}
