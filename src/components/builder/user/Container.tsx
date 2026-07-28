"use client";

import { useNode, type UserComponent } from "@craftjs/core";
import type { ReactNode } from "react";
import { SettingsRow, NumberInput, TextInput, ColorInput, SelectInput } from "./settings-controls";

export type ContainerFlexDirection = "row" | "column";
export type ContainerJustify = "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
export type ContainerAlign = "flex-start" | "center" | "flex-end" | "stretch";

export interface ContainerProps {
  background: string;
  flexDirection: ContainerFlexDirection;
  justifyContent: ContainerJustify;
  alignItems: ContainerAlign;
  gap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  radius: number;
  width: string;
  height: string;
  children?: ReactNode;
}

export const CONTAINER_DEFAULT_PROPS: ContainerProps = {
  background: "#ffffff",
  flexDirection: "column",
  justifyContent: "flex-start",
  alignItems: "stretch",
  gap: 8,
  paddingTop: 16,
  paddingRight: 16,
  paddingBottom: 16,
  paddingLeft: 16,
  radius: 0,
  width: "auto",
  height: "auto",
};

// Sadece "row"/"column" gibi SABİT, sonlu bir kümeye karşılık gelen
// Tailwind class'ları burada LİTERAL string olarak yazılıyor — Tailwind'in
// derleme zamanı (JIT) tarayıcısı kaynak kodda class adının TAMAMINI birebir
// görmek zorunda. `` `flex-${dir}` `` gibi dinamik bir template string
// yazılsaydı "flex-row"/"flex-col" hiçbir yerde tam metin olarak
// görünmeyeceği için Tailwind bu class'lara karşılık gelen CSS'i hiç
// üretmezdi (prod'da sessizce fark edilmeyen bir stil hatası). Sürekli
// değişken/kullanıcı girdili değerler (renk, gap, padding, radius, width,
// height) zaten sonlu bir kümeye sığmadığından inline `style` ile uygulanır.
const FLEX_DIRECTION_CLASS: Record<ContainerFlexDirection, string> = {
  row: "flex-row",
  column: "flex-col",
};
const JUSTIFY_CLASS: Record<ContainerJustify, string> = {
  "flex-start": "justify-start",
  center: "justify-center",
  "flex-end": "justify-end",
  "space-between": "justify-between",
  "space-around": "justify-around",
};
const ALIGN_CLASS: Record<ContainerAlign, string> = {
  "flex-start": "items-start",
  center: "items-center",
  "flex-end": "items-end",
  stretch: "items-stretch",
};

// Props tipi burada `Partial<ContainerProps>` — Craft.js `<Element is={
// Container} />` çağrılırken HİÇBİR prop verilmemiş olabilir (eksik alanlar
// `craft.props`daki varsayılanlardan doldurulur, ama bu bir RUNTIME
// davranışı; TypeScript bunu bilemez). Aşağıdaki destructuring'deki
// varsayılan değerler CONTAINER_DEFAULT_PROPS ile birebir aynı tutulmalı —
// biri, bir node ilk oluşturulduğunda (toolbox'tan sürüklenince) devreye
// girer, diğeri (bu destructuring) `is={Container}` her tip kontrolünden
// güvenle geçebilsin diye vardır; ikisi de aynı "varsayılan Container"
// tanımını temsil eder.
export const Container: UserComponent<Partial<ContainerProps>> = ({
  background = CONTAINER_DEFAULT_PROPS.background,
  flexDirection = CONTAINER_DEFAULT_PROPS.flexDirection,
  justifyContent = CONTAINER_DEFAULT_PROPS.justifyContent,
  alignItems = CONTAINER_DEFAULT_PROPS.alignItems,
  gap = CONTAINER_DEFAULT_PROPS.gap,
  paddingTop = CONTAINER_DEFAULT_PROPS.paddingTop,
  paddingRight = CONTAINER_DEFAULT_PROPS.paddingRight,
  paddingBottom = CONTAINER_DEFAULT_PROPS.paddingBottom,
  paddingLeft = CONTAINER_DEFAULT_PROPS.paddingLeft,
  radius = CONTAINER_DEFAULT_PROPS.radius,
  width = CONTAINER_DEFAULT_PROPS.width,
  height = CONTAINER_DEFAULT_PROPS.height,
  children,
}) => {
  const {
    connectors: { connect, drag },
  } = useNode();

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref));
      }}
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
        // Boş bir Container'ın tuval üzerinde hedef bulunamayacak kadar
        // küçülmesini engeller — bir çocuk eklenir eklenmez devre dışı
        // kalır (flex içeriği zaten kendi boyutunu belirler).
        minHeight: children ? undefined : 60,
      }}
    >
      {children}
    </div>
  );
};

