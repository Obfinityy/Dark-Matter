import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inferApiShapesFromMigrations,
  mineGraphqlCodegenArtifacts,
  mineHasuraMetadata,
  extractSupabaseConfig,
} from './dataLayerArtifactMiner.js';

test('971: inferApiShapesFromMigrations parses CREATE TABLE statements', () => {
  const sql = `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  bio TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  author_id INTEGER REFERENCES users(id)
);
`;
  const tables = inferApiShapesFromMigrations(sql);
  assert.equal(tables.length, 2);
  const users = tables[0];
  assert.equal(users.table, 'users');
  const id = users.columns.find((c) => c.name === 'id');
  assert.equal(id.primaryKey, true);
  const email = users.columns.find((c) => c.name === 'email');
  assert.equal(email.type, 'varchar(255)');
  assert.equal(email.nullable, false);
  assert.equal(email.unique, true);
  const bio = users.columns.find((c) => c.name === 'bio');
  assert.equal(bio.nullable, true);
  assert.equal(users.endpoints.length, 5);
  assert.ok(users.endpoints.some((e) => e.method === 'GET' && e.path === '/users/:id'));
  assert.equal(tables[1].table, 'posts');
});

test('971: inferApiShapesFromMigrations handles quoted identifiers and defaults', () => {
  const sql = 'CREATE TABLE "order_items" ("id" SERIAL PRIMARY KEY, "qty" INTEGER DEFAULT 1);';
  const tables = inferApiShapesFromMigrations(sql);
  assert.equal(tables.length, 1);
  assert.equal(tables[0].table, 'order_items');
  const qty = tables[0].columns.find((c) => c.name === 'qty');
  assert.equal(qty.defaultValue, '1');
});

test('972: mineGraphqlCodegenArtifacts extracts operations and fragments', () => {
  const code = `
export const GetUserDocument = gql\`
  query GetUser($id: ID!) {
    user(id: $id) { id name email ...UserBits }
  }
\`;
export type GetUserQueryVariables = Exact<{
  id: Scalars['ID'];
}>;
fragment UserBits on User {
  id
  name
}
export const CreatePostDocument = gql\`
  mutation CreatePost($title: String!) { createPost(title: $title) { id } }
\`;
`;
  const { operations, fragments } = mineGraphqlCodegenArtifacts(code);
  assert.ok(operations.some((o) => o.name === 'GetUser' && o.kind === 'query'));
  assert.ok(operations.some((o) => o.name === 'CreatePost' && o.kind === 'mutation'));
  const getUser = operations.find((o) => o.name === 'GetUser');
  assert.deepEqual(getUser.variables, [{ name: 'id', type: 'ID!' }]);
  assert.deepEqual(getUser.fragments, ['UserBits']);
  assert.ok(fragments.some((f) => f.name === 'UserBits' && f.onType === 'User'));
});

test('972: mineGraphqlCodegenArtifacts dedupes typed-document strings', () => {
  const code = "const x = new TypedDocumentString`query Ping { ping }`;";
  const { operations } = mineGraphqlCodegenArtifacts(code);
  assert.equal(operations.length, 1);
  assert.equal(operations[0].name, 'Ping');
  assert.equal(operations[0].kind, 'query');
});

test('979: mineHasuraMetadata extracts tables, permissions and actions', () => {
  const metadata = {
    tables: [
      {
        table: { schema: 'public', name: 'users' },
        select_permissions: [{ role: 'user', permission: { columns: ['id', 'name'] } }],
        insert_permissions: [],
        object_relationships: [{ name: 'profile', using: { foreign_key_constraint_on: 'profile_id' } }],
      },
    ],
    actions: [
      {
        name: 'sendInvite',
        definition: {
          kind: 'synchronous',
          arguments: [{ name: 'email', type: 'String!' }],
          forward_client_headers: true,
        },
      },
    ],
    remote_schemas: [{ name: 'billing' }],
  };
  const out = mineHasuraMetadata(JSON.stringify(metadata));
  assert.equal(out.tables.length, 1);
  assert.equal(out.tables[0].name, 'users');
  assert.deepEqual(out.tables[0].permissions, ['select']);
  assert.equal(out.tables[0].relationships[0].name, 'profile');
  assert.equal(out.actions.length, 1);
  assert.equal(out.actions[0].name, 'sendInvite');
  assert.deepEqual(out.actions[0].arguments, [{ name: 'email', type: 'String!' }]);
  assert.equal(out.actions[0].forwardClientHeaders, true);
  assert.deepEqual(out.remoteSchemas, ['billing']);
});

test('979: mineHasuraMetadata handles invalid JSON gracefully', () => {
  assert.deepEqual(mineHasuraMetadata('not json'), { tables: [], actions: [], remoteSchemas: [] });
  assert.deepEqual(mineHasuraMetadata(null), { tables: [], actions: [], remoteSchemas: [] });
});

test('980: extractSupabaseConfig finds project refs in client code', () => {
  const code = `
import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://xyzcompany.supabase.co', 'eyJhbGciOi...');
const other = 'https://backup-proj.supabase.co/rest/v1/users';
`;
  const refs = extractSupabaseConfig(code);
  const byRef = Object.fromEntries(refs.map((r) => [r.projectRef, r.source]));
  assert.equal(byRef['xyzcompany'], 'createClient');
  assert.equal(byRef['backup-proj'], 'url-literal');
});

test('980: extractSupabaseConfig detects env-var references', () => {
  const code = 'const url = process.env.NEXT_PUBLIC_SUPABASE_URL;';
  const refs = extractSupabaseConfig(code);
  assert.ok(refs.some((r) => r.projectRef === 'env-configured' && r.source === 'env-reference'));
});

test('980: extractSupabaseConfig returns empty for unrelated code', () => {
  assert.deepEqual(extractSupabaseConfig('const x = 1;'), []);
});
