// Lane AI (24 Oct 2026) — temp-mail inbox for agent self-registration.
//
// When a signup needs mail verification, the agent uses its OWN
// temp-mail inbox (one it controls and can poll) — never the
// owner's mailbox, never another user's address.
//
// PROVIDER CHOICE (verified live from EC2, 24 Oct 2026 — not docs):
//   - PRIMARY mail.tm: account API + token + message poll all
//     answered from EC2; active domain at test time was
//     maxxspace.com (domains rotate; the code reads the live list).
//     Its domain looks ordinary, so disposable-domain blocking is
//     less likely than with the famous throwaway domains.
//   - FALLBACK GuerrillaMail: instant inbox (no account needed),
//     check_email poll + full body verified live from EC2. Its
//     domains (guerrillamailblock.com, sharklasers.com, …) are
//     textbook disposable domains — expect blocking on strict sites.
//   - NOT VERIFIED from EC2: arrival of a REAL sender's mail.
//     EC2 blocks outbound port 25, so no send→receive loop could be
//     completed from the hunt box; the first real signup attempt is
//     the arrival test. The code treats that honestly: a poll that
//     times out is reported as a blocker, never retried forever.
//
// BLOCKING BEHAVIOUR (documented, deterministic):
//   - Signup rejection naming the domain -> the brain records a
//     blocker for that site+domain and stops that path.
//   - No mail after maxPolls -> pollForCode returns
//     {ok:false, reason:'timeout'} -> the brain records a blocker
//     (site may block the domain, or mail is delayed) and moves on.
//   - A verification CODE is transient: it is returned to the brain
//     as a one-turn observation and added to the session's secret
//     set (humanLoop.js scrubs it from every recorded surface).
//     The code itself is never written to the vault, events, or
//     reasoning rows — only the fact that a code was received.

const MAILTM_BASE = 'https://api.mail.tm';
const GUERRILLA_BASE = 'https://api.guerrillamail.com/ajax.php';

const fetchJson = async (fetchFn, url, opts = {}) => {
  const res = await fetchFn(url, opts);
  if (!res.ok) throw new Error(`temp-mail HTTP ${res.status} for ${url}`);
  return res.json();
};

const randomSuffix = (n = 8) => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

// ---- mail.tm ---------------------------------------------------------------

async function mailtmCreateInbox(fetchFn) {
  const domains = await fetchJson(fetchFn, `${MAILTM_BASE}/domains`);
  const active = (domains['hydra:member'] || []).find((d) => d.isActive) || (domains['hydra:member'] || [])[0];
  if (!active) throw new Error('mail.tm: no domains available');
  const address = `obfinity-${randomSuffix()}@${active.domain}`;
  const password = `Tm${randomSuffix(12)}!`;
  await fetchJson(fetchFn, `${MAILTM_BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password }),
  });
  const tokenRes = await fetchJson(fetchFn, `${MAILTM_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password }),
  });
  if (!tokenRes.token) throw new Error('mail.tm: token request failed');
  return { provider: 'mail.tm', address, token: tokenRes.token };
}

async function mailtmListMessages(fetchFn, inbox) {
  const list = await fetchJson(fetchFn, `${MAILTM_BASE}/messages`, {
    headers: { Authorization: `Bearer ${inbox.token}` },
  });
  const members = list['hydra:member'] || [];
  const out = [];
  for (const m of members.slice(0, 10)) {
    let text = m.intro || '';
    try {
      const full = await fetchJson(fetchFn, `${MAILTM_BASE}/messages/${m.id}`, {
        headers: { Authorization: `Bearer ${inbox.token}` },
      });
      text = full.text || full.html || text;
    } catch { /* intro stands */ }
    out.push({ id: String(m.id), subject: m.subject || '', from: (m.from && m.from.address) || '', date: m.createdAt || '', text: String(text || '') });
  }
  return out;
}

// ---- GuerrillaMail ---------------------------------------------------------

async function guerrillaCreateInbox(fetchFn) {
  const res = await fetchJson(fetchFn, `${GUERRILLA_BASE}?f=get_email_address`);
  if (!res.email_addr || !res.sid_token) throw new Error('guerrillamail: no inbox issued');
  return { provider: 'guerrillamail', address: res.email_addr, token: res.sid_token };
}

async function guerrillaListMessages(fetchFn, inbox) {
  const res = await fetchJson(fetchFn, `${GUERRILLA_BASE}?f=check_email&sid_token=${encodeURIComponent(inbox.token)}&seq=0`);
  return (res.list || []).map((m) => ({
    id: String(m.mail_id),
    subject: m.mail_subject || '',
    from: m.mail_from || '',
    date: m.mail_date || '',
    text: String(m.mail_body || m.mail_excerpt || ''),
  }));
}

const PROVIDERS = {
  'mail.tm': { create: mailtmCreateInbox, list: mailtmListMessages },
  guerrillamail: { create: guerrillaCreateInbox, list: guerrillaListMessages },
};

/** Create an inbox, mail.tm first, GuerrillaMail fallback. fetchFn injected for tests. */
export async function createInboxPreferred(fetchFn = fetch) {
  const errors = [];
  for (const name of ['mail.tm', 'guerrillamail']) {
    try {
      return await PROVIDERS[name].create(fetchFn);
    } catch (err) {
      errors.push(`${name}: ${err.message || err}`);
    }
  }
  throw new Error(`temp-mail: all providers failed (${errors.join('; ')})`);
}

/** List messages of an inbox (provider dispatched). */
export async function listInboxMessages(inbox, fetchFn = fetch) {
  const provider = PROVIDERS[inbox.provider];
  if (!provider) throw new Error(`temp-mail: unknown provider ${inbox.provider}`);
  return provider.list(fetchFn, inbox);
}

// ---- Code extraction -------------------------------------------------------

const CODE_CONTEXT = /(code|verification|verify|otp|confirm|passcode)/i;
const CODE_RE = /\b\d{4,8}\b/g;

/**
 * Extract a verification code from a message body: prefer a 4–8 digit
 * sequence near a code keyword; else the first standalone 4–8 digit
 * sequence; else null. Returns the code string ONLY — never the body.
 */
export function extractVerificationCode(text) {
  const body = String(text || '');
  if (!body) return null;
  const candidates = [...body.matchAll(CODE_RE)].map((m) => ({ code: m[0], at: m.index }));
  if (!candidates.length) return null;
  for (const c of candidates) {
    const window = body.slice(Math.max(0, c.at - 40), c.at + c.code.length + 10);
    if (CODE_CONTEXT.test(window)) return c.code;
  }
  return candidates[0].code;
}

/**
 * Poll an inbox for a verification code. sleep injected (tests pass a
 * no-op; production passes the loop's sleep). Never loops forever:
 * maxPolls bounds it, and a timeout is a reportable blocker, not a
 * reason to keep polling.
 */
export async function pollForCode(inbox, { maxPolls = 8, intervalMs = 15000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), fetchFn = fetch } = {}) {
  let polls = 0;
  let lastError = null;
  while (polls < maxPolls) {
    polls++;
    try {
      const messages = await listInboxMessages(inbox, fetchFn);
      for (const m of messages) {
        const code = extractVerificationCode(m.text);
        if (code) return { ok: true, code, subject: m.subject, from: m.from, polls };
      }
    } catch (err) {
      lastError = err.message || String(err);
    }
    if (polls < maxPolls) await sleep(intervalMs);
  }
  return { ok: false, reason: lastError ? `provider_error: ${lastError}` : 'timeout', polls };
}
