/**
 * payloadLibraryService — Payload Library dataset service.
 *
 * Serves the curated payload datasets shipped under
 * backend/data/payload-library/*.json (derived from the MIT-licensed
 * PayloadsAllTheThings corpus; see THIRD_PARTY_NOTICES.md and
 * backend/scripts/extract-payload-library.mjs for provenance).
 *
 * Datasets are lazy-loaded on first access and cached in memory. Each item:
 *   { id, title, payload, context, tags }
 *
 * This is a DATA library only: it suggests payload strings for the user's own
 * authorized targets. It never fires requests or automates exploitation.
 * Part of: Infinity AI / Dark-Matter backend (business-logic services).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(here, '..', '..', 'data', 'payload-library');

/** Business-logic service for the Payload Library dataset. */
export class PayloadLibraryService {
  /**
   * @param {object} [options]
   * @param {string} [options.dataDir] — directory holding <slug>.json datasets.
   * @param {object} [options.logger] — logger with warn/log/error.
   */
  constructor({ dataDir = DEFAULT_DATA_DIR, logger = console } = {}) {
    this.dataDir = dataDir;
    this.logger = logger;
    this.cache = new Map(); // slug -> items[]
    this.manifest = null; // [{ slug, name, count }]
  }

  /** Read and cache one dataset; returns [] when the file is missing. */
  async _loadDataset(slug) {
    if (this.cache.has(slug)) return this.cache.get(slug);
    const file = path.join(this.dataDir, `${slug}.json`);
    let items = [];
    try {
      const raw = await fs.readFile(file, 'utf8');
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      this.logger.warn?.(`[payload-library] cannot load dataset "${slug}": ${error.message}`);
    }
    this.cache.set(slug, items);
    return items;
  }

  /**
   * List available categories with payload counts.
   * @returns {Promise<Array<{ slug: string, name: string, count: number }>>}
   */
  async listCategories() {
    if (this.manifest) return this.manifest;
    let files = [];
    try {
      files = (await fs.readdir(this.dataDir)).filter(f => f.endsWith('.json')).sort();
    } catch (error) {
      this.logger.warn?.(`[payload-library] data dir unreadable: ${error.message}`);
      this.manifest = [];
      return this.manifest;
    }
    const categories = [];
    for (const file of files) {
      const slug = file.slice(0, -'.json'.length);
      const items = await this._loadDataset(slug);
      const name =
        items.find(i => i && typeof i.context === 'string' && i.context)?.context ||
        humanizeSlug(slug);
      categories.push({ slug, name: datasetDisplayName(slug, name), count: items.length });
    }
    this.manifest = categories;
    return categories;
  }

  /**
   * Get payloads for one category (paginated).
   * @param {string} category — dataset slug.
   * @param {object} [opts]
   * @param {number} [opts.limit=50] — max items (clamped 1..500).
   * @param {number} [opts.offset=0]
   */
  async getPayloads(category, { limit = 50, offset = 0 } = {}) {
    const slug = normalizeSlug(category);
    const items = await this._loadDataset(slug);
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    return {
      category: slug,
      total: items.length,
      limit: safeLimit,
      offset: safeOffset,
      payloads: items.slice(safeOffset, safeOffset + safeLimit),
    };
  }

  /**
   * Full-text search across every dataset.
   * @param {string} query
   * @param {object} [opts]
   * @param {number} [opts.limit=50] — max results (clamped 1..200).
   */
  async searchPayloads(query, { limit = 50 } = {}) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return { query: String(query || ''), total: 0, results: [] };
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const categories = await this.listCategories();
    const results = [];
    for (const { slug } of categories) {
      const items = await this._loadDataset(slug);
      for (const item of items) {
        const haystack = `${item.title || ''} ${item.payload || ''} ${item.context || ''}`.toLowerCase();
        if (haystack.includes(q)) {
          results.push({ ...item, category: slug });
          if (results.length >= safeLimit) break;
        }
      }
      if (results.length >= safeLimit) break;
    }
    return { query: String(query || ''), total: results.length, results };
  }

  /**
   * One random payload from a category — handy for hunt hint variety.
   * @param {string} category — dataset slug.
   * @returns {Promise<object|null>}
   */
  async randomPayload(category) {
    const slug = normalizeSlug(category);
    const items = await this._loadDataset(slug);
    if (!items.length) return null;
    const pick = items[Math.floor(Math.random() * items.length)];
    return { ...pick, category: slug };
  }

  /** Aggregate stats for the whole library. */
  async getStats() {
    const categories = await this.listCategories();
    const totalPayloads = categories.reduce((n, c) => n + c.count, 0);
    return { categories: categories.length, totalPayloads, byCategory: categories };
  }

  /**
   * Hunt-flow adapter: payloads for a vulnerability class, best-effort.
   * Unknown categories resolve to [] instead of throwing, so hunt engines
   * can call this unconditionally.
   * @param {string} category — dataset slug (e.g. 'xss', 'sqli').
   * @param {object} [opts] — { limit }
   * @returns {Promise<Array>} payload items (may be empty).
   */
  async payloadsFor(category, { limit = 10 } = {}) {
    const { payloads } = await this.getPayloads(category, { limit, offset: 0 });
    return payloads;
  }
}

/** Normalize a user-supplied category to a dataset slug. */
export function normalizeSlug(category) {
  return String(category || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function humanizeSlug(slug) {
  return slug
    .split('-')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Stable display names for the shipped datasets. */
function datasetDisplayName(slug, fallback) {
  const NAMES = {
    xss: 'XSS Injection',
    sqli: 'SQL Injection',
    'command-injection': 'Command Injection',
    'file-inclusion': 'File Inclusion (LFI/RFI)',
    ssrf: 'Server Side Request Forgery',
    ssti: 'Server Side Template Injection',
    xxe: 'XXE Injection',
    'ldap-injection': 'LDAP Injection',
    'nosql-injection': 'NoSQL Injection',
    'xpath-injection': 'XPATH Injection',
    'open-redirect': 'Open Redirect',
    'crlf-injection': 'CRLF Injection',
    'csv-injection': 'CSV Injection',
    'graphql-injection': 'GraphQL Injection',
    'prototype-pollution': 'Prototype Pollution',
    hpp: 'HTTP Parameter Pollution',
    'cors-misconfiguration': 'CORS Misconfiguration',
    clickjacking: 'Clickjacking',
    'file-upload': 'Upload Insecure Files',
    'request-smuggling': 'Request Smuggling',
    'web-cache-deception': 'Web Cache Deception',
    'ssi-injection': 'Server Side Include Injection',
  };
  return NAMES[slug] || fallback || humanizeSlug(slug);
}
