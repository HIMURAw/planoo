export interface FigmaNode {
  id: string;
  name: string;
  type: string; // Figma node type: TEXT, FRAME, INSTANCE, COMPONENT, etc.
}

export interface DbColumn {
  table: string;
  column: string;
  dataType: string;
}

export interface MatchCandidate {
  figmaNodeId: string;
  figmaNodeName: string;
  dbTableName: string;
  dbColumnName: string;
  confidence: number; // 0..1
}

// Below this, a Figma/DB pair isn't worth surfacing at all (pure noise).
export const MIN_SUGGESTION_SCORE = 0.2;

// Above this, a suggestion is shown as "high confidence" in the UI rather
// than filed under the low-confidence, visually-separated bucket — decided
// in /plan-ceo-review Section 2 to keep noisy generic-name matches
// (id/name/value collisions) from drowning out real ones.
export const CONFIDENCE_THRESHOLD = 0.55;
