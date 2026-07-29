"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { type ProjectView, type ActivePanel } from "./DashboardLayout";
import { FigmaPanel } from "./FigmaPanel";
import type { LinkView } from "@/components/canvas/types";

// Puck'ın sürükle-bırak motoru tarayıcıya özgü işler yaptığı için ssr:false
// ile client-only yükleniyor — bkz. BuilderEditor.tsx'teki not.
const BuilderEditor = dynamic(() => import("@/components/builder/BuilderEditor").then((m) => m.BuilderEditor), {
  ssr: false,
});

interface DesignPanelProps {
  project: ProjectView | null;
  hasFigmaAccount: boolean;
  links: LinkView[];
  onLinksChange: (links: LinkView[]) => void;
  onPanelChange: (panel: ActivePanel) => void;
}

type SubTab = "builder" | "figma";

export function DesignPanel({ project, hasFigmaAccount, links, onLinksChange, onPanelChange }: DesignPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>("builder");

  if (!project) return null;

  const tabs: { id: SubTab; label: string }[] = [
    { id: "builder", label: "UI Builder" },
    { id: "figma", label: "Figma Eşleştirme" },
  ];

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      <div className="mb-4 flex items-center gap-1 border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              subTab === tab.id ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
            {subTab === tab.id && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {subTab === "builder" ? (
          <div className="h-full overflow-hidden rounded-2xl border border-white/10">
            <BuilderEditor />
          </div>
        ) : (
          <FigmaPanel
            project={project}
            hasFigmaAccount={hasFigmaAccount}
            links={links}
            onLinksChange={onLinksChange}
            onPanelChange={onPanelChange}
          />
        )}
      </div>
    </div>
  );
}
