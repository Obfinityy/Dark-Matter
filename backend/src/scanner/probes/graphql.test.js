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

  // isLab follow-up (8 Nov 2026): the old local isLabTarget compared the
  // bare hostname against port-bearing labTargets entries (never matched)
  // and accepted any SUBDOMAIN of a lab entry (fail-open). The canonical
  // helper compares exact canonical hostnames, port-insensitive.
  it('#158 fires HIGH with PORT-BEARING labTargets (the production shape)', async () => {
    const origFetch = global.fetch;
    global.fetch = makeGqlStub({ introOn: true, getQueryWorks: false, mutationEcho: true });
    try {
      const findings = await probeGraphql('http://test.example/', {
        timeoutMs: 5000,
        depth: 'standard',
        labTargets: 'test.example:443',
      });
      const f = findings.find(x => x.class === 'graphql_mutation_mass_assignment');
      assert.ok(f, 'port-bearing labTargets must open the lab branch');
      assert.equal(f.severity, 'high');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#158 stays passive on a subdomain of a lab entry (no suffix match)', async () => {
    const origFetch = global.fetch;
    global.fetch = makeGqlStub({ introOn: true, getQueryWorks: false, mutationEcho: true });
    try {
      const findings = await probeGraphql('http://sub.test.example/', {
        timeoutMs: 5000,
        depth: 'standard',
        labTargets: 'test.example',
      });
      assert.ok(!findings.some(x => x.class === 'graphql_mutation_mass_assignment'), 'a subdomain is not the lab host');
      const f = findings.find(x => x.class === 'graphql_mutation_privileged_fields');
      assert.ok(f, 'passive surface note should fire instead');
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

// Stateful GraphQL + REST stub for #385 (mutation BOLA) tests.
// Models a lab GraphQL server with two users (admin + low-priv),
// REST /api/login + /api/Users, and an authorisation mode flag.
// bolaMode 'vulnerable': a low-priv mutation on the admin's id
// persists. 'hardened': the same mutation is rejected with an error.
function makeGqlBolaStub(cfg) {
  const users = {
    'u-admin': { id: 'u-admin', name: 'Admin', email: 'admin@example.com' },
    'u-low': { id: 'u-low', name: 'Low', email: 'low@example.com' },
  };
  let lowEmail = null;
  const calls = { mutations: 0, logins: 0, registers: 0 };
  const fetch = async (url, opts) => {
    const method = (opts && opts.method) || 'GET';
    const u = String(url);
    const auth = (opts && opts.headers && opts.headers.Authorization) || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    // REST: register the throwaway low-priv account.
    if (u.endsWith('/api/Users') && method === 'POST') {
      const body = opts.body ? JSON.parse(opts.body) : {};
      calls.registers += 1;
      if (body.email && String(body.email).includes('@')) {
        lowEmail = body.email;
        return jsonRes({ id: 'u-low' }, 201);
      }
      return jsonRes({ error: 'bad request' }, 400);
    }
    // REST: login (admin creds, or the registered low-priv account).
    if (u.endsWith('/api/login') && method === 'POST') {
      const body = opts.body ? JSON.parse(opts.body) : {};
      calls.logins += 1;
      const who = body.email || body.username;
      if (who === 'admin@example.com' && body.password === 'adminpass') {
        return jsonRes({ token: 'tok-admin' });
      }
      if (lowEmail && who === lowEmail) {
        return jsonRes({ token: 'tok-low' });
      }
      return jsonRes({ error: 'unauthorized' }, 401);
    }
    // Page GET (t155 cookie read): plain page, no cookies.
    if (method === 'GET' && !u.includes('?query=') && !u.includes('/graphql')) {
      return {
        ok: true,
        status: 200,
        headers: { getSetCookie: () => [], get: () => null },
        text: async () => '<html>test page</html>',
      };
    }
    // GET GraphQL query (t155): not supported.
    if (method === 'GET' && u.includes('?query=')) {
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
      return cfg.introOn === false
        ? jsonRes({ errors: [{ message: 'introspection disabled' }] })
        : jsonRes({ data: { __schema: { queryType: { name: 'Query' } } } });
    }
    if (q.includes('__schema{types')) {
      return jsonRes({ data: { __schema: { types: [{ name: 'Query' }, { name: 'User' }] } } });
    }
    if (q.includes('queryType{fields')) {
      const fields = cfg.noSelf
        ? [{ name: 'user', args: [{ name: 'id', type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'ID' } } }], type: { kind: 'OBJECT', name: 'User' } }]
        : [
            { name: 'me', args: [], type: { kind: 'OBJECT', name: 'User' } },
            { name: 'user', args: [{ name: 'id', type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'ID' } } }], type: { kind: 'OBJECT', name: 'User' } },
          ];
      return jsonRes({ data: { __schema: { queryType: { fields } } } });
    }
    if (q.includes('mutationType{fields')) {
      const fields = cfg.noMutCand
        ? [{ name: 'deleteUser', args: [{ name: 'id', type: { kind: 'SCALAR', name: 'ID' } }], type: { kind: 'OBJECT', name: 'User' } }]
        : [{
            name: 'updateUser',
            args: [{ name: 'input', type: { kind: 'NON_NULL', ofType: { kind: 'INPUT_OBJECT', name: 'UpdateUserInput', inputFields: [{ name: 'id' }, { name: 'name' }, { name: 'role' }] } } }],
            type: { kind: 'OBJECT', name: 'User' },
          }];
      return jsonRes({ data: { __schema: { mutationType: { fields } } } });
    }
    if (q.includes('__type(name:')) {
      return jsonRes({ data: { __type: { name: 'User', fields: [
        { name: 'id', type: { kind: 'SCALAR', name: 'ID' } },
        { name: 'name', type: { kind: 'SCALAR', name: 'String' } },
        { name: 'email', type: { kind: 'SCALAR', name: 'String' } },
      ] } } });
    }
    // Self query {me{id}} — the token decides whose id comes back.
    if (q.includes('{me{')) {
      if (token === 'tok-admin') return jsonRes({ data: { me: { id: 'u-admin', name: 'Admin' } } });
      if (token === 'tok-low') return jsonRes({ data: { me: { id: 'u-low', name: 'Low' } } });
      return jsonRes({ errors: [{ message: 'unauthenticated' }] });
    }
    // Read query {user(id:"..."){name}} — returns the live stored name.
    if (q.includes('{user(')) {
      const m = /id\s*:\s*"([^"]+)"/.exec(q);
      const target = m && users[m[1]];
      if (!target) return jsonRes({ data: { user: null } });
      return jsonRes({ data: { user: { id: target.id, name: target.name } } });
    }
    // Mutation dispatch.
    if (q.startsWith('mutation')) {
      calls.mutations += 1;
      const idm = /id\s*:\s*"([^"]+)"/.exec(q);
      const nm = /name\s*:\s*"([^"]+)"/.exec(q);
      const id = idm && idm[1];
      // t158's probe (unknown canary id, no name field): echo, no state change.
      if (!id || !users[id] || !nm) return jsonRes({ data: { updateUser: { __typename: 'User' } } });
      if (cfg.bolaMode === 'hardened') {
        return jsonRes({ errors: [{ message: 'Forbidden: cannot update another user' }] });
      }
      users[id].name = nm[1];
      return jsonRes({ data: { updateUser: { id, name: nm[1] } } });
    }
    return jsonRes({ data: {} });
  };
  fetch.calls = calls;
  fetch.users = users;
  return fetch;
}

