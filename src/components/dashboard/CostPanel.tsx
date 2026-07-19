"use client";

import { useEffect, useRef, useState } from "react";
import { type ProjectView } from "./DashboardLayout";
import { COST_PRESETS } from "@/lib/cost-presets";
import type { CostEstimateInputParams, CostEstimateResult } from "@/lib/cost-estimate";

interface CostPanelProps {
  project: ProjectView | null;
}

const DEFAULT_FORM: CostEstimateInputParams = {
  presetId: COST_PRESETS[0].id,
  monthlyActiveUsers: 0,
  avgRequestsPerUser: 50,
  assumedRowsPerTable: 10000,
  manualFileStorageGb: 0,
  egressGbPerMonth: 0,
};

const SAVE_DEBOUNCE_MS = 700;

const CURRENCY = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const GB = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

function formatDelta(usd: number) {
  return usd > 0 ? `+${CURRENCY.format(usd)}` : CURRENCY.format(0);
}

export function CostPanel({ project }: CostPanelProps) {
  const [form, setForm] = useState<CostEstimateInputParams>(DEFAULT_FORM);
  const [computed, setComputed] = useState<CostEstimateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const projectId = project?.id ?? null;

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function load(id: string) {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${id}/cost-estimate`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.input) {
            const { presetId, monthlyActiveUsers, avgRequestsPerUser, assumedRowsPerTable, manualFileStorageGb, egressGbPerMonth } = data.input;
            setForm({ presetId, monthlyActiveUsers, avgRequestsPerUser, assumedRowsPerTable, manualFileStorageGb, egressGbPerMonth });
          } else {
            setForm(DEFAULT_FORM);
          }
          setComputed(data.computed ?? null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadedProjectId(id);
        }
      }
    }
    load(projectId);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function updateForm<K extends keyof CostEstimateInputParams>(key: K, value: CostEstimateInputParams[K]) {
    const next = { ...form, [key]: value };
    setForm(next);

    if (!projectId || loadedProjectId !== projectId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaving(true);
      fetch(`/api/projects/${projectId}/cost-estimate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.computed) setComputed(data.computed);
        })
        .finally(() => setSaving(false));
    }, SAVE_DEBOUNCE_MS);
  }

  if (!project) return null;

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
          <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Maliyet Simülatörü
        </h1>
        <p className="text-sm text-zinc-400">
          Tasarladığınız şemaya ve tahmini kullanım rakamlarına göre aylık altyapı maliyetini kabaca tahmin eder.
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-6 text-sm text-amber-200">
        Bu bir kaba tahmindir, gerçek faturanız değil — barındırma sağlayıcınıza ve gerçek kullanım desenlerinize göre önemli ölçüde değişebilir.
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">Yükleniyor…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_1fr] gap-6">
          {/* Inputs */}
          <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-5 h-fit">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Referans Altyapı</label>
              <div className="space-y-2">
                {COST_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => updateForm("presetId", preset.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      form.presetId === preset.id
                        ? "border-amber-500/60 bg-amber-500/10 text-white"
                        : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-medium">{preset.label}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <NumberField
              label="Aylık aktif kullanıcı (MAU)"
              value={form.monthlyActiveUsers}
              onChange={(v) => updateForm("monthlyActiveUsers", v)}
            />
            <NumberField
              label="Kullanıcı başına aylık istek"
              value={form.avgRequestsPerUser}
              onChange={(v) => updateForm("avgRequestsPerUser", v)}
              helper="Sadece uyarılarda kullanılır, maliyete doğrudan yansımaz."
            />
            <NumberField
              label="Tabloya varsayılan satır sayısı"
              value={form.assumedRowsPerTable}
              onChange={(v) => updateForm("assumedRowsPerTable", v)}
              helper="Tasarladığınız tüm tablolara aynı şekilde uygulanır."
            />
            <NumberField
              label="Ek dosya/blob depolama (GB)"
              value={form.manualFileStorageGb}
              onChange={(v) => updateForm("manualFileStorageGb", v)}
              helper="Yüklemeler, avatarlar, export'lar — şemadaki kolonlardan tahmin edilemeyenler."
              step="0.1"
            />
            <NumberField
              label="Aylık veri transferi / egress (GB)"
              value={form.egressGbPerMonth}
              onChange={(v) => updateForm("egressGbPerMonth", v)}
              step="0.1"
            />

            <div className="text-xs text-zinc-500 h-4">{saving ? "Kaydediliyor…" : " "}</div>
          </div>

          {/* Output */}
          {computed && (
            <div className="space-y-6">
              <div className="glass-panel rounded-2xl border border-white/10 p-6">
                <div className="text-sm text-zinc-400 mb-1">Tahmini aylık maliyet</div>
                <div className="text-4xl font-bold text-white mb-4">{CURRENCY.format(computed.totalCostUsd)}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <BreakdownItem label="Taban" value={CURRENCY.format(computed.breakdown.base)} />
                  <BreakdownItem label="Kullanım aşımı" value={formatDelta(computed.breakdown.computeOverage)} />
                  <BreakdownItem label="Depolama aşımı" value={formatDelta(computed.breakdown.storageOverage)} />
                  <BreakdownItem label="Egress aşımı" value={formatDelta(computed.breakdown.egressOverage)} />
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 text-sm text-amber-200/80">
                  Bu bir kaba tahmindir, gerçek faturanız değil.
                </div>
              </div>

              <div className="glass-panel rounded-2xl border border-white/10 p-6">
                <h2 className="text-white font-semibold mb-1">Şemanızdan Türetildi</h2>
                <p className="text-sm text-zinc-400 mb-4">
                  {computed.perTableBreakdown.length} tablo · toplam tahmini veritabanı depolaması: {GB.format(computed.derivedStorageGb)} GB
                </p>
                {computed.perTableBreakdown.length === 0 ? (
                  <p className="text-sm text-zinc-500">Henüz tasarlanmış bir tablo yok.</p>
                ) : (
                  <div className="space-y-1">
                    {computed.perTableBreakdown.map((t) => (
                      <div key={t.name} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-white/5">
                        <span className="text-zinc-200">{t.name}</span>
                        <span className="text-zinc-400">
                          {t.columnCount} kolon · ~{Math.round(t.rowSizeBytes)} bayt/satır · {GB.format(t.estimatedGb)} GB
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {computed.flags.length > 0 && (
                <div className="space-y-2">
                  {computed.flags.map((flag, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-sm text-orange-200"
                    >
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {flag}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-white/5">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-white font-medium">{value}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  helper,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  helper?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1.5">{label}</label>
      <input
        type="number"
        min={0}
        step={step ?? "1"}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
      />
      {helper && <p className="text-xs text-zinc-500 mt-1">{helper}</p>}
    </div>
  );
}
