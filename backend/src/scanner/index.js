// Dark Matter rule-based scanner — deterministic orchestrator.
// paste link → scope check → recon/fingerprint → probe battery →
// Nuclei → differential verification → confirmed findings.
// No LLM, no API keys, no prompts. Same target + same code = same result.
import { authorizeTarget } from './target.js';
import { randomBytes } from 'node:crypto';
import { fingerprint, fetchPage } from './fingerprint.js';
import { crawl, extractParams, extractForms } from './crawl.js';
import { probeHeaders } from './probes/headers.js';
import { probeSqliError } from './probes/sqliError.js';
import { probeXssReflected } from './probes/xss.js';
import { probeCmdiTime } from './probes/cmdi.js';
import { probeTraversal } from './probes/traversal.js';
import { probeSsti } from './probes/ssti.js';
import { probeOpenRedirect } from './probes/redirect.js';
import { probeCsrf } from './probes/csrf.js';
import { probePostForms } from './probes/postForms.js';
import { probeSensitiveFiles } from './probes/files.js';
import { probeXxe } from './probes/xxe.js';
import { probeSsrf } from './probes/ssrf.js';
import { probeIdorSurface } from './probes/idor.js';
import { runNuclei } from './nuclei.js';
import { verifyFindings } from './verifier.js';

const DEFAULT_PHASES = [
  'fingerprint',
  'crawl',
  'headers',
  'sqli-error',
  'xss',
  'cmdi',
  'traversal',
  'ssti',
  'redirect',
  'csrf',
  'post-forms',
  'files',
  'xxe',
  'ssrf',
  'idor',
  'nuclei',
];

export async function runScan(
  {
    target,
    scope = '',
    labTargets = '',
    phases = DEFAULT_PHASES,
    confirmedAuthorized = false,
  },
  opts = {}
) {
  const startedAt = new Date().toISOString();
  const { url, host } = authorizeTarget({
    target,
    scope,
    labTargets,
    confirmedAuthorized,
  });
  const all = [];
  const errors = [];
  let fp = null;
  let crawled = null;

  const step = async (name, fn) => {
    if (!phases.includes(name)) return;
    try {
      const r = await fn();
      if (Array.isArray(r)) all.push(...r);
      return r;
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
      return null;
    }
  };

  fp = await step('fingerprint', () => fingerprint(url, opts));
  crawled = await step('crawl', () => crawl(url, opts));

  // Scan targets: the target URL plus every discovered same-origin link
  // (capped). Param probes run per URL — this is what makes the battery
  // cover the whole site, not just the landing page.
  const maxUrls = opts.maxUrls || 10;
  const scanTargets = [];
  const seen = new Set();
  const pushTarget = (u) => {
    try {
      const norm = new URL(u).toString().split('#')[0];
      if (!seen.has(norm) && scanTargets.length < maxUrls) {
        seen.add(norm);
        scanTargets.push(norm);
      }
    } catch {
      // ignore malformed URLs
    }
  };
  pushTarget(url);
  for (const l of crawled ? crawled.links : []) pushTarget(l);
  const forms = crawled ? [...crawled.forms] : [];
  // Form-derived GET URLs get a separate allowance beyond maxUrls — they
  // carry known inputs and are the highest-value probe targets.
  const pushFormTarget = (u) => {
    try {
      const norm = new URL(u).toString().split('#')[0];
      if (!seen.has(norm) && scanTargets.length < maxUrls + 20) {
        seen.add(norm);
        scanTargets.push(norm);
      }
    } catch {
      // ignore malformed URLs
    }
  };

  // Forms also live on discovered pages, not just the landing page —
  // fetch every scan target (already capped by maxUrls) and merge forms.
  for (const u of scanTargets) {
    try {
      const p = await fetchPage(u, opts);
      for (const f of extractForms(p.body, p.url)) forms.push(f);
    } catch {
      // ignore per-page fetch failures
    }
  }

  // GET forms become URL targets so the param battery covers them.
  // SAFETY: fill each input with a UNIQUE value (never empty, never equal).
  // A state-changing GET form (e.g. DVWA's csrf password-change) triggers
  // when its submit param is set AND its inputs "match" — empty==empty or
  // identical fillers would fire it. Unique values keep every probe
  // read-only while still satisfying isset(submit) gates.
  const toFormUrl = (form) => {
    try {
      const u = new URL(form.action);
      let n = 0;
      for (const inp of form.inputs || []) {
        if (/^submit$/i.test(inp)) {
          if (!u.searchParams.has(inp)) u.searchParams.set(inp, '1');
        } else if (!u.searchParams.has(inp)) {
          u.searchParams.set(inp, `dmprobe${++n}_${randomBytes(2).toString('hex')}`);
        }
      }
      return u.toString();
    } catch {
      return null;
    }
  };
  for (const f of forms) {
    if (String(f.method || 'get').toLowerCase() === 'get') {
      const fu = toFormUrl(f);
      if (fu) pushFormTarget(fu);
    }
  }
  const postForms = forms.filter(
    (f) => String(f.method || 'get').toLowerCase() === 'post'
  );

  await step('headers', () => (fp ? probeHeaders({ url, headers: fp.headers }) : []));
  for (const u of scanTargets) {
    const uparams = [...new Set(extractParams(u))];
    if (uparams.length === 0) continue;
    await step('sqli-error', () => probeSqliError(u, uparams, opts));
    await step('xss', () => probeXssReflected(u, uparams, opts));
    await step('cmdi', () => probeCmdiTime(u, uparams, opts));
    await step('traversal', () => probeTraversal(u, uparams, opts));
    await step('ssti', () => probeSsti(u, uparams, opts));
    await step('redirect', () => probeOpenRedirect(u, uparams, opts));
    await step('ssrf', () => probeSsrf(u, uparams, opts));
  }
  await step('csrf', () => probeCsrf(forms, url));
  await step('post-forms', () => probePostForms(postForms, opts));
  await step('files', () => probeSensitiveFiles(url, opts));
  await step('xxe', () => probeXxe(url, opts));
  await step('idor', () => probeIdorSurface(url));
  await step('nuclei', async () => (await runNuclei(url, opts)).findings);

  const { confirmed, unconfirmed } = verifyFindings(all);
  return {
    target: url,
    host,
    startedAt,
    finishedAt: new Date().toISOString(),
    fingerprint: fp
      ? { status: fp.status, server: fp.server, tech: fp.tech, dbHint: fp.dbHint }
      : null,
    pagesCrawled: crawled ? crawled.links.length : 0,
    findings: confirmed,
    unconfirmed,
    errors,
  };
}
