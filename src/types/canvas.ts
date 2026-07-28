// Kanonik, düz (flat) Canvas Node tipleri — Tasarım Kanvası'nın state
// mimarisinin temeli. Bilinçli olarak `DesignElement` (src/components/
// canvas/DesignElementNode.tsx) ile BİREBİR aynı alanları taşır: bu, Prisma
// `DesignElement` tablosunun kolonlarıyla ve mevcut /api/design/elements
// route'larıyla hiçbir dönüşüm katmanı gerektirmeden uyumlu kalması için
// (posX/posY isimlendirmesi de bu yüzden x/y'ye çevrilmiyor — API contract'ı
// zaten bu isimlerle konuşuyor). Tek gerçek yapısal fark: `children:
// string[]`. Mevcut sistemde hiyerarşi her render'da `elements.filter(e =>
// e.parentId === id)` ile TÜRETİLİYORDU; bu mimaride ise store tarafından
// bir invariant olarak sürekli güncel tutulan, doğrudan bir referans
// dizisi — bkz. src/lib/canvas-store.ts.
import type {
  DesignElement,
  DesignElementType,
  ShadowEffect,
  PathPoint,
  StrokeStyleValue,
} from "@/components/canvas/DesignElementNode";
import type { AutoLayoutDirection, AutoLayoutAlign } from "@/lib/auto-layout";

// Tek kaynaktan (bu dosyadan) da erişilebilsin diye re-export ediliyor —
// ayrı/paralel bir tanım DEĞİL, aynı union'a bir takma ad.
export type {
  DesignElementType as CanvasNodeType,
  ShadowEffect,
  PathPoint,
  StrokeStyleValue,
  AutoLayoutDirection,
  AutoLayoutAlign,
};

export interface CanvasNode extends DesignElement {
  // Bu node'un DOĞRUDAN çocuklarının id'leri, görsel sırayla (aynı `order`
  // alanının ifade ettiği z-index/auto-layout sırasıyla tutarlı bir dizi
  // hâlinde tutulur). `parentId: null` olan kök node'lar için karşılığı
  // CanvasState.rootIds'tir.
  children: string[];
}

// Store'un dışarı verdiği ham (flat) durum — asla iç içe bir ağaç değil.
export interface CanvasState {
  nodes: Record<string, CanvasNode>;
  // Kök seviyedeki (parentId: null) node id'leri, görsel sırayla.
  rootIds: string[];
}