const BOLA_OPTS = {
  timeoutMs: 5000,
  depth: 'standard',
  labTargets: 'test.example',
  allowWrite: true,
  labCreds: { username: 'admin@example.com', password: 'adminpass' },
  apiRoutes: ['http://test.example/api/Users', 'http://test.example/api/login'],
};

describe('graphql mutation BOLA (#385)', () => {
  it('#385 fires HIGH on a mutation-vulnerable lab target', async () => {
    const origFetch = global.fetch;
    const stub = makeGqlBolaStub({ bolaMode: 'vulnerable' });
    global.fetch = stub;
    try {
      const findings = await probeGraphql('http://test.example/', BOLA_OPTS);
      const f = findings.find(x => x.class === 'graphql_mutation_bola');
      assert.ok(f, 'graphql_mutation_bola should fire on a vulnerable target');
      assert.equal(f.severity, 'high');
      assert.equal(f.parameter, 'updateUser.name');
      assert.ok(f.evidence.crossUserWrite, 'oracle must carry crossUserWrite');
      assert.ok(f.evidence.signalCorrelated);
      assert.ok(f.evidence.response.includes('Admin'), 're-read differential must show the pre-mutation value');
      // The stub's stored state proves a REAL cross-user write happened,
      // not just a finding object: the admin's name is now the canary.
      assert.notEqual(stub.users['u-admin'].name, 'Admin');
      assert.ok(stub.users['u-admin'].name.startsWith('dmbola'));
      assert.equal(stub.calls.mutations, 2, 't158 echo + the BOLA mutation');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#385 stays silent when mutations are properly authorised', async () => {
    const origFetch = global.fetch;
    const stub = makeGqlBolaStub({ bolaMode: 'hardened' });
    global.fetch = stub;
    try {
      const findings = await probeGraphql('http://test.example/', BOLA_OPTS);
      assert.ok(!findings.some(x => x.class === 'graphql_mutation_bola'), 'a rejected mutation must not fire');
      assert.equal(stub.users['u-admin'].name, 'Admin', 'no state change on the hardened target');
      assert.equal(stub.calls.mutations, 2, 'the leg attempted the mutation and the oracle rejected it');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#385 stays silent off-lab and sends no mutation', async () => {
    const origFetch = global.fetch;
    const stub = makeGqlBolaStub({ bolaMode: 'vulnerable' });
    global.fetch = stub;
    try {
      const { labTargets, ...offLab } = BOLA_OPTS;
      const findings = await probeGraphql('http://test.example/', offLab);
      assert.ok(!findings.some(x => x.class === 'graphql_mutation_bola'), 'no BOLA finding off-lab');
      assert.equal(stub.calls.mutations, 0, 'no mutation may be sent off-lab');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#385 stays silent without lab credentials', async () => {
    const origFetch = global.fetch;
    const stub = makeGqlBolaStub({ bolaMode: 'vulnerable' });
    global.fetch = stub;
    try {
      const { labCreds, ...noCreds } = BOLA_OPTS;
      const findings = await probeGraphql('http://test.example/', noCreds);
      assert.ok(!findings.some(x => x.class === 'graphql_mutation_bola'), 'no BOLA finding without sessions');
      // CORRECTION (resume lane): the single mutation is t158's fake-id
      // echo — lab-gated on labTargets alone, touches no real data — not
      // a BOLA mutation. t158's existing lab-mode test requires it to
      // send with labTargets and no labCreds, so 0 is unreachable here.
      assert.equal(stub.calls.mutations, 1, 't158 echo only — the BOLA leg sent no mutation without sessions');
      assert.equal(stub.users['u-admin'].name, 'Admin', 'no state change without sessions');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#385 stays silent when no self field exists (uncalibrated)', async () => {
    const origFetch = global.fetch;
    const stub = makeGqlBolaStub({ bolaMode: 'vulnerable', noSelf: true });
    global.fetch = stub;
    try {
      const findings = await probeGraphql('http://test.example/', BOLA_OPTS);
      assert.ok(!findings.some(x => x.class === 'graphql_mutation_bola'), 'no foreign id, no oracle, no finding');
      assert.equal(stub.calls.mutations, 1, 'only the t158 echo mutation ran');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('#385 stays silent when only destructive mutations exist', async () => {
    const origFetch = global.fetch;
    const stub = makeGqlBolaStub({ bolaMode: 'vulnerable', noMutCand: true });
    global.fetch = stub;
    try {
      const findings = await probeGraphql('http://test.example/', BOLA_OPTS);
      assert.ok(!findings.some(x => x.class === 'graphql_mutation_bola'), 'deleteUser is blocklisted, never a candidate');
      // CORRECTION (resume lane): t158 sends its echo only when a
      // mutation input exposes privileged fields — with deleteUser as
      // the sole mutation it sends nothing either, so the total is 0.
      assert.equal(stub.calls.mutations, 0, 'no mutation was attempted at all — delete was never a candidate');
    } finally {
      global.fetch = origFetch;
    }
  });
});
