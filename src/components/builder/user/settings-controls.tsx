"use client";

// Settings Panel (sağ panel) için paylaşılan, küçük form primitifleri.
// Container/Button'ın kendi *Settings bileşenleri bunları kullanır; Text ve
// Image eklendiğinde de aynı primitifler yeniden kullanılacak — bu yüzden
// tek dosyada topluyoruz, her *Settings bileşeninde aynı <label>+<input>
// boilerplate'ini tekrar tekrar yazmak yerine.

import type { ChangeEvent, ReactNode } from "react";

interface SettingsRowProps {
  label: string;
  children: ReactNode;
}

export function SettingsRow({ label, children }: SettingsRowProps) {
  return (
    <label className="flex items-center justify-between gap-2 py-2 text-[12px] text-zinc-300">
      <span className="shrink-0 text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberInput({ value, onChange, min, max, step = 1 }: NumberInputProps) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        const next = e.target.valueAsNumber;
        onChange(Number.isNaN(next) ? 0 : next);
      }}
      className="w-20 rounded border border-white/10 bg-white/5 px-2 py-1 text-right text-[12px] text-white focus:border-violet-500 focus:outline-none"
    />
  );
}

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TextInput({ value, onChange, placeholder }: TextInputProps) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      className="w-28 rounded border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white focus:border-violet-500 focus:outline-none"
    />
  );
}

interface ColorInputProps {
  value: string;
  onChange: (value: string) => void;
}

// Renk seçici + hex/"transparent" gibi ham metin girişini yan yana sunar —
// sadece <input type="color"> kullanılsaydı "transparent" gibi anahtar
// kelimeler hiç ifade edilemezdi (o input her zaman bir hex değer bekler).
export function ColorInput({ value, onChange }: ColorInputProps) {
  const swatchValue = /^#([0-9a-fA-F]{3}){1,2}$/.test(value) ? value : "#ffffff";
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={swatchValue}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="w-20 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white focus:border-violet-500 focus:outline-none"
      />
    </div>
  );
}

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectInputProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}

export function SelectInput<T extends string>({ value, options, onChange }: SelectInputProps<T>) {
  return (
    <select
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as T)}
      className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white focus:border-violet-500 focus:outline-none"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#0b0714]">
          {opt.label}
        </option>
      ))}
    </select>
  );
}
