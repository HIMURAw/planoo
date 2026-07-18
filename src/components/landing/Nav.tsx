"use client";

import { useState, useRef, useEffect } from "react";

interface NavProps {
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  user: { name: string | null; image: string | null } | null;
}

export function Nav({ onSignIn, onSignOut, user }: NavProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

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

        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition-all hover:bg-white/10"
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="h-7 w-7 rounded-full ring-2 ring-violet-400/30"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-blue-500 text-xs font-bold text-white">
                  {user.name?.charAt(0)?.toUpperCase() ?? "U"}
                </span>
              )}
              <span className="hidden text-sm font-medium text-zinc-200 sm:inline">
                {user.name ?? "Hesap"}
              </span>
              <svg
                className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#14141e]/95 shadow-xl shadow-black/40 backdrop-blur-xl"
                style={{ animation: "scaleIn 0.15s ease" }}
              >
                <a
                  href="/dashboard"
                  className="flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-200 transition-colors hover:bg-white/8"
                >
                  <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Dashboard
                </a>
                <div className="mx-3 border-t border-white/8" />
                <form action={onSignOut}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-zinc-400 transition-colors hover:bg-white/8 hover:text-red-400"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Çıkış yap
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <form action={onSignIn}>
            <button
              type="submit"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-transform hover:scale-105"
            >
              Google ile giriş yap
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
