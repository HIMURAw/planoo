import { beforeEach, describe, it, expect } from "vitest";
import { useCanvasStore, collectDescendantIds, isSelfOrDescendant } from "./canvas-store";
import type { CanvasNode } from "@/types/canvas";

function makeNode(id: string, parentId: string | null, overrides: Partial<CanvasNode> = {}): Omit<CanvasNode, "children"> {
  return {
    id,
    parentId,
    type: "rectangle",
    name: null,
    posX: 0,
    posY: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    order: 0,
    fillColor: "#8b5cf6",
    text: null,
    fontSize: null,
    borderRadius: null,
    strokeColor: null,
    strokeWidth: 0,
    strokeStyle: "solid",
    effects: null,
    pathData: null,
    imageData: null,
    layoutMode: "none",
    layoutGap: 8,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    layoutAlign: "start",
    hidden: false,
    locked: false,
    ...overrides,
  };
}

beforeEach(() => {
  useCanvasStore.getState().reset();
});

describe("hydrate", () => {
  it("derives children arrays from a flat, non-topologically-sorted array", () => {
    // Child ("child") listed BEFORE its parent ("frame") on purpose — the
    // real /api/design/elements response has no ordering guarantee.
    useCanvasStore.getState().hydrate([makeNode("child", "frame"), makeNode("frame", null, { type: "frame" }), makeNode("root2", null)]);
    const state = useCanvasStore.getState();
    expect(state.rootIds).toEqual(["frame", "root2"]);
    expect(state.nodes.frame.children).toEqual(["child"]);
    expect(state.nodes.child.children).toEqual([]);
  });

  it("treats a node whose parentId points nowhere as a root", () => {
    useCanvasStore.getState().hydrate([makeNode("orphan", "missing-parent")]);
    expect(useCanvasStore.getState().rootIds).toEqual(["orphan"]);
  });
});

describe("addNode", () => {
  it("appends to rootIds when parentId is null", () => {
    useCanvasStore.getState().addNode(makeNode("a", null));
    useCanvasStore.getState().addNode(makeNode("b", null));
    expect(useCanvasStore.getState().rootIds).toEqual(["a", "b"]);
  });

  it("appends to the parent's children array when parentId is set", () => {
    useCanvasStore.getState().addNode(makeNode("frame", null, { type: "frame" }));
    useCanvasStore.getState().addNode(makeNode("child", "frame"));
    expect(useCanvasStore.getState().nodes.frame.children).toEqual(["child"]);
  });

  it("respects an explicit insertion index", () => {
    useCanvasStore.getState().addNode(makeNode("a", null));
    useCanvasStore.getState().addNode(makeNode("b", null));
    useCanvasStore.getState().addNode(makeNode("c", null), 1);
    expect(useCanvasStore.getState().rootIds).toEqual(["a", "c", "b"]);
  });
});

describe("removeNode", () => {
  it("cascades through nested children and cleans up the parent's bucket", () => {
    useCanvasStore.getState().hydrate([
      makeNode("frame", null, { type: "frame" }),
      makeNode("inner", "frame", { type: "frame" }),
      makeNode("leaf", "inner"),
      makeNode("sibling", null),
    ]);
    useCanvasStore.getState().removeNode("frame");
    const state = useCanvasStore.getState();
    expect(state.nodes.frame).toBeUndefined();
    expect(state.nodes.inner).toBeUndefined();
    expect(state.nodes.leaf).toBeUndefined();
    expect(state.rootIds).toEqual(["sibling"]);
  });
});

describe("updateNode / updateNodePosition", () => {
  it("patches fields without touching parentId or children", () => {
    useCanvasStore.getState().hydrate([makeNode("frame", null, { type: "frame" }), makeNode("child", "frame")]);
    useCanvasStore.getState().updateNode("child", { fillColor: "#ff0000" });
    expect(useCanvasStore.getState().nodes.child.fillColor).toBe("#ff0000");
    expect(useCanvasStore.getState().nodes.child.parentId).toBe("frame");
    expect(useCanvasStore.getState().nodes.frame.children).toEqual(["child"]);
  });

  it("commits a single position update, as required at drag-end", () => {
    useCanvasStore.getState().addNode(makeNode("a", null));
    useCanvasStore.getState().updateNodePosition("a", 42, 99);
    expect(useCanvasStore.getState().nodes.a).toMatchObject({ posX: 42, posY: 99 });
  });
});

