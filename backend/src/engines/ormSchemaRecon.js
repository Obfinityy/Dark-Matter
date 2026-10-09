/**
 * ormSchemaRecon.js — ORM schema reconnaissance engine.
 *
 * Passively parses ORM / schema-definition text the hunt agent has already
 * recovered from the target's own publicly served client artifacts (bundles,
 * leaked schema files, docs). Pure static analysis of text — no network calls,
 * no execution of target code, fully deterministic.
 *
 * Covers idea-bank ideas:
 *  00973 — Prisma schema model extraction
 *  00974 — Drizzle schema table mapping
 *  00975 — TypeORM entity mining
 *  00976 — Sequelize model extraction
 *  00977 — Mongoose schema harvesting
 *  00978 — Knex migration analysis
 *
 * Each parser returns a list of structured data models:
 *   { name, table, source: 'prisma'|'drizzle'|'typeorm'|'sequelize'|'mongoose'|'knex',
 *     fields: [{ name, type, nullable, primaryKey, unique, defaultValue }] }
 *
 * Inferred REST-style endpoints are derived from table names with the helper
 * inferApiShapesFromModels(), so downstream recon can treat schema knowledge
 * as a data-layer attack surface.
 *
 * @module ormSchemaRecon
 */

/**
 * Split a brace-delimited block body into top-level lines, ignoring nested
 * braces inside parentheses (e.g. decorators like @Column({ type: 'text' })).
 *
 * @param {string} body - Block body text without the outer braces.
 * @returns {Array<string>} Significant lines.
 */
function blockLines(body) {
  const lines = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '{') depth += 1;
    if (ch === '}') depth = Math.max(0, depth - 1);
    if (ch === '\n' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed && !trimmed.startsWith('//')) lines.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last && !last.startsWith('//')) lines.push(last);
  return lines;
}

/**
 * Extract the argument of @default(...) honouring nested parentheses.
 *
 * @param {string} attrs - Prisma attribute text.
 * @returns {string|null} Default expression or null.
 */
function extractPrismaDefault(attrs) {
  const idx = attrs.indexOf('@default(');
  if (idx === -1) return null;
  let depth = 0;
  let start = -1;
  for (let i = idx + '@default'.length; i < attrs.length; i += 1) {
    const ch = attrs[i];
    if (ch === '(') { if (start === -1) start = i + 1; depth += 1; }
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return attrs.slice(start, i).trim();
    }
  }
  return null;
}

/**
 * Normalise a raw field descriptor.
 *
 * @param {object} partial - Partial field descriptor.
 * @returns {{name:string,type:string,nullable:boolean,primaryKey:boolean,unique:boolean,defaultValue:string|null}}
 */
function makeField(partial = {}) {
  return {
    name: partial.name ?? '',
    type: partial.type ?? 'unknown',
    nullable: partial.nullable ?? false,
    primaryKey: partial.primaryKey ?? false,
    unique: partial.unique ?? false,
    defaultValue: partial.defaultValue ?? null,
  };
}

/**
 * Idea 00973 — extract data models from Prisma schema text.
 *
 * Recognises `model Name { ... }` blocks with `field Type` declarations plus
 * Prisma attributes: `?` (optional), `@id`, `@unique`, `@default(...)`,
 * `@@map("table")` for explicit table names.
 *
 * @param {string} schema - Raw Prisma schema text.
 * @returns {Array<object>} Structured models.
 */
export function extractPrismaModels(schema = '') {
  const src = String(schema);
  const models = [];
  const blockRe = /\bmodel\s+([A-Za-z_][\w]*)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    const [, name, body] = m;
    let table = name;
    const mapMatch = body.match(/@@map\(\s*["']([^"']+)["']\s*\)/);
    if (mapMatch) table = mapMatch[1];
    const fields = [];
    for (const line of blockLines(body)) {
      if (/^@@/.test(line)) continue;
      const fieldMatch = line.match(/^([A-Za-z_][\w]*)\s+([A-Za-z_][\w$]*(?:\[\])?)(\?)?\s*(.*)$/);
      if (!fieldMatch) continue;
      const [, fname, ftype, optional, attrs] = fieldMatch;
      if (/^(?:@@|\/\/)/.test(fname)) continue;
      const attrStr = attrs || '';
      fields.push(makeField({
        name: fname,
        type: ftype,
        nullable: Boolean(optional) || /@default\(null\)/.test(attrStr),
        primaryKey: /@id\b/.test(attrStr),
        unique: /@unique\b/.test(attrStr),
        defaultValue: extractPrismaDefault(attrStr),
      }));
    }
    models.push({ name, table, source: 'prisma', fields });
  }
  return models;
}

