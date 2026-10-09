import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractStrapiConfigRefs,
  extractContentfulConfigRefs,
  extractSanityConfigRefs,
  extractStoryblokConfigRefs,
  extractHygraphConfigRefs,
  mapCmsConfigs,
} from './cmsConfigRecon.js';

// --- 00986 Strapi ------------------------------------------------------------

test('986: extractStrapiConfigRefs maps content-type endpoints', () => {
  const js = `
const res = await fetch(\`\${process.env.STRAPI_API_URL}/api/articles?populate=*\`);
const r2 = await fetch('https://cms.demo.io/api/products?filters[slug]=x');
const g = 'https://cms.demo.io/graphql';`;
  const out = extractStrapiConfigRefs(js);
  const types = out.filter(f => f.kind === 'contentType').map(f => f.value);
  assert.ok(types.includes('articles'), `types: ${types}`);
  assert.ok(types.includes('products'));
  assert.ok(out.some(f => f.kind === 'envReference' && f.value === 'STRAPI_API_URL'));
  assert.ok(out.some(f => f.kind === 'graphqlEndpoint'));
  assert.ok(out.every(f => f.idea === '00986'));
});

// --- 00987 Contentful --------------------------------------------------------

test('987: extractContentfulConfigRefs extracts space and hosts', () => {
  const js = `
import { createClient } from 'contentful';
const client = createClient({
  space: 'a1b2c3d4e5f6',
  accessToken: 'delivery-token',
  host: 'cdn.contentful.com'
});
fetch('https://cdn.contentful.com/spaces/a1b2c3d4e5f6/entries');
const sid = process.env.CONTENTFUL_SPACE_ID;`;
  const out = extractContentfulConfigRefs(js);
  assert.ok(out.some(f => f.kind === 'spaceId' && f.value === 'a1b2c3d4e5f6'));
  assert.ok(out.some(f => f.kind === 'deliveryHost'));
  assert.ok(out.some(f => f.kind === 'envReference' && f.value === 'CONTENTFUL_SPACE_ID'));
  assert.ok(out.some(f => f.kind === 'sdkUsage'));
  assert.ok(out.every(f => f.idea === '00987'));
});

// --- 00988 Sanity ------------------------------------------------------------

test('988: extractSanityConfigRefs mines projectId and dataset', () => {
  const js = `
import { createClient } from '@sanity/client';
const client = createClient({
  projectId: 'z9y8x7w6',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true
});
const img = 'https://cdn.sanity.io/images/z9y8x7w6/production/abc123-800x600.jpg';`;
  const out = extractSanityConfigRefs(js);
  assert.ok(out.some(f => f.kind === 'projectId' && f.value === 'z9y8x7w6'));
  assert.ok(out.some(f => f.kind === 'dataset' && f.value === 'production'));
  assert.ok(out.some(f => f.kind === 'sdkUsage'));
  assert.ok(out.every(f => f.idea === '00988'));
});

// --- 00989 Storyblok ---------------------------------------------------------

test('989: extractStoryblokConfigRefs maps CDN endpoints', () => {
  const js = `
import { storyblokInit, apiPlugin } from '@storyblok/react';
storyblokInit({ accessToken: 'wur8fcdisjFX0ABfEXEXQwtt', use: [apiPlugin] });
const stories = 'https://api.storyblok.com/v2/cdn/stories?token=x';
const asset = 'https://a.storyblok.com/f/12345/800x600/abcdef/image.png';
const home = useStoryblok('home', {});`;
  const out = extractStoryblokConfigRefs(js);
  assert.ok(out.some(f => f.kind === 'cdnEndpoint' && f.value.includes('api.storyblok.com')));
  assert.ok(out.some(f => f.kind === 'assetCdnUrl' && f.value.includes('a.storyblok.com')));
  assert.ok(out.some(f => f.kind === 'tokenReference'));
  assert.ok(out.some(f => f.kind === 'storyPath' && f.value === 'home'));
  assert.ok(out.some(f => f.kind === 'sdkUsage'));
  assert.ok(out.every(f => f.idea === '00989'));
});

// --- 00990 Hygraph -----------------------------------------------------------

test('990: extractHygraphConfigRefs extracts content endpoint', () => {
  const js = `
import { GraphQLClient } from 'graphql-request';
const endpoint = 'https://api-eu-west-2.hygraph.com/v2/clxyz1234567890abcd/master';
const client = new GraphQLClient(endpoint);
const pid = process.env.HYGRAPH_PROJECT_ID;`;
  const out = extractHygraphConfigRefs(js);
  assert.ok(out.some(f => f.kind === 'contentEndpoint' && f.value.includes('hygraph.com/v2/')));
  assert.ok(out.some(f => f.kind === 'projectId' && f.value === 'clxyz1234567890abcd'));
  assert.ok(out.some(f => f.kind === 'envReference' && f.value === 'HYGRAPH_PROJECT_ID'));
  assert.ok(out.some(f => f.kind === 'sdkUsage'));
  assert.ok(out.every(f => f.idea === '00990'));
});

// --- aggregate ---------------------------------------------------------------

test('aggregate: mapCmsConfigs returns per-provider buckets and total', () => {
  const js = `
fetch('/api/articles');
const client = createClient({ space: 'a1b2c3d4e5f6', accessToken: 't' });
const sanity = createClient({ projectId: 'z9y8x7w6', dataset: 'production' });`;
  const out = mapCmsConfigs(js);
  assert.ok(out.strapi.length > 0);
  assert.ok(out.contentful.length > 0);
  assert.ok(out.sanity.length > 0);
  const counted = out.strapi.length + out.contentful.length + out.sanity.length + out.storyblok.length + out.hygraph.length;
  assert.equal(out.total, counted);
});

test('aggregate: mapCmsConfigs dedupes repeated space IDs', () => {
  const js = `
const a = createClient({ space: 'a1b2c3d4e5f6', accessToken: 't' });
const b = 'https://cdn.contentful.com/spaces/a1b2c3d4e5f6/entries';`;
  const out = mapCmsConfigs(js);
  const spaces = out.contentful.filter(f => f.kind === 'spaceId');
  assert.equal(spaces.length, 1);
});

test('aggregate: empty input yields empty buckets', () => {
  const out = mapCmsConfigs('');
  assert.equal(out.total, 0);
});
