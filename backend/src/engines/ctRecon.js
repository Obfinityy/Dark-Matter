/**
 * ctRecon.js — Certificate Transparency reconnaissance engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capabilities built on Certificate Transparency (CT)
 * logs. Covers idea-bank items 00001–00008:
 *
 *  00001 Certificate-transparency substring watch
 *  00002 Precertificate SCT timestamp mining
 *  00003 CT dev-prefix rotation tracking
 *  00004 Typosquat brand-pair generation
 *  00005 Certificate SAN overlap clustering
 *  00006 Wildcard-certificate parent probing
 *  00007 Expired-cert host resurrection list
 *  00008 CT log issuer anomaly flagging
 *
 * All functions are pure and side-effect free: they parse and analyze CT data
 * structures (crt.sh rows, certstream messages, or plain objects). Network
 * fetching of CT logs is intentionally left to the caller so the engine stays
 * testable and safe to run anywhere.
 */

const MS_PER_DAY = 86400000;

/** SLA for auto-queuing freshly-issued hosts for takeover checks (idea 00001). */
export const TAKEOVER_QUEUE_SLA_MS = 60000;

const AFFIX_PREFIXES = [
  'dev', 'test', 'stage', 'staging', 'prod', 'preprod', 'qa', 'uat',
  'internal', 'corp', 'beta', 'demo', 'new', 'old', 'backup', 'api',
  'app', 'web', 'mail', 'vpn', 'sso', 'admin', 'sandbox', 'canary',
];
const AFFIX_SUFFIXES = ['dev', 'test', 'staging', 'prod', 'api', 'app', 'internal', 'backup'];

const COLOR_PALETTE = [
  'blue', 'green', 'red', 'yellow', 'orange', 'purple', 'black', 'white', 'gray',
];

const KEYBOARD_ADJACENCY = {
  a: ['q', 'w', 's', 'z'], b: ['v', 'g', 'h', 'n'], c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'], e: ['w', 'r', 'd', 's'],
  f: ['d', 'r', 't', 'g', 'v', 'c'], g: ['f', 't', 'y', 'h', 'b', 'v'],
  h: ['g', 'y', 'u', 'j', 'n', 'b'], i: ['u', 'o', 'k', 'j'],
  j: ['h', 'u', 'i', 'k', 'n', 'm'], k: ['j', 'i', 'o', 'l', 'm'],
  l: ['k', 'o', 'p'], m: ['n', 'j', 'k'], n: ['b', 'h', 'j', 'm'],
  o: ['i', 'p', 'l', 'k'], p: ['o', 'l'], q: ['w', 'a'],
  r: ['e', 't', 'f', 'd'], s: ['a', 'w', 'e', 'd', 'x', 'z'],
  t: ['r', 'y', 'g', 'f'], u: ['y', 'i', 'h', 'j'], v: ['c', 'f', 'g', 'b'],
  w: ['q', 'e', 'a', 's'], x: ['z', 's', 'd', 'c'], y: ['t', 'u', 'g', 'h'],
  z: ['a', 's', 'x'],
};

/** Common homoglyph (look-alike) substitutions used by squatters. */
const HOMOGLYPHS = {
  a: ['\u0430'], b: ['\u0185'], c: ['\u0441'], d: ['\u0501'], e: ['\u0435'],
  g: ['\u0261'], h: ['\u04BB'], i: ['\u0456', '\u0131'], j: ['\u03F3'],
  k: ['\u03BA'], l: ['\u04CF'], m: ['\u043C'], n: ['\u0578'], o: ['\u043E'],
  p: ['\u0440'], q: ['\u051B'], r: ['\u0433'], s: ['\u0455'], t: ['\u0442'],
  u: ['\u057D'], v: ['\u0475'], w: ['\u051D'], x: ['\u0445'], y: ['\u0443'],
  z: ['\u1D22'], 0: ['\u043E'], 1: ['\u04CF', 'l'], 5: ['\u0455'],
};

