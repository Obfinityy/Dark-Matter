// Dark Matter rule-based scanner — deterministic orchestrator.
// paste link → scope check → recon/fingerprint → probe battery →
// Nuclei → differential verification → confirmed findings.
// No LLM, no API keys, no prompts. Same target + same code = same result.
import { authorizeTarget } from './target.js';
import { fingerprint } from './fingerprint.js';
import { crawl } from './crawl.js';
import { probeHeaders } from './probes/headers.js';
import { probeSqliError } from './probes/sqliError.js';
import { probeXssReflected } from './probes/xss.js';
import { probeCmdiTime } from './probes/cmdi.js';
import { probeTraversal } from './probes/traversal.js';
import { probeSsti } from './probes/ssti.js';
import { probeOpenRedirect } from './probes/redirect.js';
import { probeCsrf } from './probes/csrf.js';
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

  // Candidate inputs: crawled params + the target URL's own query params.
  const params = [
    ...new Set([...(crawled ? crawled.params : []), ...new URL(url).searchParams.keys()]),
  ];
  const forms = crawled ? crawled.forms : [];

  await step('headers', () => (fp ? probeHeaders({ url, headers: fp.headers }) : []));
  await step('sqli-error', () => probeSqliError(url, params, opts));
  await step('xss', () => probeXssReflected(url, params, opts));
  await step('cmdi', () => probeCmdiTime(url, params, opts));
  await step('traversal', () => probeTraversal(url, params, opts));
  await step('ssti', () => probeSsti(url, params, opts));
  await step('redirect', () => probeOpenRedirect(url, params, opts));
  await step('csrf', () => probeCsrf(forms, url));
  await step('files', () => probeSensitiveFiles(url, opts));
  await step('xxe', () => probeXxe(url, opts));
  await step('ssrf', () => probeSsrf(url, params, opts));
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
