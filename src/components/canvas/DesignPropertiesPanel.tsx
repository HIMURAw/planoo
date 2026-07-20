"use client";

import { useState } from "react";
import type { DesignElement, AutoLayoutDirection, AutoLayoutAlign, StrokeStyleValue, ShadowEffect } from "./DesignElementNode";
import { buildSvgMarkup, rasterizeSvg, downloadBlob, type ExportableElement } from "@/lib/design-export";

interface DesignPropertiesPanelProps {
  selectedElement: DesignElement | null;
  parentElement: DesignElement | null;
  allElements: DesignElement[];
  onUpdate: (id: string, patch: Partial<DesignElement>) => void;
  onDelete: (id: string) => void;
}

const FILL_PALETTE = [
  "#ffffff", "#e5e7eb", "#9ca3af", "#4b5563", "#18181b", "#000000",
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
];

const TYPE_LABEL_TR: Record<DesignElement["type"], string> = {
  rectangle: "Dikdörtgen",
  ellipse: "Elips",
  text: "Metin",
  frame: "Çerçeve",
  image: "Görsel",
  path: "Çizgi",
};

function AccordionSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200"
      >
        {title}
        <span className={`text-[9px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && <div className="space-y-2.5 px-3 pb-3">{children}</div>}
    </div>
  );
}

function NumberField({ label, value, onCommit, min }: { label: string; value: number; onCommit: (v: number) => void; min?: number }) {
  const [draft, setDraft] = useState(String(Math.round(value * 100) / 100));
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
      <span className="w-5 shrink-0">{label}</span>
      <input
        type="number"
        value={draft}
        min={min}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (!Number.isNaN(n)) onCommit(n);
          else setDraft(String(value));
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-full min-w-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-[11px] text-white focus:border-violet-500 focus:outline-none"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-zinc-400">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {FILL_PALETTE.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={`h-5 w-5 rounded-md border-2 transition-transform hover:scale-110 ${
              value.toLowerCase() === color ? "border-violet-400" : "border-white/10"
            }`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-6 shrink-0 cursor-pointer rounded-md border border-white/10 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-[11px] text-white focus:border-violet-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

export function DesignPropertiesPanel({ selectedElement, parentElement, allElements, onUpdate, onDelete }: DesignPropertiesPanelProps) {
  if (!selectedElement) {
    return <p className="p-3 text-[11px] text-zinc-600">Ayarlarını görmek için bir eleman seçin.</p>;
  }

  const el = selectedElement;
  const patch = (p: Partial<DesignElement>) => onUpdate(el.id, p);

  const hasFill = el.type !== "path" && el.type !== "image";
  const hasStroke = el.type !== "text" && el.type !== "image";
  const hasBorderRadius = el.type === "rectangle" || el.type === "frame" || el.type === "image";
  const hasEffects = true;

  function alignWithinParent(axis: "x" | "y", where: "start" | "center" | "end") {
    const bound = axis === "x" ? (parentElement ? parentElement.width : 2000) : parentElement ? parentElement.height : 2000;
    const size = axis === "x" ? el.width : el.height;
    let pos = 0;
    if (where === "center") pos = (bound - size) / 2;
    else if (where === "end") pos = bound - size;
    patch(axis === "x" ? { posX: pos } : { posY: pos });
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center justify-between px-3 pt-3">
        <span className="text-[11px] font-semibold text-zinc-200">{TYPE_LABEL_TR[el.type]}</span>
        <button onClick={() => onDelete(el.id)} className="text-[11px] text-zinc-500 hover:text-red-400">
          Sil
        </button>
      </div>

      <AccordionSection title="Hizalama" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={el.posX} onCommit={(v) => patch({ posX: v })} />
          <NumberField label="Y" value={el.posY} onCommit={(v) => patch({ posY: v })} />
          <NumberField label="G" value={el.width} min={1} onCommit={(v) => patch({ width: v })} />
          <NumberField label="Y" value={el.height} min={1} onCommit={(v) => patch({ height: v })} />
        </div>
        {parentElement && (
          <div>
            <label className="mb-1 block text-[11px] text-zinc-400">Çerçeveye hizala</label>
            <div className="flex gap-1">
              {(["start", "center", "end"] as const).map((w) => (
                <button
                  key={`x-${w}`}
                  onClick={() => alignWithinParent("x", w)}
                  className="flex-1 rounded-md border border-white/10 bg-white/5 py-1 text-[10px] text-zinc-300 hover:bg-white/10"
                >
                  {w === "start" ? "Sol" : w === "center" ? "Orta Y" : "Sağ"}
                </button>
              ))}
            </div>
            <div className="mt-1 flex gap-1">
              {(["start", "center", "end"] as const).map((w) => (
                <button
                  key={`y-${w}`}
                  onClick={() => alignWithinParent("y", w)}
                  className="flex-1 rounded-md border border-white/10 bg-white/5 py-1 text-[10px] text-zinc-300 hover:bg-white/10"
                >
                  {w === "start" ? "Üst" : w === "center" ? "Orta D" : "Alt"}
                </button>
              ))}
            </div>
          </div>
        )}
      </AccordionSection>

      {el.type === "frame" && (
        <AccordionSection title="Auto Layout" defaultOpen>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-400">Yön</label>
            <div className="flex gap-1">
              {(["none", "horizontal", "vertical"] as AutoLayoutDirection[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => patch({ layoutMode: mode })}
                  className={`flex-1 rounded-md border py-1 text-[10px] transition-colors ${
                    el.layoutMode === mode
                      ? "border-violet-400/60 bg-violet-500/20 text-violet-200"
                      : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  {mode === "none" ? "Yok" : mode === "horizontal" ? "Yatay →" : "Dikey ↓"}
                </button>
              ))}
            </div>
          </div>
          {el.layoutMode !== "none" && (
            <>
              <NumberField label="Boşluk" value={el.layoutGap} min={0} onCommit={(v) => patch({ layoutGap: v })} />
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Üst" value={el.paddingTop} min={0} onCommit={(v) => patch({ paddingTop: v })} />
                <NumberField label="Sağ" value={el.paddingRight} min={0} onCommit={(v) => patch({ paddingRight: v })} />
                <NumberField label="Alt" value={el.paddingBottom} min={0} onCommit={(v) => patch({ paddingBottom: v })} />
                <NumberField label="Sol" value={el.paddingLeft} min={0} onCommit={(v) => patch({ paddingLeft: v })} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Karşı eksen hizası</label>
                <div className="flex gap-1">
                  {(["start", "center", "end"] as AutoLayoutAlign[]).map((a) => (
                    <button
                      key={a}
                      onClick={() => patch({ layoutAlign: a })}
                      className={`flex-1 rounded-md border py-1 text-[10px] transition-colors ${
                        el.layoutAlign === a
                          ? "border-violet-400/60 bg-violet-500/20 text-violet-200"
                          : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {a === "start" ? "Başlangıç" : a === "center" ? "Orta" : "Son"}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </AccordionSection>
      )}

      <AccordionSection title="Görünüm">
        <div>
          <label className="mb-1 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Opaklık</span>
            <span>{Math.round(el.opacity * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={el.opacity}
            onChange={(e) => patch({ opacity: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <NumberField label="↻" value={el.rotation} onCommit={(v) => patch({ rotation: v })} />
        {hasBorderRadius && (
          <div>
            <label className="mb-1 block text-[11px] text-zinc-400">Köşe yuvarlaklığı</label>
            <input
              type="range"
              min={0}
              max={100}
              value={el.borderRadius ?? 0}
              onChange={(e) => patch({ borderRadius: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        )}
        {el.type === "text" && (
          <NumberField label="Boyut" value={el.fontSize ?? 16} min={1} onCommit={(v) => patch({ fontSize: v })} />
        )}
      </AccordionSection>

      {hasFill && (
        <AccordionSection title="Dolgu">
          <ColorField label="Renk" value={el.fillColor} onChange={(v) => patch({ fillColor: v })} />
        </AccordionSection>
      )}

      {hasStroke && (
        <AccordionSection title="Kontur">
          <label className="flex items-center gap-2 text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={!!el.strokeColor}
              onChange={(e) =>
                patch(e.target.checked ? { strokeColor: "#ffffff", strokeWidth: el.strokeWidth || 1 } : { strokeColor: null, strokeWidth: 0 })
              }
            />
            Kontur ekle
          </label>
          {el.strokeColor && (
            <>
              <ColorField label="Renk" value={el.strokeColor} onChange={(v) => patch({ strokeColor: v })} />
              <NumberField label="Kalınlık" value={el.strokeWidth} min={0} onCommit={(v) => patch({ strokeWidth: v })} />
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">Stil</label>
                <div className="flex gap-1">
                  {(["solid", "dashed", "dotted"] as StrokeStyleValue[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => patch({ strokeStyle: s })}
                      className={`flex-1 rounded-md border py-1 text-[10px] transition-colors ${
                        el.strokeStyle === s
                          ? "border-violet-400/60 bg-violet-500/20 text-violet-200"
                          : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {s === "solid" ? "Düz" : s === "dashed" ? "Kesikli" : "Noktalı"}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </AccordionSection>
      )}

      {hasEffects && (
        <AccordionSection title="Efektler">
          {(el.effects ?? []).map((fx, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-white/10 p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">Gölge {i + 1}</span>
                <button
                  onClick={() => {
                    const next = (el.effects ?? []).filter((_, idx) => idx !== i);
                    patch({ effects: next });
                  }}
                  className="text-[10px] text-zinc-500 hover:text-red-400"
                >
                  Kaldır
                </button>
              </div>
              <ColorField
                label="Renk"
                value={fx.color}
                onChange={(v) => {
                  const next = [...(el.effects ?? [])];
                  next[i] = { ...fx, color: v };
                  patch({ effects: next });
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="X"
                  value={fx.x}
                  onCommit={(v) => {
                    const next = [...(el.effects ?? [])];
                    next[i] = { ...fx, x: v };
                    patch({ effects: next });
                  }}
                />
                <NumberField
                  label="Y"
                  value={fx.y}
                  onCommit={(v) => {
                    const next = [...(el.effects ?? [])];
                    next[i] = { ...fx, y: v };
                    patch({ effects: next });
                  }}
                />
                <NumberField
                  label="Bulanıklık"
                  value={fx.blur}
                  min={0}
                  onCommit={(v) => {
                    const next = [...(el.effects ?? [])];
                    next[i] = { ...fx, blur: v };
                    patch({ effects: next });
                  }}
                />
                <NumberField
                  label="Yayılma"
                  value={fx.spread}
                  onCommit={(v) => {
                    const next = [...(el.effects ?? [])];
                    next[i] = { ...fx, spread: v };
                    patch({ effects: next });
                  }}
                />
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              const newEffect: ShadowEffect = { type: "shadow", color: "#00000080", x: 0, y: 4, blur: 8, spread: 0 };
              patch({ effects: [...(el.effects ?? []), newEffect] });
            }}
            className="w-full rounded-lg border border-dashed border-white/20 py-1.5 text-[11px] text-zinc-400 hover:border-violet-400/50 hover:text-violet-300"
          >
            + Gölge Ekle
          </button>
        </AccordionSection>
      )}

      <ExportSection element={el} allElements={allElements} />
    </div>
  );
}

function ExportSection({ element, allElements }: { element: DesignElement; allElements: DesignElement[] }) {
  const [format, setFormat] = useState<"png" | "svg" | "jpg">("png");
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      const exportable = allElements as unknown as ExportableElement[];
      const root = exportable.find((e) => e.id === element.id)!;
      const svgMarkup = buildSvgMarkup(root, exportable);

      if (format === "svg") {
        downloadBlob(new Blob([svgMarkup], { type: "image/svg+xml" }), `${element.type}-${element.id.slice(0, 6)}.svg`);
        return;
      }
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const blob = await rasterizeSvg(svgMarkup, element.width, element.height, scale, mime);
      downloadBlob(blob, `${element.type}-${element.id.slice(0, 6)}@${scale}x.${format}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccordionSection title="Export">
      <div>
        <label className="mb-1 block text-[11px] text-zinc-400">Format</label>
        <div className="flex gap-1">
          {(["png", "svg", "jpg"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 rounded-md border py-1 text-[10px] uppercase transition-colors ${
                format === f
                  ? "border-violet-400/60 bg-violet-500/20 text-violet-200"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {format !== "svg" && (
        <div>
          <label className="mb-1 block text-[11px] text-zinc-400">Ölçek</label>
          <div className="flex gap-1">
            {[1, 2, 3].map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`flex-1 rounded-md border py-1 text-[10px] transition-colors ${
                  scale === s
                    ? "border-violet-400/60 bg-violet-500/20 text-violet-200"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={handleExport}
        disabled={busy}
        className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 py-1.5 text-[11px] font-medium text-white hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-50"
      >
        {busy ? "Hazırlanıyor…" : "İndir"}
      </button>
    </AccordionSection>
  );
}
