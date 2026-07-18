interface HeroProps {
  onSignIn: () => Promise<void>;
}

export function Hero({ onSignIn }: HeroProps) {
  return (
    <section className="relative overflow-hidden px-6 pt-28 pb-32 text-center">
      {/* Extra local glow on top of the global app-canvas-bg (see
          globals.css) — the hero earns a brighter focal point than the
          rest of the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-15%] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-linear-to-tr from-violet-600/25 via-fuchsia-500/15 to-blue-500/25 blur-3xl"
      />

      <div className="relative mx-auto max-w-3xl">
        <span className="glass-panel inline-flex items-center gap-2 rounded-full! px-4 py-1.5 text-xs font-medium text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]" />
          Figma × Veritabanı × Yapay Zeka
        </span>

        <h1 className="mt-6 text-5xl font-semibold tracking-tight text-white sm:text-6xl">
          Tasarımın ile{" "}
          <span className="bg-linear-to-r from-violet-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
            veritabanın
          </span>{" "}
          artık aynı sayfada.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-400">
          Figma ekranlarındaki her elementi veritabanı tablolarınla otomatik eşleştir. Şema
          değiştiğinde, tasarımın kırıldığında anında haberdar ol — artık kopuk dosyalar, unutulan
          bağlantılar yok.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <form action={onSignIn}>
            <button
              type="submit"
              className="rounded-full bg-white px-7 py-3.5 text-base font-medium text-black shadow-lg shadow-white/10 transition-transform hover:scale-105"
            >
              Google ile ücretsiz başla
            </button>
          </form>
          <a
            href="#pricing"
            className="glass-panel rounded-full! px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/10"
          >
            Fiyatlandırmayı gör
          </a>
        </div>
      </div>

      <CanvasPreview />
    </section>
  );
}

// A CSS-only stand-in for the actual product screenshot: abstract nodes and
// connecting lines evoking the React Flow canvas, styled/colored the same
// way the real Link states are (see components/canvas/LinkCanvas.tsx) so it
// isn't just generic decoration. Frosted glass panel + glowing "confirmed"
// pill to sell the glassmorphism language before anyone even signs in.
const CANVAS_ROWS = [
  { figma: "email", db: "users.email", confirmed: false },
  { figma: "full_name", db: "users.full_name", confirmed: true },
  { figma: "avatar_url", db: "users.avatar_url", confirmed: false },
];

function CanvasPreview() {
  return (
    <div className="glass-panel relative mx-auto mt-20 max-w-4xl overflow-hidden rounded-3xl! p-10 shadow-[0_20px_60px_-15px_rgba(139,92,246,0.35)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/4 to-transparent"
      />
      <div className="relative flex flex-col gap-4">
        {CANVAS_ROWS.map((row) => (
          <div key={row.figma} className="flex items-center gap-4">
            <div className="flex-1 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-2.5 text-left text-sm text-violet-200 backdrop-blur-sm">
              {row.figma}
            </div>
            {row.confirmed ? (
              <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.3)]">
                ✓
              </span>
            ) : (
              <span className="h-px w-6 shrink-0 bg-white/15" aria-hidden />
            )}
            <div className="flex-1 rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2.5 text-left text-sm text-blue-200 backdrop-blur-sm">
              {row.db}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
