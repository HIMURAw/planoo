export type LinkState = "suggested" | "confirmed" | "stale" | "broken" | "rejected";

export interface LinkView {
  id: string;
  figmaNodeId: string;
  dbTableName: string;
  dbColumnName: string;
  confidence: number;
  state: LinkState;
}
