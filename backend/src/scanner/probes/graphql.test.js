// Tests for the GraphQL probe — verifies endpoint detection and
// introspection finding without requiring a live GraphQL server.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeGraphql } from './graphql.js';

describe('graphql probe', () => {
  it('returns empty array when no GraphQL endpoint found', async () => {
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => ({
      ok: true,
      status: 200,
      text: async () => '<html>No GraphQL here</html>',
    });
    
    try {
      const findings = await probeGraphql('http://test.example/', { timeoutMs: 5000 });
      assert.deepEqual(findings, []);
    } finally {
      global.fetch = origFetch;
    }
  });

  it('detects introspection when __schema present', async () => {
    const origFetch = global.fetch;
    let callCount = 0;
    global.fetch = async (url, opts) => {
      callCount++;
      const body = opts.body ? JSON.parse(opts.body) : {};
      // First call: endpoint detection via __typename
      if (body.query === '{__typename}') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ data: { __typename: 'Query' } }),
        };
      }
      // Second call: introspection query
      if (body.query && body.query.includes('__schema{queryType')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            data: { __schema: { queryType: { name: 'Query' } } }
          }),
        };
      }
      // Third call: types query
      if (body.query && body.query.includes('__schema{types')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            data: { __schema: { types: [{ name: 'Query' }, { name: 'User' }] } }
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: {} }),
      };
    };
    
    try {
      const findings = await probeGraphql('http://test.example/', { 
        timeoutMs: 5000,
        depth: 'quick', // Skip T2-T5 for speed
      });
      const intro = findings.find(f => f.class === 'graphql_introspection');
      assert.ok(intro, 'Should detect introspection');
      assert.ok(['info', 'low'].includes(intro.severity));
    } finally {
      global.fetch = origFetch;
    }
  });

  it('flags sensitive types in introspection', async () => {    const origFetch = global.fetch;
    global.fetch = async (url, opts) => {
      const body = opts.body ? JSON.parse(opts.body) : {};
      if (body.query === '{__typename}') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ data: { __typename: 'Query' } }),
        };
      }
      if (body.query && body.query.includes('__schema{queryType')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            data: { __schema: { queryType: { name: 'Query' } } }
          }),
        };
      }
      if (body.query && body.query.includes('__schema{types')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            data: { __schema: { types: [
              { name: 'Query' },
              { name: 'UserPassword' },
              { name: 'AdminSecret' },
            ] } }
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: {} }),
      };
    };
    
    try {
      const findings = await probeGraphql('http://test.example/', { 
        timeoutMs: 5000,
        depth: 'quick',
      });
      const intro = findings.find(f => f.class === 'graphql_introspection');
      assert.ok(intro, 'Should detect introspection');
      assert.equal(intro.severity, 'low', 'Should be low with sensitive types');
    } finally {
      global.fetch = origFetch;
    }
  });
});

// Stub GraphQL server for #155 / #156 / #158 gap-coverage tests.
// Configurable: GET-query support, page cookies, query fields, mutation echo,
// introspection on/off.
function jsonRes(obj, status = 200) {
  return {
    ok: true,
    status,
    headers: { getSetCookie: () => [], get: () => null },
    text: async () => JSON.stringify(obj),
  };
}

