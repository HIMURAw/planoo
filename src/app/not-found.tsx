import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Sayfa bulunamadı</h1>
      <p className="text-zinc-600 dark:text-zinc-400">Aradığın sayfa mevcut değil.</p>
      <Link href="/" className="text-sm underline">
        Ana sayfaya dön
      </Link>
    </div>
  );
}
