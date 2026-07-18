interface NavProps {
  onSignIn: () => Promise<void>;
}

export function Nav({ onSignIn }: NavProps) {
  return (
    <header className="sticky top-4 z-50 mx-auto w-[calc(100%-2rem)] max-w-5xl">
      <div className="glass-panel flex items-center justify-between px-5 py-3">
        <span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
          <span className="h-2 w-2 rounded-full bg-linear-to-br from-violet-400 to-blue-400" />
          planoo
        </span>
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
