/**
 * dataLayerArtifactMiner.js — data-layer artifact mining engine.
 *
 * Passively mines data-layer artifacts the hunt agent has already recovered
 * from the target's own publicly served client bundle, docs, or config files.
 * Pure static analysis of text — no network calls, no execution of target
 * code, fully deterministic.
 *
 * Covers idea-bank ideas:
 *  00971 — migration-file endpoint inference (infer API shapes from DB migrations)
 *  00972 — GraphQL codegen artifact mining (mine codegen outputs for operations)
 *  00979 — Hasura metadata mining (tracked tables, actions, remote schemas)
 *  00980 — Supabase config extraction (project refs from client code)
 *
 * @module dataLayerArtifactMiner
 */

/**
 * Parse a comma-separated column-definition list from a CREATE TABLE body,
 * respecting nested parentheses (e.g. varchar(255), numeric(10,2)).
 *
 * @param {string} body - Text between the CREATE TABLE parentheses.
 * @returns {Array<string>} Top-level column/constraint definitions.
 */
function splitColumnDefs(body) {
  const defs = [];
  let depth = 0;
  let current = '';
  let inStr = null;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (inStr) {
      current += ch;
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"') { inStr = ch; current += ch; continue; }
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const t = current.trim();
      if (t) defs.push(t);
      current = '';
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last) defs.push(last);
  return defs;
}

/**
 * Idea 00971 — infer API shapes from database migration files.
 *
 * Parses `CREATE TABLE` statements (Postgres/MySQL/SQLite dialects) found in
 * SQL migration files: table name, columns with types, primary keys, NOT NULL
 * and DEFAULT clauses. Each table yields inferred REST endpoint shapes so a
 * migration leak becomes a data-layer endpoint list.
 *
 * @param {string} sql - Raw SQL migration text.
 * @returns {Array<{table:string, columns:Array<object>, endpoints:Array<object>}>}
 */
