/**
 * samlMetadataHostExtraction.js — SAML metadata host extraction for autonomous bug bounty.
 *
 * Implements idea-bank item 00426: parse SAML 2.0 metadata documents to
 * extract entity IDs, single-sign-on / logout / assertion-consumer
 * endpoints, and the hosts behind them.
 *
 * SAML metadata (published at well-known federation URLs) inventories an
 * identity provider or service provider: its entityID, the bindings and
 * locations of SSO/SLO/ACS endpoints, supported NameID formats, and
 * signing/encryption key descriptors. Extracting the endpoint hosts maps
 * the federation surface — SSO hosts often differ from the application
 * host — for an authorized engagement to inventory.
 *
 * All functions are pure and side-effect free: they parse metadata XML
 * text the caller obtained through legitimate means during an authorized
 * engagement. Parsing is regex-based and never resolves external entities
 * (no DTD/XXE processing). Certificate material is counted, never returned.
 */

/**
 * Extract an attribute value from a tag's attribute string.
 * @param {string} attrs Raw attribute text of a tag.
 * @param {string} name Attribute name.
 * @returns {string|null}
 */
function attrOf(attrs, name) {
  const m = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs || '');
  return m ? (m[1] !== undefined ? m[1] : m[2]) : null;
}

/**
 * Collect self-closing or open/close tags matching a local name.
 * @param {string} xml
 * @param {string} localName Tag local name without namespace prefix.
 * @returns {Array<{attrs: string, body: string}>}
 */
function collectTags(xml, localName) {
  const out = [];
  const re = new RegExp(`<(?:[\\w-]+:)?${localName}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${localName}>)`, 'gi');
  let m;
  while ((m = re.exec(xml)) !== null) {
    out.push({ attrs: m[1] || '', body: m[2] || '' });
  }
  return out;
}

/**
 * Extract the host from a URL string.
 * @param {string} url
 * @returns {string|null}
 */
function hostOf(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Parse a SAML metadata document into entity, endpoint, and key inventory.
 * @param {string} xml Raw SAML metadata XML.
 * @returns {{
 *   entityId: string|null, roles: string[],
 *   endpoints: Array<{role: string, service: string, binding: string|null, location: string|null, host: string|null}>,
 *   nameIdFormats: string[], certificateCount: number, valid: boolean, error: string|null
 * }}
 */
export function parseSamlMetadata(xml) {
  const invalid = (error) => ({
    entityId: null, roles: [], endpoints: [], nameIdFormats: [],
    certificateCount: 0, valid: false, error,
  });
  if (!xml || typeof xml !== 'string') return invalid('not a string');
  if (!/<(?:[\w-]+:)?EntityDescriptor\b/i.test(xml)) return invalid('no EntityDescriptor element found');

  const entityTag = collectTags(xml, 'EntityDescriptor')[0];
  const entityId = entityTag ? attrOf(entityTag.attrs, 'entityID') : null;

  const roles = [];
  const endpoints = [];
  const roleSpecs = [
    ['IDPSSODescriptor', 'IdP', [['SingleSignOnService', 'SSO'], ['SingleLogoutService', 'SLO'], ['ArtifactResolutionService', 'Artifact']]],
    ['SPSSODescriptor', 'SP', [['AssertionConsumerService', 'ACS'], ['SingleLogoutService', 'SLO'], ['ArtifactResolutionService', 'Artifact']]],
  ];
  for (const [tag, role, services] of roleSpecs) {
    const descriptors = collectTags(xml, tag);
    if (descriptors.length === 0) continue;
    roles.push(role);
    for (const desc of descriptors) {
      for (const [serviceTag, service] of services) {
        for (const el of collectTags(desc.body, serviceTag)) {
          const location = attrOf(el.attrs, 'Location');
          endpoints.push({
            role,
            service,
            binding: attrOf(el.attrs, 'Binding'),
            location,
            host: hostOf(location),
          });
        }
      }
    }
  }

  const nameIdFormats = collectTags(xml, 'NameIDFormat')
    .map((t) => t.body.trim())
    .filter(Boolean);
  const certificateCount = collectTags(xml, 'X509Certificate').length;

  return {
    entityId,
    roles,
    endpoints,
    nameIdFormats: [...new Set(nameIdFormats)],
    certificateCount,
    valid: true,
    error: null,
  };
}

/**
 * Extract the unique endpoint hosts from parsed metadata.
 * @param {{endpoints: Array}} parsed Output of parseSamlMetadata.
 * @returns {Array<{host: string, roles: string[], services: string[], endpointCount: number}>}
 */
export function extractSamlHosts(parsed) {
  const map = new Map();
  for (const ep of (parsed && parsed.endpoints) || []) {
    if (!ep.host) continue;
    if (!map.has(ep.host)) map.set(ep.host, { host: ep.host, roles: new Set(), services: new Set(), endpointCount: 0 });
    const e = map.get(ep.host);
    e.roles.add(ep.role);
    e.services.add(ep.service);
    e.endpointCount += 1;
  }
  return [...map.values()]
    .map((e) => ({ host: e.host, roles: [...e.roles].sort(), services: [...e.services].sort(), endpointCount: e.endpointCount }))
    .sort((a, b) => b.endpointCount - a.endpointCount || a.host.localeCompare(b.host));
}

/**
 * Classify the SAML entity: IdP, SP, or both, with a short summary.
 * @param {{entityId: string|null, roles: string[], endpoints: Array}} parsed
 * @returns {{entityId: string|null, classification: string, ssoEndpointCount: number, acsEndpointCount: number, summary: string}}
 */
export function classifySamlEntity(parsed) {
  const p = parsed || {};
  const roles = p.roles || [];
  const endpoints = p.endpoints || [];
  const sso = endpoints.filter((e) => e.service === 'SSO').length;
  const acs = endpoints.filter((e) => e.service === 'ACS').length;
  const classification = roles.includes('IdP') && roles.includes('SP')
    ? 'hybrid IdP+SP'
    : roles.includes('IdP') ? 'Identity Provider (IdP)'
      : roles.includes('SP') ? 'Service Provider (SP)'
        : 'unknown';
  return {
    entityId: p.entityId || null,
    classification,
    ssoEndpointCount: sso,
    acsEndpointCount: acs,
    summary: `${p.entityId || 'unnamed entity'} — ${classification} with ${endpoints.length} endpoints`,
  };
}
