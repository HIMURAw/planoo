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
      <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          Bu anahtarı şimdi kopyala — bir daha gösterilmeyecek.
        </p>
        <code className="select-all rounded bg-white px-2 py-1 text-xs dark:bg-black">{apiKey}</code>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Veritabanı makinende/CI&apos;da çalıştır:
        </p>
        <code className="select-all whitespace-pre-wrap rounded bg-white px-2 py-1 text-xs dark:bg-black">
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
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
    >
      {generating ? "Oluşturuluyor…" : "Agent bağla"}
    </button>
  );
}