export function inferApiShapesFromMigrations(sql = '') {
  const src = String(sql);
  const tables = [];
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w.]*))\s*\(([\s\S]*?)\)\s*;/gi;
  let m;
  while ((m = createRe.exec(src)) !== null) {
    const rawName = m[1] || m[2] || m[3] || m[4];
    const table = rawName.split('.').pop();
    const body = m[5];
    const columns = [];
    const pkCols = new Set();
    for (const def of splitColumnDefs(body)) {
      const pkMatch = def.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        pkMatch[1].split(',').forEach((c) => pkCols.add(c.trim().replace(/["`[\]]/g, '').toLowerCase()));
        continue;
      }
      if (/^(FOREIGN\s+KEY|CONSTRAINT|UNIQUE|CHECK|INDEX)\b/i.test(def)) continue;
      const colM = def.match(/^["`[]?([A-Za-z_][\w$]*)["`\]]?\s+([A-Za-z_][\w]*(?:\s*\([^)]*\))?)/);
      if (!colM) continue;
      const [, colName, colType] = colM;
      columns.push({
        name: colName,
        type: colType.trim().toLowerCase(),
        nullable: !/NOT\s+NULL/i.test(def),
        primaryKey: /PRIMARY\s+KEY/i.test(def) || pkCols.has(colName.toLowerCase()),
        unique: /UNIQUE/i.test(def),
        defaultValue: (def.match(/DEFAULT\s+([^,]+?)(?:\s+(?:NOT\s+NULL|NULL|UNIQUE|PRIMARY|REFERENCES|CHECK)\b|$)/i) || [])[1]?.trim() ?? null,
      });
    }
    const base = `/${table.toLowerCase().replace(/\s+/g, '-')}`;
    tables.push({
      table,
      columns,
      endpoints: [
        { method: 'GET', path: base, operation: 'list', model: table },
        { method: 'POST', path: base, operation: 'create', model: table },
        { method: 'GET', path: `${base}/:id`, operation: 'read', model: table },
        { method: 'PATCH', path: `${base}/:id`, operation: 'update', model: table },
        { method: 'DELETE', path: `${base}/:id`, operation: 'delete', model: table },
      ],
    });
  }
  return tables;
}

/**
 * Idea 00972 — mine GraphQL codegen artifact outputs for full operation lists.
 *
 * Recognises GraphQL Code Generator artefacts embedded in client bundles:
 *  - `export const FooQueryDocument = gql\`query Foo($id: ID!) { ... }\``
 *  - `export type FooQueryVariables = Exact<{ id: Scalars['ID'] }>`
 *  - Typed-document nodes (`new TypedDocumentString(...)`, `DocumentNode` casts)
 * Also captures fragment definitions for join analysis.
 *
 * @param {string} code - Raw JS/TS bundle text containing codegen output.
 * @returns {{operations:Array<object>, fragments:Array<object>}}
 */
export function mineGraphqlCodegenArtifacts(code = '') {
  const src = String(code);
  const operations = [];
  const fragments = [];
  const seenOps = new Set();

  // 1. Document constants with embedded gql template literals.
  //    (Codegen names the const <OperationName>Document; the operation kind
  //    comes from the GraphQL text itself.)
  const docRe = /export\s+const\s+(\w+)Document\s*=\s*(?:gql|graphql)`([\s\S]*?)`/g;
  let m;
  while ((m = docRe.exec(src)) !== null) {
    const [, , gqlText] = m;
    const opM = gqlText.match(/(query|mutation|subscription)\s+([A-Za-z_][\w]*)\s*(\([^)]*\))?/i);
    if (!opM) continue;
    const kind = opM[1].toLowerCase();
    const name = opM[2];
    const varDecl = opM[3] || '';
    const variables = [];
    const varRe = /\$\s*([A-Za-z_][\w]*)\s*:\s*([^,)=]+)/g;
    let v;
    while ((v = varRe.exec(varDecl)) !== null) {
      variables.push({ name: v[1], type: v[2].trim() });
    }
    const fragSpreads = [...gqlText.matchAll(/\.\.\.\s*([A-Za-z_][\w]*)/g)].map((f) => f[1]);
    const key = `${kind}:${name}`;
    if (seenOps.has(key)) continue;
    seenOps.add(key);
    operations.push({
      name,
      kind: kind.toLowerCase(),
      variables,
      fragments: fragSpreads,
      fieldCount: (gqlText.match(/[A-Za-z_][\w]*\s*[{(:]/g) || []).length,
    });
  }

  // 2. Typed-document strings: `new TypedDocumentString(\`query Foo ...\`, {...})`.
  const typedRe = /new\s+TypedDocumentString`([\s\S]*?)`/g;
  while ((m = typedRe.exec(src)) !== null) {
    const opM = m[1].match(/(query|mutation|subscription)\s+([A-Za-z_][\w]*)/i);
    if (!opM) continue;
    const key = `${opM[1].toLowerCase()}:${opM[2]}`;
    if (seenOps.has(key)) continue;
    seenOps.add(key);
    operations.push({ name: opM[2], kind: opM[1].toLowerCase(), variables: [], fragments: [], fieldCount: 0 });
  }

  // 3. `export type FooQueryVariables = Exact<{ id: Scalars['ID']; }>` — enrich or create entries.
  const varTypeRe = /export\s+type\s+(\w+?)(Query|Mutation|Subscription)Variables\s*=\s*Exact<\{([\s\S]*?)\}>/g;
  while ((m = varTypeRe.exec(src)) !== null) {
    const [, baseName, kind, varsBody] = m;
    const variables = [];
    const fieldRe = /([A-Za-z_][\w]*)[?]?\s*:\s*([^;]+);/g;
    let f;
    while ((f = fieldRe.exec(varsBody)) !== null) {
      const typeM = f[2].match(/Scalars\[['"]([^'"]+)['"]\]/);
      variables.push({ name: f[1], type: typeM ? typeM[1] : f[2].trim() });
    }
    const key = `${kind.toLowerCase()}:${baseName}`;
    const existing = operations.find((o) => `${o.kind}:${o.name}` === key || o.name === baseName);
    if (existing) {
      if (!existing.variables.length) existing.variables = variables;
    } else {
      operations.push({ name: baseName, kind: kind.toLowerCase(), variables, fragments: [], fieldCount: 0 });
    }
  }

  // 4. Fragment definitions.
  const fragRe = /fragment\s+([A-Za-z_][\w]*)\s+on\s+([A-Za-z_][\w]*)/g;
  const seenFrag = new Set();
  while ((m = fragRe.exec(src)) !== null) {
    const key = `${m[1]}:${m[2]}`;
    if (seenFrag.has(key)) continue;
    seenFrag.add(key);
    fragments.push({ name: m[1], onType: m[2] });
  }

  return { operations, fragments };
}

/**
 * Idea 00979 — mine Hasura metadata for tracked tables and actions.
 *
 * Parses Hasura metadata JSON (v2/v3 export format): tracked tables with
 * their select/insert/update/delete permissions and custom actions, so the
 * GraphQL surface a Hasura instance exposes is enumerated statically.
 *
 * @param {string|object} metadata - Hasura metadata JSON text or object.
 * @returns {{tables:Array<object>, actions:Array<object>, remoteSchemas:Array<string>}}
 */
export function mineHasuraMetadata(metadata) {
  let doc;
  try {
    doc = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
  } catch {
    return { tables: [], actions: [], remoteSchemas: [] };
  }
  const out = { tables: [], actions: [], remoteSchemas: [] };
  const d = doc && typeof doc === 'object' ? doc : {};

  const tables = d.tables || d.metadata?.tables || [];
  for (const t of tables) {
    const tableDef = t.table || t;
    const name = tableDef.name || tableDef;
    const schema = tableDef.schema || 'public';
    const perms = ['select_permissions', 'insert_permissions', 'update_permissions', 'delete_permissions']
      .filter((k) => Array.isArray(t[k]) && t[k].length > 0)
      .map((k) => k.replace('_permissions', ''));
    const relationships = [
      ...(t.object_relationships || []).map((r) => ({ name: r.name, kind: 'object', target: r.using?.foreign_key_constraint_on })),
      ...(t.array_relationships || []).map((r) => ({ name: r.name, kind: 'array', target: r.using?.foreign_key_constraint_on })),
    ];
    out.tables.push({ name, schema, permissions: perms, relationships });
  }

  const actions = d.actions || d.metadata?.actions || [];
  for (const a of actions) {
    const def = a.definition || {};
    out.actions.push({
      name: a.name,
      kind: def.kind || 'synchronous',
      arguments: (def.arguments || []).map((arg) => ({ name: arg.name, type: arg.type })),
      forwardClientHeaders: Boolean(def.forward_client_headers),
    });
  }

  const remotes = d.remote_schemas || d.metadata?.remote_schemas || [];
  for (const r of remotes) out.remoteSchemas.push(r.name || r);

  return out;
}

/**
 * Idea 00980 — extract Supabase project refs from client code.
 *
 * Recognises `createClient('https://xyzcompany.supabase.co', 'anon-key')`
 * calls, `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` env reads, and bare
 * `*.supabase.co` hostnames in strings — the project ref (`xyzcompany`)
 * identifies the Supabase project for surface mapping.
 *
 * @param {string} code - Raw JS/TS client code text.
 * @returns {Array<{projectRef:string, url:string, source:string}>}
 */
export function extractSupabaseConfig(code = '') {
  const src = String(code);
  const found = [];
  const seen = new Set();
  const push = (projectRef, url, source) => {
    const key = `${projectRef}::${source}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ projectRef, url, source });
  };

  // 1. Direct createClient calls with a literal URL.
  const clientRe = /createClient\(\s*["'`](https:\/\/([a-z0-9-]+)\.supabase\.co)["'`]/gi;
  let m;
  while ((m = clientRe.exec(src)) !== null) {
    push(m[2], m[1], 'createClient');
  }

  // 2. Bare supabase.co hostnames anywhere in strings (skipping ones already
  //    captured from createClient calls above).
  const clientRefs = new Set(found.map((f) => f.projectRef));
  const hostRe = /["'`](https:\/\/([a-z0-9-]+)\.supabase\.co(?:\/[^"'`]*)?)["'`]/gi;
  while ((m = hostRe.exec(src)) !== null) {
    if (clientRefs.has(m[2])) continue;
    push(m[2], m[1], 'url-literal');
  }

  // 3. Env-var references that carry the Supabase URL.
  const envRe = /process\.env\.(NEXT_PUBLIC_)?SUPABASE_URL|import\.meta\.env\.VITE_SUPABASE_URL/g;
  if (envRe.test(src)) {
    push('env-configured', 'process.env / import.meta.env', 'env-reference');
  }

  return found;
}