/**
 * Idea 00974 — map tables from Drizzle ORM schema definitions.
 *
 * Recognises pgTable/mysqliteTable('table_name', { col: pgType('db_col', opts), ... })
 * and plain object columns, including `primaryKey()`, `.notNull()`, `.default(...)`.
 *
 * @param {string} schemaJs - Raw Drizzle schema JS/TS text.
 * @returns {Array<object>} Structured tables.
 */
export function mapDrizzleTables(schemaJs = '') {
  const src = String(schemaJs);
  const models = [];
  const tableRe = /\b(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*\{([\s\S]*?)\n\}\s*\)/g;
  let m;
  while ((m = tableRe.exec(src)) !== null) {
    const [, tableName, body] = m;
    const fields = [];
    const colRe = /([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)\s*\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)?/g;
    let c;
    while ((c = colRe.exec(body)) !== null) {
      const colName = c[1];
      const colType = c[2];
      const literal = c[3] ?? c[4] ?? c[5] ?? null;
      const rest = body.slice(c.index, body.indexOf('\n', c.index) === -1 ? undefined : body.indexOf('\n', c.index));
      fields.push(makeField({
        name: literal && !/^[A-Z]/.test(literal) ? literal : colName,
        type: colType,
        nullable: !/\.notNull\(\)/.test(rest),
        primaryKey: /\.primaryKey\(\)/.test(rest),
        unique: /\.unique\(\)/.test(rest),
        defaultValue: (rest.match(/\.default\(([^)]+)\)/) || [])[1] ?? null,
      }));
    }
    models.push({ name: tableName, table: tableName, source: 'drizzle', fields });
  }
  return models;
}

/**
 * Idea 00975 — mine TypeORM entities from decorated class text.
 *
 * Recognises `@Entity('table') class Name { @PrimaryGeneratedColumn() id; @Column({ type: 'text', nullable: true }) body }`
 * including `@Column('varchar') shorthand` forms.
 *
 * @param {string} js - Raw TypeScript/JS entity text.
 * @returns {Array<object>} Structured entities.
 */
