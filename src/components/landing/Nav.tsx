interface NavProps {
  onSignIn: () => Promise<void>;
}

export function Nav({ onSignIn }: NavProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <span className="text-lg font-semibold tracking-tight text-white">planoo</span>
        <nav className="hidden items-center gap-8 text-sm text-zinc-300 sm:flex">
          <a href="#why" className="transition-colors hover:text-white">
            Neden planoo?
          </a>
          <a href="#features" className="transition-colors hover:text-white">
            Özellikler
          </a>
          <a href="#pricing" className="transition-colors hover:text-white">
            Fiyatlandırma
          </a>
        </nav>
        <form action={onSignIn}>
          <button
            type="submit"
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-transform hover:scale-105"
          >
            Google ile giriş yap
          </button>
        </form>
      </div>
    </header>
  );
}