const COMMON_PROBE_LABELS = [
  'www', 'api', 'app', 'admin', 'dev', 'test', 'staging', 'stage', 'prod',
  'beta', 'demo', 'internal', 'portal', 'dashboard', 'console', 'auth',
  'login', 'sso', 'vpn', 'mail', 'cdn', 'static', 'assets', 'docs',
  'support', 'status', 'monitor', 'grafana', 'kibana', 'jenkins', 'git',
  'jira', 'wiki', 'db', 'cache', 'queue', 'worker', 'cron', 'backup',
  'legacy', 'old', 'new', 'v1', 'v2', 'mobile', 'm', 'shop', 'pay',
  'billing', 'webhook', 'hooks', 'events', 'logs', 'metrics', 'tracing',
  'search', 'cdn2', 'origin', 'edge', 'lb', 'gateway', 'proxy',
];

/**
 * Canonical CT entry shape used by every function in this engine.
 * @typedef {object} CtEntry
 * @property {string|number} id
 * @property {string} cn
 * @property {string[]} sans
 * @property {string} issuer
 * @property {number} notBefore  epoch ms
 * @property {number} notAfter   epoch ms
 * @property {boolean} isPrecert
 * @property {number} loggedAt   epoch ms
 */

/**
 * Normalize a raw CT record (crt.sh JSON row, certstream message, or plain
 * object) into the canonical CtEntry shape.
 * @param {object} raw
 * @returns {CtEntry|null}
 */
export function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // certstream envelope: { message_type, data: { leaf_cert: {...} } }
  const leaf = raw?.data?.leaf_cert || raw?.leaf_cert;
  const source = leaf && typeof leaf === 'object' ? raw.data || raw : raw;

  const id = raw.id ?? raw.cert_index ?? leaf?.serial_number ?? null;
  const cn =
    raw.common_name ||
    leaf?.subject?.CN ||
    raw.cn ||
    '';
  const rawNames =
    raw.name_value ||
    leaf?.all_domains ||
    raw.sans ||
    raw.domains ||
    (cn ? [cn] : []);
  const sans = [
    ...new Set(
      String(rawNames)
        .split(/[\n,]/)
        .map((s) => s.trim().toLowerCase().replace(/\.$/, ''))
        .filter(Boolean)
    ),
  ];
  const issuer =
    raw.issuer_name ||
    raw.issuer?.name ||
    leaf?.issuer?.O ||
    raw.issuer ||
    '';
  const notBefore = Date.parse(
    raw.not_before ?? leaf?.not_before ?? raw.notBefore ?? ''
  );
  const notAfter = Date.parse(
    raw.not_after ?? leaf?.not_after ?? raw.notAfter ?? ''
  );
  const loggedAt = Date.parse(
    raw.entry_timestamp ?? raw.loggedAt ?? raw.seen_at ?? ''
  );
  const isPrecert =
    Boolean(raw.isPrecert) ||
    raw.message_type === 'precertificate_update' ||
    /precert/i.test(String(raw.entry_type || ''));

  if (sans.length === 0 && !cn) return null;
  return {
    id,
    cn: String(cn).toLowerCase(),
    sans,
    issuer: String(issuer),
    notBefore: Number.isNaN(notBefore) ? 0 : notBefore,
    notAfter: Number.isNaN(notAfter) ? 0 : notAfter,
    isPrecert,
    loggedAt: Number.isNaN(loggedAt) ? 0 : loggedAt,
  };
}

/**
 * Normalize many raw records at once, dropping unparseable rows.
 * @param {object[]} raws
 * @returns {CtEntry[]}
 */
