/**
 * grpcReflectionMiner.js — gRPC reflection service list miner.
 *
 * Parses fetched gRPC server-reflection responses (the service list an
 * endpoint itself returns, e.g. via grpcurl list output or reflection v1
 * FileDescriptorProto listings) for:
 *  - fully-qualified service names whose packages reveal backend hosts
 *  - method inventories per service to scope further review
 *  - naming signals (internal/corp/staging packages, version markers)
 *
 * Pure functions: takes a parsed/textual reflection listing, returns intel.
 */

const FQ_NAME_RE = /^([a-zA-Z][\w.]*)\.([A-Za-z][\w]*)$/;
const HOSTY_TOKEN_RE = /[a-z0-9]+(?:[.-][a-z0-9]+)+/gi;
const SIGNAL_RE = /\b(internal|corp|staging|stage|dev|test|qa|prod|private|legacy|v\d+|beta|alpha)\b/i;

/** Parse grpcurl-style `list` output text into service entries. */
export function parseReflectionList(text = '') {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && FQ_NAME_RE.test(l))
    .map(name => ({ fullName: name }));
}

/** Split a fully-qualified name into package path and service name. */
export function splitServiceName(fullName = '') {
  const m = String(fullName).match(FQ_NAME_RE);
  if (!m) return { package: '', service: fullName };
  return { package: m[1], service: m[2] };
}

/** Extract host-like tokens from package/service names. */
export function extractHostTokens(services = []) {
  const tokens = new Map();
  for (const s of services) {
    const { package: pkg, service } = splitServiceName(s.fullName);
    const hay = `${pkg} ${service}`;
    HOSTY_TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = HOSTY_TOKEN_RE.exec(hay))) {
      const tok = m[0].toLowerCase();
      if (!tok.includes('.') && !tok.includes('-')) continue;
      if (!/\d|[.-]/.test(tok)) continue;
      if (!tokens.has(tok)) tokens.set(tok, { token: tok, seenIn: [] });
      tokens.get(tok).seenIn.push(s.fullName);
    }
  }
  return [...tokens.values()];
}

/** Flag services whose names carry environment/sensitivity signals. */
export function flagSensitiveServices(services = []) {
  return services
    .filter(s => SIGNAL_RE.test(s.fullName))
    .map(s => {
      const sig = (s.fullName.match(SIGNAL_RE) || [])[1].toLowerCase();
      return {
        fullName: s.fullName,
        signal: sig,
        confidence: 'medium',
        note: `Service name contains "${sig}" — may map to a non-production or internal backend.`,
      };
    });
}

/** Normalize method listings: accepts { service, methods[] } or text lines. */
export function normalizeMethodList(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    const out = [];
    let current = null;
    for (const line of input.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      if (FQ_NAME_RE.test(t)) { current = { service: t, methods: [] }; out.push(current); continue; }
      if (current && /^[A-Za-z][\w]*$/.test(t)) current.methods.push(t);
    }
    return out;
  }
  return [];
}

/**
 * Mine a fetched gRPC reflection listing for backend host signals.
 * @param {object} input
 * @param {string} input.target - target the reflection was fetched from (provenance)
 * @param {string|Array} input.listing - reflection service listing (grpcurl text or array)
 * @returns structured findings
 */
export function mineGrpcReflection({ target = '', listing = '' } = {}) {
  const services = Array.isArray(listing)
    ? listing.map(s => ({ fullName: typeof s === 'string' ? s : s.fullName })).filter(s => s.fullName)
    : parseReflectionList(listing);
  if (!services.length) {
    return { target, type: 'gRPC Reflection Service Listing', confidence: 'none', error: 'No services parsed — reflection may be disabled' };
  }
  const tokens = extractHostTokens(services);
  const flagged = flagSensitiveServices(services);
  const methodLists = normalizeMethodList(listing);

  return {
    target,
    type: 'gRPC Reflection Service Listing',
    confidence: tokens.length || flagged.length ? 'medium' : 'low',
    evidence: `${services.length} service(s) listed via reflection, ${tokens.length} host-like token(s), ${flagged.length} flagged service name(s).`,
    services: services.map(s => s.fullName),
    hostTokens: tokens,
    flaggedServices: flagged,
    methodInventory: methodLists.slice(0, 100),
  };
}

export const GRPC_REFLECTION_MINER = {
  parseReflectionList, splitServiceName, extractHostTokens, flagSensitiveServices,
  normalizeMethodList, mineGrpcReflection,
};
export default GRPC_REFLECTION_MINER;
