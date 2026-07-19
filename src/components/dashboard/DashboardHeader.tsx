"use client";

import { useState } from "react";
import { type ProjectView } from "./DashboardLayout";
import { ProjectSelector } from "./ProjectSelector";

interface DashboardHeaderProps {
  userName: string;
  userImage: string | null;
  projects: ProjectView[];
  activeProject: ProjectView | null;
  onProjectChange: (projectId: string) => void;
  onOpenCreateModal: () => void;
  onSignOut: () => Promise<void>;
}

export function DashboardHeader({
  userName,
  userImage,
  projects,
  activeProject,
  onProjectChange,
  onOpenCreateModal,
  onSignOut
}: DashboardHeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header className="h-16 glass-panel flex items-center justify-between px-6 relative z-10">
      <div className="flex items-center gap-4">
        <ProjectSelector
          projects={projects}
          activeProject={activeProject}
          onProjectChange={onProjectChange}
          onOpenCreateModal={onOpenCreateModal}
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 p-1 pr-3 rounded-full hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
          >
            {userImage ? (
              <img src={userImage} alt={userName} className="w-8 h-8 rounded-full ring-2 ring-violet-500/20" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center ring-2 ring-violet-500/20">
                <span className="text-sm font-medium text-violet-300">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-sm font-medium text-zinc-300 hidden sm:block">{userName}</span>
            <svg className={`w-4 h-4 text-zinc-500 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isProfileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
              <div
                className="absolute right-0 mt-2 w-48 glass-panel border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden"
                style={{ animation: "scaleIn 0.15s ease", transformOrigin: "top right" }}
              >
                <div className="p-3 border-b border-white/5">
                  <p className="text-sm font-medium text-white truncate">{userName}</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Çıkış yap
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
