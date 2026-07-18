import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <div className="glass-panel flex flex-col items-center gap-3 px-10 py-8">
        <h1 className="text-2xl font-semibold text-white">Sayfa bulunamadı</h1>
        <p className="text-zinc-400">Aradığın sayfa mevcut değil.</p>
        <Link href="/" className="text-sm text-white underline">
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  );
}
