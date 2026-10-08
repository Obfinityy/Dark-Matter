/**
 * adGlobalCatalogDetector.js — Active Directory Global Catalog detector.
 *
 * A Global Catalog (port 3268) answers LDAP searches across the whole
 * forest. An authorized agent pings candidate hosts on 3268, reads the
 * rootDSE (isGlobalCatalogReady, forestFunctionality, dsServiceName),
 * and reports whether the host is a GC — a high-value reconnaissance
 * finding because GCs hold a partial replica of every object.
 *
 * Defensive framing: read-only rootDSE analysis of hosts observed during
 * an authorized assessment. No searches for sensitive attributes.
 */

/**
 * Analyze an observed rootDSE record for Global Catalog traits.
 *
 * @param {Object} input
 * @param {string} [input.server] - Host observed.
 * @param {number} [input.port] - Port probed (3268 = GC, 3269 = GC over TLS).
 * @param {boolean} [input.portOpen] - Whether the GC port responded.
 * @param {boolean} [input.isGlobalCatalogReady] - rootDSE isGlobalCatalogReady value.
 * @param {string} [input.forestFunctionality] - rootDSE forestFunctionality OID/value.
 * @param {string} [input.dsServiceName] - rootDSE dsServiceName (DSA DN).
 * @param {string} [input.defaultNamingContext] - rootDSE defaultNamingContext.
 * @returns {Object} Global Catalog detection finding.
 */
export function detectGlobalCatalog({
  server = '',
  port = 3268,
  portOpen = false,
  isGlobalCatalogReady = false,
  forestFunctionality = '',
  dsServiceName = '',
  defaultNamingContext = '',
} = {}) {
  if (!portOpen) {
    return {
      type: 'AD Global Catalog Detection',
      isGlobalCatalog: false,
      confidence: 'medium',
      evidence: `Port ${port} on ${server || 'target'} did not respond — not a reachable Global Catalog.`,
    };
  }

  const evidenceBits = [`port ${port} open`];
  if (isGlobalCatalogReady) evidenceBits.push('isGlobalCatalogReady=TRUE');
  if (forestFunctionality) evidenceBits.push(`forestFunctionality=${forestFunctionality}`);
  if (dsServiceName) evidenceBits.push(`dsServiceName=${dsServiceName}`);
  if (defaultNamingContext) evidenceBits.push(`defaultNamingContext=${defaultNamingContext}`);

  return {
    type: 'AD Global Catalog Detection',
    isGlobalCatalog: !!isGlobalCatalogReady,
    confidence: isGlobalCatalogReady ? 'high' : 'medium',
    severity: isGlobalCatalogReady ? 'Low' : undefined,
    evidence: `Global Catalog ${isGlobalCatalogReady ? 'confirmed' : 'candidate'} at ${server || 'target'}: ${evidenceBits.join('; ')}.`,
    port,
    portOpen,
    isGlobalCatalogReady: !!isGlobalCatalogReady,
    forestFunctionality: forestFunctionality || undefined,
    dsServiceName: dsServiceName || undefined,
    defaultNamingContext: defaultNamingContext || undefined,
    exposureNote: isGlobalCatalogReady
      ? 'GC exposes a forest-wide partial replica — enumerate access controls before any further queries.'
      : 'Port open but rootDSE does not confirm GC readiness — may be a filtered proxy.',
  };
}

/**
 * Map Global Catalogs across a set of observed hosts.
 * @param {Array<Object>} observations - Per-host detectGlobalCatalog inputs.
 * @returns {Object} Aggregate GC map.
 */
export function mapGlobalCatalogs(observations = []) {
  const hosts = observations.map(o => ({
    server: o.server || 'unknown',
    port: o.port || 3268,
    isGlobalCatalog: !!(o.portOpen && o.isGlobalCatalogReady),
  }));
  const confirmed = hosts.filter(h => h.isGlobalCatalog);
  return {
    type: 'AD Global Catalog Map',
    confidence: 'medium',
    hosts,
    evidence: `${confirmed.length} confirmed Global Catalog(s) across ${hosts.length} probed host(s): ${confirmed.map(h => h.server).join(', ') || 'none'}.`,
  };
}

export const AD_GLOBAL_CATALOG_DETECTOR = {
  detectGlobalCatalog,
  mapGlobalCatalogs,
};
export default AD_GLOBAL_CATALOG_DETECTOR;
