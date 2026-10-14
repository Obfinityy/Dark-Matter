// Dark Matter hunt-intel — bounty scope parser.
// Solves problem #9: "context-blind."
//
// Elite hunters READ the bounty program: what's in scope, what's out,
// what pays most. This parses a program page/link into structured scope
// so the agent prioritizes like a hunter, not a scanner.

/**
 * Parse scope from program page text/HTML.
 * @param {string} pageText — raw program page content
 * @returns {{inScope: string[], outOfScope: string[], bountyTable: object[], notes: string[]}}
 */
export function parseScope(pageText) {
  const text = String(pageText || '');
  const scope = { inScope: [], outOfScope: [], bountyTable: [], notes: [] };

  // In-scope domains/URLs
  const urlRe = /(?:https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi;
  const scopeSection = extractSection(text, /in.?scope/i);
  if (scopeSection) {
    let m;
    while ((m = urlRe.exec(scopeSection)) && scope.inScope.length < 20) {
      const u = m[0].toLowerCase();
      if (!scope.inScope.includes(u)) scope.inScope.push(u);
    }
  }

  // Out-of-scope
  const oosSection = extractSection(text, /out.?of.?scope|exclusions?/i);
  if (oosSection) {
    let m;
    const re2 = /(?:https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi;
    while ((m = re2.exec(oosSection)) && scope.outOfScope.length < 20) {
      const u = m[0].toLowerCase();
      if (!scope.outOfScope.includes(u)) scope.outOfScope.push(u);
    }
  }

  // Bounty table: severity -> reward
  const bountyRe = /(critical|high|medium|low)[^\n$]{0,40}\$\s?([\d,]+)/gi;
  let bm;
  while ((bm = bountyRe.exec(text))) {
    scope.bountyTable.push({ severity: bm[1].toLowerCase(), reward: bm[2].replace(/,/g, '') });
  }

  return scope;
}

function extractSection(text, headerRe) {
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => headerRe.test(l));
  if (idx === -1) return null;
  return lines.slice(idx, idx + 30).join('\n');
}

/**
 * Prioritize targets by bounty value.
 * @returns targets sorted by max payout for their likely vuln classes
 */
export function prioritizeByBounty(targets, scope) {
  const table = scope.bountyTable || [];
  const maxReward = table.length
    ? Math.max(...table.map((t) => Number(t.reward) || 0))
    : 0;
  return (targets || []).map((t) => ({
    target: t,
    priority: /admin|api|auth|payment|checkout/i.test(t) ? 'high' : 'normal',
    maxBounty: maxReward,
  })).sort((a, b) => (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0));
}

/** Check if a target is in scope before testing. */
export function isInScope(target, scope) {
  if (!scope || !scope.inScope || !scope.inScope.length) return true; // no scope = assume allowed
  const t = String(target).toLowerCase();
  if ((scope.outOfScope || []).some((o) => t.includes(o))) return false;
  return scope.inScope.some((s) => t.includes(s.replace(/^https?:\/\//, '').split('/')[0]));
}