export function mineTypeOrmEntities(js = '') {
  const src = String(js);
  const models = [];
  const entityRe = /@Entity\(\s*(?:["'`]([^"'`]+)["'`]\s*)?\)\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_][\w]*)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = entityRe.exec(src)) !== null) {
    const [, entityArg, className, body] = m;
    const table = entityArg || className;
    const fields = [];
    // Split on semicolons/newlines at top level to get property declarations.
    const props = body.split(/;|\n/).map((s) => s.trim()).filter(Boolean);
    let pendingPrimary = false;
    let pendingColumn = null;
    for (const prop of props) {
      if (prop.startsWith('@PrimaryGeneratedColumn') || prop.startsWith('@PrimaryColumn')) {
        pendingPrimary = true;
        const argM = prop.match(/\(\s*["'`]([^"'`]+)["'`]/);
        pendingColumn = argM ? { name: argM[1] } : null;
        continue;
      }
      if (prop.startsWith('@Column')) {
        const argM = prop.match(/@Column\(\s*(?:\{([^}]*)\}|["'`]([^"'`]+)["'`])?/);
        pendingColumn = { opts: argM ? (argM[1] || argM[2] || '') : '' };
        continue;
      }
      if (prop.startsWith('@')) { pendingPrimary = false; pendingColumn = null; continue; }
      const decl = prop.match(/^([A-Za-z_$][\w$]*)\s*[:!?]/);
      if (!decl) continue;
      const opts = pendingColumn && pendingColumn.opts ? String(pendingColumn.opts) : '';
      const typeM = opts.match(/type\s*:\s*["'`]([^"'`]+)["'`]/);
      const nameM = opts.match(/name\s*:\s*["'`]([^"'`]+)["'`]/);
      const nullable = /nullable\s*:\s*true/.test(opts) || /[?!]\s*:/.test(prop);
      fields.push(makeField({
        name: (pendingColumn && pendingColumn.name) || nameM?.[1] || decl[1],
        type: typeM?.[1] || (typeof (pendingColumn?.opts) === 'string' && /^[a-z]+$/.test(pendingColumn.opts) ? pendingColumn.opts : 'column'),
        nullable,
        primaryKey: pendingPrimary,
        unique: /unique\s*:\s*true/.test(opts),
        defaultValue: (opts.match(/default\s*:\s*([^,}]+)/) || [])[1]?.trim() ?? null,
      }));
      pendingPrimary = false;
      pendingColumn = null;
    }
    models.push({ name: className, table, source: 'typeorm', fields });
  }
  return models;
}

/**
 * Idea 00976 — extract Sequelize models from define()/init() calls.
 *
 * Recognises `sequelize.define('Name', { col: DataTypes.STRING })` and
 * `Model.init({ col: { type: DataTypes.INTEGER, primaryKey: true } }, { tableName: 't' })`.
 *
 * @param {string} js - Raw Sequelize model JS text.
 * @returns {Array<object>} Structured models.
 */
export function extractSequelizeModels(js = '') {
  const src = String(js);
  const models = [];
  const typeName = (expr) => {
    const mm = String(expr).match(/DataTypes\.([A-Za-z_][\w]*)/);
    return mm ? mm[1] : 'unknown';
  };
  const parseAttrs = (body, tableHint, name) => {
    const fields = [];
    const attrRe = /([A-Za-z_$][\w$]*)\s*:\s*(DataTypes\.[A-Za-z_][\w]*(?:\([^)]*\))?|\{([^}]*)\})/g;
    let a;
    while ((a = attrRe.exec(body)) !== null) {
      const [, colName, expr, optsBody] = a;
      const opts = optsBody || '';
      fields.push(makeField({
        name: (opts.match(/field\s*:\s*["'`]([^"'`]+)["'`]/) || [])[1] || colName,
        type: typeName(expr),
        nullable: !/allowNull\s*:\s*false/.test(opts),
        primaryKey: /primaryKey\s*:\s*true/.test(opts),
        unique: /unique\s*:\s*true/.test(opts),
        defaultValue: (opts.match(/defaultValue\s*:\s*([^,}]+)/) || [])[1]?.trim() ?? null,
      }));
    }
    return { name, table: tableHint || name, source: 'sequelize', fields };
  };
  let m;
  const defineRe = /\.\s*define\(\s*["'`]([^"'`]+)["'`]\s*,\s*\{([\s\S]*?)\n\}\s*(?:,|\))/g;
  while ((m = defineRe.exec(src)) !== null) {
    models.push(parseAttrs(m[2], null, m[1]));
  }
  const initRe = /\.init\(\s*\{([\s\S]*?)\n\}\s*,\s*\{([\s\S]*?)\n?\}\s*\)/g;
  while ((m = initRe.exec(src)) !== null) {
    const optsBody = m[2];
    const tableM = optsBody.match(/tableName\s*:\s*["'`]([^"'`]+)["'`]/);
    const nameM = optsBody.match(/modelName\s*:\s*["'`]([^"'`]+)["'`]/);
    const parsed = parseAttrs(m[1], tableM?.[1], nameM?.[1] || tableM?.[1] || 'Model');
    models.push(parsed);
  }
  return models;
}

/**
 * Idea 00977 — harvest Mongoose schemas from schema-definition text.
 *
 * Recognises `new mongoose.Schema({ name: String, age: { type: Number, required: true } })`
 * and `new Schema({...})` forms, including array shorthand (`tags: [String]`).
 *
 * @param {string} js - Raw Mongoose schema JS text.
 * @returns {Array<object>} Structured document shapes.
 */
export function harvestMongooseSchemas(js = '') {
  const src = String(js);
  const models = [];
  const schemaRe = /new\s+(?:mongoose\.)?Schema\(\s*\{([\s\S]*?)\n\}\s*(?:,\s*\{([\s\S]*?)\})?\s*\)/g;
  let m;
  while ((m = schemaRe.exec(src)) !== null) {
    const body = m[1];
    const opts = m[2] || '';
    const collectionM = opts.match(/collection\s*:\s*["'`]([^"'`]+)["'`]/);
    const fields = [];
    const fieldRe = /([A-Za-z_$][\w$]*)\s*:\s*(\[[A-Za-z_$][\w$]*\]|[A-Za-z_$][\w$]*|\{([^}]*)\})/g;
    let f;
    while ((f = fieldRe.exec(body)) !== null) {
      const [, fname, ftype, optsBody] = f;
      if (fname === 'timestamps') continue;
      const optsStr = optsBody || '';
      const typeM = optsStr.match(/type\s*:\s*\[?([A-Za-z_$][\w$]*)\]?/);
      fields.push(makeField({
        name: fname,
        type: typeM?.[1] || ftype.replace(/[\[\]]/g, ''),
        nullable: !/required\s*:\s*true/.test(optsStr),
        primaryKey: fname === '_id',
        unique: /unique\s*:\s*true/.test(optsStr),
        defaultValue: (optsStr.match(/default\s*:\s*([^,}]+)/) || [])[1]?.trim() ?? null,
      }));
    }
    // Attach model name when the schema is registered via mongoose.model().
    const window = src.slice(Math.max(0, m.index - 160), m.index + m[0].length + 240);
    const modelM = window.match(/model\(\s*["'`]([^"'`]+)["'`]/);
    const name = modelM?.[1] || collectionM?.[1] || 'Document';
    models.push({ name, table: collectionM?.[1] || name, source: 'mongoose', fields });
  }
  return models;
}

/**
 * Idea 00978 — analyze Knex migration files for table structures.
 *
 * Recognises `knex.schema.createTable('users', (t) => { t.increments('id'); t.string('email').unique(); ... })`
 * and `alterTable` blocks. Maps Knex column builder calls to portable types.
 *
 * @param {string} js - Raw Knex migration JS text.
 * @returns {Array<object>} Structured tables.
 */
export function analyzeKnexMigrations(js = '') {
  const src = String(js);
  const models = [];
  const opRe = /\.(createTable|createTableIfNotExists|alterTable)\(\s*["'`]([^"'`]+)["'`]\s*,\s*(?:function\s*\([^)]*\)|\(?[^)]*\)?\s*=>)\s*\{?([\s\S]*?)\n?\}\s*\)/g;
  let m;
  while ((m = opRe.exec(src)) !== null) {
    const [, op, tableName, body] = m;
    const fields = [];
    const colRe = /\b\w+\.([A-Za-z_][\w]*)\(\s*(?:"([^"]*)"|'([^']*)')?/g;
    let c;
    while ((c = colRe.exec(body)) !== null) {
      const builder = c[1];
      const colName = c[2] ?? c[3] ?? null;
      if (/^(foreign|index|dropColumn|renameColumn|dropForeign|unique|comment)$/.test(builder)) continue;
      const rest = body.slice(c.index, body.indexOf('\n', c.index) === -1 ? undefined : body.indexOf('\n', c.index));
      const isPk = builder === 'increments' || builder === 'bigIncrements' || /\.primary\(\)/.test(rest);
      fields.push(makeField({
        name: colName || builder,
        type: builder,
        nullable: !/\.notNullable\(\)/.test(rest) && builder !== 'increments' && builder !== 'bigIncrements',
        primaryKey: isPk,
        unique: /\.unique\(\)/.test(rest),
        defaultValue: (rest.match(/\.defaultTo\(([^)]+)\)/) || [])[1]?.trim() ?? null,
      }));
    }
    models.push({ name: tableName, table: tableName, source: 'knex', fields, operation: op });
  }
  return models;
}

/**
 * Derive likely REST-style endpoint shapes from structured models, so a
 * schema leak directly becomes a data-layer attack-surface list.
 *
 * @param {Array<object>} models - Models from any parser in this module.
 * @returns {Array<{method:string, path:string, model:string, fields:Array<string>}>}
 */
export function inferApiShapesFromModels(models = []) {
  const out = [];
  for (const model of models) {
    const base = `/${String(model.table).toLowerCase().replace(/\s+/g, '-')}`;
    const fieldNames = (model.fields || []).map((f) => f.name);
    out.push(
      { method: 'GET', path: base, model: model.name, fields: fieldNames },
      { method: 'POST', path: base, model: model.name, fields: fieldNames },
      { method: 'GET', path: `${base}/:id`, model: model.name, fields: fieldNames },
      { method: 'PUT', path: `${base}/:id`, model: model.name, fields: fieldNames },
      { method: 'DELETE', path: `${base}/:id`, model: model.name, fields: fieldNames },
    );
  }
  return out;
}
