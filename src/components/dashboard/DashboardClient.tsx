"use client";

import { useState, useCallback } from "react";
import { DashboardLayout, type ActivePanel, type ProjectView } from "./DashboardLayout";
import { OverviewPanel } from "./OverviewPanel";
import { SchemaPanel } from "./SchemaPanel";
import { FigmaPanel } from "./FigmaPanel";
import { RoadmapPanel } from "./RoadmapPanel";
import { CostPanel } from "./CostPanel";
import { SettingsPanel } from "./SettingsPanel";
import { CreateProjectModal, type CreateProjectFormData } from "./CreateProjectModal";
import type { DesignedTable } from "@/components/canvas/SchemaBuilder";
import type { CanvasNote } from "@/components/canvas/SchemaNoteNode";
import type { LinkView } from "@/components/canvas/types";
import { getPlan, type PlanId } from "@/lib/pricing";

interface DashboardClientProps {
  userName: string;
  userImage: string | null;
  plan: string;
  hasFigmaAccount: boolean;
  initialProjects: ProjectView[];
  onSignOut: () => Promise<void>;
}

export function DashboardClient({
  userName,
  userImage,
  plan,
  hasFigmaAccount,
  initialProjects,
  onSignOut,
}: DashboardClientProps) {
  const [projects, setProjects] = useState<ProjectView[]>(initialProjects);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    initialProjects.length > 0 ? initialProjects[0].id : null
  );
  const [activePanel, setActivePanel] = useState<ActivePanel>("overview");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Project-specific data loaded on demand
  const [designedTables, setDesignedTables] = useState<DesignedTable[]>([]);
  const [canvasNotes, setCanvasNotes] = useState<CanvasNote[]>([]);
  const [links, setLinks] = useState<LinkView[]>([]);
  const [projectDataLoaded, setProjectDataLoaded] = useState<string | null>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const loadProjectData = useCallback(async (projectId: string) => {
    if (projectDataLoaded === projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        const project = data.project;
        setDesignedTables(project.designedTables ?? []);
        setCanvasNotes(project.canvasNotes ?? []);
        setLinks(
          (project.links ?? []).map((l: {
            id: string;
            figmaNodeId: string;
            dbTableName: string;
            dbColumnName: string;
            confidence: number;
            state: string;
          }) => ({
            id: l.id,
            figmaNodeId: l.figmaNodeId,
            dbTableName: l.dbTableName,
            dbColumnName: l.dbColumnName,
            confidence: l.confidence,
            state: l.state,
          }))
        );
        setProjectDataLoaded(projectId);
      }
    } catch (err) {
      console.error("Failed to load project data", err);
    }
  }, [projectDataLoaded]);

  const handleProjectChange = useCallback(
    async (projectId: string) => {
      setActiveProjectId(projectId);
      setProjectDataLoaded(null);
      setDesignedTables([]);
      setCanvasNotes([]);
      setLinks([]);
      await loadProjectData(projectId);
    },
    [loadProjectData]
  );

  const handleProjectCreate = useCallback(
    async (data: CreateProjectFormData): Promise<{ ok: boolean; message?: string }> => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, message: payload.message ?? "Proje oluşturulamadı." };
      }
      const newProject: ProjectView = {
        ...payload.project,
        _count: { designedTables: 0, links: 0, roadmapItems: 0 },
      };
      setProjects((prev) => [newProject, ...prev]);
      setActiveProjectId(newProject.id);
      setProjectDataLoaded(null);
      setDesignedTables([]);
      setCanvasNotes([]);
      setLinks([]);
      setActivePanel("overview");
      return { ok: true };
    },
    []
  );

  const handleUpdateProjectFigmaFile = useCallback(
    async (fileKeyOrUrl: string): Promise<{ ok: boolean; message?: string }> => {
      if (!activeProjectId) return { ok: false, message: "Proje seçili değil." };
      const res = await fetch(`/api/projects/${activeProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figmaFileKey: fileKeyOrUrl }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, message: payload.message ?? "Güncellenemedi." };
      }
      setProjects((prev) =>
        prev.map((p) => (p.id === activeProjectId ? { ...p, figmaFileKey: payload.project.figmaFileKey } : p))
      );
      return { ok: true };
    },
    [activeProjectId]
  );

  const openCreateModal = useCallback(() => setIsCreateModalOpen(true), []);
  const closeCreateModal = useCallback(() => setIsCreateModalOpen(false), []);

  const handlePanelChange = useCallback(
    (panel: ActivePanel) => {
      setActivePanel(panel);
      // Load project data when switching to panels that need it
      if (activeProjectId && !projectDataLoaded) {
        loadProjectData(activeProjectId);
      }
    },
    [activeProjectId, projectDataLoaded, loadProjectData]
  );

  // Load initial project data on first render
  if (activeProjectId && !projectDataLoaded) {
    loadProjectData(activeProjectId);
  }

  function renderPanel() {
    switch (activePanel) {
      case "overview":
        return (
          <OverviewPanel
            project={activeProject}
            onPanelChange={handlePanelChange}
            onOpenCreateModal={openCreateModal}
          />
        );
      case "schema":
        return (
          <SchemaPanel
            project={activeProject}
            initialTables={designedTables}
            initialNotes={canvasNotes}
            userName={userName}
            userImage={userImage}
            onSchemaChanged={() => {
              // Refresh project counts AND the cached table/note lists
              // themselves — SchemaBuilder seeds its canvas state once from
              // these props on mount and never re-syncs afterward, so
              // leaving the Schema tab and coming back fully remounts it
              // from whatever's cached here. Only refreshing `_count` (the
              // old behavior) left that cache stale, which made saved
              // edits — table drags and notes included — look like they'd
              // been silently discarded on the next visit.
              if (activeProjectId) {
                fetch(`/api/projects/${activeProjectId}`)
                  .then((r) => r.json())
                  .then((d) => {
                    if (d.project) {
                      setDesignedTables(d.project.designedTables ?? []);
                      setCanvasNotes(d.project.canvasNotes ?? []);
                      setProjects((prev) =>
                        prev.map((p) =>
                          p.id === activeProjectId
                            ? { ...p, _count: { ...p._count, designedTables: d.project.designedTables?.length ?? p._count.designedTables } }
                            : p
                        )
                      );
                    }
                  });
              }
            }}
          />
        );
      case "figma":
        return (
          <FigmaPanel
            project={activeProject}
            hasFigmaAccount={hasFigmaAccount}
            links={links}
            onLinksChange={setLinks}
            onPanelChange={handlePanelChange}
          />
        );
      case "roadmap":
        return <RoadmapPanel project={activeProject} />;
      case "cost":
        return <CostPanel project={activeProject} />;
      case "settings":
        return (
          <SettingsPanel
            project={activeProject}
            plan={plan}
            onUpdateFigmaFile={handleUpdateProjectFigmaFile}
          />
        );
      default:
        return null;
    }
  }

  const planDef = getPlan((plan as PlanId) ?? "free");

  return (
    <>
      <DashboardLayout
        userName={userName}
        userImage={userImage}
        plan={plan}
        projects={projects}
        activeProject={activeProject}
        activePanel={activePanel}
        onPanelChange={handlePanelChange}
        onProjectChange={handleProjectChange}
        onOpenCreateModal={openCreateModal}
        onSignOut={onSignOut}
      >
        {renderPanel()}
      </DashboardLayout>
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        onSubmit={handleProjectCreate}
        planName={planDef.name}
        projectLimit={planDef.projectLimit}
        projectCount={projects.length}
      />
    </>
  );
}
