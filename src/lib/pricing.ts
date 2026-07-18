// Single source of truth for the three plans, used by both the landing
// page's pricing section and the checkout-creation route. Displayed prices
// are the ranges given at product-decision time — the amount actually
// charged comes from whatever price is configured on the corresponding
// Lemon Squeezy variant (see .env.example), not from a number in this file.
// Keep them in sync manually when the real Lemon Squeezy product is priced.
export type PlanId = "free" | "solo" | "team";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceLabel: string;
  priceSuffix: string;
  description: string;
  features: string[];
  cta: string;
  /** Env var name holding this plan's Lemon Squeezy variant ID. Free has none — it's not a checkout. */
  variantEnvVar?: "LEMONSQUEEZY_SOLO_VARIANT_ID" | "LEMONSQUEEZY_TEAM_VARIANT_ID";
  highlighted?: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Ücretsiz",
    priceLabel: "$0",
    priceSuffix: "/ay",
    description: "Bireysel geliştiriciler için — sisteme alışmak amaçlı.",
    features: [
      "1 aktif proje",
      "10 veri tabanı tablosu çizimi",
      "Manuel / sınırlı Figma senkronizasyonu",
    ],
    cta: "Ücretsiz başla",
  },
  {
    id: "solo",
    name: "Solo Developer",
    priceLabel: "$12–19",
    priceSuffix: "/ay",
    description: "Tek başına çalışan geliştiriciler için.",
    features: [
      "Sınırsız proje",
      "Otomatik Figma API senkronizasyonu",
      "Şemayı direkt koda dönüştür (SQL, Prisma, TypeORM export)",
    ],
    cta: "Solo'ya geç",
    variantEnvVar: "LEMONSQUEEZY_SOLO_VARIANT_ID",
    highlighted: true,
  },
  {
    id: "team",
    name: "Team / Agency",
    priceLabel: "$49–99",
    priceSuffix: "/ay",
    description: "Ajanslar ve ekipler için.",
    features: [
      "Ekip içi canlı (real-time) iş birliği",
      "Revizyon geçmişi",
      "Müşterilere salt-okunur (read-only) sunum linkleri",
    ],
    cta: "Team'e geç",
    variantEnvVar: "LEMONSQUEEZY_TEAM_VARIANT_ID",
  },
];

export function getPlan(id: PlanId): PlanDefinition {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan id: ${id}`);
  return plan;
}
