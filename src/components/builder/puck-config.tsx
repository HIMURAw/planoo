"use client";

// Puck (@puckeditor/core) Config tanımı — Tasarım Kanvası'nın Puck tabanlı
// sürümü için 4 temel bileşen: Container (nested/Auto Layout), Text, Button,
// Image. Craft.js denemesinden farklı olarak sağ paneldeki ayarlar burada
// custom React bileşenleri (`related.settings`) yerine DEKLARATİF `fields`
// tanımlarıyla kuruluyor — Puck bu tanımlardan paneli otomatik üretiyor.
import type { CustomField, Config, Data, Slot } from "@puckeditor/core";

// Puck'ın yerleşik field tiplerinde (text/number/select/radio/...) bir renk
// seçici yok — "custom" field tipiyle küçük bir renk + hex girişi kuruyoruz;
// Container/Text/Button'ın hepsi aynı yardımcıyı paylaşıyor.
function colorField(label: string): CustomField<string> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange }) => {
      const swatch = /^#([0-9a-fA-F]{3}){1,2}$/.test(value) ? value : "#ffffff";
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="color"
            value={swatch}
            onChange={(e) => onChange(e.target.value)}
            style={{ height: 24, width: 24, cursor: "pointer", border: "1px solid #d1d5db", borderRadius: 4, padding: 0 }}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 84, fontSize: 12, padding: "2px 6px", border: "1px solid #d1d5db", borderRadius: 4 }}
          />
        </div>
      );
    },
  };
}

// Sadece SABİT/sonlu bir kümeye (row/column, hizalama seçenekleri, yazı
// kalınlığı...) karşılık gelen Tailwind class'ları burada literal string
// olarak bir lookup objesinde tutuluyor — Tailwind'in derleme zamanı (JIT)
// tarayıcısı kaynakta class adının TAMAMINI birebir görmek zorunda; dinamik
// bir template string (`` `flex-${dir}` ``) yazılsaydı karşılık gelen CSS
// hiç üretilmezdi. Sürekli değişken değerler (renk, gap, padding, radius,
// width, height, src) zaten sonlu bir kümeye sığmadığından inline `style`
// ile uygulanıyor.
const FLEX_DIRECTION_CLASS = { row: "flex-row", column: "flex-col" } as const;
const JUSTIFY_CLASS = {
  "flex-start": "justify-start",
  center: "justify-center",
  "flex-end": "justify-end",
  "space-between": "justify-between",
  "space-around": "justify-around",
} as const;
const ALIGN_CLASS = {
  "flex-start": "items-start",
  center: "items-center",
  "flex-end": "items-end",
  stretch: "items-stretch",
} as const;
const FONT_WEIGHT_CLASS = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
} as const;
const BUTTON_WIDTH_CLASS = { auto: "w-auto", full: "w-full" } as const;
const OBJECT_FIT_CLASS = { cover: "object-cover", contain: "object-contain", fill: "object-fill" } as const;

export interface ContainerProps {
  flexDirection: keyof typeof FLEX_DIRECTION_CLASS;
  justifyContent: keyof typeof JUSTIFY_CLASS;
  alignItems: keyof typeof ALIGN_CLASS;
  gap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  radius: number;
  background: string;
  width: string;
  height: string;
  // Nested/Auto Layout mekanizması: Puck'ın modern "slot" field tipi
  // (eski, artık deprecated olan <DropZone> API'sinin yerini alıyor).
  // Render'da bu prop, çağrılabilir bir bileşene dönüşür (bkz. render'daki
  // `content: Content` yeniden adlandırması).
  content: Slot;
}

// `contentEditable: true` olan bir alan, <Puck> editörü İÇİNDE prop
// değerini string yerine bir Object'e çevirir (yayınlanmış/<Render>
// içeriğinde yine string kalır) — bu yüzden tip `string | ReactNode`.
// (bkz. Puck dokümantasyonu: "api-reference/fields/text")
export interface TextProps {
  text: string | React.ReactNode;
  fontSize: number;
  fontWeight: keyof typeof FONT_WEIGHT_CLASS;
  color: string;
  textAlign: "left" | "center" | "right";
}

export interface ButtonProps {
  text: string | React.ReactNode;
  background: string;
  color: string;
  paddingX: number;
  paddingY: number;
  radius: number;
  fontSize: number;
  fontWeight: keyof typeof FONT_WEIGHT_CLASS;
  width: keyof typeof BUTTON_WIDTH_CLASS;
}

