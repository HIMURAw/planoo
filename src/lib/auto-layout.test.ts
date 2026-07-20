import { describe, it, expect } from "vitest";
import { computeAutoLayoutPositions, type AutoLayoutFrame, type AutoLayoutChild } from "./auto-layout";

const baseFrame: AutoLayoutFrame = {
  layoutMode: "horizontal",
  layoutGap: 8,
  paddingTop: 16,
  paddingRight: 16,
  paddingBottom: 16,
  paddingLeft: 16,
  layoutAlign: "start",
  width: 400,
  height: 100,
};

const children: AutoLayoutChild[] = [
  { id: "a", width: 50, height: 30, order: 0 },
  { id: "b", width: 60, height: 40, order: 1 },
  { id: "c", width: 70, height: 20, order: 2 },
];

describe("computeAutoLayoutPositions", () => {
  it("returns [] when layoutMode is none", () => {
    expect(computeAutoLayoutPositions({ ...baseFrame, layoutMode: "none" }, children)).toEqual([]);
  });

  it("returns [] for an empty child list", () => {
    expect(computeAutoLayoutPositions(baseFrame, [])).toEqual([]);
  });

  it("arranges children left-to-right with gap and padding, respecting order not array order", () => {
    const shuffled = [children[2], children[0], children[1]];
    const result = computeAutoLayoutPositions(baseFrame, shuffled);
    expect(result).toEqual([
      { id: "a", posX: 16, posY: 16 },
      { id: "b", posX: 16 + 50 + 8, posY: 16 },
      { id: "c", posX: 16 + 50 + 8 + 60 + 8, posY: 16 },
    ]);
  });

  it("arranges children top-to-bottom for vertical mode", () => {
    const frame: AutoLayoutFrame = { ...baseFrame, layoutMode: "vertical" };
    const result = computeAutoLayoutPositions(frame, children);
    expect(result).toEqual([
      { id: "a", posX: 16, posY: 16 },
      { id: "b", posX: 16, posY: 16 + 30 + 8 },
      { id: "c", posX: 16, posY: 16 + 30 + 8 + 40 + 8 },
    ]);
  });

  it("centers children on the cross axis", () => {
    const frame: AutoLayoutFrame = { ...baseFrame, layoutAlign: "center" };
    const result = computeAutoLayoutPositions(frame, [children[0]]);
    // cross size = 100 - 16 - 16 = 68; child height 30 -> centered offset = 16 + (68-30)/2 = 35
    expect(result).toEqual([{ id: "a", posX: 16, posY: 35 }]);
  });

  it("aligns children to the end of the cross axis", () => {
    const frame: AutoLayoutFrame = { ...baseFrame, layoutAlign: "end" };
    const result = computeAutoLayoutPositions(frame, [children[0]]);
    // cross size = 68; child height 30 -> end offset = 16 + (68-30) = 54
    expect(result).toEqual([{ id: "a", posX: 16, posY: 54 }]);
  });

  it("respects custom padding per side", () => {
    const frame: AutoLayoutFrame = { ...baseFrame, paddingLeft: 40, paddingTop: 5 };
    const result = computeAutoLayoutPositions(frame, [children[0]]);
    expect(result[0].posX).toBe(40);
    expect(result[0].posY).toBe(5);
  });
});
