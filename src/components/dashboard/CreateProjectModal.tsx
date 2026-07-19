"use client";

import { useState } from "react";

export interface CreateProjectFormData {
  name: string;
  description?: string;
  githubRepo?: string;
  figmaFileKey?: string;
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectFormData) => Promise<{ ok: boolean; message?: string }>;
  planName: string;
  projectLimit: number | null;
  projectCount: number;
}

const EMPTY_FORM = { name: "", description: "", githubRepo: "", figmaFileKey: "" };

export function CreateProjectModal({
  isOpen,
  onClose,
  onSubmit,
  planName,
  projectLimit,
  projectCount,
}: CreateProjectModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const limitReached = projectLimit !== null && projectCount >= projectLimit;

  function close() {
    setForm(EMPTY_FORM);
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || limitReached) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        githubRepo: form.githubRepo.trim() || undefined,
        figmaFileKey: form.figmaFileKey.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.message ?? "Proje oluşturulamadı.");
        return;
      }
      close();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="glass-panel w-full max-w-md relative z-10 border border-white/10 shadow-2xl p-6 rounded-2xl">
        <h3 className="text-xl font-bold text-white mb-1">Yeni Proje Oluştur</h3>
        <p className="text-sm text-zinc-400 mb-6">
          Projeniz için bir isim girin. GitHub reposu ve Figma dosyası isteğe bağlıdır, sonradan da eklenebilir.
        </p>

        {limitReached && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">
            {planName} planında en fazla {projectLimit} proje oluşturabilirsin. Daha fazla proje için planını yükselt.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Proje Adı</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              placeholder="Örn: E-ticaret Paneli"
              autoFocus
              disabled={limitReached}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Açıklama (Opsiyonel)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all resize-none h-20"
              placeholder="Proje hakkında kısa bir açıklama..."
              disabled={limitReached}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">GitHub Reposu (Opsiyonel)</label>
            <input
              type="text"
              value={form.githubRepo}
              onChange={(e) => setForm((f) => ({ ...f, githubRepo: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              placeholder="https://github.com/kullanici/repo"
              disabled={limitReached}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Figma Dosya Anahtarı (Opsiyonel)</label>
            <input
              type="text"
              value={form.figmaFileKey}
              onChange={(e) => setForm((f) => ({ ...f, figmaFileKey: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              placeholder="Figma dosya linkindeki anahtar"
              disabled={limitReached}
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={close} className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors">
              İptal
            </button>
            <button
              type="submit"
              disabled={!form.name.trim() || isSubmitting || limitReached}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 rounded-lg transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Oluşturuluyor..." : "Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
