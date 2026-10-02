/**
 * Worker 4 (detect) verification suite — gap items B6-B11, C12-C18, G33, G34, H41.
 *
 * Proof strategy per coordinator bar:
 *   - canned-output parsing: nuclei / sqlmap / dalfox / cors / sslscan / subzy /
 *     naabu / nmap-xml / dnsx / katana / linkfinder / gau / wayback / wafw00f / whatweb
 *   - REAL passing tests: IDOR dual-account + API/Swagger fuzzing against own
 *     express fixtures on 127.0.0.1:4611 and :4562 (no external targets)
 *   - WAF-adaptive enforcement, policyValidator audit, permissionService,
 *     bad-tool-output recovery, and graceful degradation (binaries missing here)
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = (name) => fs.readFile(path.join(__dirname, 'fixtures/w4', name), 'utf8');

// ── modules under test ──────────────────────────────────────────────
import { loadWordlist, buildBruteCandidates, parseDnsxJsonLines, runDnsBrute, dnsxAvailable } from '../src/recon/dnsBrute.js';
import { parseNaabuJsonLines, parseNmapXml, buildTargetedNmapArgs, chainNaabuToNmap } from '../src/recon/portChain.js';
import { normalizeTech, planFromTech, parseWhatweb, GENERIC_PLAN } from '../src/recon/techPlan.js';
import { extractEndpointsFromKatana, extractEndpointsFromLinkfinder, buildJsEndpointTestPlan, jsEndpointLoop } from '../src/recon/jsEndpointLoop.js';
import { collectArchiveUrls, extractParamCandidates, prioritizeParams, buildParamTestPlan, paramLoop } from '../src/recon/paramLoop.js';
import { parseWafw00f, enforceOnRequest, WafAdaptiveState, STEALTH_PROFILES } from '../src/recon/wafAdaptive.js';
import { normalizeNuclei, normalizeSqlmap, normalizeDalfox, normalizeCorscanner, normalizeSslscan, normalizeSubzy, normalizeToolFindings } from '../src/tools/findingNormalizer.js';
import { matchTakeoverFingerprint, detectTakeovers, claimCheck } from '../src/recon/subdomainTakeover.js';
import { PermissionService } from '../src/services/permissionService.js';
import { PolicyValidator } from '../src/tools/policyValidator.js';
import { ToolExecutor, isGarbageResult, FALLBACK_TOOLS } from '../src/tools/executor.js';
import { ScanService } from '../src/services/scanService.js';
import { checkIdor } from '../src/recon/idorChecker.js';
import { discoverSwagger, enumerateApiPaths, fuzzApiParams, swaggerFuzzLoop } from '../src/recon/apiFuzzer.js';

// ═══════════════════════════════════════════════════════════════════
// B6 — Active DNS brute-force (+ graceful degradation, no dnsx binary)
// ═══════════════════════════════════════════════════════════════════
describe('B6 dnsBrute', () => {
  it('ships a usable wordlist (~200-500 entries)', async () => {
    const labels = await loadWordlist();
    assert.ok(labels.length >= 200 && labels.length <= 600, `wordlist has ${labels.length} entries`);
    for (const must of ['www', 'mail', 'api', 'admin', 'vpn', 'staging']) {
      assert.ok(labels.includes(must), `wordlist contains ${must}`);
    }
  });

  it('builds in-scope candidates only', async () => {
    const cands = await buildBruteCandidates('target.local', { max: 5 });
    assert.deepEqual(cands, ['www.target.local', 'mail.target.local', 'ftp.target.local', 'localhost.target.local', 'webmail.target.local']);
    assert.ok(cands.every((c) => c.endsWith('.target.local')));
  });

  it('rejects invalid hostnames', async () => {
    await assert.rejects(() => buildBruteCandidates('not a host!!'), /Invalid hostname/);
  });

  it('parses dnsx JSONL, skipping garbage lines', async () => {
    const raw = await FIX('dnsx.jsonl');
    const { records, count } = parseDnsxJsonLines(raw);
    assert.equal(count, 2);
    assert.equal(records[0].host, 'www.target.local');
    assert.deepEqual(records[0].a, ['93.184.216.34']);
    assert.deepEqual(records[1].mx, ['mail.target.local']);
  });

  it('degrades gracefully: dnsx binary is missing here, node-dns fallback runs', async () => {
    assert.equal(await dnsxAvailable(), false, 'dnsx must be missing in this env (proves degradation path)');
    const result = await runDnsBrute('nonexistent-w4-test.invalid', { max: 10, availability: { dnsx: false } });
    assert.equal(result.method, 'node-dns', 'fell back to pure-node DNS');
    assert.equal(result.degraded, true);
    assert.equal(result.candidates, 10);
    assert.ok(Array.isArray(result.records), 'records array present even with zero hits');
    // NOTE: this sandbox's DNS wildcard-resolves, so count is not asserted —
    // the proof is that the node-dns path RAN without the binary.
  });
});

// ═══════════════════════════════════════════════════════════════════
// B7 — naabu → nmap chaining (targeted, never full-range)
// ═══════════════════════════════════════════════════════════════════
describe('B7 portChain', () => {
  it('parses naabu JSONL, skipping malformed lines', async () => {
    const { ports, hosts } = parseNaabuJsonLines(await FIX('naabu.jsonl'));
    assert.deepEqual(ports.map((p) => p.port), [80, 443, 8080, 22]);
    assert.deepEqual(hosts, ['127.0.0.1']);
  });

  it('builds a TARGETED nmap arg list — explicit ports, no ranges', () => {
    const { args, ports } = buildTargetedNmapArgs([80, 443, 8080, 22]);
    assert.ok(args, 'args built');
    const pIdx = args.indexOf('-p');
    assert.ok(pIdx >= 0);
    assert.equal(args[pIdx + 1], '80,443,8080,22');
    assert.ok(!args.join(' ').includes('-p-'), 'never a full-range scan');
    assert.ok(args.includes('-sV') && args.includes('-sC'), 'service + default scripts');
    assert.ok(!args.some((a) => /-T[45]/.test(a)), 'no aggressive timing by default');
  });

  it('returns no-chain when naabu found nothing', () => {
    const { args, reason } = buildTargetedNmapArgs([]);
    assert.equal(args, null);
    assert.match(reason, /no open ports/);
  });

  it('chainNaabuToNmap produces an executor-ready request', async () => {
    const chain = chainNaabuToNmap(await FIX('naabu.jsonl'), { target: 'target.local' });
    assert.equal(chain.chained, true);
    assert.equal(chain.request.tool, 'nmap');
    assert.equal(chain.request.target, 'target.local');
    assert.ok(chain.request.arguments.args.includes('-p'));
    assert.match(chain.request.description, /chained from naabu/);
  });

  it('parses nmap -oX XML into service records (open only)', async () => {
    const { services, hosts } = parseNmapXml(await FIX('nmap.xml'));
    assert.deepEqual(hosts, ['127.0.0.1']);
    assert.equal(services.length, 3, 'only open ports (22 was closed)');
    const http = services.find((s) => s.port === 80);
    assert.equal(http.service, 'http');
    assert.equal(http.product, 'nginx');
    assert.equal(http.version, '1.24.0');
    assert.ok(services.every((s) => s.state === 'open'));
  });

  it('ScanService.planPortChain wires the chain into the scan lifecycle', async () => {
    const events = [];
    const scanService = new ScanService({
      scanModel: { getInternal: async () => null },
      targetModel: { getInternal: async () => null },
      eventService: { publish: async (id, ev) => events.push(ev) }
    });
    const chain = await scanService.planPortChain('scan1', await FIX('naabu.jsonl'));
    assert.equal(chain.chained, true);
    assert.deepEqual(chain.ports, [80, 443, 8080, 22]);
    assert.ok(events.some((e) => e.type === 'recon.port_chain.planned'));
    const parsed = scanService.parseChainedNmap(await FIX('nmap.xml'));
    assert.equal(parsed.services.length, 3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// B8 — tech-fingerprint-driven planning
// ═══════════════════════════════════════════════════════════════════
describe('B8 techPlan', () => {
  it('parses whatweb JSON into a tech list', async () => {
    const techs = parseWhatweb(await FIX('whatweb.json'));
    assert.ok(techs.some((t) => /wordpress/i.test(t)), `got ${techs}`);
    assert.ok(techs.some((t) => /php/i.test(t)));
    assert.ok(techs.some((t) => /apache/i.test(t)));
  });

  it('WordPress → nuclei (wp tags) first, nikto second', () => {
    const { plan, matchedTech, fallback } = planFromTech(['WordPress 6.4.1']);
    assert.equal(fallback, false);
    assert.ok(matchedTech.includes('WordPress'));
    assert.equal(plan[0].tool, 'nuclei');
    assert.ok(plan[0].args.join(' ').includes('wordpress'), 'wp template tags passed');
    assert.equal(plan[1].tool, 'nikto');
  });

  it('WordPress + PHP → nuclei still first, arjun before sqlmap', () => {
    const { plan } = planFromTech(['WordPress 6.4.1', 'PHP 8.1']);
    assert.equal(plan[0].tool, 'nuclei');
    const arjunIdx = plan.findIndex((s) => s.tool === 'arjun');
    const sqlmapIdx = plan.findIndex((s) => s.tool === 'sqlmap');
    assert.ok(arjunIdx < sqlmapIdx);
  });

  it('Node/Express → katana crawl first, then arjun param discovery', () => {
    const { plan } = planFromTech(['Express', 'Node.js']);
    assert.equal(plan[0].tool, 'katana');
    assert.ok(plan.some((s) => s.tool === 'arjun'), 'param discovery prioritized for Node');
  });

  it('PHP → arjun before sqlmap (params first, then injection)', () => {
    const { plan } = planFromTech(['PHP']);
    const arjunIdx = plan.findIndex((s) => s.tool === 'arjun');
    const sqlmapIdx = plan.findIndex((s) => s.tool === 'sqlmap');
    assert.ok(arjunIdx >= 0 && sqlmapIdx >= 0 && arjunIdx < sqlmapIdx);
    const sqlmap = plan[sqlmapIdx];
    assert.ok(sqlmap.args.join(' ').includes('--risk=1'), 'sqlmap stays at safe risk');
  });

  it('CDN/WAF-fronted → wafw00f first, then origin hunting', () => {
    const { plan, matchedTech } = planFromTech(['Cloudflare']);
    assert.ok(matchedTech.includes('CDN/WAF fronted'));
    assert.equal(plan[0].tool, 'wafw00f');
  });

  it('unknown stack → generic fallback plan', () => {
    const { plan, fallback } = planFromTech(['SomeObscureServer 9.9']);
    assert.equal(fallback, true);
    assert.deepEqual(plan.map((s) => s.tool), GENERIC_PLAN.map((s) => s.tool));
  });

  it('normalizeTech handles httpx -tech-detect shapes', () => {
    const techs = normalizeTech([{ tech: ['React', 'Next.js'] }]);
    assert.ok(techs.includes('React'));
    const { plan } = planFromTech(techs);
    assert.ok(plan.some((s) => s.tool === 'linkfinder'), 'SPA → linkfinder for JS bundles');
  });
});

// ═══════════════════════════════════════════════════════════════════
// B9 — JS endpoint testing loop (katana/linkfinder → dalfox/nuclei)
// ═══════════════════════════════════════════════════════════════════
describe('B9 jsEndpointLoop', () => {
  it('extracts katana endpoints, skipping malformed lines', async () => {
    const { endpoints, count } = extractEndpointsFromKatana(await FIX('katana.jsonl'));
    assert.equal(count, 4);
    assert.ok(endpoints.every((e) => e.source === 'katana'));
  });

  it('extracts linkfinder endpoints, resolving relative and filtering out-of-scope', async () => {
    const { endpoints } = extractEndpointsFromLinkfinder(await FIX('linkfinder.txt'), 'http://127.0.0.1:4612/');
    const urls = endpoints.map((e) => e.url);
    assert.ok(urls.some((u) => u.includes('/api/v1/users')));
    assert.ok(urls.some((u) => u.includes('debug=true')), 'keeps query strings');
    assert.ok(!urls.some((u) => u.includes('other.local')), 'out-of-scope filtered');
  });

  it('builds dalfox requests for param URLs + one nuclei sweep', async () => {
    const loop = jsEndpointLoop({
      katanaRaw: await FIX('katana.jsonl'),
      linkfinderRaw: await FIX('linkfinder.txt'),
      baseUrl: 'http://127.0.0.1:4612/'
    });
    const dalfoxReqs = loop.requests.filter((r) => r.tool === 'dalfox');
    const nucleiReqs = loop.requests.filter((r) => r.tool === 'nuclei');
    assert.ok(dalfoxReqs.length >= 2, `dalfox targets param URLs, got ${dalfoxReqs.length}`);
    assert.ok(dalfoxReqs.every((r) => r.target.includes('?')), 'dalfox only on URLs with params');
    assert.equal(nucleiReqs.length, 1, 'single nuclei sweep over the list');
    assert.ok(nucleiReqs[0].meta.targetList.length >= 4);
    assert.ok(loop.coverage.endpointsDiscovered >= 4);
    assert.ok(loop.sources.katana === 4);
  });
});

// ═══════════════════════════════════════════════════════════════════
// B10 — Wayback/gau param loop (collect → dedup → arjun → test)
// ═══════════════════════════════════════════════════════════════════
describe('B10 paramLoop', () => {
  it('collects + dedups archive URLs, dropping static assets', async () => {
    const { urls, count } = collectArchiveUrls([await FIX('gau.txt'), await FIX('wayback.txt')], { baseHost: 'target.local' });
    // gau: 8 lines − 1 dupe − 1 asset(png) = 6; wayback: 2 lines, 0 dupes of gau's full URLs = 2 → 8
    assert.equal(count, 8, `got: ${urls.join(' | ')}`);
    assert.ok(!urls.some((u) => /\.png/.test(u)), 'static assets dropped');
    assert.ok(new Set(urls).size === urls.length, 'deduped');
  });

  it('extracts param candidates grouped by path', async () => {
    const { urls } = collectArchiveUrls([await FIX('gau.txt'), await FIX('wayback.txt')], { baseHost: 'target.local' });
    const cands = extractParamCandidates(urls);
    const product = cands.find((c) => c.url.includes('/product'));
    assert.ok(product, 'product path found');
    assert.ok(product.params.includes('id') && product.params.includes('debug'), `params: ${product.params}`);
  });

  it('prioritizes high-value params (debug, token, id) first', async () => {
    const { urls } = collectArchiveUrls([await FIX('gau.txt')], { baseHost: 'target.local' });
    const prioritized = prioritizeParams(extractParamCandidates(urls));
    assert.ok(prioritized[0].highValue.length > 0, 'top candidate has high-value params');
    assert.ok(prioritized[0].highValue.some((p) => /debug|token|id/i.test(p)));
  });

  it('builds arjun confirmation + dalfox/sqlmap test requests', async () => {
    const plan = paramLoop([await FIX('gau.txt'), await FIX('wayback.txt')], { baseHost: 'target.local' });
    const arjunReqs = plan.requests.filter((r) => r.tool === 'arjun');
    const sqlmapReqs = plan.requests.filter((r) => r.tool === 'sqlmap');
    assert.ok(arjunReqs.length > 0, 'arjun confirmations planned');
    assert.ok(arjunReqs[0].meta.archivedParams.length > 0);
    assert.ok(sqlmapReqs.length > 0);
    assert.ok(sqlmapReqs.every((r) => r.meta.needsApproval === true), 'sqlmap flagged as needing approval');
    assert.ok(sqlmapReqs.every((r) => r.arguments.args.join(' ').includes('--risk=1')), 'sqlmap stays risk 1');
    assert.ok(plan.stats.highValueHits > 0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// G34 — WAF-adaptive strategy: detection ENFORCES stealth
// ═══════════════════════════════════════════════════════════════════
describe('G34 wafAdaptive', () => {
  it('parses wafw00f JSON → detected WAF', async () => {
    const parsed = parseWafw00f(await FIX('wafw00f.json'));
    assert.equal(parsed.detected, true);
    assert.match(parsed.waf, /cloudflare/i);
  });

  it('returns not-detected for clean output', () => {
    const parsed = parseWafw00f(JSON.stringify([{ url: 'https://x', firewall: 'None', is_behind: false }]));
    assert.equal(parsed.detected, false);
  });

  it('ENFORCES stealth on nuclei: low concurrency, rate limit, low-noise templates, rotated UA', () => {
    const { request, enforced, changes } = enforceOnRequest({ tool: 'nuclei', target: 't', arguments: { args: [] } });
    assert.equal(enforced, true);
    const args = request.arguments.args;
    assert.ok(args.includes('-c') && args[args.indexOf('-c') + 1] === '5', 'concurrency 5');
    assert.ok(args.includes('-rate-limit') && args[args.indexOf('-rate-limit') + 1] === '10');
    assert.ok(args.includes('-exclude-tags'), 'intrusive/fuzz/dos excluded');
    assert.ok(args.some((a, i) => a === '-H' && args[i + 1].startsWith('User-Agent: Mozilla')), 'UA rotated');
    assert.ok(request.meta.preRequestJitterMs > 0, 'jitter armed');
    assert.ok(request.meta.stealthEnforced === true);
    assert.ok(changes.length >= 4);
  });

  it('does not touch requests under the normal profile', () => {
    const orig = { tool: 'nuclei', target: 't', arguments: { args: ['-c', '25'] } };
    const { request, enforced } = enforceOnRequest(orig, STEALTH_PROFILES.normal);
    assert.equal(enforced, false);
    assert.equal(request, orig, 'original object returned untouched');
  });

  it('WafAdaptiveState: detection flips the assessment into enforced mode', async () => {
    const state = new WafAdaptiveState();
    assert.equal(state.isEnforced('a1'), false);
    const s = state.applyWafDetection('a1', await FIX('wafw00f.json'));
    assert.equal(s.detected, true);
    assert.equal(state.isEnforced('a1'), true);
    const { request, enforced } = state.enforce('a1', { tool: 'ffuf', target: 't', arguments: { args: [] } });
    assert.equal(enforced, true);
    assert.ok(request.arguments.args.includes('-t'), 'ffuf threads lowered');
    // another assessment stays normal
    assert.equal(state.isEnforced('a2'), false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// C12-C18 — finding normalization: every tool output → findings
// ═══════════════════════════════════════════════════════════════════
describe('C12 nuclei → findings', () => {
  it('parses nuclei JSONL into normalized findings', async () => {
    const findings = normalizeNuclei(await FIX('nuclei.jsonl'));
    assert.equal(findings.length, 3);
    const crit = findings.find((f) => f.severity === 'critical');
    assert.ok(crit, 'critical kept');
    assert.equal(crit.url, 'https://target.local/wp-admin/admin-ajax.php');
    assert.ok(crit.evidence.templateId.includes('wordpress'), 'template id in evidence');
    assert.ok(crit.confidence >= 0.9);
    assert.equal(crit.source, 'nuclei');
    for (const f of findings) {
      assert.ok(f.type && f.severity && 'url' in f && f.evidence && typeof f.confidence === 'number');
    }
  });

  it('respects minSeverity filtering', async () => {
    const findings = normalizeNuclei(await FIX('nuclei.jsonl'), { minSeverity: 'high' });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, 'critical');
  });
});

describe('C13 sqlmap → findings', () => {
  it('parses injectable parameters into confirmed findings', async () => {
    const { findings, negative } = normalizeSqlmap(await FIX('sqlmap.txt'));
    assert.equal(negative, false);
    assert.equal(findings.length, 2, 'two injectable techniques on param q');
    assert.ok(findings.every((f) => f.type === 'sql-injection'));
    assert.ok(findings[0].evidence.parameter === 'q');
    assert.ok(findings[0].evidence.place === 'GET');
    assert.ok(findings[0].confidence >= 0.8);
    assert.equal(findings[0].source, 'sqlmap');
  });

  it('reports negative evidence instead of a finding when not injectable', () => {
    const { findings, negative } = normalizeSqlmap('[INFO] all tested parameters do not appear to be injectable');
    assert.equal(findings.length, 0);
    assert.equal(negative, true);
  });
});

describe('C14 dalfox → findings', () => {
  it('parses dalfox JSON into reflected-XSS findings', async () => {
    const findings = normalizeDalfox(await FIX('dalfox.json'));
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.type, 'reflected-xss');
    assert.equal(f.severity, 'medium');
    assert.equal(f.url, 'http://127.0.0.1:4562/search');
    assert.equal(f.evidence.param, 'q');
    assert.ok(f.evidence.poc.includes('dmxss'), 'PoC preserved as evidence');
    assert.ok(f.confidence >= 0.7);
  });
});

describe('C17 corscanner/sslscan → findings', () => {
  it('flags reflected-origin-with-credentials CORS as high', async () => {
    const findings = normalizeCorscanner(await FIX('cors.json'));
    assert.equal(findings.length, 2);
    const high = findings.find((f) => f.severity === 'high');
    assert.ok(high, 'reflected origin + credentials = high');
    assert.equal(high.type, 'cors-misconfiguration');
    assert.ok(high.evidence.allowCredentials);
    const medium = findings.find((f) => f.severity === 'medium');
    assert.ok(medium, 'wildcard without credentials = medium');
  });

  it('maps sslscan output to severity-graded findings', async () => {
    const findings = normalizeSslscan(await FIX('sslscan.txt'));
    const tls10 = findings.find((f) => f.evidence.protocol === 'TLSv1.0');
    assert.ok(tls10, 'TLS 1.0 found');
    assert.equal(tls10.severity, 'medium');
    const weakCipher = findings.find((f) => f.type === 'weak-cipher');
    assert.ok(weakCipher, '3DES accepted flagged');
    const selfSigned = findings.find((f) => f.title.includes('Self-signed'));
    assert.ok(selfSigned && selfSigned.severity === 'low');
    assert.ok(findings.every((f) => f.source === 'sslscan' && typeof f.confidence === 'number'));
  });
});

describe('C16 subdomain takeover', () => {
  it('matches a dangling GitHub Pages CNAME + HTTP marker', () => {
    const m = matchTakeoverFingerprint({
      subdomain: 'old.target.local',
      cname: 'old-pages.github.io',
      httpBody: "There isn't a GitHub Pages site here"
    });
    assert.equal(m.matched, true);
    assert.equal(m.service, 'GitHub Pages');
    assert.equal(m.httpConfirmed, true);
    assert.ok(m.confidence >= 0.85);
  });

  it('CNAME-only match is weaker than HTTP-confirmed', () => {
    const weak = matchTakeoverFingerprint({ subdomain: 'x.target.local', cname: 'x.github.io', httpBody: '<html>real site</html>' });
    const strong = matchTakeoverFingerprint({ subdomain: 'x.target.local', cname: 'x.github.io', httpBody: "There isn't a GitHub Pages site here" });
    assert.ok(weak.matched && strong.matched);
    assert.ok(strong.confidence > weak.confidence);
  });

  it('does not match unrelated CNAMEs', () => {
    assert.equal(matchTakeoverFingerprint({ subdomain: 'www.target.local', cname: 'www.target.local', httpBody: '' }).matched, false);
  });

  it('detectTakeovers emits normalized findings only for matches', () => {
    const { findings, checked } = detectTakeovers([
      { subdomain: 'old.target.local', cname: 'old-pages.github.io', httpBody: "There isn't a GitHub Pages site here" },
      { subdomain: 'www.target.local', cname: 'www.target.local', httpBody: '' }
    ]);
    assert.equal(checked, 2);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].type, 'subdomain-takeover');
    assert.equal(findings[0].severity, 'high');
  });

  it('normalizeSubzy turns vulnerable=true rows into findings', async () => {
    const { findings, checked } = normalizeSubzy(await FIX('subzy.json'));
    assert.equal(checked, 2);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].type, 'subdomain-takeover');
    assert.equal(findings[0].evidence.service, 'GitHub Pages');
    assert.ok(findings[0].confidence >= 0.9, 'verified → high confidence');
  });

  it('claimCheck is a SAFE code path: still-dangling without claiming', async () => {
    const r = await claimCheck(
      { subdomain: 'old.target.local', cname: 'old-pages.github.io' },
      {
        resolver: async () => ({ cname: 'old-pages.github.io' }),
        fetcher: async () => ({ status: 404, body: "There isn't a GitHub Pages site here" })
      }
    );
    assert.equal(r.status, 'still-dangling');
    assert.match(r.reason, /WITHOUT claiming/);
  });

  it('claimCheck reports resolved when the dangling marker is gone', async () => {
    const r = await claimCheck(
      { subdomain: 'old.target.local', cname: 'old-pages.github.io' },
      {
        resolver: async () => ({ cname: 'real-site.github.io' }),
        fetcher: async () => ({ status: 200, body: '<html>claimed</html>' })
      }
    );
    assert.equal(r.status, 'resolved');
  });
});

describe('findingNormalizer dispatcher', () => {
  it('routes by tool name', async () => {
    assert.equal(normalizeToolFindings('nuclei', await FIX('nuclei.jsonl')).length, 3);
    assert.equal(normalizeToolFindings('dalfox', await FIX('dalfox.json')).length, 1);
    assert.equal(normalizeToolFindings('corscanner', await FIX('cors.json')).length, 2);
    assert.ok(normalizeToolFindings('sslscan', await FIX('sslscan.txt')).length >= 3);
    assert.equal(normalizeToolFindings('subzy', await FIX('subzy.json')).length, 1);
    assert.equal(normalizeToolFindings('sqlmap', await FIX('sqlmap.txt')).length, 2);
    assert.deepEqual(normalizeToolFindings('nope', 'x'), []);
  });
});

// ═══════════════════════════════════════════════════════════════════
// H41 — permissionService contract
// ═══════════════════════════════════════════════════════════════════
describe('H41 permissionService', () => {
  it('defaults to "ask" (fail-safe)', () => {
    const p = new PermissionService();
    assert.equal(p.getPermissionMode('new-user'), 'ask');
  });

  it('set/get round-trips, rejects invalid modes', () => {
    const p = new PermissionService();
    assert.equal(p.setPermissionMode('u1', 'full'), 'full');
    assert.equal(p.getPermissionMode('u1'), 'full');
    assert.throws(() => p.setPermissionMode('u1', 'yolo'), /Invalid permission mode/);
  });

  it('ask mode: destructive action creates a pending approval', () => {
    const p = new PermissionService();
    const r = p.requireApproval({ userId: 'u1', action: 'destructive_tool', tool: 'sqlmap', target: 't' });
    assert.equal(r.decision, 'needs_approval');
    assert.ok(r.approval.id.startsWith('apr_'));
    assert.equal(p.listPending('u1').length, 1);
  });

  it('ask mode: approved approval lets the action through', () => {
    const p = new PermissionService();
    const r1 = p.requireApproval({ userId: 'u1', action: 'destructive_tool', tool: 'sqlmap', target: 't' });
    p.resolveApproval(r1.approval.id, { approved: true, userId: 'u1' });
    const r2 = p.requireApproval({ userId: 'u1', action: 'destructive_tool', tool: 'sqlmap', target: 't' });
    assert.equal(r2.decision, 'approved');
  });

  it('ask mode: denied approval keeps blocking', () => {
    const p = new PermissionService();
    const r1 = p.requireApproval({ userId: 'u1', action: 'destructive_tool', tool: 'sqlmap', target: 't' });
    p.resolveApproval(r1.approval.id, { approved: false, userId: 'u1' });
    const r2 = p.requireApproval({ userId: 'u1', action: 'destructive_tool', tool: 'sqlmap', target: 't' });
    assert.equal(r2.decision, 'needs_approval', 'a new approval is requested after denial');
  });

  it('full mode: allowed with audit logging', () => {
    const p = new PermissionService();
    p.setPermissionMode('u1', 'full');
    const r = p.requireApproval({ userId: 'u1', action: 'destructive_tool', tool: 'sqlmap', target: 't' });
    assert.equal(r.decision, 'allowed');
    const audit = p.getAuditLog({ userId: 'u1' });
    assert.ok(audit.some((e) => e.event === 'destructive_allowed_full_mode'));
  });

  it('resolveApproval rejects unknown/double-resolved ids', () => {
    const p = new PermissionService();
    assert.throws(() => p.resolveApproval('apr_nope', { approved: true }), /Unknown approval/);
    const r = p.requireApproval({ userId: 'u1', action: 'destructive_tool', tool: 'sqlmap', target: 't' });
    p.resolveApproval(r.approval.id, { approved: true });
    assert.throws(() => p.resolveApproval(r.approval.id, { approved: true }), /already approved/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// H41 — policyValidator audit: destructive blocking + permission hookup
// ═══════════════════════════════════════════════════════════════════
const fakeScope = { validateToolTarget: () => ({ valid: true }) };

describe('H41 policyValidator', () => {
  it('hard-blocks rm -rf in any casing/order', () => {
    for (const args of [['rm', '-rf', '/'], ['rm', '-fr', '/tmp'], [';', 'rm', '-rf', '/']]) {
      const r = PolicyValidator.validate({ tool: 'nmap', target: 't', arguments: { args } }, fakeScope);
      assert.equal(r.allowed, false, `should block ${args.join(' ')}`);
    }
  });

  it('hard-blocks sqlmap --risk 2/3 and --level 4/5', () => {
    for (const args of [['--risk=3'], ['--risk', '2'], ['--level=5'], ['--level', '4']]) {
      const r = PolicyValidator.validate({ tool: 'sqlmap', target: 't', arguments: { args } }, fakeScope,
        { permissionService: new PermissionService(), userId: 'u1' });
      assert.equal(r.allowed, false, `should block ${args.join(' ')}`);
      assert.match(r.reason, /Blocked argument pattern/);
    }
  });

  it('hard-blocks sqlmap OS/file takeover flags', () => {
    for (const flag of ['--os-shell', '--os-cmd', '--os-pwn', '--file-write', '--sql-shell', '--dump-all']) {
      const r = PolicyValidator.validate({ tool: 'sqlmap', target: 't', arguments: { args: [flag] } }, fakeScope,
        { permissionService: new PermissionService(), userId: 'u1' });
      assert.equal(r.allowed, false, `should block ${flag}`);
    }
  });

  it('hard-blocks nmap -T5 insane timing', () => {
    const r = PolicyValidator.validate({ tool: 'nmap', target: 't', arguments: { args: ['-T5', '-p', '80'] } }, fakeScope);
    assert.equal(r.allowed, false);
  });

  it('hard-blocks command injection and system-path writes', () => {
    for (const args of [['`id`'], ['$(whoami)'], ['>', '/etc/passwd'], ['|', 'bash']]) {
      const r = PolicyValidator.validate({ tool: 'nmap', target: 't', arguments: { args } }, fakeScope);
      assert.equal(r.allowed, false, `should block ${args.join(' ')}`);
    }
  });

  it('hard-blocks destructive python code (os.system, rmtree)', () => {
    for (const code of ['import os; os.system("rm -rf /")', 'import shutil; shutil.rmtree("/etc")', 'import subprocess; subprocess.run("x", shell=True)']) {
      const r = PolicyValidator.validate({ tool: 'python', target: 't', arguments: { code } }, fakeScope);
      assert.equal(r.allowed, false, `should block: ${code.slice(0, 40)}`);
    }
  });

  it('ask mode: sqlmap risk-1 is PERMISSION_REQUIRED until approved', () => {
    const perm = new PermissionService();
    const r1 = PolicyValidator.validate(
      { tool: 'sqlmap', target: 't', arguments: { args: ['--batch', '--risk=1'] } },
      fakeScope, { permissionService: perm, userId: 'u1' });
    assert.equal(r1.allowed, false);
    assert.match(r1.reason, /PERMISSION_REQUIRED/);
    assert.ok(r1.approval?.id, 'approval id surfaced for the frontend card');
    perm.resolveApproval(r1.approval.id, { approved: true, userId: 'u1' });
    const r2 = PolicyValidator.validate(
      { tool: 'sqlmap', target: 't', arguments: { args: ['--batch', '--risk=1'] } },
      fakeScope, { permissionService: perm, userId: 'u1' });
    assert.equal(r2.allowed, true, 'approved → allowed');
  });

  it('full mode: sqlmap risk-1 allowed with audit trail', () => {
    const perm = new PermissionService();
    perm.setPermissionMode('u1', 'full');
    const r = PolicyValidator.validate(
      { tool: 'sqlmap', target: 't', arguments: { args: ['--batch', '--risk=1'] } },
      fakeScope, { permissionService: perm, userId: 'u1' });
    assert.equal(r.allowed, true);
    assert.ok(perm.getAuditLog({ userId: 'u1' }).some((e) => e.event === 'destructive_allowed_full_mode'));
  });

  it('non-destructive tools pass in ask mode without approval', () => {
    const r = PolicyValidator.validate({ tool: 'nuclei', target: 't', arguments: { args: ['-silent'] } }, fakeScope,
      { permissionService: new PermissionService(), userId: 'u1' });
    assert.equal(r.allowed, true);
  });

  it('timeout limits enforced per risk level', () => {
    const r = PolicyValidator.validate({ tool: 'nuclei', target: 't', timeout: 999_999_999 }, fakeScope);
    assert.equal(r.allowed, false);
    assert.match(r.reason, /exceeds limit/);
  });

  it('sanitize drops blocked args instead of shipping them', () => {
    const args = PolicyValidator.sanitize('nmap', ['-sV', 'rm', '-rf', '/', '-p', '80']);
    assert.ok(!args.join(' ').includes('rm -rf'), 'dangerous args removed');
    assert.ok(args.includes('-sV') && args.includes('-p'));
  });

  it('unknown tool rejected', () => {
    const r = PolicyValidator.validate({ tool: 'nope', target: 't' }, fakeScope);
    assert.equal(r.allowed, false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// G33 — bad-tool-output recovery + G34 executor enforcement
// ═══════════════════════════════════════════════════════════════════
function makeExecutorFakes() {
  const events = [];
  const executions = new Map();
  let seq = 0;
  const toolExecutionModel = {
    constructor: { fingerprint: (t, target, args) => `${t}|${target}|${JSON.stringify(args || {})}` },
    findByFingerprint: async () => null,
    create: async (aid, uid, data) => { const e = { id: `ex${++seq}`, ...data }; executions.set(e.id, e); return e; },
    markStarted: async () => {},
    markCompleted: async (id, data) => Object.assign(executions.get(id), data),
    markFailed: async (id, msg) => { executions.get(id).failed = msg; }
  };
  const eventService = { publish: async (aid, ev) => { events.push({ aid, ...ev }); } };
  const scopeEngine = { validateToolTarget: () => ({ valid: true }) };
  return { toolExecutionModel, eventService, scopeEngine, events, executions };
}

describe('G33 executeResilient', () => {
  it('detects garbage output kinds', () => {
    assert.equal(isGarbageResult({ success: false }, 'whatever'), true, 'parse failure = garbage');
    assert.equal(isGarbageResult({ success: true }, ''), true, 'empty output = garbage');
    assert.equal(isGarbageResult({ success: true }, 'sh: nuclei: command not found'), true);
    assert.equal(isGarbageResult({ success: true }, JSON.stringify({ status: 'kali_required' })), true);
    assert.equal(isGarbageResult({ success: true }, 'https://target.local/a\nhttps://target.local/b\n'), false);
  });

  it('retries with different approaches and recovers via fallback tool', async () => {
    const fakes = makeExecutorFakes();
    const ex = new ToolExecutor({ ...fakes, permissionService: new PermissionService() });
    // katana "runs" but returns empty output twice; gau fallback returns real lines
    ex.executeOnKali = async (tool) => (tool.name === 'katana' ? '' : 'https://target.local/p1\nhttps://target.local/p2\n');
    const out = await ex.executeResilient('a1', 'u1', { tool: 'katana', target: 'target.local', arguments: {} });
    assert.equal(out.recovery.recovered, true);
    assert.deepEqual(out.recovery.attempts, ['requested', 'simplified-args', 'fallback:gau']);
    assert.equal(out.parsed.items.length, 2, 'fallback gau output parsed');
    assert.ok(fakes.events.some((e) => e.type === 'TOOL_RECOVERED'));
  });

  it('exhausts all approaches and throws with the attempt trail', async () => {
    const fakes = makeExecutorFakes();
    const ex = new ToolExecutor({ ...fakes, permissionService: new PermissionService() });
    ex.executeOnKali = async () => ''; // every tool returns empty = garbage
    try {
      await ex.executeResilient('a1', 'u1', { tool: 'nmap', target: 't2', arguments: {} }, { maxAttempts: 3 });
      assert.fail('should have thrown');
    } catch (e) {
      assert.match(e.message, /unusable output after 3 approach/);
      assert.deepEqual(e.recoveryAttempts, ['requested', 'simplified-args', 'fallback:naabu']);
    }
  });

  it('NEVER retries a policy violation (safety block is final)', async () => {
    const fakes = makeExecutorFakes();
    const ex = new ToolExecutor({ ...fakes, permissionService: new PermissionService() }); // default ask
    let kaliCalls = 0;
    ex.executeOnKali = async () => { kaliCalls++; return ''; };
    await assert.rejects(
      ex.executeResilient('a1', 'u1', { tool: 'sqlmap', target: 't', arguments: { args: ['--batch'] } }),
      /PERMISSION_REQUIRED/
    );
    assert.equal(kaliCalls, 0, 'blocked before any execution attempt');
    assert.ok(fakes.events.some((e) => e.type === 'TOOL_BLOCKED'));
  });
});

describe('G34 executor enforcement', () => {
  it('wafw00f detection arms stealth; later nuclei runs are rewritten', async () => {
    const fakes = makeExecutorFakes();
    const ex = new ToolExecutor({ ...fakes, permissionService: new PermissionService() });
    let captured = null;
    ex.executeOnKali = async (tool, req) => { captured = req; return ''; };

    const state = ex.applyWafDetection('a9', await FIX('wafw00f.json'));
    assert.equal(state.detected, true);
    assert.equal(ex.isStealthEnforced('a9'), true);

    await ex.execute('a9', 'u1', { tool: 'nuclei', target: 'target.local', arguments: { args: [] } });
    assert.ok(captured, 'tool executed');
    assert.ok(captured.arguments.args.includes('-c'));
    assert.equal(captured.arguments.args[captured.arguments.args.indexOf('-c') + 1], '5');
    assert.equal(captured.meta.stealthEnforced, true);
    assert.ok(fakes.events.some((e) => e.type === 'STEALTH_ENFORCED'), 'enforcement event published');
  });

  it('no WAF → requests pass through unmodified', async () => {
    const fakes = makeExecutorFakes();
    const ex = new ToolExecutor({ ...fakes, permissionService: new PermissionService() });
    let captured = null;
    ex.executeOnKali = async (tool, req) => { captured = req; return ''; };
    await ex.execute('a9', 'u1', { tool: 'nuclei', target: 'target.local', arguments: { args: ['-c', '25'] } });
    assert.deepEqual(captured.arguments.args, ['-c', '25']);
    assert.ok(!fakes.events.some((e) => e.type === 'STEALTH_ENFORCED'));
  });
});

// ═══════════════════════════════════════════════════════════════════
// C15 — REAL IDOR dual-account test against our own fixture (127.0.0.1:4611)
// ═══════════════════════════════════════════════════════════════════
import express from 'express';

function createIdorFixture({ vulnerable }) {
  const app = express();
  const users = {
    1: { id: 1, name: 'alice', email: 'alice@w4.local', phone: '+91-9000000001' },
    2: { id: 2, name: 'bob', email: 'bob@w4.local', phone: '+91-9000000002' }
  };
  const tokens = { tokenA: '1', tokenB: '2' }; // A=alice, B=bob
  app.get('/api/users/:id', (req, res) => {
    const uid = tokens[(req.headers.authorization || '').replace('Bearer ', '')];
    if (!uid) return res.status(401).json({ error: 'unauthorized' });
    const target = users[req.params.id];
    if (!target) return res.status(404).json({ error: 'not found' });
    if (!vulnerable && uid !== req.params.id) return res.status(403).json({ error: 'forbidden' });
    res.json(target);
  });
  // Public endpoint (control: anonymous can read → NOT idor)
  app.get('/api/public/users/:id', (req, res) => res.json(users[req.params.id] || {}));
  return app;
}

describe('C15 idorChecker (live fixture 127.0.0.1:4611)', () => {
  let vulnServer, fixedServer;
  before(async () => {
    vulnServer = createIdorFixture({ vulnerable: true }).listen(4611, '127.0.0.1');
    fixedServer = createIdorFixture({ vulnerable: false }).listen(4613, '127.0.0.1');
    await new Promise((r) => setTimeout(r, 300));
  });
  after(async () => { vulnServer.close(); fixedServer.close(); });

  const base = {
    resourcePath: '/api/users/:id',
    victimId: 1, attackerId: 2,
    tokenA: 'tokenA', tokenB: 'tokenB'
  };

  it('CONFIRMS IDOR on the vulnerable fixture with disclosed fields as evidence', async () => {
    const r = await checkIdor('http://127.0.0.1:4611', base);
    assert.equal(r.vulnerable, true);
    const f = r.finding;
    assert.equal(f.type, 'idor');
    assert.equal(f.severity, 'high');
    assert.ok(f.url.includes('/api/users/1'));
    assert.ok(f.evidence.disclosedFields.includes('email'), `disclosed: ${f.evidence.disclosedFields}`);
    assert.ok(f.evidence.attackerBody.includes('alice@w4.local'), 'attacker body has victim data');
    assert.equal(f.evidence.anonymousStatus, 401);
    assert.ok(f.confidence >= 0.9);
    assert.equal(f.source, 'idor-dual-account');
  });

  it('reports NOT vulnerable on the fixed fixture (403)', async () => {
    const r = await checkIdor('http://127.0.0.1:4613', base);
    assert.equal(r.vulnerable, false);
    assert.match(r.reason, /403/);
  });

  it('does NOT call a public endpoint IDOR (anonymous control)', async () => {
    const r = await checkIdor('http://127.0.0.1:4611', { ...base, resourcePath: '/api/public/users/:id' });
    assert.equal(r.vulnerable, false);
    assert.match(r.reason, /public/);
  });

  it('refuses non-loopback targets (safety)', async () => {
    await assert.rejects(
      checkIdor('https://target.local', base),
      /not loopback/
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// C16b — REAL API/Swagger fuzzing against our own fixture (127.0.0.1:4612)
// ═══════════════════════════════════════════════════════════════════
function createApiFixture() {
  const app = express();
  app.get('/openapi.json', (req, res) => res.json({
    openapi: '3.0.0',
    info: { title: 'w4 fixture', version: '1' },
    paths: {
      '/api/search': { get: { operationId: 'search', parameters: [{ name: 'q', in: 'query' }] } },
      '/api/echo': { get: { operationId: 'echo', parameters: [{ name: 'msg', in: 'query' }] } },
      '/api/users/{id}': { get: { operationId: 'getUser', parameters: [{ name: 'id', in: 'path', required: true }] } }
    }
  }));
  app.get('/api/search', (req, res) => {
    const q = String(req.query.q || '');
    if (q.includes("'")) return res.status(500).send(`You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax near '${q}'`);
    res.send(`<html><body>results for ${q}</body></html>`);
  });
  app.get('/api/echo', (req, res) => {
    res.send(`<html><body>you said: ${req.query.msg || ''}</body></html>`);
  });
  app.get('/api/users/:id', (req, res) => res.json({ id: req.params.id }));
  return app;
}

describe('C16b apiFuzzer (live fixture 127.0.0.1:4612)', () => {
  let server;
  before(async () => {
    server = createApiFixture().listen(4612, '127.0.0.1');
    await new Promise((r) => setTimeout(r, 300));
  });
  after(async () => { server.close(); });

  it('discovers the swagger doc', async () => {
    const d = await discoverSwagger('http://127.0.0.1:4612');
    assert.equal(d.found, true);
    assert.ok(d.docUrl.endsWith('/openapi.json'));
  });

  it('enumerates paths + parameters from the doc', async () => {
    const d = await discoverSwagger('http://127.0.0.1:4612');
    const paths = enumerateApiPaths(d.doc);
    assert.equal(paths.length, 3);
    const search = paths.find((p) => p.path === '/api/search');
    assert.ok(search.params.some((p) => p.name === 'q' && p.in === 'query'));
  });

  it('fuzzes params → finds SQLi (error-based) AND reflected XSS as normalized findings', async () => {
    const r = await swaggerFuzzLoop('http://127.0.0.1:4612');
    assert.equal(r.found, true);
    assert.ok(r.tested >= 2, `tested ${r.tested} params`);
    const sqli = r.findings.find((f) => f.type === 'sql-injection');
    assert.ok(sqli, `expected sql-injection finding, got: ${r.findings.map((f) => f.type)}`);
    assert.equal(sqli.severity, 'high');
    assert.ok(sqli.url.includes('/api/search'));
    assert.ok(sqli.evidence.responseExcerpt.includes('SQL syntax'), 'DB error marker in evidence');
    const xss = r.findings.find((f) => f.type === 'reflected-xss');
    assert.ok(xss, 'expected reflected-xss finding');
    assert.ok(xss.url.includes('/api/echo'));
    assert.ok(xss.evidence.probeValue.includes('dmxss'));
    assert.ok(r.findings.every((f) => f.source === 'api-fuzzer' && typeof f.confidence === 'number'));
  });

  it('returns found=false when no doc exists', async () => {
    const app = express();
    app.get('/', (req, res) => res.send('no docs here'));
    const s = app.listen(4614, '127.0.0.1');
    await new Promise((r) => setTimeout(r, 200));
    try {
      const r = await swaggerFuzzLoop('http://127.0.0.1:4614');
      assert.equal(r.found, false);
      assert.deepEqual(r.findings, []);
    } finally { s.close(); }
  });

  it('refuses non-loopback targets (safety)', async () => {
    await assert.rejects(swaggerFuzzLoop('https://target.local'), /not loopback/);
  });
});
