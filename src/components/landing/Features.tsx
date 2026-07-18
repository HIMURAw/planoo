const FEATURES = [
  {
    icon: "⚡",
    title: "Otomatik eşleştirme",
    body: "Figma katmanlarını veritabanı kolonlarınla otomatik eşleştirir — isim ve tip benzerliğine bakarak, saniyeler içinde.",
  },
  {
    icon: "🔄",
    title: "Sapma tespiti",
    body: "Bir kolon silindiğinde ya da yeniden adlandırıldığında, onaylanmış bağlantı hemen işaretlenir. Sessizce kaybolmaz.",
  },
  {
    icon: "🖥️",
    title: "Canvas görünümü",
    body: "Tüm bağlantıları tek bir görsel canvas'ta gör — hangi ekran hangi tabloya bağlı, bir bakışta anla.",
  },
  {
    icon: "🔒",
    title: "Güvenli mimari",
    body: "Veritabanı credential'ların hiçbir zaman sunucularımıza gitmez — açık kaynaklı agent, sadece şema farkını gönderir.",
  },
];

export function Features() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Nasıl çalışır?
        </h2>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="glass-panel flex flex-col items-center p-6 text-center transition-colors duration-300 hover:bg-white/10"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-xl">
                {feature.icon}
              </div>
              <h3 className="mt-4 text-base font-medium text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
