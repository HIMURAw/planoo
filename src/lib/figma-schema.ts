import { figmaFetch } from "@/lib/figma-client";
import type { FigmaNode } from "@/lib/matcher/types";

interface RawFigmaNode {
  id: string;
  name: string;
  type: string;
  children?: RawFigmaNode[];
}

interface FigmaFileResponse {
  document: RawFigmaNode;
}

// Types that are pure structural/organizational containers in Figma's tree —
// never meaningful match targets themselves, but still walked into for their
// children.
const CONTAINER_ONLY_TYPES = new Set(["DOCUMENT", "CANVAS"]);

function flattenNodes(node: RawFigmaNode, out: FigmaNode[]) {
  if (!CONTAINER_ONLY_TYPES.has(node.type)) {
    out.push({ id: node.id, name: node.name, type: node.type });
  }
  for (const child of node.children ?? []) {
    flattenNodes(child, out);
  }
}

export async function fetchFigmaFileNodes(fileKey: string, accessToken: string): Promise<FigmaNode[]> {
  const response = await figmaFetch(`/files/${fileKey}`, accessToken);

  if (!response.ok) {
    throw new Error(`Figma file fetch failed with status ${response.status}`);
  }

  const data = (await response.json()) as FigmaFileResponse;
  const nodes: FigmaNode[] = [];
  flattenNodes(data.document, nodes);
  return nodes;
}
