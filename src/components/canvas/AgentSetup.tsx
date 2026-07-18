"use client";

import { useState } from "react";

export function AgentSetup() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const response = await fetch("/api/agent-key", { method: "POST" });
      const data = (await response.json()) as { apiKey?: string };
      if (data.apiKey) setApiKey(data.apiKey);
    } finally {
      setGenerating(false);
    }
  }

  if (apiKey) {
    // window.location.origin (not a hardcoded https://planoo.xyz) so this
    // command is correct whether you're testing against `npm run dev` on
    // localhost or the real deployed site — same reasoning as origin
    // derivation in src/app/api/figma/connect/route.ts.
    const apiUrl = typeof window !== "undefined" ? window.location.origin : "";

    return (
      <div className="flex flex-col gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm">
        <p className="font-medium text-amber-200">Bu anahtarı şimdi kopyala — bir daha gösterilmeyecek.</p>
        <code className="select-all rounded bg-black/40 px-2 py-1 text-xs text-amber-100">{apiKey}</code>
        <p className="text-xs text-zinc-400">
          Aşağıdaki komutu, hangi veritabanını takip etmek istiyorsan onun bağlantı bilgileriyle
          (host/port/kullanıcı/şifre/veritabanı adı) doldurup çalıştır — kendi makinende ya da
          CI&apos;da, planoo&apos;nun sunucularında değil:
        </p>
        <code className="select-all whitespace-pre-wrap rounded bg-black/40 px-2 py-1 text-xs text-zinc-300">
          {[
            `export PLANOO_API_KEY="${apiKey}"`,
            `export AGENT_DATABASE_URL="mysql://user:pass@host:3306/db_adi"`,
            `export PLANOO_API_URL="${apiUrl}"`,
            `curl -s $PLANOO_API_URL/agent.js | node -`,
          ].join("\n")}
        </code>
        <p className="text-xs text-zinc-500">
          `AGENT_DATABASE_URL`, şemasını okumak istediğin veritabanına ait bağlantı dizesi —
          planoo&apos;nun kendi veritabanı değil, izlemek istediğin projenin veritabanı.
        </p>
        <p className="text-xs text-zinc-500">
          Komut &quot;pushed schema for...&quot; diye başarı mesajı verince bu sayfayı yenile —
          3. adım otomatik tamamlanmış görünecek.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={generating}
      className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black shadow-lg shadow-white/10 transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
    >
      {generating ? "Oluşturuluyor…" : "Agent bağla"}
    </button>
  );
}
