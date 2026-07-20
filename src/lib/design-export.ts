// Client-only: exporting a design element (and its nested children, if it's
// a frame) to SVG/PNG/JPG. Rendered as an SVG string first — that's the
// natural format for these shapes (rect/ellipse/text/image/path are all
// direct SVG primitives) and gives SVG export for free; PNG/JPG are then
// produced by rasterizing that same SVG onto an offscreen canvas, so there's
// exactly one rendering path to keep correct rather than two.

export type ShadowEffect = {
  type: "shadow";
  color: string;
  x: number;
  y: number;
  blur: number;
  spread: number;
};

export interface ExportableElement {
  id: string;
  parentId: string | null;
  type: "rectangle" | "ellipse" | "text" | "frame" | "image" | "path";
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  order: number;
  fillColor: string;
  text: string | null;
  fontSize: number | null;
  borderRadius: number | null;
  strokeColor: string | null;
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  effects: ShadowEffect[] | null;
  pathData: { x: number; y: number }[] | null;
  imageData: string | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dashArray(style: ExportableElement["strokeStyle"], width: number): string | null {
  if (style === "dashed") return `${Math.max(width * 2, 4)},${Math.max(width, 4)}`;
  if (style === "dotted") return `${width},${width * 1.6}`;
  return null;
}

function strokeAttrs(el: ExportableElement): string {
  if (!el.strokeColor || el.strokeWidth <= 0) return "";
  const dash = dashArray(el.strokeStyle, el.strokeWidth);
  return ` stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ""}`;
}

function filterAttrs(el: ExportableElement, filterId: string): string {
  return el.effects && el.effects.length > 0 ? ` filter="url(#${filterId})"` : "";
}

function buildFilterDefs(el: ExportableElement, filterId: string): string {
  if (!el.effects || el.effects.length === 0) return "";
  const shadows = el.effects
    .map(
      (fx) =>
        `<feDropShadow dx="${fx.x}" dy="${fx.y}" stdDeviation="${Math.max(fx.blur / 2, 0)}" flood-color="${fx.color}" />`,
    )
    .join("");
  return `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">${shadows}</filter>`;
}

function rotateTransform(el: ExportableElement, absX: number, absY: number): string {
  if (!el.rotation) return "";
  const cx = absX + el.width / 2;
  const cy = absY + el.height / 2;
  return ` transform="rotate(${el.rotation} ${cx} ${cy})"`;
}

function renderShapeSvg(el: ExportableElement, absX: number, absY: number): { markup: string; defs: string } {
  const filterId = `fx-${el.id}`;
  const defs = buildFilterDefs(el, filterId);
  const opacityAttr = el.opacity < 1 ? ` opacity="${el.opacity}"` : "";
  const rotate = rotateTransform(el, absX, absY);
  const filter = filterAttrs(el, filterId);

  if (el.type === "path") {
    const points = (el.pathData ?? []).map((p) => `${absX + p.x},${absY + p.y}`).join(" ");
    return {
      defs,
      markup: `<polyline points="${points}" fill="none"${strokeAttrs(el)}${opacityAttr}${rotate}${filter} />`,
    };
  }

  if (el.type === "ellipse") {
    const rx = el.width / 2;
    const ry = el.height / 2;
    return {
      defs,
      markup: `<ellipse cx="${absX + rx}" cy="${absY + ry}" rx="${rx}" ry="${ry}" fill="${el.fillColor}"${strokeAttrs(el)}${opacityAttr}${rotate}${filter} />`,
    };
  }

  if (el.type === "text") {
    const fontSize = el.fontSize ?? 16;
    const lines = (el.text ?? "").split("\n");
    const tspans = lines
      .map((line, i) => `<tspan x="${absX}" dy="${i === 0 ? fontSize : fontSize * 1.2}">${escapeXml(line)}</tspan>`)
      .join("");
    return {
      defs,
      markup: `<text x="${absX}" y="${absY + fontSize}" font-size="${fontSize}" fill="${el.fillColor}" font-family="sans-serif"${opacityAttr}${rotate}${filter}>${tspans}</text>`,
    };
  }

  if (el.type === "image") {
    return {
      defs,
      markup: el.imageData
        ? `<image href="${el.imageData}" x="${absX}" y="${absY}" width="${el.width}" height="${el.height}" preserveAspectRatio="xMidYMid slice"${opacityAttr}${rotate}${filter} />`
        : "",
    };
  }

  // rectangle or frame
  const rx = el.borderRadius ?? 0;
  return {
    defs,
    markup: `<rect x="${absX}" y="${absY}" width="${el.width}" height="${el.height}" rx="${rx}" fill="${el.fillColor}"${strokeAttrs(el)}${opacityAttr}${rotate}${filter} />`,
  };
}

function renderElementSvg(
  el: ExportableElement,
  allElements: ExportableElement[],
  parentAbsX: number,
  parentAbsY: number,
): { markup: string; defs: string } {
  const absX = parentAbsX + el.posX;
  const absY = parentAbsY + el.posY;
  const { markup, defs } = renderShapeSvg(el, absX, absY);

  const children = allElements
    .filter((c) => c.parentId === el.id)
    .sort((a, b) => a.order - b.order)
    .map((c) => renderElementSvg(c, allElements, absX, absY));

  return {
    markup: markup + children.map((c) => c.markup).join(""),
    defs: defs + children.map((c) => c.defs).join(""),
  };
}

export function buildSvgMarkup(root: ExportableElement, allElements: ExportableElement[]): string {
  const { markup, defs } = renderElementSvg(root, allElements, -root.posX, -root.posY);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${root.width}" height="${root.height}" viewBox="0 0 ${root.width} ${root.height}"><defs>${defs}</defs>${markup}</svg>`;
}

export async function rasterizeSvg(
  svgMarkup: string,
  width: number,
  height: number,
  scale: number,
  mime: "image/png" | "image/jpeg",
): Promise<Blob> {
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG rasterization failed to load"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");

    if (mime === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob failed"))), mime, 0.92);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