function ContainerSettings() {
  const {
    props,
    actions: { setProp },
  } = useNode((node) => ({ props: node.data.props as ContainerProps }));

  function set<K extends keyof ContainerProps>(key: K, value: ContainerProps[K]) {
    setProp((p: ContainerProps) => {
      p[key] = value;
    });
  }

  return (
    <div className="flex flex-col divide-y divide-white/5 px-3">
      <SettingsRow label="Yön">
        <SelectInput
          value={props.flexDirection}
          onChange={(v) => set("flexDirection", v)}
          options={[
            { value: "row", label: "Yatay" },
            { value: "column", label: "Dikey" },
          ]}
        />
      </SettingsRow>
      <SettingsRow label="Ana eksen hizası">
        <SelectInput
          value={props.justifyContent}
          onChange={(v) => set("justifyContent", v)}
          options={[
            { value: "flex-start", label: "Başlangıç" },
            { value: "center", label: "Orta" },
            { value: "flex-end", label: "Son" },
            { value: "space-between", label: "Aralıklı" },
            { value: "space-around", label: "Çevresel" },
          ]}
        />
      </SettingsRow>
      <SettingsRow label="Çapraz eksen hizası">
        <SelectInput
          value={props.alignItems}
          onChange={(v) => set("alignItems", v)}
          options={[
            { value: "flex-start", label: "Başlangıç" },
            { value: "center", label: "Orta" },
            { value: "flex-end", label: "Son" },
            { value: "stretch", label: "Genişlet" },
          ]}
        />
      </SettingsRow>
      <SettingsRow label="Boşluk (gap)">
        <NumberInput value={props.gap} onChange={(v) => set("gap", v)} min={0} />
      </SettingsRow>
      <SettingsRow label="Üst boşluk">
        <NumberInput value={props.paddingTop} onChange={(v) => set("paddingTop", v)} min={0} />
      </SettingsRow>
      <SettingsRow label="Sağ boşluk">
        <NumberInput value={props.paddingRight} onChange={(v) => set("paddingRight", v)} min={0} />
      </SettingsRow>
      <SettingsRow label="Alt boşluk">
        <NumberInput value={props.paddingBottom} onChange={(v) => set("paddingBottom", v)} min={0} />
      </SettingsRow>
      <SettingsRow label="Sol boşluk">
        <NumberInput value={props.paddingLeft} onChange={(v) => set("paddingLeft", v)} min={0} />
      </SettingsRow>
      <SettingsRow label="Köşe yarıçapı">
        <NumberInput value={props.radius} onChange={(v) => set("radius", v)} min={0} />
      </SettingsRow>
      <SettingsRow label="Genişlik">
        <TextInput value={props.width} onChange={(v) => set("width", v)} placeholder="320px, 100%, auto" />
      </SettingsRow>
      <SettingsRow label="Yükseklik">
        <TextInput value={props.height} onChange={(v) => set("height", v)} placeholder="200px, auto" />
      </SettingsRow>
      <SettingsRow label="Arka plan">
        <ColorInput value={props.background} onChange={(v) => set("background", v)} />
      </SettingsRow>
    </div>
  );
}

Container.craft = {
  displayName: "Container",
  props: CONTAINER_DEFAULT_PROPS,
  // Her Container instance'ı, nereye bırakılırsa bırakılsın otomatik olarak
  // droppable bir alan olsun diye — kullanım yerinde ayrıca <Element canvas>
  // ile sarmalamaya gerek kalmaz (bkz. node_modules/@craftjs/core'daki
  // UserComponentConfig.isCanvas alanı).
  isCanvas: true,
  rules: {
    canDrag: () => true,
    canMoveIn: () => true,
    canMoveOut: () => true,
  },
  related: {
    settings: ContainerSettings,
  },
};
