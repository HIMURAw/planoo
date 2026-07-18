"use client";

import { useState } from "react";

interface FigmaFileConnectProps {
  onConnected: (figmaFileKey: string) => void;
}

export function FigmaFileConnect({ onConnected }: FigmaFileConnectProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/figma-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKeyOrUrl: value }),
      });
      const data = (await response.json()) as { figmaFileKey?: string; error?: string };

      if (!response.ok || !data.figmaFileKey) {
        setError(data.error ?? "Bağlanamadı");
        return;
      }

      onConnected(data.figmaFileKey);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label className="text-sm font-medium text-zinc-300">Figma dosya linki veya key&apos;i</label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://www.figma.com/design/AbC123.../my-file"
          className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-violet-400/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting || value.trim().length === 0}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          Bağla
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
