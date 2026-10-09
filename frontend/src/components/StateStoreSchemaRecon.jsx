/**
 * StateStoreSchemaRecon.jsx — Wave 921, ideas 951–960 (state-store & schema surface recon).
 *
 * Export-only demo component (not wired into any page): paste HTML/JS collected
 * from an authorized target and inspect the client-side API surface encoded in
 * state-management wiring (Redux, SWR, React Query, Apollo, Urql, Relay, tRPC)
 * and validation schemas (Zod, Yup, Joi).
 *
 * Imports the engine functions directly from the backend engine module.
 */

import { useState, useMemo } from 'react';
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
} from '../../../backend/src/engines/stateStoreSchemaRecon.js';
import './StateStoreSchemaRecon.css';

const SAMPLE = `const logger = (store) => (next) => (action) => {
  return next(action);
};
const apiMiddleware = (store) => (next) => (action) => {
  if (action.type === 'FETCH_USER') {
    return fetch('/api/users/' + action.id).then(r => r.json());
  }
  return next(action);
};
const store = createStore(reducer, applyMiddleware(thunk, apiMiddleware));
const { data } = useSWR('/api/users/me');
const q = useQuery(['orders', orgId], () => fetch('/api/orders'));
const cache = new InMemoryCache({ typePolicies: { User: { keyFields: ['id'] } } });
const GET_USER = gql\`
  query GetUser($id: ID!) { user(id: $id) { id name email } }
\`;
const client = createClient({ url: '/graphql', exchanges: [dedupExchange, cacheExchange, fetchExchange] });
const q2 = graphql\`
  query UserListQuery { users { id name } }
\`;
const userRouter = router({
  getById: publicProcedure.input(UserIdSchema).query(({ input }) => getUser(input)),
  create: protectedProcedure.input(CreateUserSchema).mutation(({ input }) => createUser(input)),
});
const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nickname: z.string().optional(),
});
const loginSchema = yup.object().shape({
  email: yup.string().email().required(),
  password: yup.string().min(8).required(),
});
const orderSchema = Joi.object({
  productId: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
});`;

function Section({ title, count, children }) {
  return (
    <section className="w921d-section">
      <h3 className="w921d-section-title">
        {title} <span className="w921d-count">{count}</span>
      </h3>
      <div className="w921d-section-body">{children}</div>
    </section>
  );
}

function Empty() {
  return <p className="w921d-empty">No findings in this category.</p>;
}

