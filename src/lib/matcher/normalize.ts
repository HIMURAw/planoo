// Splits a Figma layer name or DB column name into lowercase comparable
// tokens: camelCase, snake_case, kebab-case, and plain spaces all split.
// "userEmail" / "user_email" / "User Email" all -> ["user", "email"].
export function tokenize(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase -> camel Case
    .replace(/[_\-./]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

// Figma auto-names layers like "Frame 42", "Rectangle Copy 3", "Group 17",
// "Ellipse 5" when a designer never renames them. These carry zero semantic
// signal and would otherwise pollute matches with noise — flagged as a real
// risk to the whole approach in /plan-eng-review's outside voice pass.
// Skipping them isn't optional politeness, it's what keeps the confidence
// score meaningful.
const GENERIC_NAME_PATTERN =
  /^(frame|rectangle|ellipse|group|vector|component|instance|line|polygon|star|text)\s*\d*(\s*copy\s*\d*)?$/i;

export function isGenericFigmaName(name: string): boolean {
  return GENERIC_NAME_PATTERN.test(name.trim());
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}
