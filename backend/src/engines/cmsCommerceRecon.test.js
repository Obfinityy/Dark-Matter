import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapDatoCmsApiHosts,
  extractPrismicRepoNames,
  mapGhostContentApiEndpoints,
  discoverWordPressRestEndpoints,
  mapDrupalJsonApiRoutes,
  mapHeadlessCommerceEndpoints,
  analyseCmsCommerceSurface,
} from './cmsCommerceRecon.js';

test('991: mapDatoCmsApiHosts finds DatoCMS hosts and masks tokens', () => {
  const js = `
const client = new SiteClient('secret-token-abcdef123456');
fetch('https://graph.datocms.com/').then(r => r.json());
client.items.list({});`;
  const out = mapDatoCmsApiHosts(js);
  assert.equal(out.hosts.length, 1);
  assert.equal(out.hosts[0].host, 'graph.datocms.com');
  assert.ok(out.hosts[0].line >= 1);
  assert.equal(out.clients.length, 1);
  assert.equal(out.clients[0].kind, 'SiteClient');
  assert.ok(!out.clients[0].token.includes('secret-token'), 'token must be masked');
  assert.ok(out.clients[0].token.startsWith('present('));
  assert.ok(out.callSites.some(c => c.method === 'client.items.list'));
});

test('991: mapDatoCmsApiHosts reports nothing on clean source', () => {
  const out = mapDatoCmsApiHosts('const x = 1; fetch("/api/data");');
  assert.deepEqual(out.hosts, []);
  assert.deepEqual(out.clients, []);
});

test('992: extractPrismicRepoNames finds repo names from endpoints', () => {
  const js = `
import * as prismic from '@prismicio/client';
const client = prismic.createClient('my-shop', { fetch });
fetch('https://other-site.prismic.io/api/v2');`;
  const out = extractPrismicRepoNames(js);
  const names = out.repositories.map(r => r.name);
  assert.ok(names.includes('my-shop'));
  assert.ok(names.includes('other-site'));
  const cdn = out.repositories.find(r => r.name === 'other-site');
  assert.ok(cdn.endpoint.includes('other-site.prismic.io/api/v2'));
});

test('992: extractPrismicRepoNames dedupes repeated mentions', () => {
  const js = "fetch('https://abc.cdn.prismic.io/api/v2'); fetch('https://abc.cdn.prismic.io/api/v2');";
  const out = extractPrismicRepoNames(js);
  assert.equal(out.repositories.length, 1);
});

test('993: mapGhostContentApiEndpoints maps content/admin routes and masks keys', () => {
  const js = `
const api = new GhostContentAPI({ url: 'https://blog.example.com', key: 'super-secret-key-0123456789abcdef', version: 'v5.0' });
fetch('/ghost/api/content/posts/?key=x&limit=5');
fetch('/ghost/api/admin/site/');`;
  const out = mapGhostContentApiEndpoints(js);
  const paths = out.endpoints.map(e => e.path);
  assert.ok(paths.includes('/ghost/api/content/v5.0') || paths.some(p => p.startsWith('/ghost/api/content')));
  assert.ok(paths.some(p => p.startsWith('/ghost/api/admin')));
  assert.equal(out.clients.length, 1);
  assert.equal(out.clients[0].version, 'v5.0');
  assert.ok(!out.clients[0].key.includes('super-secret'), 'API key must be masked');
});

test('994: discoverWordPressRestEndpoints groups routes by namespace', () => {
  const js = `
fetch('/wp-json/wp/v2/posts');
fetch('https://example.com/wp-json/wp/v2/pages');
fetch('/wp-json/contact-form-7/v1/contact-forms');
var wpApiSettings = { root: 'https://example.com/wp-json/', nonce: 'abc' };`;
  const out = discoverWordPressRestEndpoints(js);
  assert.ok(out.bases.some(b => b.includes('wp-json')));
  assert.ok(out.namespaces['wp/v2'].includes('posts'));
  assert.ok(out.namespaces['wp/v2'].includes('pages'));
  assert.ok(out.namespaces['contact-form-7/v1'].includes('contact-forms'));
  assert.ok(out.bases.includes('https://example.com/wp-json/'));
});

test('994: discoverWordPressRestEndpoints returns empty maps for non-WP source', () => {
  const out = discoverWordPressRestEndpoints('fetch("/api/v1/users");');
  assert.deepEqual(out.bases, []);
  assert.deepEqual(out.namespaces, {});
});

test('995: mapDrupalJsonApiRoutes maps resource routes', () => {
  const js = `
fetch('/jsonapi/node/article?include=field_image');
fetch('/jsonapi/node/page');
fetch('/jsonapi/user/user');`;
  const out = mapDrupalJsonApiRoutes(js);
  const types = out.resources.map(r => r.resourceType);
  assert.ok(types.includes('node/article'));
  assert.ok(types.includes('node/page'));
  assert.ok(types.includes('user/user'));
});

test('996: mapHeadlessCommerceEndpoints finds Shopify store and endpoints', () => {
  const js = `
fetch('https://acme-shop.myshopify.com/api/2024-01/graphql.json', { method: 'POST' });
fetch('/cart/add');
fetch('/products.json');
const buy = ShopifyBuy.buildClient({ domain: 'acme-shop.myshopify.com', storefrontAccessToken: 'shpat_secret1234567890' });`;
  const out = mapHeadlessCommerceEndpoints(js);
  assert.equal(out.shopify.stores.length, 1);
  assert.equal(out.shopify.stores[0].store, 'acme-shop');
  const eps = out.shopify.endpoints.map(e => e.endpoint);
  assert.ok(eps.includes('/cart/add'));
  assert.ok(eps.some(e => e.includes('graphql')));
  assert.equal(out.shopify.buyClients.length, 1);
  assert.ok(!out.shopify.buyClients[0].storefrontToken.includes('shpat'), 'storefront token must be masked');
});

test('996: mapHeadlessCommerceEndpoints finds BigCommerce endpoints', () => {
  const js = `
fetch('/graphql', { method: 'POST', body: JSON.stringify({ query: '{ site { products { edges { node { name } } } } }' }) });
fetch('/api/storefront/cart', { method: 'POST' });`;
  const out = mapHeadlessCommerceEndpoints(js);
  const eps = out.bigcommerce.endpoints.map(e => e.endpoint);
  assert.ok(eps.includes('/graphql'));
  assert.ok(eps.some(e => e.startsWith('/api/storefront')));
});

test('analyseCmsCommerceSurface combines all six mappers', () => {
  const js = `fetch('https://graph.datocms.com/'); fetch('/wp-json/wp/v2/posts'); fetch('/jsonapi/node/article');`;
  const out = analyseCmsCommerceSurface(js);
  assert.ok(out.datoCms.hosts.length >= 1);
  assert.ok(out.wordpress.namespaces['wp/v2'].includes('posts'));
  assert.ok(out.drupal.resources.some(r => r.resourceType === 'node/article'));
});
