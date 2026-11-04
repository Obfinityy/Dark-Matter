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

  it('flags sensitive types in introspection', async () => {
    const origFetch = global.fetch;
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
