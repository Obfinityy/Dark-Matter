/**
 * halLinkRelationMapper.js — HAL link-relation mapping engine.
 *
 * Idea 00629 — HAL link-relation mapping.
 *
 * Maps the navigation graph of HAL (Hypertext Application Language,
 * application/hal+json) APIs on authorized targets by walking _links
 * (including templated links) and _embedded resources. Pure response
 * analysis; no link is followed unless the caller opts in.
 */

/**
 * Extract links from a HAL document.
 * @param {object} doc parsed HAL JSON document
 * @returns {Array<{rel: string, href: string, templated: boolean, title: string|null}>}
 */
export function extractHalLinks(doc = {}) {
  const links = doc?._links;
  if (!links || typeof links !== 'object') return [];
  const out = [];
  for (const [rel, value] of Object.entries(links)) {
    const entries = Array.isArray(value) ? value : [value];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || !entry.href) continue;
      out.push({
        rel,
        href: String(entry.href),
        templated: entry.templated === true,
        title: entry.title || null,
      });
    }
  }
  return out;
}

/**
 * Build a navigation graph (adjacency list) from a HAL document.
 * @param {object} doc parsed HAL JSON document
 * @returns {{ nodes: string[], edges: Array<{from: string, rel: string, to: string, templated: boolean}> }}
 */
export function mapNavigationGraph(doc = {}) {
  const links = extractHalLinks(doc);
  const self = links.find((l) => l.rel === 'self')?.href || '(root)';
  const nodes = new Set([self]);
  const edges = [];
  for (const link of links) {
    nodes.add(link.href);
    edges.push({ from: self, rel: link.rel, to: link.href, templated: link.templated });
  }
  const embedded = doc?._embedded;
  if (embedded && typeof embedded === 'object') {
    for (const [rel, items] of Object.entries(embedded)) {
      const list = Array.isArray(items) ? items : [items];
      for (const item of list) {
        const childSelf = item?._links?.self?.href;
        if (childSelf) {
          nodes.add(childSelf);
          edges.push({ from: self, rel, to: childSelf, templated: false });
        }
      }
    }
  }
  return { nodes: [...nodes], edges };
}

/**
 * Detect whether a response body is a HAL document.
 * @param {string} contentType response Content-Type header
 * @param {unknown} body parsed JSON body
 * @returns {boolean}
 */
export function isHalDocument(contentType = '', body) {
  const ct = String(contentType).split(';')[0].trim().toLowerCase();
  const ctMatch = ct === 'application/hal+json' || ct === 'application/hal+xml';
  const shapeMatch = body && typeof body === 'object' && body._links && typeof body._links === 'object';
  return Boolean(ctMatch || shapeMatch);
}

/**
 * Expand a templated HAL link with provided variables (RFC 6570 level-1 style).
 * @param {string} href templated href e.g. '/orders/{id}'
 * @param {object} vars variable values
 * @returns {string} expanded href
 */
export function expandTemplatedLink(href = '', vars = {}) {
  return String(href).replace(/\{([^}]+)\}/g, (match, name) => {
    const key = name.replace(/^[?+#&]/, '');
    return key in vars ? encodeURIComponent(String(vars[key])) : match;
  });
}

/**
 * Summarize a HAL navigation graph as a hardening note.
 * @param {string} url endpoint that served the HAL document
 * @param {object} graph output of mapNavigationGraph
 * @returns {string|null}
 */
export function summarizeFindings(url, graph = { nodes: [], edges: [] }) {
  if (!graph.edges || graph.edges.length === 0) return null;
  const rels = [...new Set(graph.edges.map((e) => e.rel))];
  const admin = rels.filter((r) => /admin|internal|debug|manage/i.test(r));
  const note = admin.length ? ` Sensitive-looking relations: ${admin.join(', ')}.` : '';
  return `HAL navigation graph mapped at ${url}: ${graph.edges.length} link(s) across ${rels.length} relation(s) (${rels.slice(0, 8).join(', ')}${rels.length > 8 ? ', ...' : ''}).${note} Recommendation: apply authorization on every linked resource, not just the entry point.`;
}
