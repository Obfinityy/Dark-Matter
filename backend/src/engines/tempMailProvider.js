/**
 * tempMailProvider.js — disposable email for hunter test-account creation.
 *
 * Learned from the real VFS Global bug-bounty hunt (9 Oct 2026): the agent
 * needs test accounts to exercise authenticated flows (booking, reschedule,
 * IDOR), but asking the owner for an email every time blocks autonomy.
 * mail.tm is free, needs no signup, and exposes a clean REST API — perfect
 * for autonomous hunters. Fallback: ask the user for an email address.
 *
 * API docs: https://api.mail.tm (endpoints used below are stable public API)
 */

const API = 'https://api.mail.tm';
const TIMEOUT_MS = 15000;

/**
 * Fetch with a 15s abort timeout.
 * @param {string} url
 * @param {object} [init]
 * @param {Function} [fetchImpl] - injectable fetch for tests
 */
async function timedFetch(url, init = {}, fetchImpl = globalThis.fetch) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function randomAddress(domain = 'maxxspace.com') {
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return `hunter${rand}@${domain}`;
}

function randomPassword() {
  return 'Tmp' + Math.random().toString(36).slice(2, 12) + '!9xQ';
}

/**
 * Create a disposable mailbox and return a Bearer token for it.
 * @param {object} [opts] - {address?, password?, domain?}
 * @param {Function} [fetchImpl]
 * @returns {Promise<{address:string, token:string}>}
 * @throws {Error} with a clear message when creation or token issue fails
 */
export async function createAccount(opts = {}, fetchImpl = globalThis.fetch) {
  const address = opts.address || randomAddress(opts.domain);
  const password = opts.password || randomPassword();

  let res;
  try {
    res = await timedFetch(
      `${API}/accounts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password }),
      },
      fetchImpl
    );
  } catch (err) {
    throw new Error(`tempMail: account creation failed (network): ${err.message}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`tempMail: account creation failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }

  let tokenRes;
  try {
    tokenRes = await timedFetch(
      `${API}/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password }),
      },
      fetchImpl
    );
  } catch (err) {
    throw new Error(`tempMail: token request failed (network): ${err.message}`);
  }
  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    throw new Error(`tempMail: token request failed (HTTP ${tokenRes.status}): ${body.slice(0, 200)}`);
  }
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenJson.token) {
    throw new Error('tempMail: token response missing token field');
  }
  return { address, token: tokenJson.token };
}

/**
 * List messages in the mailbox.
 * @param {object} opts - {token, page=1}
 * @param {Function} [fetchImpl]
 * @returns {Promise<Array<{id:string, from:string, subject:string, intro:string, receivedAt:string}>>}
 */
export async function listMessages({ token, page = 1 } = {}, fetchImpl = globalThis.fetch) {
  if (!token) throw new Error('tempMail: listMessages needs a token');
  const res = await timedFetch(
    `${API}/messages?page=${page}`,
    { headers: { Authorization: `Bearer ${token}` } },
    fetchImpl
  );
  if (!res.ok) {
    throw new Error(`tempMail: listMessages failed (HTTP ${res.status})`);
  }
  const json = await res.json().catch(() => ({}));
  const items = Array.isArray(json['hydra:member']) ? json['hydra:member'] : [];
  return items.map((m) => ({
    id: m.id,
    from: m.from?.address || m.from?.name || '',
    subject: m.subject || '',
    intro: m.intro || '',
    receivedAt: m.createdAt || '',
  }));
}

/**
 * Fetch one full message.
 * @param {object} opts - {token, id}
 * @param {Function} [fetchImpl]
 * @returns {Promise<{subject:string, text:string, html:string}>}
 */
export async function getMessage({ token, id } = {}, fetchImpl = globalThis.fetch) {
  if (!token) throw new Error('tempMail: getMessage needs a token');
  if (!id) throw new Error('tempMail: getMessage needs an id');
  const res = await timedFetch(
    `${API}/messages/${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${token}` } },
    fetchImpl
  );
  if (!res.ok) {
    throw new Error(`tempMail: getMessage failed (HTTP ${res.status})`);
  }
  const json = await res.json().catch(() => ({}));
  const text = Array.isArray(json.text) ? json.text.join('\n') : String(json.text || '');
  const html = Array.isArray(json.html) ? json.html.join('\n') : String(json.html || '');
  return { subject: json.subject || '', text, html };
}

/**
 * Find the first 4-8 digit verification code in text.
 * @param {string} text
 * @returns {string|null}
 */
export function extractVerificationCode(text) {
  if (!text) return null;
  const m = String(text).match(/\b\d{4,8}\b/);
  return m ? m[0] : null;
}

const LINK_RE = /https?:\/\/[^\s"'<>)]+/gi;

/**
 * Extract unique http(s) links from HTML/text, optionally filtered by domain substring.
 * @param {string} html
 * @param {object} [opts] - {domain?}
 * @returns {string[]}
 */
export function extractLinks(html, { domain } = {}) {
  if (!html) return [];
  const found = String(html).match(LINK_RE) || [];
  const cleaned = found.map((l) => l.replace(/[.,;:!?]+$/, ''));
  const unique = [...new Set(cleaned)];
  if (domain) {
    return unique.filter((l) => l.includes(domain));
  }
  return unique;
}

/**
 * Poll listMessages until predicate(msg) is true or timeout.
 * pollFn is injectable: ({token, page}) => Promise<message[]>.
 * @param {object} opts - {token, pollFn?, timeoutMs=60000, intervalMs=5000, predicate?}
 * @returns {Promise<object|null>} the first matching message, or null on timeout
 */
export async function waitForMessage({
  token,
  pollFn = (t) => listMessages({ token: t }),
  timeoutMs = 60000,
  intervalMs = 5000,
  predicate = () => true,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const msgs = await pollFn(token);
    for (const m of msgs || []) {
      if (predicate(m)) return m;
    }
    if (Date.now() >= deadline) return null;
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, Math.max(0, deadline - Date.now()))));
    if (Date.now() >= deadline) return null;
  }
}

export const TEMP_MAIL_PROVIDER = {
  createAccount,
  listMessages,
  getMessage,
  extractVerificationCode,
  extractLinks,
  waitForMessage,
};
export default TEMP_MAIL_PROVIDER;
