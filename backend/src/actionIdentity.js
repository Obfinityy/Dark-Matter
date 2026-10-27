// Canonical identity of one executed action — shared by the
// already-done gate (humanLoop.js) and the Action Index
// (actionIndex.js). ONE definition, so the gate's verdict and the
// index's hash can never disagree about what "the same action" is.
//
// Moved here verbatim from humanLoop.js (Lane F, 21 Oct 2026) in the
// keyword-index lane (27 Oct 2026); humanLoop.js re-exports them so
// the import surface is unchanged.

/**
 * Canonical detail for one action, in the same (tool, detail) form
 * the loop records via toolCall. The detail is first cut to the 300
 * chars the tool_call record itself keeps, so a candidate action is
 * judged on exactly the bytes history was recorded with.
 * browser_open normalises the URL (case + trailing slash); search
 * folds case and whitespace; everything else is trimmed verbatim
 * (payloads and labels are case-sensitive; never fold them).
 */
export function normalisedActionDetail(tool, detail) {
  const t = String(tool || '').toLowerCase();
  let d = String(detail || '').slice(0, 300);
  if (t === 'browser_open') {
    const raw = d.trim();
    try {
      const u = new URL(raw);
      let p = u.pathname || '/';
      if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
      return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${p}${u.search || ''}`;
    } catch {
      d = raw.toLowerCase();
      if (d.length > 1 && d.endsWith('/')) d = d.slice(0, -1);
      return d;
    }
  }
  if (t === 'search') return d.trim().toLowerCase().replace(/\s+/g, ' ');
  return d.trim();
}

/** Canonical identity of one executed action: `tool|normalised detail`. */
export function actionSignature(tool, detail) {
  const t = String(tool || '').toLowerCase();
  return `${t}|${normalisedActionDetail(t, detail)}`;
}

/**
 * Content-hash of one executed action: FNV-1a 32-bit over the
 * canonical signature, rendered as 8 hex chars. Deterministic —
 * the same action always hashes the same, in any session, on any
 * machine. The hash is the DEDUP KEY (the gate blocks a repeat by
 * signature; the index names that same repeat by hash), and the
 * sequential #N beside it is the FETCH KEY (array position, O(1)).
 */
export function contentHash(tool, detail) {
  const s = actionSignature(tool, detail);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
