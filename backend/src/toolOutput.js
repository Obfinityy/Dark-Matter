// Dark Matter — ACI pass over tool outputs (Job 6, stage 7).
//
// Research report §5 item 7 (SWE-agent's Agent-Computer Interface
// lesson: the same model performs far worse when tool outputs are raw,
// unbounded, or silently empty). This module is the envelope applied on
// the MODEL-FACING surfaces (SEARCH:/RECALL: results and other text the
// model reads back): bounded head+tail with explicit counts, the full
// output always preserved in the hunt record, and — critically — an
// explicit marker for empty output, because a blank result is exactly
// what a small model misreads as success. Verification inputs are NOT
// passed through here: assessResult keeps reading raw output, so no
// signal can be created or destroyed by the envelope.

export const EMPTY_OUTPUT_MARKER =
  '(no output — the command produced nothing; that is NO signal, not success)';

/**
 * Summarise raw tool output for model consumption.
 * Returns { text, bytes, lines, truncated, empty }.
 */
export function summarizeToolOutput(raw, { maxChars = 4000, headChars = 2400, tailChars = 800 } = {}) {
  const text = raw == null ? '' : String(raw);
  const bytes = Buffer.byteLength(text, 'utf8');
  const lines = text ? text.split('\n').length : 0;
  if (!text.trim()) {
    return { text: EMPTY_OUTPUT_MARKER, bytes, lines, truncated: false, empty: true };
  }
  if (text.length <= maxChars) {
    return { text, bytes, lines, truncated: false, empty: false };
  }
  const head = text.slice(0, headChars);
  const tail = text.slice(-tailChars);
  const wrapped =
    `${head}\n…[tool output elided: ${lines} lines, ${bytes} bytes total — ` +
    `showing head+tail; the full output is preserved in the hunt record]…\n${tail}`;
  return { text: wrapped, bytes, lines, truncated: true, empty: false };
}
