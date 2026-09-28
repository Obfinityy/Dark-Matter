/**
 * Generic result parsers for different output formats.
 * Each parser: rawOutput → normalized structured data.
 */

/** Parse line-separated output (subfinder, assetfinder, gau, etc.). */
export function parseLines(rawOutput) {
  if (!rawOutput) return { items: [] };
  const items = String(rawOutput)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  return { items, count: items.length };
}

/** Parse JSON Lines (one JSON object per line — httpx, dnsx, nuclei, katana, naabu). */
export function parseJsonLines(rawOutput) {
  if (!rawOutput) return { items: [] };
  const items = [];
  for (const line of String(rawOutput).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      items.push(JSON.parse(trimmed));
    } catch {
      // Skip malformed lines
    }
  }
  return { items, count: items.length };
}

/** Parse full JSON output. */
export function parseJson(rawOutput) {
  if (!rawOutput) return { data: null };
  try {
    const data = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
    return { data };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

/** Generic text parser — just structured wrapping of raw text. */
export function parseGeneric(rawOutput) {
  if (!rawOutput) return { text: '', lineCount: 0 };
  const text = String(rawOutput);
  return {
    text: text.slice(0, 500_000), // Cap at 500KB for storage
    lineCount: text.split('\n').length,
    truncated: text.length > 500_000
  };
}
