"use client";

import { useState } from "react";
import { type ProjectView } from "./DashboardLayout";

interface ProjectSelectorProps {
  projects: ProjectView[];
  activeProject: ProjectView | null;
  onProjectChange: (projectId: string) => void;
  onProjectCreate: (name: string, description?: string) => Promise<void>;
}

export function ProjectSelector({ projects, activeProject, onProjectChange, onProjectCreate }: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    try {
      setIsSubmitting(true);
      await onProjectCreate(newProjectName, newProjectDesc);
      setIsNewModalOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
    } finally {
      setIsSubmitting(false);
      setIsOpen(false);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
        >
          <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-zinc-200">
            {activeProject ? activeProject.name : "Proje Seçin"}
          </span>
          <svg className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 mt-2 w-64 glass-panel border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-96">
              <div className="p-2 overflow-y-auto">
                <div className="px-2 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Projelerim</div>
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onProjectChange(p.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2
                      ${activeProject?.id === p.id ? 'bg-violet-500/10 text-violet-300' : 'text-zinc-300 hover:bg-white/5'}
                    `}
                  >
                    <svg className={`w-4 h-4 ${activeProject?.id === p.id ? 'text-violet-400' : 'text-zinc-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
                {projects.length === 0 && (
                  <div className="px-3 py-2 text-sm text-zinc-500 italic">Henüz proje yok</div>
                )}
              </div>
              <div className="p-2 border-t border-white/5 bg-white/[0.02]">
                <button
                  onClick={() => setIsNewModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 rounded-lg transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Yeni Proje
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsNewModalOpen(false)} />
          <div className="glass-panel w-full max-w-md relative z-10 border border-white/10 shadow-2xl p-6 rounded-2xl">
            <h3 className="text-xl font-bold text-white mb-1">Yeni Proje Oluştur</h3>
            <p className="text-sm text-zinc-400 mb-6">Projeniz için bir isim ve açıklama girin.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Proje Adı</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  placeholder="Örn: E-ticaret Paneli"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Açıklama (Opsiyonel)</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all resize-none h-24"
                  placeholder="Proje hakkında kısa bir açıklama..."
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleCreate}
                disabled={!newProjectName.trim() || isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 rounded-lg transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Oluşturuluyor...' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
