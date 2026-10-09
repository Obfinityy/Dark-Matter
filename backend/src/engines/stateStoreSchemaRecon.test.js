import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeReduxMiddlewareChains,
  enumerateSwrKeys,
  mapReactQueryKeys,
  extractApolloCacheShapes,
  mapUrqlExchanges,
  mineRelayArtifacts,
  extractTRpcRouterShapes,
  inferApiShapesFromZod,
  harvestYupFormFields,
  mapApisFromJoi,
  analyzeStateStoreSchemaSurface,
} from './stateStoreSchemaRecon.js';

test('00951 analyzeReduxMiddlewareChains finds middleware and API calls', () => {
  const js = `
    const loggerMiddleware = (store) => (next) => (action) => {
      console.log(action);
      return next(action);
    };
    const apiMiddleware = (store) => (next) => (action) => {
      if (action.type === 'FETCH_USER') {
        return fetch('/api/users/' + action.id).then(r => r.json());
      }
      if (action.type === 'SAVE_USER') {
        return fetch('/api/users', { method: 'POST', body: JSON.stringify(action.payload) });
      }
      return next(action);
    };
    const store = createStore(reducer, applyMiddleware(thunk, loggerMiddleware, apiMiddleware));
  `;
  const r = analyzeReduxMiddlewareChains(js);
  assert.deepEqual(r.middlewares.sort(), ['apiMiddleware', 'loggerMiddleware', 'thunk']);
  assert.equal(r.chainDefinitions, 2);
  assert.equal(r.apiCalls.length, 2);
  const urls = r.apiCalls.map((c) => c.url).sort();
  assert.deepEqual(urls, ['/api/users', '/api/users/']);
  const post = r.apiCalls.find((c) => c.url === '/api/users');
  assert.equal(post.method, 'POST');
  assert.equal(post.middleware, 'apiMiddleware');
  assert.equal(post.via, 'fetch');
});

test('00951 analyzeReduxMiddlewareChains is empty-safe', () => {
  assert.deepEqual(analyzeReduxMiddlewareChains(''), {
    middlewares: [],
    chainDefinitions: 0,
    apiCalls: [],
  });
  assert.deepEqual(analyzeReduxMiddlewareChains(null).middlewares, []);
});

test('00952 enumerateSwrKeys extracts URL-like keys', () => {
  const js = `
    const { data: user } = useSWR('/api/users/me');
    const { data: list } = useSWR(['/api/orders', token], fetcher);
    const { data: other } = useSWR(someVariable);
  `;
  const r = enumerateSwrKeys(js);
  assert.equal(r.length, 2);
  const urls = r.filter((k) => k.isUrl).map((k) => k.key);
  assert.ok(urls.includes('/api/users/me'));
  assert.ok(urls.includes('/api/orders'));
  assert.ok(r.every((k) => k.isUrl));
  assert.ok(r.find((k) => k.key === '/api/orders').kind === 'array');
});

test('00953 mapReactQueryKeys maps key tuples to endpoints', () => {
  const js = `
    const q = useQuery(['users', page], () => fetch('/api/users?page=' + page));
    const m = useMutation(['create-user'], (body) => axios.post('/api/users', body));
  `;
  const r = mapReactQueryKeys(js);
  assert.equal(r.length, 2);
  const q1 = r.find((x) => x.hook === 'useQuery');
  assert.deepEqual(q1.key, ['users']);
  const m1 = r.find((x) => x.hook === 'useMutation');
  assert.deepEqual(m1.key, ['create-user']);
});

test('00953 mapReactQueryKeys catches queryKey object form', () => {
  const js = `useQuery({ queryKey: ['projects', orgId], queryFn: () => get('/api/projects') });`;
  const r = mapReactQueryKeys(js);
  assert.equal(r.length, 1);
  assert.equal(r[0].hook, 'queryKey');
  assert.deepEqual(r[0].key, ['projects']);
});

test('00954 extractApolloCacheShapes reads typePolicies and gql docs', () => {
  const js = `
    const cache = new InMemoryCache({
      typePolicies: {
        User: { keyFields: ['id'] },
        Order: { keyFields: ['orderId', 'tenant'] },
      },
    });
    const GET_USER = gql\`
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          name
          email
        }
      }
    \`;
  `;
  const r = extractApolloCacheShapes(js);
  assert.equal(r.types.length, 2);
  assert.deepEqual(
    r.types.find((t) => t.name === 'User'),
    { name: 'User', keyFields: ['id'] }
  );
  assert.equal(r.operations.length, 1);
  assert.equal(r.operations[0].kind, 'query');
  assert.equal(r.operations[0].name, 'GetUser');
  assert.ok(r.operations[0].fields.includes('user'));
});

test('00955 mapUrqlExchanges maps client pipelines', () => {
  const js = `
    const client = createClient({
      url: 'https://api.example.com/graphql',
      exchanges: [dedupExchange, cacheExchange, authExchange, fetchExchange],
    });
  `;
  const r = mapUrqlExchanges(js);
  assert.equal(r.length, 1);
  assert.equal(r[0].url, 'https://api.example.com/graphql');
  assert.deepEqual(r[0].exchanges, [
    'dedupExchange',
    'cacheExchange',
    'authExchange',
    'fetchExchange',
  ]);
  assert.equal(r[0].pipeline[2].role, 'injects auth headers / handles auth errors');
  assert.equal(r[0].pipeline[3].role, 'terminal network fetch');
});

