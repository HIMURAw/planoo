"use client";

import { type ProjectView, type ActivePanel } from "./DashboardLayout";

interface OverviewPanelProps {
  project: ProjectView | null;
  onPanelChange: (panel: ActivePanel) => void;
  onOpenCreateModal: () => void;
}

export function OverviewPanel({ project, onPanelChange, onOpenCreateModal }: OverviewPanelProps) {
  if (!project) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 min-h-[500px]">
        <div className="w-20 h-20 bg-violet-500/10 rounded-2xl flex items-center justify-center border border-violet-500/20 mb-6 shadow-lg shadow-black/20 backdrop-blur-md">
          <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">Planoo&apos;ya Hoş Geldin!</h2>
        <p className="text-zinc-400 max-w-md mx-auto mb-8 text-sm leading-relaxed">
          Başlamak için ilk projeni oluştur, veya sol üstteki proje seçiciden mevcut bir projeyi seç.
        </p>
        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 rounded-xl transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Proje Oluştur
        </button>
      </div>
    );
  }

  const stats = [
    {
      label: "SQL Tabloları",
      value: project._count.designedTables,
      icon: (
        <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      ),
      color: "from-blue-500/20 to-blue-500/5 border-blue-500/20"
    },
    {
      label: "Figma Eşleştirme",
      value: project._count.links,
      icon: (
        <svg className="w-6 h-6 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      color: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/20"
    },
    {
      label: "Yapılacaklar Durumu",
      value: project._count.roadmapItems,
      icon: (
        <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
      color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20"
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{project.name}</h1>
          {project.description && (
            <p className="text-zinc-400 text-base">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-zinc-400">
            PROJ_ID: {project.id}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className={`glass-panel p-6 rounded-2xl bg-gradient-to-br ${stat.color} border transition-all hover:scale-[1.02] hover:-translate-y-1 duration-300`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/5 rounded-xl backdrop-blur-md border border-white/5">
                {stat.icon}
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-1 tracking-tight">{stat.value}</div>
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid: Project Info & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Info Block */}
        <div className="lg:col-span-2 glass-panel p-6 flex flex-col justify-between min-h-[300px]">
          <div>
            <h3 className="text-xl font-bold text-white mb-4">Proje Özeti</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              Bu projede tasarladığınız SQL tabloları ile Figma ekranlarınızdaki görsel bileşenleri eşleştirebilirsiniz. Şemalarda veya tasarımlarda oluşacak uyumsuzluklar (drift) anında tespit edilerek Tasarım panelinde listelenecektir.
            </p>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono border-t border-white/5 pt-4">
              <div>
                <span className="text-zinc-500 block mb-1">SQL TASARIM:</span>
                <span className="text-blue-400">{project._count.designedTables} Tablo Çizildi</span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">EŞLEŞMELER:</span>
                <span className="text-fuchsia-400">{project._count.links} Bağlantı Onaylandı</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-6">
            <span className="text-xs text-zinc-400">Durum: Aktif</span>
            <button 
              onClick={() => onPanelChange('schema')}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors border border-white/10"
            >
              SQL Şemalarını Aç →
            </button>
          </div>
        </div>

        {/* Action Quick List */}
        <div className="glass-panel p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white mb-4">Hızlı İşlemler</h3>
            <div className="space-y-3">
              <button 
                onClick={() => onPanelChange('schema')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/5 hover:border-violet-500/20 hover:bg-violet-500/5 transition-all text-left text-sm text-zinc-300 hover:text-white"
              >
                <span>Şema Tasarla</span>
                <span className="text-violet-400 text-xs">Aç →</span>
              </button>
              <button 
                onClick={() => onPanelChange('figma')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/5 hover:border-fuchsia-500/20 hover:bg-fuchsia-500/5 transition-all text-left text-sm text-zinc-300 hover:text-white"
              >
                <span>Figma&apos;yı Bağla</span>
                <span className="text-fuchsia-400 text-xs">Aç →</span>
              </button>
              <button 
                onClick={() => onPanelChange('roadmap')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all text-left text-sm text-zinc-300 hover:text-white"
              >
                <span>Yapılacaklar Listesi</span>
                <span className="text-emerald-400 text-xs">Aç →</span>
              </button>
            </div>
          </div>
          <div className="pt-4 border-t border-white/5 mt-6">
            <p className="text-[11px] text-zinc-500 font-mono">PLANOO ENGINE V1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
