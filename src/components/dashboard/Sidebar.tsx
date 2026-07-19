"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { type ActivePanel, type ProjectView } from "./DashboardLayout";

interface SidebarProps {
  activePanel: ActivePanel;
  onPanelChange: (panel: ActivePanel) => void;
  activeProject: ProjectView | null;
  plan: string;
  projectCount: number;
  projectLimit: number | null;
}

const COLLAPSED_WIDTH = 76;
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 440;

export function Sidebar({ activePanel, onPanelChange, activeProject, plan, projectCount, projectLimit }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef({ startX: 0, startWidth: DEFAULT_WIDTH });

  const handleResizeMove = useCallback((e: MouseEvent) => {
    const delta = e.clientX - resizeStartRef.current.startX;
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStartRef.current.startWidth + delta));
    setWidth(next);
  }, []);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  function handleResizeStart(e: React.MouseEvent) {
    if (isCollapsed) return;
    e.preventDefault();
    resizeStartRef.current = { startX: e.clientX, startWidth: width };
    setIsResizing(true);
  }

  const menuItems: { id: ActivePanel; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: "overview",
      label: "Genel Bakış",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    {
      id: "schema",
      label: "SQL Şemaları",
      count: activeProject?._count?.designedTables,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      )
    },
    {
      id: "figma",
      label: "Figma Bağlantıları",
      count: activeProject?._count?.links,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )
    },
    {
      id: "roadmap",
      label: "Roadmap",
      count: activeProject?._count?.roadmapItems,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      )
    },
    {
      id: "settings",
      label: "Ayarlar",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];

  return (
    <div
      style={{ width: isCollapsed ? COLLAPSED_WIDTH : width }}
      className={`relative flex flex-col flex-shrink-0 glass-panel border-r border-white/5 z-20 ease-in-out ${isResizing ? "" : "transition-all duration-300"}`}
    >
      <button
        type="button"
        onClick={() => setIsCollapsed((c) => !c)}
        title={isCollapsed ? "Menüyü genişlet" : "Menüyü daralt"}
        className="absolute -right-3 top-8 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-[#0c0c14] text-zinc-400 shadow-lg transition-all duration-200 hover:text-white hover:border-violet-400/40 hover:bg-[#14141e] hover:scale-110"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {!isCollapsed && (
        <div
          onMouseDown={handleResizeStart}
          title="Sürükleyerek yeniden boyutlandır"
          className={`group absolute -right-1 top-0 z-30 h-full w-2 cursor-ew-resize ${isResizing ? "bg-violet-400/20" : ""}`}
        >
          <div className="absolute right-[3px] top-1/2 h-10 w-1 -translate-y-1/2 rounded-full bg-white/10 transition-colors group-hover:bg-violet-400/60" />
        </div>
      )}

      <div className={`h-16 flex items-center border-b border-white/5 overflow-hidden transition-all duration-300 ${isCollapsed ? "justify-center px-0" : "px-6"}`}>
        <div className={`flex items-center ${isCollapsed ? "" : "gap-2"}`}>
          <Image
            src="/brands/logo-icon.png"
            alt="planoo"
            width={196}
            height={126}
            priority
            className="h-8 w-auto shrink-0 object-contain"
          />
          <span
            className={`text-xl font-bold tracking-tight text-white whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100"}`}
          >
            planoo<span className="text-violet-400">.</span>
          </span>
        </div>
      </div>

      <div className="flex-1 py-6 px-3 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
        <div
          className={`px-3 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? "max-h-0 opacity-0 mb-0" : "max-h-5 opacity-100"}`}
        >
          Menü
        </div>
        {menuItems.map((item) => {
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPanelChange(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center w-full py-2.5 rounded-lg transition-all duration-200 group relative
                ${isCollapsed ? "justify-center px-0" : "justify-between px-3"}
                ${isActive ? 'text-white bg-white/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}
              `}
            >
              {isActive && (
                <div
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-violet-400 to-fuchsia-400 rounded-r-full transition-opacity duration-300 ${isCollapsed ? "opacity-0" : "opacity-100"}`}
                />
              )}
              <div className={`flex items-center min-w-0 ${isCollapsed ? "" : "gap-3"}`}>
                <span className={`shrink-0 transition-colors duration-200 ${isActive ? 'text-violet-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                  {item.icon}
                </span>
                <span
                  className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100"}`}
                >
                  {item.label}
                </span>
              </div>
              {item.count !== undefined && (
                <span
                  className={`text-xs py-0.5 rounded-full whitespace-nowrap overflow-hidden transition-all duration-300 ${isActive ? 'bg-violet-500/20 text-violet-300' : 'bg-zinc-800 text-zinc-400'} ${isCollapsed ? "max-w-0 opacity-0 px-0" : "max-w-[40px] opacity-100 px-2"}`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={`border-t border-white/5 transition-all duration-300 ${isCollapsed ? "p-2" : "p-4"}`}>
        <div
          className={`glass-panel flex items-center transition-all duration-300 ${isCollapsed ? "p-2 justify-center" : "p-3 justify-between"}`}
          title={isCollapsed ? `${plan} · ${projectLimit === null ? "sınırsız" : `${projectCount}/${projectLimit}`} proje` : undefined}
        >
          <div
            className={`flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"}`}
          >
            <span className="text-xs text-zinc-400 whitespace-nowrap">Mevcut Plan</span>
            <span className="text-sm font-medium text-white capitalize whitespace-nowrap">{plan}</span>
            <span className="text-[11px] text-zinc-500 mt-0.5 whitespace-nowrap">
              {projectLimit === null ? `${projectCount} proje · Sınırsız` : `${projectCount} / ${projectLimit} proje`}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center border border-violet-500/20 shrink-0">
            <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
