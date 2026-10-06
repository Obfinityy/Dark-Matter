/**
 * scopeRuleParser.js — Idea 30005.
 *
 * Parses bounty-program scope rules written in plain prose into a
 * machine-readable allow/forbid action list that the Hunt Planner can
 * enforce before any probe runs. Defensive planning only: this module
 * never produces exploit payloads.
 */

/** Known test-action vocabulary, normalized to canonical action ids. */
export const ACTION_VOCABULARY = [
  { id: 'subdomain-bruteforce', patterns: [/subdomain.{0,20}(brute|enumerat|fuzz)/i, /dns\s?brute/i] },
  { id: 'port-scanning', patterns: [/port\s?scann?/i, /\bnmap\b/i] },
  { id: 'automated-scanning', patterns: [/automated\s?scann?/i, /vulnerability\s?scann?ers?/i, /nessus|nuclei|acunetix/i] },
  { id: 'dir-bruteforce', patterns: [/director(y|ies).{0,20}(brute|fuzz|enumerat)/i, /\bffuf\b|\bgobuster\b|\bdirb\b/i] },
  { id: 'fuzzing', patterns: [/\bfuzz(ing|er)?\b/i, /payload\s?(lists?|injection)/i] },
  { id: 'social-engineering', patterns: [/social\s?engineer/i, /\bphishing\b/i, /\bvishing\b|\bsmishing\b/i] },
  { id: 'dos-testing', patterns: [/\b(dos|ddos)\b/i, /denial.of.service/i, /rate.{0,10}limit.{0,10}test/i, /load\s?test/i] },
  { id: 'physical-attacks', patterns: [/physical/i] },
  { id: 'credential-attacks', patterns: [/credential\s?stuffing/i, /password\s?spray/i, /\bbrute\s?force\b.{0,10}(login|password|credential)/i] },
  { id: 'data-exfiltration', patterns: [/exfiltrat/i, /dump.{0,10}(database|table)/i] },
  { id: 'xss-testing', patterns: [/\bxss\b/i, /cross.site.script/i] },
  { id: 'sqli-testing', patterns: [/\bsqli?\b/i, /sql\s?injection/i] },
  { id: 'ssrf-testing', patterns: [/\bssrf\b/i, /server.side.request/i] },
  { id: 'idor-testing', patterns: [/\bidor\b/i, /insecure.direct.object/i] },
  { id: 'api-testing', patterns: [/\bapi\b.{0,15}test/i, /graphql/i] },
  { id: 'account-creation', patterns: [/creat.{0,10}account/i, /sign.?up.{0,10}test/i] },
];

const FORBID_SIGNALS = [
  /do\s+not\s+([^.\n]{3,80})/gi,
  /prohibit(?:ed|s)?\s*:?\s*([^.\n]{3,80})/gi,
  /forbidden\s*:?\s*([^.\n]{3,80})/gi,
  /out\s+of\s+scope\s*:?\s*([^.\n]{3,80})/gi,
  /not\s+allowed\s*:?\s*([^.\n]{3,80})/gi,
  /strictly\s+no\s+([^.\n]{3,80})/gi,
  /\bno\s+([a-z][^.\n]{3,60})/gi,
  /([^.\n]{3,80}?)\s+is\s+(?:strictly\s+)?prohibited/gi,
  /([^.\n]{3,80}?)\s+are\s+(?:strictly\s+)?prohibited/gi,
  /([^.\n]{3,80}?)\s+is\s+(?:strictly\s+)?forbidden/gi,
  /([^.\n]{3,80}?)\s+is\s+out\s+of\s+scope/gi,
];
const ALLOW_SIGNALS = [
  /in\s+scope\s*:?\s*([^.\n]{3,80})/gi,
  /allowed\s*:?\s*([^.\n]{3,80})/gi,
  /encouraged\s*:?\s*([^.\n]{3,80})/gi,
  /permitted\s*:?\s*([^.\n]{3,80})/gi,
];

/**
 * Extract action ids mentioned in a text fragment.
 * @param {string} fragment
 * @returns {string[]} canonical action ids
 */
export function extractActions(fragment) {
  const found = new Set();
  for (const { id, patterns } of ACTION_VOCABULARY) {
    if (patterns.some((p) => { p.lastIndex = 0; return p.test(fragment); })) found.add(id);
  }
  return [...found];
}

/**
 * Parse bounty program scope rules prose into allow/forbid lists.
 * @param {string} scopeText - raw program rules text
 * @returns {{ allowed: string[], forbidden: string[], notes: string[] }}
 */
export function parseScopeRules(scopeText = '') {
  const allowed = new Set();
  const forbidden = new Set();
  const notes = [];
  const text = String(scopeText);

  for (const re of FORBID_SIGNALS) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const actions = extractActions(m[1]);
      if (actions.length) actions.forEach((a) => forbidden.add(a));
      else notes.push(`forbidden (unmapped): ${m[1].trim().slice(0, 80)}`);
      if (m[0].length === 0) break;
    }
  }
  for (const re of ALLOW_SIGNALS) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const actions = extractActions(m[1]);
      if (actions.length) actions.forEach((a) => { if (!forbidden.has(a)) allowed.add(a); });
      else notes.push(`allowed (unmapped): ${m[1].trim().slice(0, 80)}`);
      if (m[0].length === 0) break;
    }
  }
  // Forbid wins over allow on conflicts.
  for (const a of forbidden) allowed.delete(a);
  return { allowed: [...allowed], forbidden: [...forbidden], notes };
}

/**
 * Check whether a planned action is permitted under parsed rules.
 * @param {object} rules - output of parseScopeRules
 * @param {string} actionId - canonical action id
 * @returns {{ permitted: boolean, reason: string }}
 */
export function isActionPermitted(rules, actionId) {
  if (rules.forbidden.includes(actionId)) {
    return { permitted: false, reason: `forbidden by program rules: ${actionId}` };
  }
  return { permitted: true, reason: rules.allowed.includes(actionId) ? 'explicitly allowed' : 'not mentioned (default allow)' };
}

export const SCOPE_RULE_PARSER = { ACTION_VOCABULARY, extractActions, parseScopeRules, isActionPermitted };
export default SCOPE_RULE_PARSER;
