// Dark Matter rule-based scanner — deterministic orchestrator.
// paste link → scope check → recon/fingerprint → probe battery →
// Nuclei → differential verification → confirmed findings.
// No LLM, no API keys, no prompts. Same target + same code = same result.
import { authorizeTarget } from './target.js';
import { fingerprint } from './fingerprint.js';
import { crawl } from './crawl.js';
import { probeHeaders } from './probes/headers.js';
import { probeSqliError } from './probes/sqliError.js';
import { runNuclei } from './nuclei.js';
import { verifyFindings } from './verifier.js';

const DEFAULT_PHASES = ['fingerprint', 'crawl', 'headers', 'sqli-error', 'nuclei'];

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
  await step('headers', () =>
    fp ? probeHeaders({ url, headers: fp.headers }) : []
  );
  await step('sqli-error', () => {
    const params = new Set([
      ...(crawled ? crawled.params : []),
      ...new URL(url).searchParams.keys(),
    ]);
    return probeSqliError(url, [...params], opts);
  });
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
