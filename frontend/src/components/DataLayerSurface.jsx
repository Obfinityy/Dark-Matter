import { useState } from 'react';
import './DataLayerSurface.css';
import {
  extractPrismaModels,
  mapDrizzleTables,
  mineTypeOrmEntities,
  extractSequelizeModels,
  harvestMongooseSchemas,
  analyzeKnexMigrations,
  inferApiShapesFromModels,
} from '../../backend/src/engines/ormSchemaRecon.js';
import {
  inferApiShapesFromMigrations,
  mineGraphqlCodegenArtifacts,
  mineHasuraMetadata,
  extractSupabaseConfig,
} from '../../backend/src/engines/dataLayerArtifactMiner.js';

const SAMPLE = `model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  name  String?
  @@map("users")
}

export const users = pgTable('customers', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
});

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
});
const User = mongoose.model('Account', userSchema);

exports.up = (knex) => knex.schema.createTable('orders', (t) => {
  t.increments('id');
  t.string('status', 32).notNullable().defaultTo('pending');
  t.decimal('total', 10, 2);
});

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TIMESTAMP NOT NULL
);

export const GetOrdersDocument = gql\`
  query GetOrders($status: String) {
    orders(status: $status) { id total ...OrderBits }
  }
\`;
fragment OrderBits on Order { id total }

{ "tables": [{ "table": { "schema": "public", "name": "orders" },
  "select_permissions": [{ "role": "user" }] }],
  "actions": [{ "name": "placeOrder",
    "definition": { "kind": "synchronous",
      "arguments": [{ "name": "total", "type": "Float!" }] } }] }

const supabase = createClient('https://demo-project.supabase.co', process.env.SB_KEY);`;

const ANALYSERS = [
  ['973 · Prisma models', extractPrismaModels],
  ['974 · Drizzle tables', mapDrizzleTables],
  ['975 · TypeORM entities', mineTypeOrmEntities],
  ['976 · Sequelize models', extractSequelizeModels],
  ['977 · Mongoose schemas', harvestMongooseSchemas],
  ['978 · Knex migrations', analyzeKnexMigrations],
  ['971 · Migration SQL shapes', inferApiShapesFromMigrations],
  ['972 · GraphQL codegen ops', mineGraphqlCodegenArtifacts],
  ['979 · Hasura metadata', mineHasuraMetadata],
  ['980 · Supabase config refs', extractSupabaseConfig],
];

function FieldRow({ field }) {
  return (
    <li className="w971a-field">
      <code>{field.name}</code>
      <span className="w971a-type">{field.type}</span>
      {field.primaryKey && <span className="w971a-badge">pk</span>}
      {field.unique && <span className="w971a-badge">unique</span>}
      {field.nullable && <span className="w971a-badge w971a-dim">nullable</span>}
      {field.defaultValue != null && (
        <span className="w971a-dim">= {String(field.defaultValue)}</span>
      )}
    </li>
  );
}

function ResultView({ label, value }) {
  if (value == null) return <p className="w971a-dim">No input.</p>;
  if (value.error) return <p className="w971a-err">{value.error}</p>;
  if (Array.isArray(value) && value.length === 0)
    return <p className="w971a-dim">No findings.</p>;

  if (label.startsWith('972')) {
    const { operations = [], fragments = [] } = value;
    return (
      <div>
        <p className="w971a-h">{operations.length} operations · {fragments.length} fragments</p>
        <ul className="w971a-list">
          {operations.map((o, i) => (
            <li key={i}>
              <code>{o.name}</code> <span className="w971a-type">{o.kind}</span>
              {o.variables?.length > 0 && (
                <span className="w971a-dim"> ({o.variables.map((v) => `${v.name}: ${v.type}`).join(', ')})</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (label.startsWith('979')) {
    return (
      <div>
        <p className="w971a-h">
          {value.tables.length} tracked tables · {value.actions.length} actions
          {value.remoteSchemas.length > 0 && ` · remotes: ${value.remoteSchemas.join(', ')}`}
        </p>
        <ul className="w971a-list">
          {value.tables.map((t, i) => (
            <li key={i}>
              <code>{t.schema}.{t.name}</code>
              <span className="w971a-dim"> {t.permissions.join(', ') || 'no permissions'}</span>
            </li>
          ))}
          {value.actions.map((a, i) => (
            <li key={`a${i}`}>
              <code>action:{a.name}</code> <span className="w971a-type">{a.kind}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (label.startsWith('980')) {
    return (
      <ul className="w971a-list">
        {value.map((r, i) => (
          <li key={i}>
            <code>{r.projectRef}</code> <span className="w971a-dim">{r.source}</span>
            <span className="w971a-dim"> — {r.url}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (label.startsWith('971')) {
    return (
      <div>
        {value.map((t, i) => (
          <div key={i} className="w971a-model">
            <p className="w971a-modelname">
              table <code>{t.table}</code>
              <span className="w971a-dim"> → {t.endpoints.map((e) => `${e.method} ${e.path}`).join(' · ')}</span>
            </p>
            <ul className="w971a-list">{t.columns.map((f, j) => <FieldRow key={j} field={f} />)}</ul>
          </div>
        ))}
      </div>
    );
  }
  // 973–978: model lists with fields.
  return (
    <div>
      {value.map((m, i) => (
        <div key={i} className="w971a-model">
          <p className="w971a-modelname">
            <code>{m.name}</code> <span className="w971a-dim">({m.source} → {m.table})</span>
          </p>
          <ul className="w971a-list">{(m.fields || []).map((f, j) => <FieldRow key={j} field={f} />)}</ul>
        </div>
      ))}
    </div>
  );
}

export default function DataLayerSurface() {
  const [source, setSource] = useState(SAMPLE);
  const [results, setResults] = useState(null);
  const [shapes, setShapes] = useState([]);

  const run = () => {
    const out = {};
    const allModels = [];
    for (const [label, fn] of ANALYSERS) {
      try {
        const res = fn(source);
        out[label] = res;
        if (Array.isArray(res) && res.length > 0 && res[0] && res[0].fields) {
          allModels.push(...res);
        }
      } catch (err) {
        out[label] = { error: String(err && err.message ? err.message : err) };
      }
    }
    setResults(out);
    setShapes(inferApiShapesFromModels(allModels));
  };

  return (
    <div className="w971a-root">
      <h2 className="w971a-title">Data-Layer Surface</h2>
      <p className="w971a-sub">
        Passive ORM/schema reconnaissance (ideas 971–980): parses ORM schema
        definitions, migration files, GraphQL codegen output, Hasura metadata
        and Supabase config recovered from the target&apos;s own client
        artifacts — and derives the data-layer endpoint surface. No network
        calls; static analysis only.
      </p>
      <textarea
        className="w971a-input"
        rows={14}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        spellCheck={false}
        aria-label="Schema and artifact text to analyse"
      />
      <div className="w971a-actions">
        <button type="button" className="w971a-run" onClick={run}>Analyse data-layer artifacts</button>
      </div>
      {results && (
        <div className="w971a-results">
          {ANALYSERS.map(([label]) => (
            <section key={label} className="w971a-card">
              <h3 className="w971a-cardtitle">{label}</h3>
              <ResultView label={label} value={results[label]} />
            </section>
          ))}
          {shapes.length > 0 && (
            <section className="w971a-card">
              <h3 className="w971a-cardtitle">Inferred API shapes (973–978)</h3>
              <ul className="w971a-list">
                {shapes.map((s, i) => (
                  <li key={i}>
                    <code>{s.method} {s.path}</code>
                    <span className="w971a-dim"> ← {s.model}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
