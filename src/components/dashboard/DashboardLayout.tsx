"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";
import { getPlan, type PlanId } from "@/lib/pricing";

export type ActivePanel = "overview" | "schema" | "figma" | "roadmap" | "settings";

export interface ProjectView {
  id: string;
  name: string;
  description: string | null;
  figmaFileKey: string | null;
  githubRepo: string | null;
  _count: { designedTables: number; links: number; roadmapItems: number };
}

interface DashboardLayoutProps {
  userName: string;
  userImage: string | null;
  plan: string;
  projects: ProjectView[];
  activeProject: ProjectView | null;
  activePanel: ActivePanel;
  onPanelChange: (panel: ActivePanel) => void;
  onProjectChange: (projectId: string) => void;
  onOpenCreateModal: () => void;
  onSignOut: () => Promise<void>;
  children: ReactNode;
}

export function DashboardLayout({
  userName,
  userImage,
  plan,
  projects,
  activeProject,
  activePanel,
  onPanelChange,
  onProjectChange,
  onOpenCreateModal,
  onSignOut,
  children,
}: DashboardLayoutProps) {
  const projectLimit = getPlan((plan as PlanId) ?? "free").projectLimit;

  return (
    <div className="flex h-screen overflow-hidden text-zinc-100 p-4 gap-4">
      {/* Sidebar: rounded & floating */}
      <Sidebar
        activePanel={activePanel}
        onPanelChange={onPanelChange}
        activeProject={activeProject}
        plan={plan}
        projectCount={projects.length}
        projectLimit={projectLimit}
      />

      {/* Main content wrapper */}
      <div className="flex flex-1 flex-col overflow-hidden gap-4">
        {/* Header: floating panel */}
        <DashboardHeader
          userName={userName}
          userImage={userImage}
          projects={projects}
          activeProject={activeProject}
          onProjectChange={onProjectChange}
          onOpenCreateModal={onOpenCreateModal}
          onSignOut={onSignOut}
        />
        
        {/* Main Panel Content: floating glass area */}
        <main className="flex-1 overflow-y-auto relative glass-panel border border-white/5 rounded-2xl p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/3 via-transparent to-blue-500/3 pointer-events-none" />
          <div className="relative h-full w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
