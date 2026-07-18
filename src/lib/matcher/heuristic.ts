import { tokenize, isGenericFigmaName, jaccardSimilarity } from "./normalize";
import { MIN_SUGGESTION_SCORE, type DbColumn, type FigmaNode, type MatchCandidate } from "./types";

// Small alias table for common naming mismatches a pure token-overlap score
// would miss (e.g. Figma layer "email" vs DB column "contact_email"). Kept
// intentionally short — this is the "no LLM, no pluggable abstraction"
// heuristic decided in the design doc; if this table needs to grow large to
// stay useful, that's itself a signal the heuristic isn't generalizing (see
// TODOS.md "Pluggable matcher / LLM tabanlı eşleştirme").
const ALIAS_GROUPS: string[][] = [
  ["email", "mail", "contact"],
  ["phone", "tel", "telephone", "mobile"],
  ["name", "fullname", "full", "username"],
  ["avatar", "photo", "picture", "image", "img"],
  ["created", "createdat", "createddate"],
  ["updated", "updatedat", "modifieddate"],
  ["id", "identifier"],
];

function expandWithAliases(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const group of ALIAS_GROUPS) {
      if (group.includes(token)) {
        for (const alias of group) expanded.add(alias);
      }
    }
  }
  return [...expanded];
}

function scorePair(figmaTokens: string[], columnTokens: string[]): number {
  const directScore = jaccardSimilarity(figmaTokens, columnTokens);
  const aliasScore = jaccardSimilarity(expandWithAliases(figmaTokens), expandWithAliases(columnTokens));
  return Math.max(directScore, aliasScore * 0.9); // slight discount vs. a direct match
}

/**
 * For each (non-generically-named) Figma node, finds the single best-scoring
 * DB column above MIN_SUGGESTION_SCORE. One figma node -> at most one
 * candidate; the caller decides the confidence-threshold split for display.
 */
export function generateMatchCandidates(
  figmaNodes: FigmaNode[],
  dbColumns: DbColumn[],
): MatchCandidate[] {
  const columnTokenCache = dbColumns.map((col) => ({
    col,
    tokens: tokenize(col.column),
  }));

  const candidates: MatchCandidate[] = [];

  for (const node of figmaNodes) {
    if (isGenericFigmaName(node.name)) continue;

    const figmaTokens = tokenize(node.name);
    let best: { col: DbColumn; score: number } | null = null;

    for (const { col, tokens } of columnTokenCache) {
      const score = scorePair(figmaTokens, tokens);
      if (score > (best?.score ?? -1)) {
        best = { col, score };
      }
    }

    if (best && best.score >= MIN_SUGGESTION_SCORE) {
      candidates.push({
        figmaNodeId: node.id,
        figmaNodeName: node.name,
        dbTableName: best.col.table,
        dbColumnName: best.col.column,
        confidence: Math.round(best.score * 100) / 100,
      });
    }
  }

  return candidates;
}
