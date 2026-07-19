"use client";

import { type ProjectView } from "./DashboardLayout";

interface SettingsPanelProps {
  project: ProjectView | null;
  plan: string;
}

export function SettingsPanel({ project, plan }: SettingsPanelProps) {
  if (!project) return null;

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Proje Ayarları</h1>
        <p className="text-zinc-400">
          Projenizin yapılandırmasını, bağlantılarını ve temel özelliklerini buradan yönetebilirsiniz.
        </p>
      </div>

      <div className="space-y-8">
        {/* Figma Bağlantısı */}
        <section className="glass-panel rounded-2xl overflow-hidden border border-white/10">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Figma Entegrasyonu
            </h2>
            <p className="text-sm text-zinc-400">Figma hesabınızı ve tasarım dosyalarınızı projenize bağlayın.</p>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
              <div>
                <h3 className="text-white font-medium mb-1">Figma Hesabı</h3>
                <p className="text-sm text-zinc-400">Planoo&apos;nun Figma tasarımlarınıza erişmesi için yetkilendirin.</p>
              </div>
              <a 
                href="/api/figma/connect" 
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors border border-white/10 whitespace-nowrap"
              >
                Hesabı Bağla
              </a>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
              <div>
                <h3 className="text-white font-medium mb-1">Figma Dosyası</h3>
                <p className="text-sm text-zinc-400">
                  {project.figmaFileKey 
                    ? `Şu anda bağlı dosya: ${project.figmaFileKey}`
                    : 'Bu projeye henüz bir Figma dosyası bağlanmadı.'}
                </p>
              </div>
              <button className="px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white text-sm font-medium rounded-lg transition-all shadow-[0_0_10px_rgba(139,92,246,0.2)] whitespace-nowrap">
                {project.figmaFileKey ? 'Dosyayı Değiştir' : 'Dosya Ekle'}
              </button>
            </div>
          </div>
        </section>

        {/* Plan Bilgisi */}
        <section className="glass-panel rounded-2xl overflow-hidden border border-white/10">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Plan ve Kullanım
            </h2>
            <p className="text-sm text-zinc-400">Mevcut planınız ve kullanım limitleriniz.</p>
          </div>
          
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-sm text-zinc-400 mb-1">Mevcut Plan</div>
                <div className="text-2xl font-bold text-white capitalize">{plan}</div>
              </div>
              {plan === 'free' && (
                <button className="px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-xl hover:bg-zinc-200 transition-colors shadow-lg">
                  Planı Yükselt
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <div className="text-zinc-400 text-sm mb-1">Tablolar</div>
                <div className="text-white font-medium text-lg">{project._count.designedTables} / 10</div>
                <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div className="bg-blue-400 h-full rounded-full" style={{ width: `${Math.min((project._count.designedTables / 10) * 100, 100)}%` }} />
                </div>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <div className="text-zinc-400 text-sm mb-1">Bağlantılar</div>
                <div className="text-white font-medium text-lg">{project._count.links}</div>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                <div className="text-zinc-400 text-sm mb-1">Yapılacak Görevler</div>
                <div className="text-white font-medium text-lg">{project._count.roadmapItems}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Tehlikeli Alan */}
        <section className="glass-panel rounded-2xl overflow-hidden border border-red-500/20 bg-red-500/5">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-red-400 flex items-center gap-2 mb-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Tehlikeli Alan
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              Projeyi silmek geri alınamaz bir işlemdir. Tüm veritabanı şemalarınız, figma bağlantılarınız ve roadmap görevleriniz kalıcı olarak silinir.
            </p>
            
            <button className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-500/20">
              Projeyi Sil
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
