"use client";

import { useEditor, useNode, type UserComponent } from "@craftjs/core";
import type { FocusEvent, KeyboardEvent } from "react";
import { SettingsRow, NumberInput, TextInput, ColorInput, SelectInput } from "./settings-controls";

export type ButtonFontWeight = "normal" | "medium" | "semibold" | "bold";
export type ButtonWidth = "auto" | "full";

export interface ButtonProps {
  text: string;
  background: string;
  color: string;
  paddingX: number;
  paddingY: number;
  radius: number;
  fontSize: number;
  fontWeight: ButtonFontWeight;
  width: ButtonWidth;
}

export const BUTTON_DEFAULT_PROPS: ButtonProps = {
  text: "Buton",
  background: "#7c3aed",
  color: "#ffffff",
  paddingX: 20,
  paddingY: 10,
  radius: 8,
  fontSize: 14,
  fontWeight: "medium",
  width: "auto",
};

// bkz. Container.tsx'teki aynı isimli not: sadece "width: auto/full" gibi
// sabit/sonlu bir kümeye karşılık geldiği için bu class'lar Tailwind'in JIT
// tarayıcısının görebileceği literal string'ler olarak bir lookup
// objesinde tutuluyor — dinamik bir template string olsaydı karşılık gelen
// CSS hiç üretilmezdi.
const FONT_WEIGHT_CLASS: Record<ButtonFontWeight, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};
const WIDTH_CLASS: Record<ButtonWidth, string> = {
  auto: "w-auto",
  full: "w-full",
};

// bkz. Container.tsx'teki aynı isimli not: `Partial<ButtonProps>` + varsayılan
// değerli destructuring, `<Element is={Button} />`'ın hiç prop verilmeden de
// tip kontrolünden geçebilmesi için gerekli — gerçek değerler yine
// `craft.props` (BUTTON_DEFAULT_PROPS) üzerinden runtime'da doldurulur.
export const Button: UserComponent<Partial<ButtonProps>> = ({
  text = BUTTON_DEFAULT_PROPS.text,
  background = BUTTON_DEFAULT_PROPS.background,
  color = BUTTON_DEFAULT_PROPS.color,
  paddingX = BUTTON_DEFAULT_PROPS.paddingX,
  paddingY = BUTTON_DEFAULT_PROPS.paddingY,
  radius = BUTTON_DEFAULT_PROPS.radius,
  fontSize = BUTTON_DEFAULT_PROPS.fontSize,
  fontWeight = BUTTON_DEFAULT_PROPS.fontWeight,
  width = BUTTON_DEFAULT_PROPS.width,
}) => {
  const {
    connectors: { connect, drag },
    actions: { setProp },
  } = useNode();
  // Önizleme modunda (editor.options.enabled === false) metin düzenlemeyi
  // kapatır — "Sonraki Adım"daki TopBar'ın Preview anahtarı bu bayrağı
  // `actions.setOptions(o => { o.enabled = false })` ile değiştirecek.
  const { enabled } = useEditor((state) => ({ enabled: state.options.enabled }));

  function commitText(e: FocusEvent<HTMLSpanElement>) {
    const next = e.currentTarget.textContent ?? "";
    if (next !== text) {
      setProp((p: ButtonProps) => {
        p.text = next;
      });
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLSpanElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  return (
    <button
      ref={(ref) => {
        if (ref) connect(drag(ref));
      }}
      type="button"
      className={`inline-flex items-center justify-center border-none ${FONT_WEIGHT_CLASS[fontWeight]} ${WIDTH_CLASS[width]}`}
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
      <span
        contentEditable={enabled}
        suppressContentEditableWarning
        onBlur={commitText}
        onKeyDown={handleKeyDown}
        // Craft.js kendi seçim/sürükleme event'lerini butonun KENDİSİ
        // üzerinden dinliyor — metin düzenlerken buraya bir tıklama, üstteki
        // butonun seçim davranışına sızıp imleç konumlandırmayı bozmasın.
        onClick={(e) => {
          if (enabled) e.stopPropagation();
        }}
        className="cursor-text outline-none"
      >
        {text}
      </span>
    </button>
  );
};

function ButtonSettings() {
  const {
    props,
    actions: { setProp },
  } = useNode((node) => ({ props: node.data.props as ButtonProps }));

  function set<K extends keyof ButtonProps>(key: K, value: ButtonProps[K]) {
    setProp((p: ButtonProps) => {
      p[key] = value;
    });
  }

  return (
    <div className="flex flex-col divide-y divide-white/5 px-3">
      <SettingsRow label="Metin">
        <TextInput value={props.text} onChange={(v) => set("text", v)} />
      </SettingsRow>
      <SettingsRow label="Genişlik">
        <SelectInput
          value={props.width}
          onChange={(v) => set("width", v)}
          options={[
            { value: "auto", label: "İçeriğe göre" },
            { value: "full", label: "Tam genişlik" },
          ]}
        />
      </SettingsRow>
      <SettingsRow label="Yatay boşluk">
        <NumberInput value={props.paddingX} onChange={(v) => set("paddingX", v)} min={0} />
      </SettingsRow>
      <SettingsRow label="Dikey boşluk">
        <NumberInput value={props.paddingY} onChange={(v) => set("paddingY", v)} min={0} />
      </SettingsRow>
      <SettingsRow label="Köşe yarıçapı">
        <NumberInput value={props.radius} onChange={(v) => set("radius", v)} min={0} />
      </SettingsRow>
      <SettingsRow label="Yazı boyutu">
        <NumberInput value={props.fontSize} onChange={(v) => set("fontSize", v)} min={8} />
      </SettingsRow>
      <SettingsRow label="Yazı kalınlığı">
        <SelectInput
          value={props.fontWeight}
          onChange={(v) => set("fontWeight", v)}
          options={[
            { value: "normal", label: "Normal" },
            { value: "medium", label: "Orta" },
            { value: "semibold", label: "Yarı Kalın" },
            { value: "bold", label: "Kalın" },
          ]}
        />
      </SettingsRow>
      <SettingsRow label="Arka plan">
        <ColorInput value={props.background} onChange={(v) => set("background", v)} />
      </SettingsRow>
      <SettingsRow label="Yazı rengi">
        <ColorInput value={props.color} onChange={(v) => set("color", v)} />
      </SettingsRow>
    </div>
  );
}

Button.craft = {
  displayName: "Button",
  props: BUTTON_DEFAULT_PROPS,
  rules: {
    canDrag: () => true,
  },
  related: {
    settings: ButtonSettings,
  },
};
