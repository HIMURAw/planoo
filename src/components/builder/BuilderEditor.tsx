"use client";

import { useState } from "react";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { puckConfig, initialPuckData, type BuilderComponents } from "./puck-config";

// Bu bileşen her zaman `next/dynamic(..., { ssr: false })` ile yüklenmeli
// (bkz. DesignPanel.tsx) — Puck'ın sürükle-bırak motoru DOM ölçümü/rastgele
// id üretimi gibi tarayıcıya özgü işler yapıyor; sunucuda render edilirse
// server/client çıktısı birebir eşleşmeyip hydration hatası riski doğar.
export function BuilderEditor() {
  const [data, setData] = useState<Data<BuilderComponents>>(initialPuckData);

  return (
    <div style={{ height: "100%" }}>
      <Puck
        config={puckConfig}
        data={data}
        onChange={setData}
        // Puck render'lar canvas'ı bir iframe içinde (host app'ten CSS
        // izolasyonu için) — `syncHostStyles` olmadan, render fonksiyonlarımızın
        // kullandığı Tailwind class'ları (flex, flex-row, font-medium, ...)
        // bu iframe'e hiç kopyalanmaz ve tuval stilsiz görünür.
        iframe={{ syncHostStyles: true }}
        onPublish={(finalData) => {
          // Kalıcılık (DB'ye kaydetme) ve JSON export/Preview modu henüz bu
          // adımın kapsamında değil — TopBar/Export/Preview ile birlikte
          // ayrı bir adımda ele alınacak.
          console.info("Puck onPublish — henüz kalıcılık yok:", finalData);
        }}
      />
    </div>
  );
}