function makeGqlStub(cfg) {
  return async (url, opts) => {
    const method = (opts && opts.method) || 'GET';
    const u = String(url);

    // Page fetch: plain GET on a non-/graphql URL.
    if (method === 'GET' && !u.includes('?query=') && !u.includes('/graphql')) {
      return {
        ok: true,
        status: 200,
        headers: { getSetCookie: () => cfg.pageCookies || [], get: () => null },
        text: async () => '<html>test page</html>',
      };
    }
    // GET GraphQL query (benign __typename probe).
    if (method === 'GET' && u.includes('?query=')) {
      if (cfg.getQueryWorks) return jsonRes({ data: { __typename: 'Query' } });
      return {
        ok: true,
        status: 400,
        headers: { getSetCookie: () => [], get: () => null },
        text: async () => 'Method Not Allowed',
      };
    }
    // POST /graphql dispatch.
    const body = opts.body ? JSON.parse(opts.body) : {};
    const q = body.query || '';
    if (q === '{__typename}') return jsonRes({ data: { __typename: 'Query' } });
    if (q.includes('__schema{queryType{name}}')) {
      return cfg.introOn
        ? jsonRes({ data: { __schema: { queryType: { name: 'Query' } } } })
        : jsonRes({ errors: [{ message: 'introspection disabled' }] });
    }
    if (q.includes('__schema{types')) {
      return jsonRes({ data: { __schema: { types: [{ name: 'Query' }] } } });
    }
    if (q.includes('queryType{fields')) {
      return jsonRes({
        data: { __schema: { queryType: { fields: cfg.fields || [{ name: 'me' }] } } },
      });
    }
    if (q.includes('mutationType{fields')) {
      return jsonRes({
        data: {
          __schema: {
            mutationType: {
              fields: [
                {
                  name: 'updateUser',
                  args: [
                    {
                      name: 'input',
                      type: {
                        kind: 'NON_NULL',
                        ofType: {
                          name: 'UpdateUserInput',
                          inputFields: [
                            { name: 'id' },
                            { name: 'name' },
                            { name: 'role' },
                          ],
                        },
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      });
    }
    if (q.startsWith('mutation')) {
      return cfg.mutationEcho
        ? jsonRes({ data: { updateUser: { __typename: 'User' } } })
        : jsonRes({ errors: [{ message: 'Unknown field "isAdmin"' }] });
    }
    // Sensitive-field query fallback: {userEmail} etc.
    return jsonRes({ data: { userEmail: 'admin@example.com' } });
  };
}

describe('graphql gap coverage (#155/#156/#158)', () => {
  it('#155 fires when GET queries execute + session cookie lacks SameSite', async () => {
    const origFetch = global.fetch;
    global.fetch = makeGqlStub({
      introOn: true,
      getQueryWorks: true,
      pageCookies: ['sessionid=abc; Path=/; HttpOnly'],
      fields: [{ name: 'me' }],
    });
    try {
      const findings = await probeGraphql('http://test.example/', {
        timeoutMs: 5000,
        depth: 'standard',
      });
      const f = findings.find(x => x.class === 'graphql_csrf_get');
      assert.ok(f, 'graphql_csrf_get should fire');
      assert.equal(f.severity, 'medium');
      assert.equal(f.parameter, 'sessionid');
      assert.ok(f.evidence.signalCorrelated);
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#155 does not fire when GET queries are not supported', async () => {
    const origFetch = global.fetch;
    global.fetch = makeGqlStub({
      introOn: true,
      getQueryWorks: false,
      pageCookies: ['sessionid=abc; Path=/'],
      fields: [{ name: 'me' }],
    });
    try {
      const findings = await probeGraphql('http://test.example/', {
        timeoutMs: 5000,
        depth: 'standard',
      });
      assert.ok(!findings.some(x => x.class === 'graphql_csrf_get'), 'no CSRF finding without GET support');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#155 does not fire when session cookie has SameSite=Lax', async () => {
    const origFetch = global.fetch;
    global.fetch = makeGqlStub({
      introOn: true,
      getQueryWorks: true,
      pageCookies: ['sessionid=abc; Path=/; SameSite=Lax; HttpOnly'],
      fields: [{ name: 'me' }],
    });
    try {
      const findings = await probeGraphql('http://test.example/', {
        timeoutMs: 5000,
        depth: 'standard',
      });
      assert.ok(!findings.some(x => x.class === 'graphql_csrf_get'), 'no CSRF finding with SameSite=Lax');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#156 fires when a sensitive field returns data unauthenticated', async () => {
    const origFetch = global.fetch;
    global.fetch = makeGqlStub({
      introOn: true,
      getQueryWorks: false,
      fields: [{ name: 'userEmail' }, { name: 'me' }],
    });
    try {
      const findings = await probeGraphql('http://test.example/', {
        timeoutMs: 5000,
        depth: 'standard',
      });
      const f = findings.find(x => x.class === 'graphql_field_auth_bypass');
      assert.ok(f, 'graphql_field_auth_bypass should fire');
      assert.ok(['high', 'critical'].includes(f.severity));
      assert.ok(f.parameter.includes('userEmail'));
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#156 stays silent when sensitive fields return null', async () => {
    const origFetch = global.fetch;
    global.fetch = async (url, opts) => {
      const stub = makeGqlStub({
        introOn: true,
        getQueryWorks: false,
        fields: [{ name: 'userEmail' }],
      });
      const r = await stub(url, opts);
      // Force null for the sensitive-field query.
      const body = opts.body ? JSON.parse(opts.body) : {};
      if ((body.query || '').includes('userEmail') && !body.query.includes('__schema')) {
        return {
          ok: true,
          status: 200,
          headers: { getSetCookie: () => [], get: () => null },
          text: async () => JSON.stringify({ data: { userEmail: null } }),
        };
      }
      return r;
    };
    try {
      const findings = await probeGraphql('http://test.example/', {
        timeoutMs: 5000,
        depth: 'standard',
      });
      assert.ok(!findings.some(x => x.class === 'graphql_field_auth_bypass'), 'null fields must not fire');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#158 fires HIGH in lab mode when mutation accepts privileged fields', async () => {
    const origFetch = global.fetch;
    global.fetch = makeGqlStub({ introOn: true, getQueryWorks: false, mutationEcho: true });
    try {
      const findings = await probeGraphql('http://test.example/', {
        timeoutMs: 5000,
        depth: 'standard',
        labTargets: 'test.example',
      });
      const f = findings.find(x => x.class === 'graphql_mutation_mass_assignment');
      assert.ok(f, 'graphql_mutation_mass_assignment should fire in lab mode');
      assert.equal(f.severity, 'high');
      assert.ok(f.evidence.response.includes('role'));
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#158 stays passive (low) against non-lab targets', async () => {
    const origFetch = global.fetch;
    global.fetch = makeGqlStub({ introOn: true, getQueryWorks: false, mutationEcho: true });
    try {
      const findings = await probeGraphql('http://test.example/', {
        timeoutMs: 5000,
        depth: 'standard',
      });
      assert.ok(!findings.some(x => x.class === 'graphql_mutation_mass_assignment'), 'no active mutation off-lab');
      const f = findings.find(x => x.class === 'graphql_mutation_privileged_fields');
      assert.ok(f, 'passive surface note should fire');
      assert.equal(f.severity, 'low');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#158 lab mode rejects when server errors on unknown fields', async () => {
    const origFetch = global.fetch;
    global.fetch = makeGqlStub({ introOn: true, getQueryWorks: false, mutationEcho: false });
    try {
      const findings = await probeGraphql('http://test.example/', {
        timeoutMs: 5000,
        depth: 'standard',
        labTargets: 'test.example',
      });
      assert.ok(!findings.some(x => x.class === 'graphql_mutation_mass_assignment'), 'validation error must not fire');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('all-negative stub yields zero findings', async () => {
    const origFetch = global.fetch;
    global.fetch = makeGqlStub({
      introOn: false,
      getQueryWorks: false,
      pageCookies: [],
      fields: [{ name: 'me' }],
    });
    try {
      const findings = await probeGraphql('http://test.example/', {
        timeoutMs: 5000,
        depth: 'standard',
      });
      assert.deepEqual(findings, [], 'no findings on hardened stub');
    } finally {
      global.fetch = origFetch;
    }
  });
});
