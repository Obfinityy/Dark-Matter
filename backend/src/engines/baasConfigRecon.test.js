import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFirebaseConfigRefs,
  extractAmplifyConfigRefs,
  extractAppwriteConfigRefs,
  extractPocketBaseConfigRefs,
  extractDirectusConfigRefs,
  harvestBaasConfigs,
} from './baasConfigRecon.js';

// --- 00981 Firebase ----------------------------------------------------------

test('981: extractFirebaseConfigRefs harvests firebaseConfig object fields', () => {
  const js = `
const firebaseConfig = {
  apiKey: "AIzaSyDx8fK2mQpLxVnT3wY4zU5aB6cD7eF8g",
  authDomain: "my-shop-12345.firebaseapp.com",
  projectId: "my-shop-12345",
  storageBucket: "my-shop-12345.appspot.com",
  messagingSenderId: "987654321012",
  appId: "1:987654321012:web:abcdef1234567890"
};
initializeApp(firebaseConfig);`;
  const out = extractFirebaseConfigRefs(js);
  const kinds = Object.fromEntries(out.map(f => [f.kind, f.value]));
  assert.equal(kinds.projectId, 'my-shop-12345');
  assert.equal(kinds.authDomain, 'my-shop-12345.firebaseapp.com');
  assert.equal(kinds.storageBucket, 'my-shop-12345.appspot.com');
  assert.equal(kinds.messagingSenderId, '987654321012');
  assert.ok(out.some(f => f.kind === 'apiKeyReference'));
  assert.ok(out.some(f => f.kind === 'sdkUsage'));
  assert.ok(out.every(f => f.idea === '00981'));
});

test('981: extractFirebaseConfigRefs finds hosting init and database URLs', () => {
  const js = `
import { initializeApp } from 'firebase/app';
fetch('/__/firebase/init.json');
const dbUrl = "https://my-app-1a2b3.firebaseio.com/data";`;
  const out = extractFirebaseConfigRefs(js);
  assert.ok(out.some(f => f.kind === 'hostingConfigRef'));
  assert.ok(out.some(f => f.kind === 'databaseUrl' && f.value.includes('firebaseio.com')));
});

// --- 00982 Amplify -----------------------------------------------------------

test('982: extractAmplifyConfigRefs mines aws-exports style config', () => {
  const js = `
const awsmobile = {
  aws_project_region: "us-east-1",
  aws_appsync_graphqlEndpoint: "https://abcd1234.appsync-api.us-east-1.amazonaws.com/graphql",
  aws_user_files_s3_bucket: "myapp-uploads-1a2b3c",
  aws_user_pools_id: "us-east-1_AbC123dEf",
  aws_user_pools_web_client_id: "4abc5def6ghi7jkl8mnop"
};
Amplify.configure(awsmobile);`;
  const out = extractAmplifyConfigRefs(js);
  const kinds = Object.fromEntries(out.map(f => [f.kind, f.value]));
  assert.equal(kinds.region, 'us-east-1');
  assert.ok(kinds.appsyncEndpoint.endsWith('/graphql'));
  assert.equal(kinds.s3Bucket, 'myapp-uploads-1a2b3c');
  assert.equal(kinds.cognitoUserPoolId, 'us-east-1_AbC123dEf');
  assert.ok(out.some(f => f.kind === 'sdkUsage'));
  assert.ok(out.every(f => f.idea === '00982'));
});

// --- 00983 Appwrite ----------------------------------------------------------

test('983: extractAppwriteConfigRefs extracts endpoint and project', () => {
  const js = `
import { Client, Databases } from 'appwrite';
const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('66f1a2b3c4d5e6f7');
const databases = new Databases(client);
databases.listDocuments('shop-db', 'products');
const ep = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;`;
  const out = extractAppwriteConfigRefs(js);
  assert.ok(out.some(f => f.kind === 'endpoint' && f.value === 'https://cloud.appwrite.io/v1'));
  assert.ok(out.some(f => f.kind === 'projectId' && f.value === '66f1a2b3c4d5e6f7'));
  assert.ok(out.some(f => f.kind === 'collectionCall'));
  assert.ok(out.some(f => f.kind === 'envReference' && f.value === 'NEXT_PUBLIC_APPWRITE_ENDPOINT'));
  assert.ok(out.some(f => f.kind === 'sdkUsage'));
});

// --- 00984 PocketBase --------------------------------------------------------

test('984: extractPocketBaseConfigRefs discovers instance and collections', () => {
  const js = `
import PocketBase from 'pocketbase';
const pb = new PocketBase('https://pb.example-corp.com');
const items = await pb.collection('articles').getFullList();
await pb.collection('users').authWithPassword('a@b.c', 'secret');`;
  const out = extractPocketBaseConfigRefs(js);
  assert.ok(out.some(f => f.kind === 'instanceUrl' && f.value === 'https://pb.example-corp.com'));
  assert.ok(out.some(f => f.kind === 'collectionAccess' && f.value.includes('articles')));
  assert.ok(out.some(f => f.kind === 'sdkUsage'));
  assert.ok(out.every(f => f.idea === '00984'));
});

// --- 00985 Directus ----------------------------------------------------------

test('985: extractDirectusConfigRefs maps instance and item reads', () => {
  const js = `
import { createDirectus, rest, readItems } from '@directus/sdk';
const directus = createDirectus('https://cms.example-corp.com').with(rest());
const posts = await directus.request(readItems('blog_posts'));
fetch('https://cms.example-corp.com/items/products?limit=10');`;
  const out = extractDirectusConfigRefs(js);
  assert.ok(out.some(f => f.kind === 'instanceUrl' && f.value === 'https://cms.example-corp.com'));
  assert.ok(out.some(f => f.kind === 'collectionRead' && f.value === 'blog_posts'));
  assert.ok(out.some(f => f.kind === 'collectionRead' && f.value === 'products'));
  assert.ok(out.some(f => f.kind === 'transport' && f.value === 'rest'));
  assert.ok(out.some(f => f.kind === 'sdkUsage'));
});

// --- aggregate ---------------------------------------------------------------

test('aggregate: harvestBaasConfigs returns per-provider buckets and total', () => {
  const js = `
const pb = new PocketBase('https://pb.demo.io');
const client = new Client().setEndpoint('https://aw.demo.io/v1').setProject('abcdef123456');
const firebaseConfig = { projectId: 'demo-fb-1' };`;
  const out = harvestBaasConfigs(js);
  assert.ok(out.pocketbase.length > 0);
  assert.ok(out.appwrite.length > 0);
  assert.ok(out.firebase.length > 0);
  const counted = out.firebase.length + out.amplify.length + out.appwrite.length + out.pocketbase.length + out.directus.length;
  assert.equal(out.total, counted);
});

test('aggregate: harvestBaasConfigs dedupes repeated references', () => {
  const js = `
const pb1 = new PocketBase('https://pb.demo.io');
const pb2 = new PocketBase('https://pb.demo.io');`;
  const out = harvestBaasConfigs(js);
  const urls = out.pocketbase.filter(f => f.kind === 'instanceUrl');
  assert.equal(urls.length, 1);
});

test('aggregate: empty input yields empty buckets', () => {
  const out = harvestBaasConfigs('');
  assert.equal(out.total, 0);
});
