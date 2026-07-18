"use client";

import { useState, useEffect } from "react";
import { type ProjectView } from "./DashboardLayout";

export interface RoadmapItemView {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  order: number;
}

interface RoadmapPanelProps {
  project: ProjectView | null;
}

export function RoadmapPanel({ project }: RoadmapPanelProps) {
  const [items, setItems] = useState<RoadmapItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState<"todo" | "in_progress" | "done" | null>(null);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    if (!project) return;
    const fetchItems = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/roadmap?projectId=${project.id}`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (err) {
        console.error("Roadmap fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [project]);

  const handleAddItem = async (status: "todo" | "in_progress" | "done") => {
    if (!newTitle.trim() || !project) return;
    
    // Optimistic UI
    const newItem: RoadmapItemView = {
      id: Math.random().toString(),
      title: newTitle,
      description: null,
      status,
      order: items.length
    };
    setItems([...items, newItem]);
    setIsAdding(null);
    setNewTitle("");

    try {
      const res = await fetch('/api/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, title: newTitle, status })
      });
      if (res.ok) {
        const data = await res.json();
        setItems(prev => prev.map(i => i.id === newItem.id ? data.item : i));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (id: string, newStatus: "todo" | "in_progress" | "done") => {
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
          Roadmap
        </h1>
        <p className="text-sm text-zinc-400">
          Projenizin geliştirme sürecini ve görevlerini takip edin.
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
            
          return (
            <div key={col.id} className={`w-80 flex-shrink-0 flex flex-col glass-panel rounded-2xl border ${borderColor} overflow-hidden`}>
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
                ) : colItems.map(item => (
                  <div key={item.id} className="bg-white/5 hover:bg-white/[0.07] border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all group cursor-pointer shadow-sm">
                    <h4 className="text-sm font-medium text-white mb-2">{item.title}</h4>
                    {item.description && (
                      <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{item.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="text-xs text-zinc-500">Durum Değiştir:</div>
                      <div className="flex gap-1">
                        {col.id !== "todo" && (
                          <button onClick={() => handleStatusChange(item.id, "todo")} className="p-1 rounded bg-zinc-500/20 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-500/40" title="Yapılacaklar">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                          </button>
                        )}
                        {col.id !== "in_progress" && (
                          <button onClick={() => handleStatusChange(item.id, "in_progress")} className="p-1 rounded bg-amber-500/20 text-amber-400 hover:text-amber-300 hover:bg-amber-500/40" title="Devam Ediyor">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                          </button>
                        )}
                        {col.id !== "done" && (
                          <button onClick={() => handleStatusChange(item.id, "done")} className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/40" title="Tamamlandı">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