describe("setParent", () => {
  it("moves a node from one bucket to another", () => {
    useCanvasStore.getState().hydrate([
      makeNode("frameA", null, { type: "frame" }),
      makeNode("frameB", null, { type: "frame" }),
      makeNode("child", "frameA"),
    ]);
    useCanvasStore.getState().setParent("child", "frameB");
    const state = useCanvasStore.getState();
    expect(state.nodes.frameA.children).toEqual([]);
    expect(state.nodes.frameB.children).toEqual(["child"]);
    expect(state.nodes.child.parentId).toBe("frameB");
  });

  it("moves a node to root level when newParentId is null", () => {
    useCanvasStore.getState().hydrate([makeNode("frame", null, { type: "frame" }), makeNode("child", "frame")]);
    useCanvasStore.getState().setParent("child", null);
    const state = useCanvasStore.getState();
    expect(state.nodes.frame.children).toEqual([]);
    expect(state.rootIds).toContain("child");
    expect(state.nodes.child.parentId).toBeNull();
  });

  it("rejects reparenting a node onto itself", () => {
    useCanvasStore.getState().addNode(makeNode("a", null, { type: "frame" }));
    useCanvasStore.getState().setParent("a", "a");
    expect(useCanvasStore.getState().nodes.a.parentId).toBeNull();
  });

  it("rejects reparenting a frame onto its own descendant (cycle guard)", () => {
    useCanvasStore.getState().hydrate([
      makeNode("outer", null, { type: "frame" }),
      makeNode("inner", "outer", { type: "frame" }),
    ]);
    useCanvasStore.getState().setParent("outer", "inner");
    const state = useCanvasStore.getState();
    expect(state.nodes.outer.parentId).toBeNull();
    expect(state.nodes.inner.children).toEqual([]);
  });

  it("rejects reparenting onto a non-existent target", () => {
    useCanvasStore.getState().addNode(makeNode("a", null));
    useCanvasStore.getState().setParent("a", "does-not-exist");
    expect(useCanvasStore.getState().nodes.a.parentId).toBeNull();
  });
});

describe("reorderChild", () => {
  it("reorders siblings within the same bucket", () => {
    useCanvasStore.getState().hydrate([makeNode("a", null), makeNode("b", null), makeNode("c", null)]);
    useCanvasStore.getState().reorderChild(null, "c", 0);
    expect(useCanvasStore.getState().rootIds).toEqual(["c", "a", "b"]);
  });
});

describe("collectDescendantIds", () => {
  it("returns the node itself plus every nested descendant", () => {
    useCanvasStore.getState().hydrate([
      makeNode("frame", null, { type: "frame" }),
      makeNode("inner", "frame", { type: "frame" }),
      makeNode("leaf", "inner"),
    ]);
    const ids = collectDescendantIds(useCanvasStore.getState().nodes, "frame");
    expect(ids).toEqual(new Set(["frame", "inner", "leaf"]));
  });
});

describe("isSelfOrDescendant", () => {
  it("is true for the node itself and any depth of descendant", () => {
    useCanvasStore.getState().hydrate([
      makeNode("frame", null, { type: "frame" }),
      makeNode("inner", "frame", { type: "frame" }),
      makeNode("leaf", "inner"),
    ]);
    const nodes = useCanvasStore.getState().nodes;
    expect(isSelfOrDescendant(nodes, "frame", "frame")).toBe(true);
    expect(isSelfOrDescendant(nodes, "frame", "leaf")).toBe(true);
    expect(isSelfOrDescendant(nodes, "inner", "frame")).toBe(false);
  });
});
