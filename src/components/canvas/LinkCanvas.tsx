"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CONFIDENCE_THRESHOLD } from "@/lib/matcher/types";
import type { LinkView } from "./types";

// Colors carry the link state — chosen for a quick visual scan, not
// decoration. Kept as a lookup so it's the one place that ever needs to
// change if the palette is revisited.
const STATE_STYLE: Record<LinkView["state"], { border: string; label: string }> = {
  suggested: { border: "#a1a1aa", label: "Önerilen" },
  confirmed: { border: "#16a34a", label: "Onaylandı" },
  stale: { border: "#ca8a04", label: "Değişti" },
  broken: { border: "#dc2626", label: "Kırık" },
  rejected: { border: "#71717a", label: "Reddedildi" },
};

interface LinkCanvasProps {
  links: LinkView[];
}

// Purely a visualization — confirm/reject actions live in the list panel
// next to the canvas (see Dashboard.tsx). Interactive edge controls inside
// React Flow itself are real future-scope polish, not needed to prove the
// core "aha" (auto-matched links, visibly stateful).
export function LinkCanvas({ links }: LinkCanvasProps) {
  const { nodes, edges } = useMemo(() => buildGraph(links), [links]);

  return (
    <div style={{ height: "70vh" }} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800">
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

// No real layout coordinates exist for Figma nodes or DB columns (v0 stores
// only id/name/type — see design doc), so this is a simple two-column grid:
// Figma nodes on the left, DB columns on the right. Good enough to see the
// mapping at a glance; a real spatial canvas mirroring the actual Figma
// layout is future scope, not MVP.
function buildGraph(links: LinkView[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const figmaNodeIds = [...new Set(links.map((l) => l.figmaNodeId))];
  const dbColumnKeys = [...new Set(links.map((l) => `${l.dbTableName}.${l.dbColumnName}`))];

  const ROW_HEIGHT = 70;

  figmaNodeIds.forEach((figmaNodeId, i) => {
    nodes.push({
      id: `figma:${figmaNodeId}`,
      position: { x: 0, y: i * ROW_HEIGHT },
      data: { label: figmaNodeId },
      style: { background: "#ede9fe", border: "1px solid #8b5cf6", borderRadius: 8, padding: 8 },
    });
  });

  dbColumnKeys.forEach((key, i) => {
    nodes.push({
      id: `db:${key}`,
      position: { x: 420, y: i * ROW_HEIGHT },
      data: { label: key },
      style: { background: "#dbeafe", border: "1px solid #3b82f6", borderRadius: 8, padding: 8 },
    });
  });

  for (const link of links) {
    const style = STATE_STYLE[link.state];
    const lowConfidence = link.confidence < CONFIDENCE_THRESHOLD;

    edges.push({
      id: link.id,
      source: `figma:${link.figmaNodeId}`,
      target: `db:${link.dbTableName}.${link.dbColumnName}`,
      label: `${style.label} · ${Math.round(link.confidence * 100)}%${lowConfidence ? " (düşük güven)" : ""}`,
      style: { stroke: style.border, strokeDasharray: lowConfidence ? "4 4" : undefined },
      labelStyle: { fill: style.border, fontSize: 11 },
      animated: link.state === "broken",
    });
  }

  return { nodes, edges };
}
