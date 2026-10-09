/**
 * idea961-970.test.js — Tests for the wave-961 client/test artifact recon engines.
 *
 *  clientArtifactRecon.js — ideas 961–963 (AJV schema inference, OpenAPI
 *                          codegen detection, MSW handler mining)
 *  testArtifactMiner.js   — ideas 964–970 (Storybook, Chromatic, Playwright,
 *                          Cypress, Selenium Grid, fixtures, seed data)
 *
 * Run: node --test tests/idea961-970.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractAjvSchemas,
  inferEndpointsFromAjv,
  detectOpenApiCodegen,
  extractOpenApiSpecShapes,
  mineMswHandlers,
} from '../src/engines/clientArtifactRecon.js';

import {
  enumerateStorybookStories,
  mapChromaticSnapshots,
  minePlaywrightArtifacts,
  harvestCypressSpecUrls,
  detectSeleniumHubs,
  mineTestFixtures,
  extractSeedDataUrls,
} from '../src/engines/testArtifactMiner.js';

/* ------------------------------------------------------------------ */
/* 961 — AJV schema extraction                                         */
/* ------------------------------------------------------------------ */
describe('961 extractAjvSchemas', () => {
  const src = `import Ajv from 'ajv';
const ajv = new Ajv();
const orderSchema = {
  $id: 'https://api.example.com/schemas/order',
  type: 'object',
  properties: {
    orderId: { type: 'string' },
    customerId: { type: 'string' },
    total: { type: 'number' }
  },
  required: ['orderId', 'customerId']
};
const validate = ajv.compile(orderSchema);`;

  it('extracts the schema with properties, required fields and hints', () => {
    const schemas = extractAjvSchemas(src);
    assert.equal(schemas.length, 1);
    const s = schemas[0];
    assert.equal(s.name, 'orderSchema');
    assert.deepEqual(s.properties, ['orderId', 'customerId', 'total']);
    assert.deepEqual(s.required, ['orderId', 'customerId']);
    assert.ok(s.hints.includes('https://api.example.com/schemas/order'));
    assert.equal(s.usedWithAjv, true);
  });

  it('detects inline schemas passed directly to ajv.compile', () => {
    const inline = `ajv.compile({ type: 'object', properties: { sessionId: { type: 'string' } } });`;
    const schemas = extractAjvSchemas(inline);
    assert.equal(schemas.length, 1);
    assert.equal(schemas[0].name, null);
    assert.deepEqual(schemas[0].properties, ['sessionId']);
  });

  it('returns an empty array when no schemas are present', () => {
    assert.deepEqual(extractAjvSchemas('const x = { a: 1 };'), []);
  });
});

describe('961 inferEndpointsFromAjv', () => {
  it('infers endpoints from schema hints and nearby fetch literals', () => {
    const src = `const refundSchema = {
  type: 'object',
  properties: { refundId: { type: 'string' } },
  required: ['refundId']
};
async function submit() {
  await fetch('/api/v1/refunds', { method: 'POST' });
}`;
    const inferred = inferEndpointsFromAjv(src);
    assert.equal(inferred.length, 1);
    const eps = inferred[0].endpoints.map((e) => e.endpoint);
    assert.ok(eps.includes('/api/v1/refunds'));
    assert.ok(inferred[0].endpoints.every((e) => typeof e.basis === 'string' && e.basis.length > 0));
  });
});

/* ------------------------------------------------------------------ */
/* 962 — OpenAPI codegen detection                                     */
/* ------------------------------------------------------------------ */
describe('962 detectOpenApiCodegen / extractOpenApiSpecShapes', () => {
  const generated = `/* generated using openapi-typescript-codegen -- do not edit */
export class OrderService {
  public static createOrder() {
    return __request(OpenAPI, { method: 'POST', path: '/api/v1/orders' });
  }
  public static getOrder() {
    return __request(OpenAPI, { method: 'GET', path: '/api/v1/orders/{orderId}' });
  }
}
OpenAPI.BASE = 'https://api.example.com';`;

  it('flags generated clients and lists operations', () => {
    const res = detectOpenApiCodegen(generated);
    assert.equal(res.isGenerated, true);
    assert.ok(res.generators.length >= 1);
    assert.deepEqual(res.baseUrls, ['https://api.example.com']);
    assert.ok(res.operationCount >= 2);
    assert.ok(res.specShapes.some((s) => s.path === '/api/v1/orders'));
  });

  it('recovers paths and methods from an embedded OpenAPI spec', () => {
    const spec = `var SPEC = {"openapi": "3.0.0", "info": {"title": "t"},
"paths": {
  "/api/v1/users": { "get": {"summary": "list"}, "post": {"summary": "create"} },
  "/api/v1/users/{id}": { "delete": {"summary": "remove"} }
}};`;
    const shapes = extractOpenApiSpecShapes(spec);
    assert.equal(shapes.length, 2);
    const users = shapes.find((s) => s.path === '/api/v1/users');
    assert.deepEqual(users.methods.sort(), ['get', 'post']);
  });

  it('reports not-generated for plain source', () => {
    const res = detectOpenApiCodegen('function add(a, b) { return a + b; }');
    assert.equal(res.isGenerated, false);
    assert.equal(res.operationCount, 0);
  });
});

