// Pure layout math for auto-layout frames on the design canvas (Tasarım
// Kanvası). Deliberately scoped down from Figma's real auto layout: a
// frame's own width/height stay fixed (no "hug contents"/"fill container"
// sizing modes) — only the children's positions are computed, arranged
// along one axis with a gap, inset by padding, and aligned on the cross
// axis. Still a real, live-recomputed layout (not just stored metadata):
// callers re-run this whenever a frame's settings change or a child is
// added/removed/resized/reordered.

export type AutoLayoutDirection = "none" | "horizontal" | "vertical";
export type AutoLayoutAlign = "start" | "center" | "end";

export interface AutoLayoutFrame {
  layoutMode: AutoLayoutDirection;
  layoutGap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  layoutAlign: AutoLayoutAlign;
  width: number;
  height: number;
}

export interface AutoLayoutChild {
  id: string;
  width: number;
  height: number;
  order: number;
}

export interface AutoLayoutPosition {
  id: string;
  posX: number;
  posY: number;
}

// Returns [] when layoutMode is "none" — children keep whatever posX/posY
// they already have (free placement), same as a plain Group/Frame.
export function computeAutoLayoutPositions(
  frame: AutoLayoutFrame,
  children: AutoLayoutChild[],
): AutoLayoutPosition[] {
  if (frame.layoutMode === "none" || children.length === 0) return [];

  const isHorizontal = frame.layoutMode === "horizontal";
  const sorted = [...children].sort((a, b) => a.order - b.order);

  const crossStart = isHorizontal ? frame.paddingTop : frame.paddingLeft;
  const crossSize = isHorizontal
    ? frame.height - frame.paddingTop - frame.paddingBottom
    : frame.width - frame.paddingLeft - frame.paddingRight;

  let cursor = isHorizontal ? frame.paddingLeft : frame.paddingTop;

  return sorted.map((child) => {
    const childCross = isHorizontal ? child.height : child.width;
    let crossPos = crossStart;
    if (frame.layoutAlign === "center") crossPos = crossStart + (crossSize - childCross) / 2;
    else if (frame.layoutAlign === "end") crossPos = crossStart + (crossSize - childCross);

    const position: AutoLayoutPosition = isHorizontal
      ? { id: child.id, posX: cursor, posY: crossPos }
      : { id: child.id, posX: crossPos, posY: cursor };

    cursor += (isHorizontal ? child.width : child.height) + frame.layoutGap;
    return position;
  });
}
