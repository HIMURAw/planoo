interface HeroProps {
  onSignIn: () => Promise<void>;
}

export function Hero({ onSignIn }: HeroProps) {
  return (
    <section className="relative overflow-hidden px-6 pt-24 pb-32 text-center">
      {/* Ambient gradient orbs — the "next-gen SaaS" visual signature: soft,
          blurred color blobs behind a dark canvas, no photography needed. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-violet-600/30 via-fuchsia-500/20 to-blue-500/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:56px_56px]"
      />

      <div className="relative mx-auto max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Figma × Veritabanı × Yapay Zeka
        </span>

        <h1 className="mt-6 text-5xl font-semibold tracking-tight text-white sm:text-6xl">
          Tasarımın ile{" "}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
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
              className="rounded-full bg-white px-7 py-3.5 text-base font-medium text-black transition-transform hover:scale-105"
            >
              Google ile ücretsiz başla
            </button>
          </form>
          <a
            href="#pricing"
            className="rounded-full border border-white/15 px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/5"
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
// isn't just generic decoration.
function CanvasPreview() {
  return (
    <div className="relative mx-auto mt-20 max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-10 shadow-2xl shadow-violet-950/40">
      <div className="grid grid-cols-2 gap-16">
        <div className="flex flex-col gap-4">
          {["email", "full_name", "avatar_url"].map((label) => (
            <div
              key={label}
              className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-4 py-2.5 text-left text-sm text-violet-200"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {["users.email", "users.full_name", "users.avatar_url"].map((label) => (
            <div
              key={label}
              className="rounded-lg border border-blue-400/30 bg-blue-500/10 px-4 py-2.5 text-left text-sm text-blue-200"
            >
              {label}
            </div>
          ))}
        </div>
      </div>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
        ✓ onaylandı
      </span>
    </div>
  );
}