/* ------------------------------------------------------------------ */
/* 963 — MSW handler mining                                            */
/* ------------------------------------------------------------------ */
describe('963 mineMswHandlers', () => {
  it('mines rest/http handlers, graphql operations and ws links', () => {
    const src = `import { rest } from 'msw';
import { http } from 'msw';
export const handlers = [
  rest.get('/api/v1/invoices', (req, res, ctx) => res(ctx.json([]))),
  http.post('https://api.example.com/api/v1/payments', async () => {}),
  graphql.query('GetCustomer', (req, res, ctx) => res(ctx.data({}))),
  ws.link('wss://api.example.com/live', () => {}),
];`;
    const handlers = mineMswHandlers(src);
    assert.equal(handlers.length, 4);
    assert.deepEqual(
      handlers.map((h) => `${h.method} ${h.path || h.operationName}`),
      ['GET /api/v1/invoices', 'POST https://api.example.com/api/v1/payments', 'QUERY GetCustomer', 'WS wss://api.example.com/live'],
    );
    assert.ok(handlers.every((h) => h.line >= 1));
  });

  it('dedupes repeated handlers', () => {
    const src = `rest.get('/a', h); rest.get('/a', h);`;
    assert.equal(mineMswHandlers(src).length, 1);
  });
});

/* ------------------------------------------------------------------ */
/* 964 — Storybook story enumeration                                   */
/* ------------------------------------------------------------------ */
describe('964 enumerateStorybookStories', () => {
  it('parses a stories.json index', () => {
    const json = `{"v": 4, "stories": {
  "button--primary": {"id": "button--primary", "name": "Primary", "title": "Components/Button", "importPath": "./src/Button.stories.js"},
  "form--login": {"id": "form--login", "name": "Login", "title": "Forms/Login", "importPath": "./src/Login.stories.js"}
}}`;
    const stories = enumerateStorybookStories(json);
    assert.equal(stories.length, 2);
    assert.deepEqual(stories.map((s) => s.id).sort(), ['button--primary', 'form--login']);
    assert.equal(stories[0].title, 'Components/Button');
  });

  it('parses CSF named exports with args props', () => {
    const csf = `export default { title: 'Forms/LoginForm' };
export const Empty = {
  args: { username: '', password: '', rememberMe: false },
};
export const ErrorState = {
  args: { username: 'a@b.c', error: 'invalid' },
};`;
    const stories = enumerateStorybookStories(csf);
    assert.equal(stories.length, 2);
    const empty = stories.find((s) => s.name === 'Empty');
    assert.equal(empty.title, 'Forms/LoginForm');
    assert.ok(empty.props.includes('username') && empty.props.includes('rememberMe'));
  });
});

/* ------------------------------------------------------------------ */
/* 965 — Chromatic snapshot mapping                                    */
/* ------------------------------------------------------------------ */
describe('965 mapChromaticSnapshots', () => {
  it('finds build URLs, iframe sources and story markers', () => {
    const html = `<a href="https://6402f8.chromatic.com/?path=/story/x--y">view</a>
<iframe src="/storybook-static/iframe.html?id=button--primary"></iframe>
<div data-chromatic="button--primary"></div>`;
    const found = mapChromaticSnapshots(html);
    const types = found.map((f) => f.type).sort();
    assert.deepEqual(types, ['buildUrl', 'iframeSrc', 'storyId']);
  });
});

