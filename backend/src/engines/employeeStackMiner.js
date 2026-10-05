/**
 * employeeStackMiner.js — employee-profile stack-disclosure mining engine.
 *
 * @idea 0319 — Employee LinkedIn stack disclosure: mine public employee
 *   profiles for named internal systems that hint at hostnames.
 *
 * Pure functions: callers collect public profile text themselves
 * (respecting each platform's terms of service) and pass it in.
 * No live HTTP here.
 *
 * Defensive framing: public self-disclosures are a standard recon input for
 * an authorized engagement; this engine turns them into infrastructure
 * hypotheses a human hunter would form while reading profiles.
 */

const SYSTEM_MENTION_RE = new RegExp(
  String.raw`\b(?:administrat\w+|maintain\w*|manag\w+|support\w*|deploy\w*|own\w*|responsib\w+ for|architect\w*|built|building|work\w* on|using|use of|expert in|speciali[sz]\w+ in|lead\w* of|onboard\w+ to)\s+((?:"[^"]{2,60}"|'[^']{2,60}'|[A-Z][A-Za-z0-9+.#-]*(?:\s+[A-Z][A-Za-z0-9+.#-]*){0,2}))`,
  'g'
);
const QUOTED_SYSTEM_RE = /"([A-Z][A-Za-z0-9][A-Za-z0-9 .+#-]{1,48})"/g;
const CAPS_TOKEN_RE = /\b[A-Z][A-Z0-9]{2,}(?:[-_][A-Z0-9]+)*\b/g;

const GENERIC_WORDS = new Set([
  'TEAM', 'INC', 'LLC', 'LTD', 'CORP', 'DEPT', 'IT', 'HR', 'QA', 'API', 'UI', 'UX',
  'CEO', 'CTO', 'CIO', 'VP', 'AWS', 'GCP', 'CI', 'CD', 'OK', 'OKR', 'KPI',
]);

/**
 * Extract candidate internal-system names from a public profile text.
 * @param {string} text profile summary / experience text
 * @returns {string[]}
 */
export function extractInternalSystems(text) {
  const found = new Set();
  for (const m of String(text || '').matchAll(SYSTEM_MENTION_RE)) {
    const name = m[1].replace(/^["']|["']$/g, '').trim();
    if (name.length >= 3 && name.length <= 60 && !GENERIC_WORDS.has(name.toUpperCase())) {
      found.add(name);
    }
  }
  for (const m of String(text || '').matchAll(QUOTED_SYSTEM_RE)) {
    const name = m[1].trim();
    if (!GENERIC_WORDS.has(name.toUpperCase())) found.add(name);
  }
  return [...found].sort();
}

/**
 * Extract ALL-CAPS internal codenames (e.g. "project ATLAS", system "HELIX").
 * @param {string} text
 * @returns {string[]}
 */
export function extractCodenames(text) {
  const found = new Set();
  for (const m of String(text || '').matchAll(CAPS_TOKEN_RE)) {
    if (!GENERIC_WORDS.has(m[0])) found.add(m[0]);
  }
  return [...found].sort();
}

/**
 * Turn a disclosed system name into plausible hostname hints under an apex.
 * "Customer Identity Platform" → identity-platform.acme.com, cip.acme.com …
 * @param {string} systemName
 * @param {string} apex
 * @returns {string[]}
 */
export function systemNameToHostnameHints(systemName, apex) {
  const base = String(apex || '').toLowerCase().trim().replace(/\.$/, '');
  if (!base) return [];
  const words = String(systemName || '')
    .replace(/['"`]/g, '')
    .split(/[\s\-_]+/)
    .filter((w) => w.length > 0);
  if (!words.length) return [];
  const hints = new Set();
  const joined = words.join('-').toLowerCase();
  hints.add(`${joined}.${base}`);
  const wordsNoStop = words.filter((w) => !['the', 'of', 'for', 'and', 'a', 'an'].includes(w.toLowerCase()));
  if (wordsNoStop.length > 1) {
    hints.add(`${wordsNoStop.join('-').toLowerCase()}.${base}`);
    hints.add(`${wordsNoStop.map((w) => w[0]).join('').toLowerCase()}.${base}`);
  }
  for (const w of wordsNoStop) hints.add(`${w.toLowerCase()}.${base}`);
  return [...hints];
}

/**
 * Mine one public employee profile into system disclosures + hostname hints.
 * @param {{id?: string, name?: string, text: string}} profile
 * @param {string} apex target apex domain for hostname hypotheses
 * @returns {{id: string, name: string, systems: string[], codenames: string[], hostnameHints: string[]}}
 */
export function mineEmployeeProfile(profile = {}, apex) {
  const text = String(profile?.text || '');
  const systems = extractInternalSystems(text);
  const codenames = extractCodenames(text);
  const hints = new Set();
  for (const s of systems) for (const h of systemNameToHostnameHints(s, apex)) hints.add(h);
  for (const c of codenames) {
    const base = String(apex || '').toLowerCase().trim();
    if (base) hints.add(`${c.toLowerCase()}.${base}`);
  }
  return {
    id: String(profile?.id || ''),
    name: String(profile?.name || ''),
    systems,
    codenames,
    hostnameHints: [...hints].sort(),
  };
}

/**
 * Aggregate mined profiles: rank systems/codenames by how many employees
 * disclosed them (stronger corroboration = stronger lead).
 * @param {ReturnType<typeof mineEmployeeProfile>[]} mined
 * @returns {{systems: {value: string, profiles: number}[], codenames: {value: string, profiles: number}[], hostnameHints: string[]}}
 */
export function aggregateEmployeeDisclosures(mined = []) {
  const countMap = (getter) => {
    const counts = new Map();
    for (const m of mined || []) {
      for (const v of new Set(getter(m) || [])) {
        counts.set(v, (counts.get(v) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([value, profiles]) => ({ value, profiles }))
      .sort((a, b) => b.profiles - a.profiles || a.value.localeCompare(b.value));
  };
  const hints = new Set();
  for (const m of mined || []) for (const h of m?.hostnameHints || []) hints.add(h);
  return {
    systems: countMap((m) => m?.systems),
    codenames: countMap((m) => m?.codenames),
    hostnameHints: [...hints].sort(),
  };
}
