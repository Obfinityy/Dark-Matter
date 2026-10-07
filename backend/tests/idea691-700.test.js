/**
 * idea691-700.test.js — Tests for the JS endpoint-mining + WASM intel wave.
 *
 * Ideas 691-699: jsEndpointMiner.js — passive extraction of WebSocket URLs,
 * EventSource URLs, fetch targets, Axios baseURLs, jQuery AJAX URLs,
 * GraphQL endpoints/operations and service-worker registrations from
 * synthetic bundle text shaped like real build output.
 * Idea 700: wasmIntel.js — WASM binary string extraction and classification
 * using a hand-built synthetic .wasm fixture.
 *
 * Run: cd backend && node --test tests/idea691-700.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractWebSocketUrls,
  harvestEventSourceUrls,
  aggregateFetchEndpoints,
  resolveAxiosBaseUrls,
  extractJqueryAjaxUrls,
  discoverGraphQLEndpoints,
  catalogGraphQLOperations,
  mineServiceWorker,
  enumerateServiceWorkerCacheKeys,
  mineJsEndpoints,
  stripJsComments,
} from '../src/engines/jsEndpointMiner.js';

import {
  isWasmBinary,
  readLeb128,
  listWasmSections,
  extractWasmStrings,
  classifyWasmStrings,
  analyzeWasmBinary,
} from '../src/engines/wasmIntel.js';

// ---------------------------------------------------------------------------
// Idea 691 — WebSocket URL extraction
// ---------------------------------------------------------------------------
describe('idea 691 — extractWebSocketUrls', () => {
  it('finds bare ws/wss URLs and WebSocket call sites', () => {
    const js = `
      const a = "wss://realtime.example.com/feed";
      const sock = new WebSocket("ws://legacy.example.com:8080/ws");
      const tpl = new WebSocket("wss://" + host + "/socket");
      const other = "https://example.com/not-a-socket";
    `;
    const urls = extractWebSocketUrls(js);
    const found = urls.map((u) => u.url);
    assert.ok(found.includes('wss://realtime.example.com/feed'));
    assert.ok(found.includes('ws://legacy.example.com:8080/ws'));
    assert.ok(found.includes('wss://host/socket'));
    assert.ok(!found.some((u) => u.startsWith('https://')));
    assert.strictEqual(urls.find((u) => u.url === 'wss://realtime.example.com/feed').secure, true);
    assert.strictEqual(urls.find((u) => u.url === 'ws://legacy.example.com:8080/ws').callSite, true);
  });

  it('ignores commented-out URLs', () => {
    const urls = extractWebSocketUrls('// wss://commented.example.com/x\nconst ok = 1;');
    assert.strictEqual(urls.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Idea 692 — EventSource URL harvesting
// ---------------------------------------------------------------------------
describe('idea 692 — harvestEventSourceUrls', () => {
  it('harvests constructor calls and config keys', () => {
    const js = `
      const src = new EventSource("https://api.example.com/events");
      const cfg = { eventSourceUrl: "/sse/stream", sseUrl: "https://cdn.example.com/sse" };
    `;
    const urls = harvestEventSourceUrls(js);
    const found = urls.map((u) => u.url);
    assert.deepStrictEqual(found.sort(), [
      '/sse/stream',
      'https://api.example.com/events',
      'https://cdn.example.com/sse',
    ].sort());
    assert.strictEqual(urls.find((u) => u.url === '/sse/stream').source, 'config');
    assert.strictEqual(urls.find((u) => u.url === 'https://api.example.com/events').source, 'constructor');
  });
});

// ---------------------------------------------------------------------------
// Idea 693 — Fetch-call endpoint aggregation
// ---------------------------------------------------------------------------
describe('idea 693 — aggregateFetchEndpoints', () => {
  it('aggregates fetch targets across bundles with counts', () => {
    const b1 = `fetch("/api/users").then(r=>r.json()); fetch("/api/users"); new Request("/api/export");`;
    const b2 = `window.fetch(\`/api/dyn/\${id}\`); fetch(getUrl());`;
    const inv = aggregateFetchEndpoints([b1, b2]);
    const users = inv.find((e) => e.url === '/api/users');
    assert.strictEqual(users.kind, 'fetch');
    assert.strictEqual(users.occurrences, 2);
    assert.ok(inv.find((e) => e.url === '/api/export' && e.kind === 'Request'));
    const dyn = inv.find((e) => e.dynamicCalls > 0);
    assert.strictEqual(dyn.occurrences, 2);
  });
});

// ---------------------------------------------------------------------------
// Idea 694 — Axios baseURL resolution
// ---------------------------------------------------------------------------
describe('idea 694 — resolveAxiosBaseUrls', () => {
  it('merges baseURL with relative method paths', () => {
    const js = `
      const api = axios.create({ baseURL: "https://api.example.com/v2" });
      api.get("/users");
      api.post("/users", data);
      axios.defaults.baseURL = "https://api.example.com/v1";
    `;
    const { baseUrls, endpoints } = resolveAxiosBaseUrls(js);
    assert.ok(baseUrls.includes('https://api.example.com/v2'));
    assert.ok(baseUrls.includes('https://api.example.com/v1'));
    const get = endpoints.find((e) => e.method === 'GET' && e.path === '/users');
    assert.ok(get.fullUrl.startsWith('https://api.example.com/v'));
    assert.ok(get.fullUrl.endsWith('/users'));
  });
});

// ---------------------------------------------------------------------------
// Idea 695 — jQuery AJAX URL extraction
// ---------------------------------------------------------------------------
describe('idea 695 — extractJqueryAjaxUrls', () => {
  it('extracts $.ajax blocks and shorthand calls', () => {
    const js = `
      $.ajax({ url: "/legacy/save", method: "post", data: d });
      $.get("/legacy/list");
      $.getJSON("/legacy/data.json");
      $("#box").load("/legacy/panel");
    `;
    const urls = extractJqueryAjaxUrls(js);
    const byUrl = Object.fromEntries(urls.map((u) => [u.url, u]));
    assert.strictEqual(byUrl['/legacy/save'].method, 'POST');
    assert.strictEqual(byUrl['/legacy/save'].source, '$.ajax');
    assert.strictEqual(byUrl['/legacy/list'].method, 'GET');
    assert.strictEqual(byUrl['/legacy/data.json'].source, '$.getJSON');
    assert.strictEqual(byUrl['/legacy/panel'].source, '.load');
  });
});

// ---------------------------------------------------------------------------
// Idea 696 — GraphQL endpoint discovery
// ---------------------------------------------------------------------------
describe('idea 696 — discoverGraphQLEndpoints', () => {
  it('finds Apollo uri, urql url and bare graphql paths', () => {
    const js = `
      const client = new ApolloClient({ uri: "https://api.example.com/graphql", cache });
      const urql = createClient({ url: "https://gql.example.com/v1/graphql" });
      const ping = fetch("/internal/graphql");
    `;
    const eps = discoverGraphQLEndpoints(js);
    const found = eps.map((e) => e.endpoint);
    assert.ok(found.includes('https://api.example.com/graphql'));
    assert.ok(found.includes('https://gql.example.com/v1/graphql'));
    assert.ok(found.includes('/internal/graphql'));
    assert.strictEqual(eps.find((e) => e.endpoint === 'https://api.example.com/graphql').source, 'apollo uri');
  });
});

// ---------------------------------------------------------------------------
// Idea 697 — GraphQL operation cataloging
// ---------------------------------------------------------------------------
describe('idea 697 — catalogGraphQLOperations', () => {
  it('catalogs named operations, fragments and anonymous ones', () => {
    const js = `
      query GetUser($id: ID!) { user(id: $id) { name } }
      mutation UpdateUser { updateUser { id } }
      fragment UserFields on User { name email }
      const q = gql\`query { viewer { login } }\`;
    `;
    const ops = catalogGraphQLOperations(js);
    const named = ops.filter((o) => o.name);
    assert.ok(named.some((o) => o.kind === 'query' && o.name === 'GetUser'));
    assert.ok(named.some((o) => o.kind === 'mutation' && o.name === 'UpdateUser'));
    assert.ok(ops.some((o) => o.kind === 'fragment' && o.name === 'UserFields'));
    assert.ok(ops.some((o) => o.kind === 'query' && o.name === null));
  });
});

// ---------------------------------------------------------------------------
// Ideas 698/699 — Service-worker mining
// ---------------------------------------------------------------------------
const SW_FIXTURE = `
  const CACHE_NAME = "app-cache-v3";
  workbox.precaching.precacheAndRoute([
    { url: "/index.html", revision: "a1b2c3" },
    { url: "/app.js", revision: "d4e5f6" },
  ]);
  workbox.routing.registerRoute(
    /\\/api\\/.*/,
    new workbox.strategies.NetworkFirst()
  );
  registerRoute("/images/:name", new CacheFirst());
  self.addEventListener("push", (e) => {});
  self.registration.pushManager.subscribe({ applicationServerKey: key, userVisibleOnly: true });
  caches.open("runtime-cache");
