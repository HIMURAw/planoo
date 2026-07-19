"use client";

import { useState } from "react";
import { type ProjectView, type ActivePanel } from "./DashboardLayout";
import { LinkCanvas } from "@/components/canvas/LinkCanvas";
import { LinkReviewPanel } from "@/components/canvas/LinkReviewPanel";
import type { LinkView } from "@/components/canvas/types";

interface FigmaPanelProps {
  project: ProjectView | null;
  hasFigmaAccount: boolean;
  links: LinkView[];
  onLinksChange: (links: LinkView[]) => void;
  onPanelChange: (panel: ActivePanel) => void;
}

type RecheckStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; isFirstRun: boolean };

export function FigmaPanel({ project, hasFigmaAccount, links, onLinksChange, onPanelChange }: FigmaPanelProps) {
  const [status, setStatus] = useState<RecheckStatus>({ kind: "idle" });
  const [pendingLinkIds, setPendingLinkIds] = useState<Set<string>>(new Set());

  if (!project) return null;

  const hasFigmaConnected = !!project.figmaFileKey && hasFigmaAccount;
  const projectId = project.id;

  async function handleRecheck() {
    setStatus({ kind: "loading" });
    try {
      const response = await fetch("/api/recheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = (await response.json()) as {
        links?: LinkView[];
        isFirstRun?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        setStatus({ kind: "error", message: data.message ?? "Bilinmeyen hata" });
        return;
      }
      onLinksChange(data.links ?? []);
      setStatus({ kind: "success", isFirstRun: Boolean(data.isFirstRun) });
    } catch {
      setStatus({ kind: "error", message: "Ağ hatası — tekrar dene." });
    }
  }

  async function handleLinkAction(id: string, action: "confirm" | "reject") {
    setPendingLinkIds((prev) => new Set(prev).add(id));
    try {
      const response = await fetch(`/api/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as { link?: LinkView };
      if (response.ok && data.link) {
        onLinksChange(links.map((l) => (l.id === id ? data.link! : l)));
      }
    } finally {
      setPendingLinkIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  if (!hasFigmaConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-fuchsia-500/10 rounded-2xl flex items-center justify-center border border-fuchsia-500/20 mb-6">
          <svg className="w-10 h-10 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Figma Dosyası Bağlı Değil</h2>
        <p className="text-zinc-400 max-w-md mx-auto mb-8">
          Figma tasarımlarınızı veritabanı tablolarınızla eşleştirmek için önce proje ayarlarından bir Figma dosyası bağlamanız gerekiyor.
        </p>
        <button
          onClick={() => onPanelChange("settings")}
          className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 rounded-xl transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_20px_rgba(139,92,246,0.5)] flex items-center gap-2"
        >
          Ayarlara Git
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <svg className="w-6 h-6 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Figma Bağlantıları
          </h1>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            Bağlı: {project.figmaFileKey}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRecheck}
            disabled={status.kind === "loading"}
            className="flex items-center gap-2 px-4 py-2 glass-panel text-sm font-medium text-white hover:bg-white/5 transition-colors border border-white/10 hover:border-fuchsia-500/50 rounded-lg disabled:opacity-50"
          >
            <svg className="w-4 h-4 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {status.kind === "loading" ? "Kontrol ediliyor…" : "Yeniden Kontrol Et"}
          </button>
          {status.kind === "success" && (
            <span className="text-sm text-emerald-400">
              {status.isFirstRun ? "İlk kurulum tamamlandı!" : "Kontrol tamamlandı."}
            </span>
          )}
          {status.kind === "error" && (
            <span className="text-sm text-red-400">{status.message}</span>
          )}
        </div>
      </div>

      {links.length === 0 ? (
        <div className="flex-1 glass-panel border-dashed border border-white/10 rounded-2xl flex flex-col items-center justify-center text-center p-12">
          <p className="text-zinc-400">
            Henüz hiç bağlantı yok. Yukarıdaki &quot;Yeniden Kontrol Et&quot; ile ilk taramayı başlat.
          </p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 min-h-0">
          <LinkCanvas links={links} />
          <LinkReviewPanel
            links={links}
            pending={pendingLinkIds}
            onConfirm={(id) => handleLinkAction(id, "confirm")}
            onReject={(id) => handleLinkAction(id, "reject")}
          />
        </div>
      )}
    </div>
  );
}
