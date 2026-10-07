/**
 * permissionsPolicyAnalyzer.js — Permissions-Policy (Feature-Policy) header analyzer.
 *
 * Parses Permissions-Policy / Feature-Policy headers and maps the enabled or
 * disabled features to likely frameworks and application types. A tight
 * policy (camera/microphone/geolocation disabled) indicates a hardened,
 * security-aware deployment; a permissive or absent policy is a hardening
 * finding.
 */

// Features commonly gated by frameworks; mapped to the frameworks that need them.
const FEATURE_HINTS = {
  'camera': 'video-conferencing / identity-verification apps',
  'microphone': 'voice-call / voice-search apps',
  'geolocation': 'maps / delivery / ride-hailing apps',
  'payment': 'checkout / e-commerce (Payment Request API)',
  'fullscreen': 'media players / presentation tools',
  'usb': 'hardware-token / WebAuthn-adjacent flows',
  'serial': 'IoT dashboards',
  'bluetooth': 'IoT / peripheral pairing',
  'xr-spatial-tracking': 'AR/VR experiences',
  'picture-in-picture': 'video platforms',
  'autoplay': 'media / advertising',
  'interest-cohort': 'ad-tech (FLoC-era)',
};

/**
 * Parse a Permissions-Policy header into a directive map.
 * @param {string} header raw header value
 * @returns {object} feature -> allowlist (array of origins, or '*' / 'self' / 'none')
 */
export function parsePermissionsPolicy(header = '') {
  const policies = {};
  const re = /([a-z0-9-]+)\s*=\s*\(([^)]*)\)/gi;
  let m;
  while ((m = re.exec(String(header))) !== null) {
    const feature = m[1].toLowerCase();
    const allowlist = m[2].trim().split(/\s+/).filter(Boolean);
    policies[feature] = allowlist.length ? allowlist : ['none'];
  }
  return policies;
}

/**
 * Analyze a Permissions-Policy header: strictness score + framework hints.
 * @param {object} headers header map (any case)
 * @returns {{present: boolean, directives: object, strictness: number, hints: string[], assessment: string}}
 */
export function analyzePermissionsPolicy(headers = {}) {
  const lowered = {};
  for (const [k, v] of Object.entries(headers)) lowered[k.toLowerCase()] = String(v);
  const raw = lowered['permissions-policy'] || lowered['feature-policy'] || '';
  if (!raw) {
    return {
      present: false, directives: {}, strictness: 0, hints: [],
      assessment: 'no policy — all powerful features available to any origin; hardening gap',
    };
  }
  const directives = parsePermissionsPolicy(raw);
  const names = Object.keys(directives);
  const disabled = names.filter((n) => directives[n].length === 0 || directives[n].includes('none'));
  const strictness = names.length ? Math.round((disabled.length / names.length) * 100) : 0;
  const hints = names
    .filter((n) => FEATURE_HINTS[n] && !disabled.includes(n))
    .map((n) => `${n}: ${FEATURE_HINTS[n]}`);
  const assessment = strictness >= 70
    ? 'strict policy — hardened deployment posture'
    : strictness >= 30
      ? 'moderate policy — some powerful features gated'
      : 'permissive policy — review whether each allowed feature is needed';
  return { present: true, directives, strictness, hints, assessment };
}

export const PERMISSIONS_POLICY_ANALYZER = {
  parsePermissionsPolicy,
  analyzePermissionsPolicy,
};

export default PERMISSIONS_POLICY_ANALYZER;
