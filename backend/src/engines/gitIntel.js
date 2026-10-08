/**
 * gitIntel.js — Git/code-hosting hostname intelligence engine.
 *
 * Covers idea-bank items 00037-00040:
 *  - 00037 GitHub code-search hostname mining: find hardcoded API hosts,
 *    webhooks, and internal endpoints in public repo code mentioning the
 *    target's domain patterns.
 *  - 00038 GitLab snippet host extraction: mine public snippets and pastes for
 *    target hostnames leaked in debug dumps and config pastes.
 *  - 00039 Git commit-history host archaeology: scan full histories of org
 *    repos for hostnames that existed in old commits but were later removed,
 *    then flag them as forgotten assets worth probing.
 *  - 00040 GitHub Actions log hostname leaks: parse public CI logs for
 *    resolved hostnames, internal URLs, and artifact endpoints printed during
 *    builds.
 *
 * Pure functions only: callers fetch code-search results, snippets, commit
 * histories, and CI logs themselves (respecting the code-hosting providers'
 * rate limits) and pass the raw data in. No live HTTP here, and no secrets
 * are emitted — matched credential-shaped values are classified but their
 * values are never included in output.
 */

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;
const URL_IN_CODE_RE = /(https?:\/\/[^\s"'`<>()\[\]{};,]+)/gi;
const SCHEMED_HOST_RE = /^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/:?\s"'<>]+)/i;

/** Well-known public infrastructure hosts to exclude from CI-log noise. */
export const CI_NOISE_HOSTS = [
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'raw.githubusercontent.com',
  'registry.npmjs.org',
  'pypi.org',
  'files.pythonhosted.org',
  'registry.yarnpkg.com',
  'rubygems.org',
  'maven.org',
  'repo1.maven.org',
  'dl.google.com',
  'storage.googleapis.com',
  'amazonaws.com',
  'docker.io',
  'registry-1.docker.io',
  'hub.docker.com',
  'deb.debian.org',
  'archive.ubuntu.com',
  'security.ubuntu.com',
  'alpine',
  'microsoft.com',
];

/**
 * Normalize a hostname: lowercase, strip trailing dot/port, drop userinfo.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/^[^@\s]+@/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Extract the hostname from a URL or bare host string.
 * @param {string} url
 * @returns {string}
 */
export function hostFromUrl(url) {
  if (!url) return '';
  const m = String(url).trim().match(SCHEMED_HOST_RE);
  return normalizeHostname(m ? m[1] : '');
}

/**
 * Classify a hostname found in code by naming/URL context.
 * @param {string} host
 * @param {string} [context] surrounding text (URL path, variable name, comment)
 * @returns {'webhook'|'api'|'internal'|'staging'|'artifact'|'other'}
 */
export function classifyCodeHost(host, context = '') {
  const h = normalizeHostname(host);
  const ctx = String(context || '').toLowerCase();
  if (/webhook|hook|callback|notify/.test(ctx) || /(^|[.-])hook([.-]|$)/.test(h)) return 'webhook';
  if (/(^|[.-])artifact([.-]|$)|\/artifacts?\//.test(h + ctx)) return 'artifact';
  if (
    /(^|[.-])internal([.-]|$)|(^|[.-])intranet([.-]|$)|(^|[.-])corp([.-]|$)|(^|[.-])vpn([.-]|$)/.test(
      h
    ) ||
    /internal|intranet|\.local|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\./.test(ctx)
  )
    return 'internal';
  if (
    /(^|[.-])(staging|stage|dev|development|test|qa|uat|preview|canary)([.-]|$)/.test(h) ||
    /staging|\bstage\b|\bdev\b/.test(ctx)
  )
    return 'staging';
  if (/(^|[.-])api([.-]|$)/.test(h) || /\/api[\/v]|\/graphql|\/rest\//.test(ctx)) return 'api';
  return 'other';
}

/**
 * Keep only hostnames related to the target root domain.
 * @param {string[]} hosts
 * @param {string} rootDomain
 * @returns {string[]}
 */
export function filterTargetHosts(hosts, rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const out = new Set();
  for (const raw of hosts || []) {
    const h = normalizeHostname(raw);
    if (!h || h === root) continue;
    if (h.endsWith(`.${root}`) || h.includes(root)) out.add(h);
  }
  return [...out];
}

/**
 * Mine a code blob (file content, diff, search hit) for target hostnames.
 * Returns hosts with classification and a short evidence snippet.
 *
 * @param {string} code raw code text
 * @param {string} rootDomain
 * @param {{maxEvidence?: number}} [options]
 * @returns {{host: string, kind: string, evidence: string}[]}
 */
export function extractHostnamesFromCode(code, rootDomain, options = {}) {
  const { maxEvidence = 120 } = options;
  const root = normalizeHostname(rootDomain);
  if (!code || !root) return [];
  const text = String(code);
  const byHost = new Map();

  const note = (host, context) => {
    const h = normalizeHostname(host);
    if (!h || h === root) return;
    if (!(h.endsWith(`.${root}`) || h.includes(root))) return;
    if (!byHost.has(h)) {
      byHost.set(h, { host: h, kind: classifyCodeHost(h, context), evidence: '' });
    }
    const entry = byHost.get(h);
    // Prefer evidence that carries the most context (longest, path-like).
    if (context && context.length > entry.evidence.length) {
      entry.evidence = context.length > maxEvidence ? context.slice(0, maxEvidence) + '…' : context;
      entry.kind = classifyCodeHost(h, context);
    }
  };

  for (const m of text.matchAll(URL_IN_CODE_RE)) {
    note(hostFromUrl(m[1]), m[1]);
  }
  // Bare hostname mentions (configs, comments, allowlists) not in URLs.
  for (const m of text.matchAll(HOSTNAME_RE)) {
    const lineStart = text.lastIndexOf('\n', m.index - 1) + 1;
    let lineEnd = text.indexOf('\n', m.index);
    if (lineEnd === -1) lineEnd = text.length;
    const context = text.slice(lineStart, lineEnd).replace(/\s+/g, ' ');
    note(m[0], context);
  }

  return [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Mine public GitLab snippets / pastes for target hostnames leaked in debug
 * dumps, config pastes, and error logs. Debug dumps get an extra 'debug'
 * classification hint via context.
 *
 * @param {{id?: string, title?: string, body: string, visibility?: string}[]} snippets
 * @param {string} rootDomain
 * @returns {{snippet: string, host: string, kind: string, evidence: string}[]}
 */
export function extractHostnamesFromSnippets(snippets = [], rootDomain) {
  const results = [];
  for (const snip of snippets || []) {
    const body = String(snip?.body || '');
    if (!body) continue;
    const label = String(snip?.id || snip?.title || 'snippet');
    const found = extractHostnamesFromCode(body, rootDomain);
    for (const f of found) {
      results.push({ snippet: label, host: f.host, kind: f.kind, evidence: f.evidence });
    }
  }
  return results.sort((a, b) => a.host.localeCompare(b.host) || a.snippet.localeCompare(b.snippet));
}

/**
 * Scan a repo's full commit history for hostnames that were introduced in old
 * commits and later removed — forgotten assets worth re-probing.
 *
 * @param {{
 *   sha: string,
 *   date: string,
 *   message?: string,
 *   changes?: {path: string, added?: string, removed?: string}[]
 * }[]} commits oldest-first or newest-first (function sorts by date)
 * @param {string} rootDomain
 * @returns {{
 *   hosts: {host: string, kind: string, firstSeen: string, lastSeen: string, status: 'active'|'removed', introducedIn: string, lastCommit: string}[],
 *   forgotten: {host: string, kind: string, firstSeen: string, lastSeen: string, introducedIn: string, removedAfter: string}[]
 * }}
 */
export function analyzeCommitHistory(commits = [], rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return { hosts: [], forgotten: [] };
  const sorted = [...(commits || [])].sort((a, b) =>
    String(a?.date || '') < String(b?.date || '') ? -1 : 1
  );

  const track = new Map(); // host -> { firstSeen, lastSeen, introducedIn, lastCommit, removed: bool }
  for (const commit of sorted) {
    const sha = String(commit?.sha || '').slice(0, 12);
    const date = String(commit?.date || '');
    for (const change of commit?.changes || []) {
      const added = extractHostnamesFromCode(String(change?.added || ''), rootDomain);
      const removed = extractHostnamesFromCode(String(change?.removed || ''), rootDomain);
      for (const f of added) {
        if (!track.has(f.host)) {
          track.set(f.host, {
            firstSeen: date,
            lastSeen: date,
            introducedIn: sha,
            lastCommit: sha,
            kind: f.kind,
            removed: false,
          });
        } else {
          const t = track.get(f.host);
          t.lastSeen = date;
          t.lastCommit = sha;
          t.removed = false; // re-introduced
        }
      }
      for (const f of removed) {
        if (track.has(f.host)) {
          track.get(f.host).removed = true;
          track.get(f.host).removedAfter = date;
        }
        // Host removed before we ever saw it added (history truncated): still track it.
        else {
          track.set(f.host, {
            firstSeen: '(pre-history)',
            lastSeen: date,
            introducedIn: '(pre-history)',
            lastCommit: sha,
            kind: f.kind,
            removed: true,
            removedAfter: date,
          });
        }
      }
    }
  }

  const hosts = [];
  const forgotten = [];
  for (const [host, t] of track) {
    const status = t.removed ? 'removed' : 'active';
    hosts.push({
      host,
      kind: t.kind,
      firstSeen: t.firstSeen,
      lastSeen: t.lastSeen,
      status,
      introducedIn: t.introducedIn,
      lastCommit: t.lastCommit,
    });
    if (t.removed) {
      forgotten.push({
        host,
        kind: t.kind,
        firstSeen: t.firstSeen,
        lastSeen: t.lastSeen,
        introducedIn: t.introducedIn,
        removedAfter: t.removedAfter || t.lastSeen,
      });
    }
  }
  hosts.sort((a, b) => a.host.localeCompare(b.host));
  forgotten.sort((a, b) => a.host.localeCompare(b.host));
  return { hosts, forgotten };
}

/**
 * Parse public CI (GitHub Actions) logs for leaked hostnames: internal URLs,
 * artifact endpoints, and resolved hosts printed during builds. Provider
 * infrastructure noise (registry.npmjs.org, pypi.org, ...) is excluded unless
 * explicitly requested.
 *
 * @param {string} logText raw CI log output
 * @param {string} rootDomain
 * @param {{excludeNoise?: boolean, extraNoise?: string[]}} [options]
 * @returns {{host: string, kind: string, source: 'url'|'hostname', occurrences: number, sampleLine: string}[]}
 */
export function parseCiLogs(logText, rootDomain, options = {}) {
  const { excludeNoise = true, extraNoise = [] } = options;
  const root = normalizeHostname(rootDomain);
  if (!logText || !root) return [];
  const text = String(logText);
  const noise = new Set([...CI_NOISE_HOSTS, ...extraNoise.map(normalizeHostname)]);
  const lines = text.split(/\r?\n/);
  const byHost = new Map();

  const note = (host, line, source) => {
    const h = normalizeHostname(host);
    if (!h) return;
    if (excludeNoise && (noise.has(h) || [...noise].some(n => h.endsWith(`.${n}`)))) return;
    if (!byHost.has(h)) {
      byHost.set(h, {
        host: h,
        kind: classifyCodeHost(h, line),
        source,
        occurrences: 0,
        sampleLine: '',
      });
    }
    const entry = byHost.get(h);
    entry.occurrences += 1;
    if (!entry.sampleLine) {
      const clean = line.replace(/\s+/g, ' ').trim();
      entry.sampleLine = clean.length > 160 ? clean.slice(0, 160) + '…' : clean;
    }
    const kind = classifyCodeHost(h, line);
    // Escalate classification: artifact/internal/webhook beats 'other'.
    if (entry.kind === 'other' && kind !== 'other') entry.kind = kind;
  };

  for (const line of lines) {
    for (const m of line.matchAll(URL_IN_CODE_RE)) {
      const host = hostFromUrl(m[1]);
      if (
        host &&
        (host.endsWith(`.${root}`) ||
          host.includes(root) ||
          /internal|staging|artifact|hook/.test(host + line.toLowerCase()))
      ) {
        note(host, line, 'url');
      } else if (host && !excludeNoise) {
        note(host, line, 'url');
      }
    }
    // Hostnames printed without scheme (e.g. "Resolved api.internal.example.com").
    for (const m of line.matchAll(HOSTNAME_RE)) {
      const host = normalizeHostname(m[0]);
      if (host.endsWith(`.${root}`) || host.includes(root)) {
        note(host, line, 'hostname');
      }
    }
  }

  return [...byHost.values()].sort(
    (a, b) => b.occurrences - a.occurrences || a.host.localeCompare(b.host)
  );
}
