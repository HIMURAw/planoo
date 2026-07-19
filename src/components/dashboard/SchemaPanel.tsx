"use client";

import { type ProjectView } from "./DashboardLayout";
import { SchemaBuilder, type DesignedTable } from "@/components/canvas/SchemaBuilder";

interface SchemaPanelProps {
  project: ProjectView | null;
  initialTables: DesignedTable[];
  onSchemaChanged: (hasAtLeastOneColumn: boolean) => void;
}

export function SchemaPanel({ project, initialTables, onSchemaChanged }: SchemaPanelProps) {
  if (!project) return null;

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            SQL Şemaları
          </h1>
          <p className="text-sm text-zinc-400">
            Projenizin veritabanı tablolarını ve ilişkilerini görsel olarak tasarlayın.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/schema/export"
            className="flex items-center gap-2 px-4 py-2 glass-panel text-sm font-medium text-white hover:bg-white/5 transition-colors border border-white/10 hover:border-blue-500/50 rounded-lg"
          >
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            .sql Olarak İndir
          </a>
        </div>
      </div>

      <div className="flex-1 bg-[#0b192c] border border-blue-500/30 rounded-2xl overflow-hidden relative shadow-2xl shadow-black/80">
        <SchemaBuilder
          projectId={project.id}
          initialTables={initialTables}
          onSchemaChanged={onSchemaChanged}
        />
      </div>
    </div>
  );
}