export interface ImageProps {
  src: string;
  alt: string;
  width: string;
  height: string;
  radius: number;
  objectFit: keyof typeof OBJECT_FIT_CLASS;
}

export type BuilderComponents = {
  Container: ContainerProps;
  Text: TextProps;
  Button: ButtonProps;
  Image: ImageProps;
};

export const puckConfig: Config<BuilderComponents> = {
  categories: {
    temel: { title: "Temel Bileşenler", components: ["Container", "Text", "Button", "Image"] },
  },
  components: {
    Container: {
      label: "Kapsayıcı",
      // Puck varsayılan olarak her bileşeni ekstra bir <div> ile sarar —
      // bir üst Container'ın flex düzenine (örn. flex-grow, yan yana
      // dizilim) gerçekten katılabilmesi için `inline: true` + kendi kök
      // elemanına `puck.dragRef` bağlanması gerekiyor (Puck dokümantasyonu:
      // "integrating-puck/multi-column-layouts").
      inline: true,
      fields: {
        flexDirection: {
          type: "radio",
          label: "Yön",
          options: [
            { label: "Yatay", value: "row" },
            { label: "Dikey", value: "column" },
          ],
        },
        justifyContent: {
          type: "select",
          label: "Ana eksen hizası",
          options: [
            { label: "Başlangıç", value: "flex-start" },
            { label: "Orta", value: "center" },
            { label: "Son", value: "flex-end" },
            { label: "Aralıklı", value: "space-between" },
            { label: "Çevresel", value: "space-around" },
          ],
        },
        alignItems: {
          type: "select",
          label: "Çapraz eksen hizası",
          options: [
            { label: "Başlangıç", value: "flex-start" },
            { label: "Orta", value: "center" },
            { label: "Son", value: "flex-end" },
            { label: "Genişlet", value: "stretch" },
          ],
        },
        gap: { type: "number", label: "Boşluk (gap)", min: 0 },
        paddingTop: { type: "number", label: "Üst boşluk", min: 0 },
        paddingRight: { type: "number", label: "Sağ boşluk", min: 0 },
        paddingBottom: { type: "number", label: "Alt boşluk", min: 0 },
        paddingLeft: { type: "number", label: "Sol boşluk", min: 0 },
        radius: { type: "number", label: "Köşe yarıçapı", min: 0 },
        background: colorField("Arka plan"),
        width: { type: "text", label: "Genişlik", placeholder: "320px, 100%, auto" },
        height: { type: "text", label: "Yükseklik", placeholder: "200px, auto" },
        content: { type: "slot" },
      },
      defaultProps: {
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "stretch",
        gap: 8,
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16,
        radius: 0,
        background: "#ffffff",
        width: "auto",
        height: "auto",
        content: [],
      },
      render: ({
        flexDirection,
        justifyContent,
        alignItems,
        gap,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
        radius,
        background,
        width,
        height,
        content: Content,
        puck,
      }) => (
        <div
          ref={puck.dragRef}
          className={`flex ${FLEX_DIRECTION_CLASS[flexDirection]} ${JUSTIFY_CLASS[justifyContent]} ${ALIGN_CLASS[alignItems]}`}
          style={{
            background,
            gap,
            paddingTop,
            paddingRight,
            paddingBottom,
            paddingLeft,
            borderRadius: radius,
            width,
            height,
            minHeight: 60,
          }}
        >
          <Content />
        </div>
      ),
    },

    Text: {
      label: "Metin",
      inline: true,
      fields: {
        text: { type: "textarea", label: "Metin", contentEditable: true },
        fontSize: { type: "number", label: "Yazı boyutu", min: 8 },
        fontWeight: {
          type: "select",
          label: "Yazı kalınlığı",
          options: [
            { label: "Normal", value: "normal" },
            { label: "Orta", value: "medium" },
            { label: "Yarı Kalın", value: "semibold" },
            { label: "Kalın", value: "bold" },
          ],
        },
        color: colorField("Yazı rengi"),
        textAlign: {
          type: "radio",
          label: "Hizalama",
          options: [
            { label: "Sol", value: "left" },
            { label: "Orta", value: "center" },
            { label: "Sağ", value: "right" },
          ],
        },
      },
      defaultProps: {
        text: "Metin",
        fontSize: 16,
        fontWeight: "normal",
        color: "#111827",
        textAlign: "left",
      },
      render: ({ text, fontSize, fontWeight, color, textAlign, puck }) => (
        <p ref={puck.dragRef} className={FONT_WEIGHT_CLASS[fontWeight]} style={{ fontSize, color, textAlign, margin: 0 }}>
          {text}
        </p>
      ),
    },

    Button: {
      label: "Buton",
      inline: true,
      fields: {
        text: { type: "text", label: "Metin", contentEditable: true },
        width: {
          type: "radio",
          label: "Genişlik",
          options: [
            { label: "İçeriğe göre", value: "auto" },
            { label: "Tam genişlik", value: "full" },
          ],
        },
        paddingX: { type: "number", label: "Yatay boşluk", min: 0 },
        paddingY: { type: "number", label: "Dikey boşluk", min: 0 },
        radius: { type: "number", label: "Köşe yarıçapı", min: 0 },
        fontSize: { type: "number", label: "Yazı boyutu", min: 8 },
        fontWeight: {
          type: "select",
          label: "Yazı kalınlığı",
          options: [
            { label: "Normal", value: "normal" },
            { label: "Orta", value: "medium" },
            { label: "Yarı Kalın", value: "semibold" },
            { label: "Kalın", value: "bold" },
          ],
        },
        background: colorField("Arka plan"),
        color: colorField("Yazı rengi"),
      },
      defaultProps: {
        text: "Buton",
        background: "#7c3aed",
        color: "#ffffff",
        paddingX: 20,
        paddingY: 10,
        radius: 8,
        fontSize: 14,
        fontWeight: "medium",
        width: "auto",
      },
      render: ({ text, background, color, paddingX, paddingY, radius, fontSize, fontWeight, width, puck }) => (
        <button
          ref={puck.dragRef}
          type="button"
          className={`inline-flex items-center justify-center border-none ${FONT_WEIGHT_CLASS[fontWeight]} ${BUTTON_WIDTH_CLASS[width]}`}
          style={{
            background,
            color,
            paddingLeft: paddingX,
            paddingRight: paddingX,
            paddingTop: paddingY,
            paddingBottom: paddingY,
            borderRadius: radius,
            fontSize,
          }}
        >
          {text}
        </button>
      ),
    },

    Image: {
      label: "Görsel",
      inline: true,
      fields: {
        src: { type: "text", label: "Görsel URL" },
        alt: { type: "text", label: "Alternatif metin" },
        width: { type: "text", label: "Genişlik", placeholder: "320px, 100%" },
        height: { type: "text", label: "Yükseklik", placeholder: "200px, auto" },
        radius: { type: "number", label: "Köşe yarıçapı", min: 0 },
        objectFit: {
          type: "select",
          label: "Sığdırma",
          options: [
            { label: "Kırp (cover)", value: "cover" },
            { label: "Sığdır (contain)", value: "contain" },
            { label: "Doldur (fill)", value: "fill" },
          ],
        },
      },
      defaultProps: {
        src: "",
        alt: "",
        width: "240px",
        height: "160px",
        radius: 0,
        objectFit: "cover",
      },
      render: ({ src, alt, width, height, radius, objectFit, puck }) => (
        <div ref={puck.dragRef} style={{ width, height, borderRadius: radius, overflow: "hidden", background: "#e5e7eb" }}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- kullanıcı tarafından girilen, derleme zamanında bilinmeyen bir URL; next/image bunu optimize edemez
            <img src={src} alt={alt} className={`h-full w-full ${OBJECT_FIT_CLASS[objectFit]}`} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">Görsel URL girin</div>
          )}
        </div>
      ),
    },
  },
  // `iframe={{ syncHostStyles: true }}` (bkz. BuilderEditor.tsx) planoo'nun
  // KENDİ global CSS'ini (`body { background: #05050a }` — koyu tema) canvas
  // iframe'ine de kopyalıyor; bu sync olmadan Tailwind class'larımız hiç
  // çalışmazdı, ama yan etkisi tasarlanan SAYFANIN canvas'ta planoo'nun kendi
  // koyu temasıyla (siyaha yakın arka plan) görünmesiydi. Kök render'ı elle
  // nötr/beyaz bir sayfa zeminiyle geçersiz kılmak bunu düzeltiyor — gerçek
  // bir sayfa builder'ının canvas'ı, builder uygulamasının kendi temasını
  // değil, tasarlanan sayfanın zeminini yansıtmalı.
  root: {
    render: ({ children }) => (
      <div style={{ minHeight: "100vh", background: "#ffffff", color: "#111827" }}>{children}</div>
    ),
  },
};

export const initialPuckData: Data<BuilderComponents> = {
  root: {},
  content: [],
  zones: {},
};