`;

describe('idea 698 — mineServiceWorker', () => {
  it('extracts precache, routes, push evidence and cache names', () => {
    const sw = mineServiceWorker(SW_FIXTURE);
    assert.ok(sw.precache.includes('/index.html'));
    assert.ok(sw.precache.includes('/app.js'));
    assert.strictEqual(sw.routes.length, 2);
    assert.ok(sw.routes.some((r) => r.strategy === 'NetworkFirst' || r.strategy === 'CacheFirst'));
    assert.strictEqual(sw.push.subscribeCall, true);
    assert.strictEqual(sw.push.applicationServerKey, true);
    assert.ok(sw.cacheNames.includes('app-cache-v3'));
    assert.ok(sw.cacheNames.includes('runtime-cache'));
  });
});

describe('idea 699 — enumerateServiceWorkerCacheKeys', () => {
  it('normalizes manifest pairs and legacy cache arrays', () => {
    const keys = enumerateServiceWorkerCacheKeys(SW_FIXTURE + `
      const FILES_TO_CACHE = ["/", "/offline.html", "/styles.css"];
    `);
    const byUrl = Object.fromEntries(keys.map((k) => [k.url, k]));
    assert.strictEqual(byUrl['/index.html'].revision, 'a1b2c3');
    assert.strictEqual(byUrl['/offline.html'].source, 'cache array');
    assert.strictEqual(byUrl['/'].revision, null);
  });
});

describe('ideas 691-699 — mineJsEndpoints pipeline', () => {
  it('aggregates all miners over bundles', () => {
    const bundle = `
      new WebSocket("wss://rt.example.com/x");
      fetch("/api/a");
      const api = axios.create({ baseURL: "https://api.example.com" });
      api.get("/v1/items");
      $.get("/legacy/y");
      query Ping { ping }
    `;
    const r = mineJsEndpoints(bundle, SW_FIXTURE);
    assert.strictEqual(r.websockets.length, 1);
    assert.ok(r.fetchEndpoints.some((e) => e.url === '/api/a'));
    assert.ok(r.axios.endpoints.some((e) => e.fullUrl === 'https://api.example.com/v1/items'));
    assert.ok(r.jquery.some((u) => u.url === '/legacy/y'));
    assert.ok(r.graphqlOperations.some((o) => o.name === 'Ping'));
    assert.ok(r.serviceWorker.precache.includes('/index.html'));
    assert.ok(r.cacheKeys.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Idea 700 — WASM binary string extraction
// ---------------------------------------------------------------------------

/** Build a minimal synthetic .wasm with a data section holding `payload`. */
function buildWasmFixture(payloadBytes) {
  const out = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  // Data section (id 11): count=1, flags=0, i32.const 0, end, vec(payload)
  const body = [0x01, 0x00, 0x41, 0x00, 0x0b, payloadBytes.length, ...payloadBytes];
  out.push(0x0b, body.length, ...body);
  return Buffer.from(out);
}

const STR = 'https://api.example.com/v1\x00wss://rt.example.com/socket\x00REACT_APP_API_KEY\x00X-Api-Key\x00/authToken\x00';
const SECRET_BLOB = '9F8E7D6C5B4A3F2E1D0C9B8A7F6E5D4C3B2A1F0E9D8C'; // 48-char blob, must NOT be returned
const WASM = buildWasmFixture([...Buffer.from(STR + SECRET_BLOB + '\x00garbage', 'utf8')]);

describe('idea 700 — wasmIntel', () => {
  it('validates the WASM header', () => {
    assert.strictEqual(isWasmBinary(WASM), true);
    assert.strictEqual(isWasmBinary(Buffer.from('not wasm')), false);
    assert.strictEqual(isWasmBinary(Buffer.alloc(4)), false);
  });

  it('reads LEB128 values', () => {
    assert.deepStrictEqual(readLeb128(Buffer.from([0xe5, 0x8e, 0x26]), 0), { value: 624485, next: 3 });
    assert.deepStrictEqual(readLeb128(Buffer.from([0x7f]), 0), { value: 127, next: 1 });
  });

  it('walks sections and finds the data section', () => {
    const sections = listWasmSections(WASM);
    assert.ok(sections.some((s) => s.id === 11));
  });

  it('extracts embedded strings from the binary', () => {
    const { strings, count, sections } = extractWasmStrings(WASM);
    assert.ok(count >= 4);
    assert.ok(strings.includes('https://api.example.com/v1'));
    assert.ok(strings.includes('wss://rt.example.com/socket'));
    assert.strictEqual(sections, 1);
  });

  it('classifies endpoints and key references without leaking secret values', () => {
    const { strings } = extractWasmStrings(WASM);
    const c = classifyWasmStrings(strings);
    assert.ok(c.endpoints.includes('https://api.example.com/v1'));
    assert.ok(c.endpoints.includes('wss://rt.example.com/socket'));
    assert.ok(c.keyReferences.includes('REACT_APP_API_KEY'));
    assert.ok(c.keyReferences.includes('X-Api-Key'));
    assert.ok(c.keyReferences.includes('/authToken'));
    // The secret-looking blob is counted only, never returned.
    assert.ok(c.suspiciousBlobCount >= 1);
    const all = [...c.endpoints, ...c.keyReferences, ...c.other];
    assert.ok(!all.some((s) => s.includes('9F8E7D6C5B4A')));
  });

  it('analyzeWasmBinary runs the full pipeline', () => {
    const r = analyzeWasmBinary(WASM);
    assert.strictEqual(r.valid, true);
    assert.ok(r.stringCount >= 4);
    assert.ok(r.endpoints.length >= 2);
    assert.ok(r.keyReferences.length >= 3);
    assert.deepStrictEqual(analyzeWasmBinary(Buffer.from('junk')), {
      valid: false,
      stringCount: 0,
      sectionCount: 0,
      endpoints: [],
      keyReferences: [],
      suspiciousBlobCount: 0,
    });
  });
});

describe('stripJsComments', () => {
  it('removes line and block comments', () => {
    const out = stripJsComments('const a = 1; // trailing\n/* block */ const b = "http://x";');
    assert.ok(!out.includes('// trailing'));
    assert.ok(!out.includes('/* block */'));
    assert.ok(out.includes('http://x'));
  });
});
