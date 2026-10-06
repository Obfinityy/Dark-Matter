/**
 * planModuleFilter.js — Idea 30009.
 *
 * Removes forbidden plan modules (e.g. subdomain brute-forcing) when the
 * parsed program rules forbid them. This is the enforcement point for the
 * scope rules parsed by scopeRuleParser (30005).
 */

/** Plan module catalog: each module declares the canonical actions it uses. */
export const PLAN_MODULES = [
  { id: 'subdomain-enum', name: 'Subdomain enumeration', actions: ['subdomain-bruteforce'] },
  { id: 'port-scan', name: 'Port scanning', actions: ['port-scanning'] },
  { id: 'dir-discovery', name: 'Directory discovery', actions: ['dir-bruteforce'] },
  { id: 'xss-probes', name: 'XSS probes', actions: ['xss-testing', 'fuzzing'] },
  { id: 'sqli-probes', name: 'SQLi probes', actions: ['sqli-testing', 'fuzzing'] },
  { id: 'ssrf-probes', name: 'SSRF probes', actions: ['ssrf-testing'] },
  { id: 'idor-probes', name: 'IDOR probes', actions: ['idor-testing'] },
  { id: 'api-mapping', name: 'API surface mapping', actions: ['api-testing'] },
  { id: 'auth-flow-tests', name: 'Auth flow tests', actions: ['account-creation'] },
  { id: 'scanner-pass', name: 'Automated scanner pass', actions: ['automated-scanning'] },
];

/**
 * Filter plan modules against parsed scope rules.
 * @param {object[]} modules - plan modules (defaults to PLAN_MODULES)
 * @param {object} rules - output of parseScopeRules: { allowed, forbidden }
 * @returns {{ kept: object[], removed: { module: object, reason: string }[] }}
 */
export function filterPlanModules(modules = PLAN_MODULES, rules = { allowed: [], forbidden: [] }) {
  const kept = [];
  const removed = [];
  for (const mod of modules) {
    const blocked = (mod.actions || []).filter((a) => rules.forbidden.includes(a));
    if (blocked.length) {
      removed.push({ module: mod, reason: `forbidden by program rules: ${blocked.join(', ')}` });
    } else {
      kept.push(mod);
    }
  }
  return { kept, removed };
}

export const PLAN_MODULE_FILTER = { PLAN_MODULES, filterPlanModules };
export default PLAN_MODULE_FILTER;
