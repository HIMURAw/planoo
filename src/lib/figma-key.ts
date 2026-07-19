// Figma file URLs look like https://www.figma.com/design/<fileKey>/<name> —
// accepts either the bare key or a pasted URL, so users don't have to know
// they're supposed to extract the key themselves.
export function extractFigmaFileKey(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9]+$/.test(trimmed)) return trimmed;
  return null;
}