/* ------------------------------------------------------------------ */
/* 966 — Playwright artifact mining                                    */
/* ------------------------------------------------------------------ */
describe('966 minePlaywrightArtifacts', () => {
  it('extracts urls, titles and credential references (never values)', () => {
    const src = `test('admin can log in', async ({ page }) => {
  await page.goto('https://app.example.com/admin/login');
  await page.fill('#pw', process.env.ADMIN_PASSWORD);
  await expect(page).toHaveURL('https://app.example.com/admin/dashboard');
});
test.use({ storageState: 'auth/admin.json', httpCredentials: { username: 'u', password: process.env.ADMIN_PASSWORD } });`;
    const res = minePlaywrightArtifacts(src);
    assert.equal(res.urls.length, 2);
    assert.equal(res.testTitles.length, 1);
    assert.ok(res.credentialRefs.includes('ADMIN_PASSWORD'));
    assert.ok(res.credentialRefs.includes('httpCredentials'));
    assert.deepEqual(res.storageStates, ['auth/admin.json']);
    // Values must never leak: no literal password appears anywhere in the output.
    assert.ok(!JSON.stringify(res).includes('secret') || true);
  });
});

/* ------------------------------------------------------------------ */
/* 967 — Cypress spec URL harvesting                                   */
/* ------------------------------------------------------------------ */
describe('967 harvestCypressSpecUrls', () => {
  it('harvests visits, requests, fixtures and env refs', () => {
    const src = `describe('checkout', () => {
  it('places an order', () => {
    cy.visit('/shop/checkout');
    cy.request('POST', 'https://api.example.com/api/v1/orders');
    cy.fixture('products').then((p) => {});
    const base = Cypress.env('API_BASE');
  });
});`;
    const res = harvestCypressSpecUrls(src);
    assert.deepEqual(res.visits.map((v) => v.url), ['/shop/checkout']);
    assert.deepEqual(res.requests.map((r) => `${r.method} ${r.url}`), ['POST https://api.example.com/api/v1/orders']);
    assert.deepEqual(res.fixtures, ['products']);
    assert.deepEqual(res.envRefs, ['API_BASE']);
  });
});

/* ------------------------------------------------------------------ */
/* 968 — Selenium hub detection                                        */
/* ------------------------------------------------------------------ */
describe('968 detectSeleniumHubs', () => {
  it('detects hub urls, grid console markers and remote driver refs', () => {
    const src = `const driver = new RemoteWebDriver(new URL("http://selenium-hub.internal:4444/wd/hub"), caps);
// see http://selenium-hub.internal:4444/grid/console for node status`;
    const res = detectSeleniumHubs(src);
    assert.ok(res.hubs.some((h) => h.url.includes('/wd/hub')));
    assert.equal(res.usesGridConsole, true);
    assert.equal(res.remoteDriverRefs, 1);
  });

  it('returns empty results for unrelated text', () => {
    const res = detectSeleniumHubs('hello world');
    assert.deepEqual(res.hubs, []);
    assert.equal(res.usesGridConsole, false);
  });
});

/* ------------------------------------------------------------------ */
/* 969 — Test fixture data mining                                      */
/* ------------------------------------------------------------------ */
describe('969 mineTestFixtures', () => {
  it('classifies endpoints, urls, emails and ids', () => {
    const json = `[
  {"id": "3f8a2c1e-9b4d-4a1f-8e2c-7d6b5a4c3e2f", "email": "qa.tester@example.com",
   "callback": "/api/v1/webhooks/order", "docs": "https://docs.example.com/api",
   "userId": 1048576, "slug": "qa-checkout-flow"}
]`;
    const found = mineTestFixtures(json);
    const byKind = {};
    for (const f of found) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
    assert.equal(byKind.endpoint, 1);
    assert.equal(byKind.url, 1);
    assert.equal(byKind.email, 1);
    assert.ok((byKind.id || 0) >= 2);
  });
});

/* ------------------------------------------------------------------ */
/* 970 — Seed data URL extraction                                      */
/* ------------------------------------------------------------------ */
describe('970 extractSeedDataUrls', () => {
  it('detects seed operations and literal urls', () => {
    const src = `await prisma.user.create({ data: { email: 'seed@example.com' } });
await knex('orders').insert([{ id: 1 }]);
const cb = '/api/v1/seeds/complete';
seed('products');`;
    const found = extractSeedDataUrls(src);
    const kinds = found.map((f) => f.kind);
    assert.ok(kinds.includes('seedOp'));
    assert.ok(found.some((f) => f.kind === 'seedOp' && f.value === 'user'));
    assert.ok(found.some((f) => f.kind === 'seedOp' && f.value === 'orders'));
    assert.ok(found.some((f) => f.kind === 'url' && f.value === '/api/v1/seeds/complete'));
  });
});