test('00956 mineRelayArtifacts extracts documents and artifact refs', () => {
  const js = `
    import userFragment from './__generated__/UserCard_user.graphql';
    const query = graphql\`
      query UserListQuery {
        users {
          id
          name
        }
      }
    \`;
    const frag = graphql\`
      fragment UserCard_user on User {
        id
        avatarUrl
      }
    \`;
  `;
  const r = mineRelayArtifacts(js);
  assert.equal(r.documents.length, 2);
  assert.equal(r.documents[0].kind, 'query');
  assert.equal(r.documents[0].name, 'UserListQuery');
  assert.ok(r.documents[0].fields.includes('users'));
  assert.equal(r.documents[1].kind, 'fragment on User');
  assert.equal(r.artifacts.length, 1);
  assert.ok(r.artifacts[0].includes('__generated__'));
});

test('00957 extractTRpcRouterShapes maps procedures', () => {
  const js = `
    const userRouter = router({
      getById: publicProcedure.input(UserIdSchema).query(({ input }) => getUser(input)),
      create: protectedProcedure.input(CreateUserSchema).mutation(({ input }) => createUser(input)),
      onUpdate: publicProcedure.subscription(() => stream()),
    });
  `;
  const r = extractTRpcRouterShapes(js);
  assert.equal(r.length, 1);
  assert.equal(r[0].router, 'userRouter');
  assert.equal(r[0].procedures.length, 3);
  const get = r[0].procedures.find((p) => p.name === 'getById');
  assert.equal(get.visibility, 'publicProcedure');
  assert.equal(get.kind, 'query');
  assert.equal(get.inputSchema, 'UserIdSchema');
  assert.equal(get.endpointHint, '/api/trpc/userRouter.getById');
  const create = r[0].procedures.find((p) => p.name === 'create');
  assert.equal(create.kind, 'mutation');
  assert.equal(create.inputSchema, 'CreateUserSchema');
});

test('00958 inferApiShapesFromZod parses z.object schemas', () => {
  const js = `
    const SignupSchema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      nickname: z.string().optional(),
      age: z.number().nullable(),
    });
  `;
  const r = inferApiShapesFromZod(js);
  assert.equal(r.length, 1);
  assert.equal(r[0].schema, 'SignupSchema');
  const fields = Object.fromEntries(r[0].fields.map((f) => [f.field, f]));
  assert.equal(fields.email.type, 'string');
  assert.equal(fields.email.required, true);
  assert.ok(fields.email.flags.includes('email'));
  assert.equal(fields.nickname.required, false);
  assert.equal(fields.age.required, false);
});

test('00959 harvestYupFormFields parses yup schemas', () => {
  const js = `
    const loginSchema = yup.object().shape({
      email: yup.string().email().required('Required'),
      password: yup.string().min(8).required(),
      remember: yup.boolean(),
    });
  `;
  const r = harvestYupFormFields(js);
  assert.equal(r.length, 1);
  assert.equal(r[0].schema, 'loginSchema');
  const fields = Object.fromEntries(r[0].fields.map((f) => [f.field, f]));
  assert.equal(fields.email.type, 'string');
  assert.equal(fields.email.required, true);
  assert.equal(fields.password.required, true);
  assert.equal(fields.remember.required, false);
});

test('00960 mapApisFromJoi parses Joi schemas', () => {
  const js = `
    const orderSchema = Joi.object({
      productId: Joi.string().uuid().required(),
      quantity: Joi.number().integer().min(1).required(),
      note: Joi.string().max(500),
    });
  `;
  const r = mapApisFromJoi(js);
  assert.equal(r.length, 1);
  assert.equal(r[0].schema, 'orderSchema');
  const fields = Object.fromEntries(r[0].fields.map((f) => [f.field, f]));
  assert.equal(fields.productId.type, 'string');
  assert.equal(fields.productId.required, true);
  assert.equal(fields.quantity.type, 'number');
  assert.equal(fields.note.required, false);
});

test('analyzeStateStoreSchemaSurface aggregates endpoint hints', () => {
  const js = `
    const { data } = useSWR('/api/profile');
    const SignupSchema = z.object({ email: z.string().email() });
    const client = createClient({ url: '/graphql', exchanges: [dedupExchange, fetchExchange] });
    const appRouter = router({ list: publicProcedure.query(() => []) });
  `;
  const r = analyzeStateStoreSchemaSurface(js);
  assert.ok(r.endpointHints.includes('GET /api/profile'));
  assert.ok(r.endpointHints.includes('GRAPHQL /graphql'));
  assert.ok(r.endpointHints.includes('QUERY /api/trpc/appRouter.list'));
  assert.equal(r.zod.length, 1);
  assert.equal(r.swr.length, 1);
});

test('all extractors handle non-string input deterministically', () => {
  for (const fn of [
    enumerateSwrKeys,
    mapReactQueryKeys,
    mapUrqlExchanges,
    extractTRpcRouterShapes,
    inferApiShapesFromZod,
    harvestYupFormFields,
    mapApisFromJoi,
  ]) {
    assert.deepEqual(fn(undefined), []);
  }
  assert.deepEqual(mineRelayArtifacts('').documents, []);
  assert.deepEqual(extractApolloCacheShapes('').operations, []);
  assert.deepEqual(analyzeStateStoreSchemaSurface('').endpointHints, []);
  // Determinism: same input → same output
  const js = `const s = z.object({ a: z.string() });`;
  assert.deepEqual(inferApiShapesFromZod(js), inferApiShapesFromZod(js));
});