export default function StateStoreSchemaRecon() {
  const [source, setSource] = useState(SAMPLE);
  const results = useMemo(() => {
    if (!source.trim()) return null;
    return analyzeStateStoreSchemaSurface(source);
  }, [source]);

  return (
    <div className="w921d-root">
      <h2 className="w921d-title">State-Store &amp; Schema Surface Recon</h2>
      <p className="w921d-sub">
        Ideas 951–960 · paste client HTML/JS from an authorized target; the
        engine extracts API endpoints, GraphQL shapes and validation-schema
        fields encoded in state-management wiring.
      </p>
      <textarea
        className="w921d-input"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        spellCheck={false}
        rows={14}
        aria-label="Paste HTML or JavaScript source"
      />
      {!results ? (
        <Empty />
      ) : (
        <div className="w921d-grid">
          <Section title="Endpoint hints" count={results.endpointHints.length}>
            {results.endpointHints.length === 0 ? (
              <Empty />
            ) : (
              <ul className="w921d-list">
                {results.endpointHints.map((h) => (
                  <li key={h} className="w921d-mono">{h}</li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Redux middleware (951)" count={results.redux.middlewares.length}>
            {results.redux.middlewares.length === 0 && results.redux.apiCalls.length === 0 ? (
              <Empty />
            ) : (
              <>
                <p className="w921d-line">
                  Chain: {results.redux.middlewares.join(' → ') || '—'} (
                  {results.redux.chainDefinitions} store→next→action definitions)
                </p>
                <ul className="w921d-list">
                  {results.redux.apiCalls.map((c, i) => (
                    <li key={i} className="w921d-mono">
                      {c.method} {c.url} <span className="w921d-dim">via {c.via}{c.middleware ? ` in ${c.middleware}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          <Section title="SWR keys (952)" count={results.swr.length}>
            {results.swr.length === 0 ? (
              <Empty />
            ) : (
              <ul className="w921d-list">
                {results.swr.map((k, i) => (
                  <li key={i} className="w921d-mono">
                    {k.key} <span className="w921d-dim">[{k.kind}{k.isUrl ? ', url-like' : ''}]</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="React Query keys (953)" count={results.reactQuery.length}>
            {results.reactQuery.length === 0 ? (
              <Empty />
            ) : (
              <ul className="w921d-list">
                {results.reactQuery.map((q, i) => (
                  <li key={i} className="w921d-mono">
                    {q.hook}[{q.key.map((k) => `'${k}'`).join(', ')}]
                    {q.endpoints.length > 0 && (
                      <span className="w921d-dim"> → {q.endpoints.join(', ')}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Apollo cache + operations (954)" count={results.apollo.types.length + results.apollo.operations.length}>
            {results.apollo.types.length === 0 && results.apollo.operations.length === 0 ? (
              <Empty />
            ) : (
              <>
                {results.apollo.types.map((t) => (
                  <p key={t.name} className="w921d-line w921d-mono">
                    {t.name} <span className="w921d-dim">keyFields: {t.keyFields.join(', ') || '—'}</span>
                  </p>
                ))}
                {results.apollo.operations.map((o, i) => (
                  <p key={i} className="w921d-line w921d-mono">
                    {o.kind} {o.name || '(anonymous)'}
                    <span className="w921d-dim"> fields: {o.fields.join(', ') || '—'}</span>
                  </p>
                ))}
              </>
            )}
          </Section>

          <Section title="Urql exchanges (955)" count={results.urql.length}>
            {results.urql.length === 0 ? (
              <Empty />
            ) : (
              results.urql.map((u, i) => (
                <div key={i}>
                  <p className="w921d-line w921d-mono">{u.url || '(no url)'}</p>
                  <ul className="w921d-list">
                    {u.pipeline.map((p, j) => (
                      <li key={j}>
                        <span className="w921d-mono">{j + 1}. {p.exchange}</span>
                        <span className="w921d-dim"> — {p.role}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </Section>

          <Section title="Relay artifacts (956)" count={results.relay.documents.length + results.relay.artifacts.length}>
            {results.relay.documents.length === 0 && results.relay.artifacts.length === 0 ? (
              <Empty />
            ) : (
              <>
                {results.relay.documents.map((d, i) => (
                  <p key={i} className="w921d-line w921d-mono">
                    {d.kind} {d.name || '(anonymous)'}
                    <span className="w921d-dim"> fields: {d.fields.join(', ') || '—'}</span>
                  </p>
                ))}
                {results.relay.artifacts.map((a) => (
                  <p key={a} className="w921d-line w921d-mono w921d-dim">{a}</p>
                ))}
              </>
            )}
          </Section>

          <Section title="tRPC routers (957)" count={results.trpc.reduce((n, r) => n + r.procedures.length, 0)}>
            {results.trpc.length === 0 ? (
              <Empty />
            ) : (
              results.trpc.map((r) => (
                <div key={r.router}>
                  <p className="w921d-line w921d-mono">{r.router}</p>
                  <ul className="w921d-list">
                    {r.procedures.map((p) => (
                      <li key={p.name} className="w921d-mono">
                        {p.kind} {p.name}
                        <span className="w921d-dim"> · {p.visibility}{p.inputSchema ? ` · input: ${p.inputSchema}` : ''} → {p.endpointHint}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </Section>

          <Section title="Zod schemas (958)" count={results.zod.length}>
            {results.zod.length === 0 ? (
              <Empty />
            ) : (
              results.zod.map((s) => (
                <div key={s.schema}>
                  <p className="w921d-line w921d-mono">{s.schema}</p>
                  <ul className="w921d-list">
                    {s.fields.map((f) => (
                      <li key={f.field} className="w921d-mono">
                        {f.field}: {f.type}
                        <span className="w921d-dim"> {f.required ? 'required' : 'optional'}{f.flags.length > 0 ? ` · ${f.flags.join(', ')}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </Section>

          <Section title="Yup schemas (959)" count={results.yup.length}>
            {results.yup.length === 0 ? (
              <Empty />
            ) : (
              results.yup.map((s) => (
                <div key={s.schema}>
                  <p className="w921d-line w921d-mono">{s.schema}</p>
                  <ul className="w921d-list">
                    {s.fields.map((f) => (
                      <li key={f.field} className="w921d-mono">
                        {f.field}: {f.type}
                        <span className="w921d-dim"> {f.required ? 'required' : 'optional'}{f.flags.length > 0 ? ` · ${f.flags.join(', ')}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </Section>

          <Section title="Joi schemas (960)" count={results.joi.length}>
            {results.joi.length === 0 ? (
              <Empty />
            ) : (
              results.joi.map((s) => (
                <div key={s.schema}>
                  <p className="w921d-line w921d-mono">{s.schema}</p>
                  <ul className="w921d-list">
                    {s.fields.map((f) => (
                      <li key={f.field} className="w921d-mono">
                        {f.field}: {f.type}
                        <span className="w921d-dim"> {f.required ? 'required' : 'optional'}{f.flags.length > 0 ? ` · ${f.flags.join(', ')}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

export {
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
};
