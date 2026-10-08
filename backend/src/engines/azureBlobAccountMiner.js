/**
 * azureBlobAccountMiner.js — Azure Blob storage account-name mining engine.
 *
 * Idea 00268 — "Azure Blob storage account mining": enumerate Azure storage
 * account names from brand patterns to find storage-backed hosts.
 *
 * Pure functions only: callers probe candidate storage endpoints themselves
 * (respecting Azure request rate limits) and pass DNS records or
 * certificate data in for hint parsing. No live HTTP requests happen here —
 * this module generates brand-derived, rule-valid storage account-name
 * candidates plus the service URLs a caller would check, and parses CNAME
 * targets that reveal the storage account behind a hostname.
 */

/** Azure storage account rules: 3-24 chars, lowercase letters + numbers only. */
export const AZURE_ACCOUNT_RE = /^[a-z0-9]{3,24}$/;
/** Azure storage service endpoint suffixes. */
export const AZURE_STORAGE_SUFFIX = 'core.windows.net';
export const AZURE_BLOB_SUFFIX = 'blob.core.windows.net';
export const AZURE_DFS_SUFFIX = 'dfs.core.windows.net';
export const AZURE_FILE_SUFFIX = 'file.core.windows.net';
export const AZURE_QUEUE_SUFFIX = 'queue.core.windows.net';
export const AZURE_TABLE_SUFFIX = 'table.core.windows.net';

export const AZURE_ACCOUNT_AFFIXES = [
  'app',
  'web',
  'assets',
  'static',
  'media',
  'files',
  'uploads',
  'images',
  'docs',
  'backup',
  'backups',
  'data',
  'logs',
  'staging',
  'prod',
  'dev',
  'test',
  'qa',
  'demo',
  'cdn',
  'site',
  'portal',
  'storage',
  'blob',
  'store',
];

/**
 * Slugify a brand name into a valid Azure storage account-name fragment
 * (lowercase alphanumerics only — hyphens are not allowed).
 * @param {string} brand
 * @returns {string}
 */
export function slugifyBrand(brand) {
  const slug = String(brand || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^0+/, '');
  return slug.slice(0, 18);
}

/**
 * Validate a candidate against Azure storage account naming rules.
 * @param {string} name
 * @returns {boolean}
 */
export function isValidAzureAccountName(name) {
  return AZURE_ACCOUNT_RE.test(String(name || ''));
}

/**
 * Generate brand-derived Azure storage account-name candidates.
 *
 * @param {string} brand brand/org name
 * @param {{affixes?: string[], maxNames?: number}} [options]
 * @returns {string[]} unique valid storage account names
 */
export function generateAzureAccountNames(brand, options = {}) {
  const { affixes = AZURE_ACCOUNT_AFFIXES, maxNames = 200 } = options;
  const slug = slugifyBrand(brand);
  if (!slug) return [];
  const out = new Set();
  const add = name => {
    if (out.size >= maxNames) return;
    if (isValidAzureAccountName(name)) out.add(name);
  };
  add(slug);
  for (const a of affixes) {
    add(`${slug}${a}`);
    add(`${a}${slug}`);
  }
  for (const n of ['1', '2', '3']) add(`${slug}${n}`);
  for (const y of ['2024', '2025', '2026']) add(`${slug}${y}`);
  return [...out];
}

/**
 * Build the Blob service URL for a storage account.
 * @param {string} account
 * @returns {string}
 */
export function azureBlobUrl(account) {
  return `https://${String(account).toLowerCase()}.${AZURE_BLOB_SUFFIX}`;
}

/**
 * Build all standard service URLs (blob, dfs, file, queue, table) for an account.
 * @param {string} account
 * @returns {{blob: string, dfs: string, file: string, queue: string, table: string}}
 */
export function azureServiceUrls(account) {
  const a = String(account).toLowerCase();
  return {
    blob: `https://${a}.${AZURE_BLOB_SUFFIX}`,
    dfs: `https://${a}.${AZURE_DFS_SUFFIX}`,
    file: `https://${a}.${AZURE_FILE_SUFFIX}`,
    queue: `https://${a}.${AZURE_QUEUE_SUFFIX}`,
    table: `https://${a}.${AZURE_TABLE_SUFFIX}`,
  };
}

/**
 * Extract the storage account name and service from an Azure storage hostname.
 * @param {string} hostname
 * @returns {{account: string, service: 'blob'|'dfs'|'file'|'queue'|'table'}|null}
 */
export function accountNameFromAzureHost(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  const suffixes = {
    [AZURE_BLOB_SUFFIX]: 'blob',
    [AZURE_DFS_SUFFIX]: 'dfs',
    [AZURE_FILE_SUFFIX]: 'file',
    [AZURE_QUEUE_SUFFIX]: 'queue',
    [AZURE_TABLE_SUFFIX]: 'table',
  };
  for (const [suffix, service] of Object.entries(suffixes)) {
    if (h.endsWith(`.${suffix}`)) {
      const account = h.slice(0, -(suffix.length + 1));
      if (isValidAzureAccountName(account)) return { account, service };
      return null;
    }
  }
  return null;
}

/**
 * Parse DNS records for Azure storage infrastructure hints.
 *
 * @param {{name: string, type: string, value: string}[]} records DNS records
 *   the caller already resolved
 * @returns {{recordName: string, target: string, account: string, service: string}[]}
 */
export function parseAzureDnsHints(records = []) {
  const hits = [];
  for (const rec of records || []) {
    const type = String(rec?.type || '').toUpperCase();
    if (!['CNAME', 'ALIAS', 'ANAME'].includes(type)) continue;
    const target = String(rec?.value || '')
      .toLowerCase()
      .replace(/\.$/, '');
    if (!target) continue;
    const parsed = accountNameFromAzureHost(target);
    if (parsed) {
      hits.push({
        recordName: String(rec?.name || ''),
        target,
        account: parsed.account,
        service: parsed.service,
      });
    }
  }
  return hits;
}

/**
 * Parse certificate SANs for Azure storage account leaks.
 *
 * @param {string[]} sans subject alternative names from a cert the caller fetched
 * @returns {{san: string, account: string, service: string}[]}
 */
export function parseAzureCertHints(sans = []) {
  const hits = [];
  for (const raw of sans || []) {
    const san = String(raw || '')
      .toLowerCase()
      .replace(/^\*\./, '');
    if (!san) continue;
    const parsed = accountNameFromAzureHost(san);
    if (parsed) hits.push({ san: String(raw), account: parsed.account, service: parsed.service });
  }
  return hits;
}
