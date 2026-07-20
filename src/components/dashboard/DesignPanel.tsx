"use client";

import { useState } from "react";
import { type ProjectView, type ActivePanel } from "./DashboardLayout";
import { FigmaPanel } from "./FigmaPanel";
import { DesignCanvas } from "@/components/canvas/DesignCanvas";
import type { DesignElement } from "@/components/canvas/DesignElementNode";
import type { LinkView } from "@/components/canvas/types";

interface DesignPanelProps {
  project: ProjectView | null;
  hasFigmaAccount: boolean;
  links: LinkView[];
  onLinksChange: (links: LinkView[]) => void;
  initialElements: DesignElement[];
  onDesignChanged: () => void;
  onPanelChange: (panel: ActivePanel) => void;
}

type SubTab = "canvas" | "figma";

export function DesignPanel({
  project,
  hasFigmaAccount,
  links,
  onLinksChange,
  initialElements,
  onDesignChanged,
  onPanelChange,
}: DesignPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>("canvas");

  if (!project) return null;

  const tabs: { id: SubTab; label: string }[] = [
    { id: "canvas", label: "Tasarım Kanvası" },
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
        {subTab === "canvas" ? (
          <div className="h-full overflow-hidden rounded-2xl border border-white/10">
            <DesignCanvas
              projectId={project.id}
              initialElements={initialElements}
              onDesignChanged={onDesignChanged}
            />
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
