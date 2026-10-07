/**
 * odataMetadataMiner.js — OData $metadata mining engine.
 *
 * Idea 00628 — OData metadata mining.
 *
 * On authorized targets, fetches OData $metadata documents and parses
 * EntitySet names, entity types, properties, and navigation properties to
 * reveal the underlying data model. Read-only metadata parsing; no entity
 * data is requested.
 */

/**
 * Candidate $metadata URLs for OData service roots.
 * @param {string} baseUrl
 * @param {string[]} [serviceRoots] e.g. ['/odata', '/api/odata']
 * @returns {string[]}
 */
export function metadataCandidates(baseUrl, serviceRoots = ['/odata', '/api/odata', '/v1', '/api']) {
  if (!baseUrl || typeof baseUrl !== 'string') return [];
  const base = baseUrl.replace(/\/+$/, '');
  return serviceRoots.map((r) => `${base}${r}$metadata`.replace(/\/\$metadata$/, '/$metadata'));
}

/**
 * Parse an OData $metadata (EDMX) document for entity sets and types.
 * @param {string} xml raw $metadata XML
 * @returns {{ entitySets: string[], entityTypes: Array<{name: string, properties: string[], navigationProperties: string[]}>, version: string|null }}
 */
export function parseODataMetadata(xml = '') {
  const result = { entitySets: [], entityTypes: [], version: null };
  const text = String(xml);
  const versionMatch = text.match(/<edmx:Edmx[^>]*Version="([^"]+)"/i);
  if (versionMatch) result.version = versionMatch[1];

  const setRe = /<EntitySet\s+Name="([^"]+)"/gi;
  let m;
  const sets = new Set();
  while ((m = setRe.exec(text)) !== null) sets.add(m[1]);
  result.entitySets = [...sets];

  const typeRe = /<EntityType\s+Name="([^"]+)"[^>]*>([\s\S]*?)<\/EntityType>/gi;
  while ((m = typeRe.exec(text)) !== null) {
    const [, name, inner] = m;
    const properties = [];
    const propRe = /<Property\s+Name="([^"]+)"/gi;
    let p;
    while ((p = propRe.exec(inner)) !== null) properties.push(p[1]);
    const navProps = [];
    const navRe = /<NavigationProperty\s+Name="([^"]+)"/gi;
    let n;
    while ((n = navRe.exec(inner)) !== null) navProps.push(n[1]);
    result.entityTypes.push({ name, properties, navigationProperties: navProps });
  }
  return result;
}

/**
 * Flag entity sets / properties that commonly hold sensitive data.
 * @param {object} parsed output of parseODataMetadata
 * @returns {{ entitySets: string[], properties: string[] }} sensitive-looking names
 */
export function flagSensitiveModel(parsed = {}) {
  const sensitive = /password|secret|token|ssn|credit|card|salary|medical|health|dob|birth|passport|iban|account/i;
  const entitySets = (parsed.entitySets || []).filter((s) => sensitive.test(s));
  const properties = [];
  for (const t of parsed.entityTypes || []) {
    for (const p of t.properties || []) {
      if (sensitive.test(p)) properties.push(`${t.name}.${p}`);
    }
  }
  return { entitySets, properties };
}

/**
 * Fetch and parse an OData $metadata document.
 * @param {string} url $metadata URL
 * @param {Function} [fetchImpl] injectable fetch
 * @returns {Promise<object>} parsed model plus the URL
 */
export async function mineMetadata(url, fetchImpl = globalThis.fetch) {
  const outcome = { url, entitySets: [], entityTypes: [], version: null, error: null };
  try {
    const res = await fetchImpl(url, { headers: { Accept: 'application/xml' } });
    const text = await res.text();
    if (!/<edmx:Edmx/i.test(text)) {
      outcome.error = `not an OData metadata document (HTTP ${res.status})`;
      return outcome;
    }
    const parsed = parseODataMetadata(text);
    Object.assign(outcome, parsed, { status: res.status });
  } catch (err) {
    outcome.error = err?.message || String(err);
  }
  return outcome;
}

/**
 * Summarize OData metadata mining as a hardening note.
 * @param {object[]} mined
 * @returns {string|null}
 */
export function summarizeFindings(mined = []) {
  const found = mined.filter((x) => x.entitySets.length > 0);
  if (found.length === 0) return null;
  const lines = found.map((x) => {
    const sensitive = flagSensitiveModel(x);
    const note = sensitive.entitySets.length || sensitive.properties.length
      ? `; sensitive-looking: ${[...sensitive.entitySets, ...sensitive.properties].slice(0, 5).join(', ')}`
      : '';
    return `- ${x.url}: ${x.entitySets.length} entity set(s)${x.version ? ` (OData v${x.version})` : ''}${note}`;
  });
  return `OData data models exposed via $metadata:\n${lines.join('\n')}\nRecommendation: review entity-level authorization and consider restricting $metadata on public services.`;
}
