"use client";

import { useState } from "react";
import { LinkCanvas } from "./LinkCanvas";
import { LinkReviewPanel } from "./LinkReviewPanel";
import { FigmaFileConnect } from "./FigmaFileConnect";
import { AgentSetup } from "./AgentSetup";
import type { LinkView } from "./types";
import type { PlanTier } from "@prisma/client";

interface DashboardProps {
  userName: string;
  plan: PlanTier;
  hasFigmaAccount: boolean;
  figmaFileKey: string | null;
  hasDbSnapshot: boolean;
  hasAgentKey: boolean;
  initialLinks: LinkView[];
  onSignOut: () => Promise<void>;
}

type RecheckStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; code: string; message: string }
  | { kind: "success"; isFirstRun: boolean };

const PLAN_LABEL: Record<PlanTier, string> = {
  free: "Ücretsiz",
  solo: "Solo Developer",
  team: "Team / Agency",
};

export function Dashboard({
  userName,
  plan,
  hasFigmaAccount,
  figmaFileKey,
  hasDbSnapshot,
  hasAgentKey,
  initialLinks,
  onSignOut,
}: DashboardProps) {
  const [fileKey, setFileKey] = useState(figmaFileKey);
  const [links, setLinks] = useState(initialLinks);
  const [status, setStatus] = useState<RecheckStatus>({ kind: "idle" });
  const [pendingLinkIds, setPendingLinkIds] = useState<Set<string>>(new Set());

  const setupComplete = hasFigmaAccount && fileKey !== null && hasDbSnapshot;

  async function handleRecheck() {
    setStatus({ kind: "loading" });
    try {
      const response = await fetch("/api/recheck", { method: "POST" });
      const data = (await response.json()) as {
        links?: LinkView[];
        isFirstRun?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setStatus({ kind: "error", code: data.error ?? "unknown", message: data.message ?? "Bilinmeyen hata" });
        return;
      }

      setLinks(data.links ?? []);
      setStatus({ kind: "success", isFirstRun: Boolean(data.isFirstRun) });
    } catch {
      setStatus({ kind: "error", code: "network", message: "Ağ hatası — tekrar dene." });
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
        setLinks((prev) => prev.map((l) => (l.id === id ? data.link! : l)));
      }
    } finally {
      setPendingLinkIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <header className="glass-panel flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
            <span className="h-2 w-2 rounded-full bg-linear-to-br from-violet-400 to-blue-400" />
            planoo
          </span>
          <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
            {PLAN_LABEL[plan]}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">Merhaba, {userName}</span>
          <form action={onSignOut}>
            <button type="submit" className="text-sm text-zinc-400 underline hover:text-white">
              Çıkış yap
            </button>
          </form>
        </div>
      </header>

      {plan === "free" && <UpgradeBanner />}

      {!setupComplete ? (
        <SetupSteps
          hasFigmaAccount={hasFigmaAccount}
          fileKey={fileKey}
          hasDbSnapshot={hasDbSnapshot}
          hasAgentKey={hasAgentKey}
          onFigmaFileConnected={setFileKey}
        />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRecheck}
              disabled={status.kind === "loading"}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black shadow-lg shadow-white/10 transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              {status.kind === "loading" ? "Kontrol ediliyor…" : "Yeniden kontrol et"}
            </button>
            <StatusBanner status={status} />
          </div>

          {links.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
              <LinkCanvas links={links} />
              <LinkReviewPanel
                links={links}
                pending={pendingLinkIds}
                onConfirm={(id) => handleLinkAction(id, "confirm")}
                onReject={(id) => handleLinkAction(id, "reject")}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UpgradeBanner() {
  return (
    <div className="glass-panel flex items-center justify-between border-violet-400/30! bg-linear-to-r! from-violet-500/15! to-fuchsia-500/10! px-5 py-3.5 text-sm">
      <span className="text-violet-200">
        Ücretsiz plandasın — sınırsız proje ve şemadan koda export (SQL/Prisma/TypeORM) için Solo&apos;ya geç.
      </span>
      <a
        href="/api/lemonsqueezy/checkout?plan=solo"
        className="shrink-0 rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 px-4 py-1.5 text-xs font-medium text-white shadow-lg shadow-violet-500/25 transition-transform hover:scale-105"
      >
        Yükselt
      </a>
    </div>
  );
}

function SetupSteps({
  hasFigmaAccount,
  fileKey,
  hasDbSnapshot,
  hasAgentKey,
  onFigmaFileConnected,
}: {
  hasFigmaAccount: boolean;
  fileKey: string | null;
  hasDbSnapshot: boolean;
  hasAgentKey: boolean;
  onFigmaFileConnected: (key: string) => void;
}) {
  return (
    <div className="glass-panel flex flex-col gap-6 p-6">
      <h2 className="text-lg font-medium text-white">İlk kurulum</h2>

      <Step done={hasFigmaAccount} title="1. Figma hesabını bağla">
        {hasFigmaAccount ? (
          <p className="text-sm text-zinc-400">Figma hesabı bağlı.</p>
        ) : (
          <a
            href="/api/figma/connect"
            className="inline-block rounded-full bg-white px-4 py-2 text-sm font-medium text-black shadow-lg shadow-white/10 transition-transform hover:scale-105"
          >
            Figma hesabını bağla
          </a>
        )}
      </Step>

      <Step done={fileKey !== null} title="2. Figma dosyanı bağla">
        {!hasFigmaAccount ? (
          <p className="text-sm text-zinc-500">Önce Figma hesabını bağla.</p>
        ) : fileKey === null ? (
          <FigmaFileConnect onConnected={onFigmaFileConnected} />
        ) : (
          <p className="text-sm text-zinc-400">Bağlı: {fileKey}</p>
        )}
      </Step>

      <Step done={hasDbSnapshot} title="3. planoo-agent'ı veritabanına karşı çalıştır">
        {hasDbSnapshot ? (
          <p className="text-sm text-zinc-400">Veritabanı şeması alındı.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Always rendered, even if hasAgentKey is already true — the
                raw key is shown exactly once and is easy to lose (page
                refresh, closed tab). Without this, a lost key had no
                recovery path: hasAgentKey stays true forever once any key
                exists, so gating AgentSetup on !hasAgentKey was a dead end. */}
            {hasAgentKey && (
              <p className="text-sm text-zinc-400">
                Daha önce bir anahtar oluşturdun. Kaybettiysen aşağıdan yenisini oluşturabilirsin
                (eskisi geçersiz kalmaz).
              </p>
            )}
            <AgentSetup />
          </div>
        )}
      </Step>
    </div>
  );
}

function Step({ done, title, children }: { done: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-medium text-white">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
            done ? "bg-emerald-500 text-white" : "bg-white/10 text-zinc-400"
          }`}
        >
          {done ? "✓" : ""}
        </span>
        {title}
      </h3>
      <div className="pl-7">{children}</div>
    </div>
  );
}

function EmptyState() {
  // Explicit "ilk kurulum" state — decided in /plan-ceo-review Section 4:
  // must read differently from "no drift found", since there's nothing to
  // compare against yet on a first check.
  return (
    <div className="glass-panel flex flex-col items-center gap-2 border-dashed! p-12 text-center">
      <p className="text-zinc-400">
        Henüz hiç bağlantı yok. Yukarıdaki &quot;Yeniden kontrol et&quot; ile ilk taramayı başlat.
      </p>
    </div>
  );
}

function StatusBanner({ status }: { status: RecheckStatus }) {
  if (status.kind === "success" && status.isFirstRun) {
    return <span className="text-sm text-emerald-400">İlk kurulum tamamlandı — önerileri gözden geçir.</span>;
  }
  if (status.kind === "success") {
    return <span className="text-sm text-zinc-400">Kontrol tamamlandı.</span>;
  }
  if (status.kind === "error" && status.code === "pending_figma_reauth") {
    return (
      <span className="text-sm text-amber-400">
        {status.message}{" "}
        <button
          type="button"
          onClick={() => {
            window.location.href = "/api/figma/connect";
          }}
          className="underline"
        >
          Figma&apos;yı yeniden bağla
        </button>
      </span>
    );
  }
  if (status.kind === "error") {
    return <span className="text-sm text-red-400">{status.message}</span>;
  }
  return null;
}