export function normalizeEntries(raws) {
  if (!Array.isArray(raws)) return [];
  return raws.map(normalizeEntry).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Idea 00001 — Certificate-transparency substring watch
// ---------------------------------------------------------------------------

/**
 * Extract the registrable brand label from a brand string or domain
 * ("Acme Corp" -> "acmecorp", "login.acme.com" -> "acme").
 * @param {string} brand
 * @returns {string}
 */
export function brandLabel(brand) {
  if (!brand) return '';
  let s = String(brand).toLowerCase().trim();
  s = s.replace(/^(https?:\/\/)?(www\.)?/, '').split(/[/:?#]/)[0];
  const labels = s.split('.').filter(Boolean);
  // Heuristic: drop a trailing TLD-ish label; keep the meaningful part.
  if (labels.length > 1 && labels[labels.length - 1].length <= 4) labels.pop();
  const core = labels.length > 1 ? labels[labels.length - 1] : labels[0] || '';
  return core.replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
}

/**
 * Build the substring watch list for a brand: the brand itself, common
 * dev/staging/affix permutations, and typosquat variants (idea 00004).
 * @param {string} brand
 * @param {{maxTyposquats?: number}} [options]
 * @returns {string[]} deduplicated lowercase watch terms
 */
export function buildWatchTerms(brand, options = {}) {
  const label = brandLabel(brand);
  if (!label) return [];
  const terms = new Set([label]);
  for (const p of AFFIX_PREFIXES) {
    terms.add(`${p}${label}`);
    terms.add(`${p}-${label}`);
  }
  for (const s of AFFIX_SUFFIXES) {
    terms.add(`${label}${s}`);
    terms.add(`${label}-${s}`);
  }
  const maxTyposquats = options.maxTyposquats ?? 120;
  for (const v of typosquatVariants(label)) {
    if (terms.size >= maxTyposquats + AFFIX_PREFIXES.length * 2 + AFFIX_SUFFIXES.length * 2 + 1) break;
    terms.add(v.variant);
  }
  return [...terms];
}

/**
 * Check a normalized CT entry against watch terms; returns matched SANs.
 * @param {CtEntry} entry
 * @param {string[]} terms lowercase watch terms
 * @returns {{entry: CtEntry, matchedNames: {name: string, term: string}[]}}
 */
export function matchCertEntry(entry, terms) {
  const matchedNames = [];
  if (!entry || !Array.isArray(terms) || terms.length === 0) {
    return { entry, matchedNames };
  }
  const lowerTerms = terms.map((t) => String(t).toLowerCase());
  const names = new Set([...(entry.sans || []), entry.cn].filter(Boolean));
  for (const name of names) {
    const bare = name.startsWith('*.') ? name.slice(2) : name;
    for (const term of lowerTerms) {
      if (bare.includes(term)) {
        matchedNames.push({ name, term });
        break;
      }
    }
  }
  return { entry, matchedNames };
}

/**
 * Add a fresh host to the takeover-check queue (dedupes by host, keeps the
 * earliest sighting so the 60s SLA is measured from first issuance).
 * @param {object[]} queue
 * @param {{host: string, issuer?: string, seenAt?: number}} hit
 * @returns {object[]} new queue
 */
export function enqueueWatchHit(queue, hit) {
  const q = Array.isArray(queue) ? [...queue] : [];
  const host = String(hit?.host || '').toLowerCase();
  if (!host) return q;
  const existing = q.find((h) => h.host === host);
  if (existing) {
    existing.seenAt = Math.min(existing.seenAt, hit.seenAt || Date.now());
    return q;
  }
  q.push({
    host,
    issuer: hit.issuer || '',
    seenAt: hit.seenAt || Date.now(),
    checked: false,
  });
  return q;
}

/**
 * Mark a queued host as takeover-checked.
 * @param {object[]} queue
 * @param {string} host
 * @returns {object[]} new queue
 */
export function markWatchHitChecked(queue, host) {
  const q = Array.isArray(queue) ? [...queue] : [];
  const item = q.find((h) => h.host === String(host).toLowerCase());
  if (item) item.checked = true;
  return q;
}

/**
 * Hosts still inside the SLA window (eligible for immediate takeover probing).
 * @param {object[]} queue
 * @param {number} [nowMs]
 * @param {number} [slaMs]
 * @returns {object[]}
 */
export function dueWatchHits(queue, nowMs = Date.now(), slaMs = TAKEOVER_QUEUE_SLA_MS) {
  if (!Array.isArray(queue)) return [];
  return queue.filter((h) => !h.checked && nowMs - h.seenAt <= slaMs);
}

/**
 * Queued hosts whose 60-second auto-queue SLA has been breached.
 * @param {object[]} queue
 * @param {number} [nowMs]
 * @param {number} [slaMs]
 * @returns {object[]}
 */
export function slaBreachedHits(queue, nowMs = Date.now(), slaMs = TAKEOVER_QUEUE_SLA_MS) {
  if (!Array.isArray(queue)) return [];
  return queue.filter((h) => !h.checked && nowMs - h.seenAt > slaMs);
}

// ---------------------------------------------------------------------------
// Idea 00002 — Precertificate SCT timestamp mining
// ---------------------------------------------------------------------------

/**
 * Mine precertificate SCT timestamps to find hosts that existed minutes to
 * hours before their final certificate went live. A precert with no matching
 * leaf cert inside `leafWindowMs` is a pre-launch window worth probing.
 * @param {CtEntry[]} entries
 * @param {number} [leafWindowMs] how long after the precert we expect the leaf
 * @returns {{host: string, precertAt: number, leafAt: number|null, leadMs: number|null, certId: string|number}[]}
 */
export function findPrelaunchWindows(entries, leafWindowMs = 4 * 3600000) {
  if (!Array.isArray(entries)) return [];
  const byHost = new Map();
  for (const e of entries) {
    if (!e || e.loggedAt <= 0) continue;
    for (const rawName of e.sans || []) {
      const name = rawName.startsWith('*.') ? rawName.slice(2) : rawName;
      if (!byHost.has(name)) byHost.set(name, { precerts: [], leaves: [] });
      const bucket = byHost.get(name);
      (e.isPrecert ? bucket.precerts : bucket.leaves).push(e);
    }
  }
  const windows = [];
  for (const [host, bucket] of byHost) {
    if (bucket.precerts.length === 0) continue;
    bucket.precerts.sort((a, b) => a.loggedAt - b.loggedAt);
    bucket.leaves.sort((a, b) => a.loggedAt - b.loggedAt);
    for (const pre of bucket.precerts) {
      const leaf = bucket.leaves.find(
        (l) => l.loggedAt >= pre.loggedAt && l.loggedAt - pre.loggedAt <= leafWindowMs
      );
      windows.push({
        host,
        precertAt: pre.loggedAt,
        leafAt: leaf ? leaf.loggedAt : null,
        leadMs: leaf ? leaf.loggedAt - pre.loggedAt : null,
        certId: pre.id,
      });
    }
  }
  return windows.sort((a, b) => b.precertAt - a.precertAt);
}

// ---------------------------------------------------------------------------
// Idea 00003 — CT dev-prefix rotation tracking
// ---------------------------------------------------------------------------

/**
 * Detect environment-rotation naming series (dev1/dev2, staging-blue/green,
 * api-v3/v4) across observed hostnames.
 * @param {string[]} hosts
 * @returns {{kind: 'numeric'|'color'|'alpha', parent: string, prefix: string, items: {label: string, value: number|string, host: string}[]}[]}
 */
export function extractRotationSeries(hosts) {
  const groups = new Map();
  const colorRe = new RegExp(`^(.*?)[-_]?(${COLOR_PALETTE.join('|')})$`, 'i');
  for (const raw of hosts || []) {
    const host = String(raw).toLowerCase().replace(/\.$/, '');
    const labels = host.split('.');
    if (labels.length < 2) continue;
    const left = labels[0];
    const parent = labels.slice(1).join('.');
    let kind = null;
    let prefix = '';
    let value = null;
    let m = left.match(/^(.*?)[-_]?(\d{1,3})$/);
    if (m && m[1].length > 0) {
      kind = 'numeric';
      prefix = m[1];
      value = parseInt(m[2], 10);
    } else if ((m = left.match(colorRe)) && m[1].length > 0) {
      kind = 'color';
      prefix = m[1].toLowerCase();
      value = m[2].toLowerCase();
    } else if ((m = left.match(/^(.*?)[-_]([a-z])$/)) && m[1].length > 0) {
      kind = 'alpha';
      prefix = m[1];
      value = m[2];
    }
    if (!kind) continue;
    const key = `${parent}|${kind}|${prefix}`;
    if (!groups.has(key)) {
      groups.set(key, { kind, parent, prefix, items: [] });
    }
    const g = groups.get(key);
    if (!g.items.some((it) => it.label === left)) {
      g.items.push({ label: left, value, host });
    }
  }
  const series = [...groups.values()].filter((g) => g.items.length >= 2);
  for (const g of series) {
    g.items.sort((a, b) =>
      g.kind === 'numeric' ? a.value - b.value : String(a.value).localeCompare(String(b.value))
    );
  }
  return series;
}

/**
 * Predict the next rotation slot for a detected series so the hunter can
 * pre-enumerate future environments (idea 00003).
 * @param {{kind: string, parent: string, prefix: string, items: object[]}} series
 * @returns {{predicted: string[], basis: string}}
 */
export function predictNextRotation(series) {
  if (!series || !Array.isArray(series.items) || series.items.length === 0) {
    return { predicted: [], basis: 'no data' };
  }
  const { kind, parent, prefix, items } = series;
  if (kind === 'numeric') {
    const max = Math.max(...items.map((i) => i.value));
    return {
      predicted: [`${prefix}${max + 1}.${parent}`, `${prefix}${max + 2}.${parent}`],
      basis: `numeric rotation, max observed ${max}`,
    };
  }
  if (kind === 'color') {
    const seen = items.map((i) => String(i.value).toLowerCase());
    const lastIdx = COLOR_PALETTE.indexOf(seen[seen.length - 1]);
    const unseen = COLOR_PALETTE.filter((c) => !seen.includes(c));
    const next = COLOR_PALETTE[(lastIdx + 1) % COLOR_PALETTE.length];
    const predicted = [`${prefix}-${next}.${parent}`];
    if (unseen.length > 0 && unseen[0] !== next) {
      predicted.push(`${prefix}-${unseen[0]}.${parent}`);
    }
    return { predicted, basis: `color rotation, last seen ${seen[seen.length - 1]}` };
  }
  if (kind === 'alpha') {
    const maxCode = Math.max(...items.map((i) => String(i.value).charCodeAt(0)));
    const next = String.fromCharCode(maxCode + 1);
    if (next > 'z') return { predicted: [], basis: 'alpha rotation exhausted' };
    return {
      predicted: [`${prefix}-${next}.${parent}`],
      basis: `alpha rotation, max observed ${String.fromCharCode(maxCode)}`,
    };
  }
  return { predicted: [], basis: 'unknown rotation kind' };
}

// ---------------------------------------------------------------------------
// Idea 00004 — Typosquat brand-pair generation
// ---------------------------------------------------------------------------

/**
 * True when two strings differ by at most one edit (insert/delete/substitute).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function withinEditDistanceOne(a, b) {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (la === lb) {
      i++;
      j++; // substitution
    } else if (la > lb) {
      i++; // deletion in a
    } else {
      j++; // insertion in a
    }
  }
  edits += la - i + (lb - j);
  return edits <= 1;
}

/**
 * Generate typosquat candidates for a brand label: keyboard-adjacent typos,
 * homoglyph substitutions, transpositions, doublings and deletions.
 * @param {string} brandLabelInput brand label (no TLD), e.g. "acme"
 * @param {{max?: number}} [options]
 * @returns {{variant: string, types: string[]}[]}
 */
export function typosquatVariants(brandLabelInput, options = {}) {
  const label = String(brandLabelInput || '').toLowerCase();
  const max = options.max ?? 500;
  /** @type {Map<string, Set<string>>} */
  const out = new Map();
  const add = (variant, type) => {
    if (!variant || variant === label || out.size >= max) return;
    if (!/^[a-z0-9-]+$/.test(variant)) return; // homoglyphs handled separately below
    if (!out.has(variant)) out.set(variant, new Set());
    out.get(variant).add(type);
  };

  const chars = [...label];
  // 1. keyboard-adjacent substitution
  chars.forEach((ch, i) => {
    for (const adj of KEYBOARD_ADJACENCY[ch] || []) {
      add(chars.slice(0, i).join('') + adj + chars.slice(i + 1).join(''), 'keyboard');
    }
  });
  // 2. deletion of one char
  chars.forEach((_, i) => {
    add(chars.slice(0, i).join('') + chars.slice(i + 1).join(''), 'deletion');
  });
  // 3. transposition of adjacent chars
  for (let i = 0; i < chars.length - 1; i++) {
    add(
      chars.slice(0, i).join('') + chars[i + 1] + chars[i] + chars.slice(i + 2).join(''),
      'transposition'
    );
  }
  // 4. doubling of one char
  chars.forEach((ch, i) => {
    add(chars.slice(0, i + 1).join('') + ch + chars.slice(i + 1).join(''), 'doubling');
  });
  // 5. keyboard-adjacent insertion
  chars.forEach((ch, i) => {
    for (const adj of KEYBOARD_ADJACENCY[ch] || []) {
      add(chars.slice(0, i + 1).join('') + adj + chars.slice(i + 1).join(''), 'insertion');
    }
  });
  // 6. common confusions: rn<->m, cl<->d, vv<->w
  const confusions = [
    [/rn/g, 'm', 'confusion'],
    [/m/g, 'rn', 'confusion'],
    [/cl/g, 'd', 'confusion'],
    [/vv/g, 'w', 'confusion'],
    [/w/g, 'vv', 'confusion'],
  ];
  for (const [re, rep, type] of confusions) {
    if (re.test(label)) add(label.replace(re, rep), type);
  }
  // 7. hyphen add/remove
  if (!label.includes('-')) {
    for (let i = 1; i < label.length; i++) {
      add(`${label.slice(0, i)}-${label.slice(i)}`, 'hyphen');
    }
  } else {
    add(label.replace(/-/g, ''), 'hyphen');
  }

  const ascii = [...out.entries()].map(([variant, types]) => ({
    variant,
    types: [...types],
  }));

  // 8. homoglyph variants (kept separate: non-ASCII, still real squat vectors)
  const homoglyph = [];
  chars.forEach((ch, i) => {
    for (const glyph of HOMOGLYPHS[ch] || []) {
      if (homoglyph.length >= 100) break;
      homoglyph.push({
        variant: chars.slice(0, i).join('') + glyph + chars.slice(i + 1).join(''),
        types: ['homoglyph'],
      });
    }
  });

  return [...ascii, ...homoglyph].slice(0, max);
}

/**
 * Flag domains from CT logs that mimic the target brand (idea 00004).
 * @param {string} brand
 * @param {string[]} domains candidate domains (e.g. SANs from CT entries)
 * @returns {{domain: string, matchType: string, evidence: string}[]}
 */
export function flagSquats(brand, domains) {
  const label = brandLabel(brand);
  if (!label || label.length < 3 || !Array.isArray(domains)) return [];
  const variantMap = new Map();
  for (const { variant, types } of typosquatVariants(label, { max: 800 })) {
    variantMap.set(variant, types);
  }
  const homoglyphSet = new Set(
    typosquatVariants(label, { max: 800 })
      .filter((v) => v.types.includes('homoglyph'))
      .map((v) => v.variant)
  );
  const flagged = [];
  const seen = new Set();
  for (const raw of domains) {
    const domain = String(raw || '').toLowerCase().replace(/\.$/, '');
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    const labels = domain.split('.');
    // Registrable-ish host: drop the TLD; keep everything left of it.
    const hostPart = labels.length > 1 ? labels.slice(0, -1).join('.') : domain;
    const candidates = [hostPart, ...labels.slice(0, -1)];
    for (const cand of candidates) {
      if (!cand || cand === label) continue;
      const plain = cand.normalize('NFKC');
      if (variantMap.has(plain)) {
        flagged.push({
          domain,
          matchType: variantMap.get(plain).join('+'),
          evidence: `matches generated typosquat variant "${plain}"`,
        });
        break;
      }
      if (homoglyphSet.has(cand) || /[^\x00-\x7F]/.test(cand)) {
        // Non-ASCII label near the brand is a homoglyph squat until proven otherwise.
        if (cand.normalize('NFKC') === label || withinEditDistanceOne(plain, label)) {
          flagged.push({
            domain,
            matchType: 'homoglyph',
            evidence: `non-ASCII label "${cand}" visually mimics "${label}"`,
          });
          break;
        }
      }
      if (plain.length >= 4 && withinEditDistanceOne(plain, label)) {
        flagged.push({
          domain,
          matchType: 'edit-distance-1',
          evidence: `"${plain}" is one edit away from "${label}"`,
        });
        break;
      }
    }
  }
  return flagged;
}

// ---------------------------------------------------------------------------
// Idea 00005 — Certificate SAN overlap clustering
// ---------------------------------------------------------------------------

/**
 * Cluster certificates whose SANs overlap the target on 2+ hosts, revealing
 * sibling infrastructure the target never advertises (idea 00005).
 * @param {CtEntry[]} entries
 * @param {string[]} targetHosts hosts known to belong to the target
 * @returns {{certIds: (string|number)[], sharedTargetHosts: string[], siblingHosts: string[], size: number}[]}
 */
export function clusterBySanOverlap(entries, targetHosts) {
  if (!Array.isArray(entries) || !Array.isArray(targetHosts)) return [];
  const targets = new Set(targetHosts.map((h) => String(h).toLowerCase()));
  const indexed = entries
    .map((e, i) => ({ e, idx: i }))
    .filter(({ e }) => e && Array.isArray(e.sans));

  // Candidate certs: share >= 2 hosts with the target.
  const candidates = indexed.filter(({ e }) => {
    const shared = e.sans.filter((s) => targets.has(s.toLowerCase()));
    return new Set(shared).size >= 2;
  });
  if (candidates.length === 0) return [];

  // Union-find: merge certs sharing any 2+ SANs with each other.
  const parent = new Map(candidates.map(({ idx }) => [idx, idx]));
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => parent.set(find(a), find(b));
  const sanSets = new Map(
    candidates.map(({ e, idx }) => [idx, new Set(e.sans.map((s) => s.toLowerCase()))])
  );
  for (let a = 0; a < candidates.length; a++) {
    for (let b = a + 1; b < candidates.length; b++) {
      const ia = candidates[a].idx;
      const ib = candidates[b].idx;
      const sa = sanSets.get(ia);
      let overlap = 0;
      for (const s of sanSets.get(ib)) {
        if (sa.has(s) && ++overlap >= 2) break;
      }
      if (overlap >= 2) union(ia, ib);
    }
  }
  const clusters = new Map();
  for (const { e, idx } of candidates) {
    const root = find(idx);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(e);
  }
  return [...clusters.values()]
    .map((certs) => {
      const allSans = new Set();
      for (const c of certs) for (const s of c.sans) allSans.add(s.toLowerCase());
      const sharedTargetHosts = [...allSans].filter((s) => targets.has(s));
      const siblingHosts = [...allSans].filter((s) => !targets.has(s) && !s.startsWith('*.'));
      return {
        certIds: certs.map((c) => c.id),
        sharedTargetHosts,
        siblingHosts,
        size: certs.length,
      };
    })
    .sort((a, b) => b.siblingHosts.length - a.siblingHosts.length || b.size - a.size);
}

// ---------------------------------------------------------------------------
// Idea 00006 — Wildcard-certificate parent probing
// ---------------------------------------------------------------------------

/**
 * When a wildcard cert (*.example.com) appears, generate probe candidates
 * from common labels plus wordlist-derived names to enumerate the wildcard's
 * actual coverage (idea 00006).
 * @param {CtEntry[]} entries
 * @param {string[]} [wordlist] extra labels to try
 * @returns {{base: string, wildcard: string, candidates: string[], certIds: (string|number)[]}[]}
 */
export function expandWildcardProbes(entries, wordlist = []) {
  if (!Array.isArray(entries)) return [];
  const words = [...new Set([...COMMON_PROBE_LABELS, ...(wordlist || []).map(String)])]
    .map((w) => w.toLowerCase().trim())
    .filter(Boolean);
  const byBase = new Map();
  for (const e of entries || []) {
    if (!e || !Array.isArray(e.sans)) continue;
    for (const san of e.sans) {
      if (!san.startsWith('*.')) continue;
      const base = san.slice(2);
      if (!base || base.includes('*')) continue;
      if (!byBase.has(base)) byBase.set(base, { wildcard: san, certIds: new Set() });
      byBase.get(base).certIds.add(e.id);
    }
  }
  return [...byBase.entries()].map(([base, info]) => {
    const candidates = new Set();
    for (const w of words) {
      candidates.add(`${w}.${base}`);
      if (w.length <= 8) {
        candidates.add(`api-${w}.${base}`);
        candidates.add(`${w}-api.${base}`);
      }
    }
    return {
      base,
      wildcard: info.wildcard,
      candidates: [...candidates],
      certIds: [...info.certIds],
    };
  });
}

// ---------------------------------------------------------------------------
// Idea 00007 — Expired-cert host resurrection list
// ---------------------------------------------------------------------------

/**
 * Collect hosts from expired certificates: expired certs often mark forgotten
 * assets that still respond (idea 00007).
 * @param {CtEntry[]} entries
 * @param {number} [nowMs]
 * @returns {{host: string, expiredAt: number, daysExpired: number, issuer: string, certId: string|number}[]}
 */
export function buildResurrectionList(entries, nowMs = Date.now()) {
  if (!Array.isArray(entries)) return [];
  const byHost = new Map();
  for (const e of entries) {
    if (!e || !(e.notAfter > 0) || e.notAfter >= nowMs) continue;
    for (const rawName of e.sans || []) {
      if (rawName.startsWith('*.')) continue;
      const host = rawName.toLowerCase();
      const prev = byHost.get(host);
      if (!prev || e.notAfter > prev.expiredAt) {
        byHost.set(host, {
          host,
          expiredAt: e.notAfter,
          issuer: e.issuer || '',
          certId: e.id,
        });
      }
    }
  }
  return [...byHost.values()]
    .map((r) => ({ ...r, daysExpired: Math.floor((nowMs - r.expiredAt) / MS_PER_DAY) }))
    .sort((a, b) => b.expiredAt - a.expiredAt);
}

// ---------------------------------------------------------------------------
// Idea 00008 — CT log issuer anomaly flagging
// ---------------------------------------------------------------------------

/**
 * Flag certificates issued by unexpected CAs, ACME issuance on unusual
 * schedules, and issuance bursts — rogue issuance often reveals attacker or
 * devops side-infrastructure (idea 00008).
 * @param {CtEntry[]} entries
 * @param {{expectedIssuers?: string[], acmeIssuers?: RegExp[], baselineHours?: number[], burstThreshold?: number, burstWindowMs?: number}} [options]
 * @returns {{certId: string|number, host: string, issuer: string, flags: string[], detail: string}[]}
 */
export function flagIssuerAnomalies(entries, options = {}) {
  if (!Array.isArray(entries)) return [];
  const {
    expectedIssuers = [],
    acmeIssuers = [/let'?s encrypt/i, /zerossl/i, /buypass/i, /google trust services/i],
    baselineHours = null,
    burstThreshold = 5,
    burstWindowMs = 3600000,
  } = options;
  const expected = expectedIssuers.map((s) => String(s).toLowerCase());
  const isAcme = (issuer) => acmeIssuers.some((re) => re.test(issuer || ''));
  const results = [];

  // Burst detection: many certs from one issuer inside a short window.
  const byIssuer = new Map();
  for (const e of entries) {
    if (!e) continue;
    const key = (e.issuer || 'unknown').toLowerCase();
    if (!byIssuer.has(key)) byIssuer.set(key, []);
    byIssuer.get(key).push(e);
  }
  const burstIds = new Set();
  for (const list of byIssuer.values()) {
    const times = list
      .filter((e) => e.loggedAt > 0 || e.notBefore > 0)
      .map((e) => ({ t: e.loggedAt > 0 ? e.loggedAt : e.notBefore, e }))
      .sort((a, b) => a.t - b.t);
    for (let i = 0; i < times.length; i++) {
      let count = 0;
      for (let j = i; j < times.length && times[j].t - times[i].t <= burstWindowMs; j++) {
        count++;
      }
      if (count >= burstThreshold) {
        for (let j = i; j < times.length && times[j].t - times[i].t <= burstWindowMs; j++) {
          burstIds.add(times[j].e);
        }
      }
    }
  }

  for (const e of entries) {
    if (!e) continue;
    const flags = [];
    const detail = [];
    const issuer = e.issuer || '';
    if (expected.length > 0 && !expected.some((exp) => issuer.toLowerCase().includes(exp))) {
      flags.push('unexpected-issuer');
      detail.push(`issuer "${issuer}" not in expected list`);
    }
    if (isAcme(issuer) && Array.isArray(baselineHours) && e.notBefore > 0) {
      const hour = new Date(e.notBefore).getUTCHours();
      if (!baselineHours.includes(hour)) {
        flags.push('off-schedule-acme');
        detail.push(`ACME issuance at ${String(hour).padStart(2, '0')}:00 UTC, outside baseline hours`);
      }
    }
    if (burstIds.has(e)) {
      flags.push('issuance-burst');
      detail.push(`part of a burst of ${burstThreshold}+ certs from one issuer within ${burstWindowMs / 60000} min`);
    }
    if (flags.length > 0) {
      results.push({
        certId: e.id,
        host: (e.sans || [])[0] || e.cn || '',
        issuer,
        flags,
        detail: detail.join('; '),
      });
    }
  }
  return results;
}

export const CT_RECON = {
  TAKEOVER_QUEUE_SLA_MS,
  normalizeEntry,
  normalizeEntries,
  brandLabel,
  buildWatchTerms,
  matchCertEntry,
  enqueueWatchHit,
  markWatchHitChecked,
  dueWatchHits,
  slaBreachedHits,
  findPrelaunchWindows,
  extractRotationSeries,
  predictNextRotation,
  withinEditDistanceOne,
  typosquatVariants,
  flagSquats,
  clusterBySanOverlap,
  expandWildcardProbes,
  buildResurrectionList,
  flagIssuerAnomalies,
};

export default CT_RECON;
