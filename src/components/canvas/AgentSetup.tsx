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
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm">
        <p className="font-medium text-amber-200">Bu anahtarı şimdi kopyala — bir daha gösterilmeyecek.</p>
        <code className="select-all rounded bg-black/40 px-2 py-1 text-xs text-amber-100">{apiKey}</code>
        <p className="text-xs text-zinc-400">Veritabanı makinende/CI&apos;da çalıştır:</p>
        <code className="select-all whitespace-pre-wrap rounded bg-black/40 px-2 py-1 text-xs text-zinc-300">
          {`PLANOO_API_KEY=${apiKey} AGENT_DATABASE_URL="mysql://user:pass@host:3306/db" \\\n  curl -s https://planoo.xyz/agent.js | node -`}
        </code>
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
