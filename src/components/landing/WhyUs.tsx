const REASONS = [
  {
    title: "Figma ve DB birbirinden kopuk",
    body: "Tasarımı Figma'da yapıyorsun, şemayı ayrı bir dosyada tutuyorsun, ikisi arasındaki bağlantı sadece kafanda. Biri değiştiğinde diğeri fark etmiyor.",
  },
  {
    title: "Dokümantasyon anında bayatlıyor",
    body: "Elle tutulan her doküman, yazıldığı an eskimeye başlar. planoo bağlantıyı statik bir not değil, sürekli doğrulanan bir gerçek olarak tutar.",
  },
  {
    title: "Roadmap, şema, tasarım — hep farklı sitelerde",
    body: "Bir projeye başladığında planlama, tasarım ve veri modeli üç ayrı araca dağılır. planoo bunları tek bir canvas'ta birleştirir.",
  },
];

export function WhyUs() {
  return (
    <section id="why" className="mx-auto max-w-5xl px-6 py-24">
      <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Neden planoo?
      </h2>
      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {REASONS.map((reason) => (
          <div
            key={reason.title}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:bg-white/[0.06]"
          >
            <h3 className="text-lg font-medium text-white">{reason.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{reason.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
