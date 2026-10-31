// Dark Matter — ACTION VERIFICATION (Mission Stage 2).
//
// The brain may declare what it expects an action to achieve by adding an
// `expect` field to its action JSON:
//
//   {"action":"browser_click","text":"Login","expect":"url contains /dashboard"}
//
// After the action executes, verifyExpectation() checks each clause against
// the fresh observation text and the current page URL. The verdict is
// appended to the turn's observation so the brain sees VERIFIED or
// NOT VERIFIED — it must diagnose and retry on failure instead of
// assuming the action succeeded.
//
// Clause syntax (case-insensitive; multiple clauses separated by ';'):
//   url contains <substr>    — current page URL contains substr
//   url is <url>             — current page URL equals url (trailing-slash
//                              and case-insensitive normalized)
//   url not <substr>         — current page URL does NOT contain substr
//   text contains <substr>   — observation/snapshot text contains substr
//   text absent <substr>     — observation/snapshot text does NOT contain it
// A clause with no recognised prefix is treated as text_contains.
//
// Design rules:
// - Pure and deterministic: no LLM, no I/O, no model calls.
// - Never throws: any parse or check error yields { checked:false }.
// - Lenient matching: case-insensitive substring; quotes stripped.
// - An empty or missing expectation yields { checked:false } (nothing
//   to verify) — verification is opt-in per action, never mandatory.

const CLAUSE_RES = [
  [/^url\s+contains\s+(.+)$/i, 'url_contains'],
  [/^url\s+is\s+(.+)$/i, 'url_is'],
  [/^url\s+not\s+(.+)$/i, 'url_not'],
  [/^text\s+contains\s+(.+)$/i, 'text_contains'],
  [/^text\s+absent\s+(.+)$/i, 'text_absent'],
];

function cleanArg(s) {
  let t = String(s || '').trim();
  // Strip one layer of matching surrounding quotes.
  if (t.length >= 2 && ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'"))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function normaliseUrl(u) {
  return String(u || '').trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * Parse an expectation string into checkable clauses.
 * @param {string} expect
 * @returns {Array<{type:string, arg:string, raw:string}>}
 */
export function parseExpectation(expect) {
  const text = String(expect || '').trim();
  if (!text) return [];
  return text
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      for (const [re, type] of CLAUSE_RES) {
        const m = raw.match(re);
        if (m) return { type, arg: cleanArg(m[1]), raw };
      }
      // No recognised prefix: lenient text_contains.
      return { type: 'text_contains', arg: cleanArg(raw), raw };
    })
    .filter((c) => c.arg.length > 0);
}

/**
 * Check parsed clauses against the action's fresh evidence.
 * @param {{expect:string, observation?:string, pageUrl?:string, snapshotText?:string}} opts
 * @returns {{checked:boolean, verified:boolean, evidence:string, checks:Array<{clause:string, pass:boolean}>}}
 */
export function verifyExpectation(opts = {}) {
  try {
    const { expect, observation = '', pageUrl = '', snapshotText = '' } = opts || {};
    const clauses = parseExpectation(expect);
    if (clauses.length === 0) {
      return { checked: false, verified: false, evidence: 'no parseable expectation', checks: [] };
    }
    const hayText = `${String(observation || '')}\n${String(snapshotText || '')}`.toLowerCase();
    const url = normaliseUrl(pageUrl);
    const checks = clauses.map((c) => {
      const arg = c.arg.toLowerCase();
      let pass = false;
      switch (c.type) {
        case 'url_contains':
          pass = url.includes(arg);
          break;
        case 'url_is':
          pass = url === normaliseUrl(c.arg);
          break;
        case 'url_not':
          pass = !url.includes(arg);
          break;
        case 'text_contains':
          pass = hayText.includes(arg);
          break;
        case 'text_absent':
          pass = !hayText.includes(arg);
          break;
        default:
          pass = false;
      }
      return { clause: c.raw, pass };
    });
    const failed = checks.filter((c) => !c.pass);
    const verified = failed.length === 0;
    const evidence = verified
      ? `${checks.length} check${checks.length === 1 ? '' : 's'} passed (${checks.map((c) => c.clause).join('; ')})`
      : `${failed.length}/${checks.length} failed: ${failed.map((c) => c.clause).join('; ')}`;
    return { checked: true, verified, evidence, checks };
  } catch {
    return { checked: false, verified: false, evidence: 'verification error', checks: [] };
  }
}
