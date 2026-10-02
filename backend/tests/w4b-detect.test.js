/**
 * Worker 4 (detect) part B — gap items C12-C18 (normalizer completeness) and
 * the nuclei / sqlmap / dalfox scan loops with honest degradation.
 *
 * Proof strategy:
 *   - normalizer: canned outputs for the 6 remaining tools (httpx, subfinder,
 *     nmap, wafw00f, katana, gau) + a 12-tool dispatcher test asserting ONE
 *     schema {type, severity, url, evidence, confidence, source, title}
 *   - loops: stub executors returning canned output (ran path) or the
 *     executor's kali_required placeholder (degraded path — the exact signal
 *     this sandbox produces since no binaries and no Kali worker exist here);
 *     a REAL ToolExecutor + PermissionService proves the permission gating.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = (name) => fs.readFile(path.join(__dirname, 'fixtures/w4', name), 'utf8');

// ── modules under test ──────────────────────────────────────────────
import {
  normalizeHttpx, normalizeSubfinder, normalizeNmap, normalizeWafw00f,
  normalizeKatana, normalizeGau, normalizeToolFindings
} from '../src/tools/findingNormalizer.js';
import {
  isToolUnavailableOutput, selectNucleiTags, buildNucleiArgs, nucleiLoop,
  buildSqlmapBooleanArgs, sqlmapLoop, buildDalfoxArgs, dalfoxLoop, runDetectionLoop
} from '../src/recon/scanLoops.js';
import { ToolExecutor } from '../src/tools/executor.js';
import { PermissionService } from '../src/services/permissionService.js';

/** Every normalized finding must carry the one schema. */
function assertFindingSchema(f, where) {
  assert.ok(typeof f.type === 'string' && f.type, `${where}: type`);
  assert.ok(['info', 'low', 'medium', 'high', 'critical'].includes(f.severity), `${where}: severity ${f.severity}`);
  assert.ok('url' in f, `${where}: url key present`);
  assert.ok(f.evidence && typeof f.evidence === 'object', `${where}: evidence`);
  assert.ok(typeof f.confidence === 'number' && f.confidence >= 0 && f.confidence <= 1, `${where}: confidence`);
  assert.ok(typeof f.source === 'string' && f.source, `${where}: source`);
  assert.ok(typeof f.title === 'string' && f.title, `${where}: title`);
}

// ═══════════════════════════════════════════════════════════════════
// C12b — the 6 remaining normalizers (httpx, subfinder, nmap, wafw00f,
// katana, gau) → the ONE finding schema
// ═══════════════════════════════════════════════════════════════════
describe('normalizer: httpx → live-host', () => {
  it('parses httpx JSONL into live-host findings, skipping garbage', async () => {
    const findings = normalizeHttpx(await FIX('httpx.jsonl'));
    assert.equal(findings.length, 3, '3 hosts with urls; garbage + url-less lines skipped');
    findings.forEach((f) => assertFindingSchema(f, 'httpx'));
    assert.ok(findings.every((f) => f.type === 'live-host' && f.severity === 'info'));
    const root = findings.find((f) => f.url === 'https://target.local');
    assert.equal(root.evidence.statusCode, 200);
    assert.equal(root.evidence.title, 'Target Home');
    assert.ok(root.evidence.tech.includes('WordPress'), 'tech-detect preserved');
    assert.ok(root.confidence >= 0.9);
    assert.equal(root.source, 'httpx');
  });
});

describe('normalizer: subfinder → subdomain', () => {
  it('dedups, lowercases, strips dots, drops invalid lines, scope-filters', async () => {
    const findings = normalizeSubfinder(await FIX('subfinder.txt'), { baseHost: 'target.local' });
    const hosts = findings.map((f) => f.evidence.subdomain);
    assert.deepEqual(hosts.sort(), ['api.target.local', 'mail.target.local', 'staging.target.local', 'www.target.local']);
    findings.forEach((f) => assertFindingSchema(f, 'subfinder'));
    assert.ok(findings.every((f) => f.type === 'subdomain' && f.severity === 'info'));
    assert.ok(!hosts.includes('other.com'), 'out-of-scope filtered');
    assert.ok(!hosts.some((h) => h.includes(' ')), 'invalid line dropped');
  });
});

describe('normalizer: nmap → open-port', () => {
  it('emits one finding per open port from nmap XML', async () => {
    const findings = normalizeNmap(await FIX('nmap.xml'));
    assert.equal(findings.length, 3, '3 open ports (22 was closed)');
    findings.forEach((f) => assertFindingSchema(f, 'nmap'));
    assert.ok(findings.every((f) => f.type === 'open-port'));
    const http = findings.find((f) => f.evidence.port === 80);
    assert.equal(http.evidence.service, 'http');
    assert.equal(http.evidence.product, 'nginx');
    assert.equal(http.severity, 'info', 'plain http is info');
    assert.equal(http.source, 'nmap');
  });

  it('grades sensitive services (DB/RDP/telnet) to medium', () => {
    const xml = '<nmaprun><host><address addr="127.0.0.1" addrtype="ipv4"/><ports>'
      + '<port protocol="tcp" portid="3306"><state state="open"/><service name="mysql" product="MySQL" version="8.0"/></port>'
      + '<port protocol="tcp" portid="23"><state state="open"/><service name="telnet"/></port>'
      + '</ports></host></nmaprun>';
    const findings = normalizeNmap(xml);
    assert.equal(findings.length, 2);
    assert.ok(findings.every((f) => f.severity === 'medium'), 'sensitive services → medium');
    assert.ok(findings[0].title.includes('mysql'));
  });
});

describe('normalizer: wafw00f → waf-detected', () => {
  it('emits a waf-detected finding when a WAF is present', async () => {
    const findings = normalizeWafw00f(await FIX('wafw00f.json'));
    assert.equal(findings.length, 1);
    findings.forEach((f) => assertFindingSchema(f, 'wafw00f'));
    assert.equal(findings[0].type, 'waf-detected');
    assert.match(findings[0].evidence.waf, /cloudflare/i);
    assert.equal(findings[0].source, 'wafw00f');
  });

  it('emits nothing when no WAF is detected', () => {
    assert.deepEqual(normalizeWafw00f(JSON.stringify([{ url: 'https://x', firewall: 'None', is_behind: false }])), []);
  });
});

describe('normalizer: katana → discovered-endpoint', () => {
  it('turns crawled URLs into endpoint findings with param flags', async () => {
    const findings = normalizeKatana(await FIX('katana.jsonl'));
    assert.equal(findings.length, 4);
    findings.forEach((f) => assertFindingSchema(f, 'katana'));
    assert.ok(findings.every((f) => f.type === 'discovered-endpoint' && f.severity === 'info'));
    const paramUrl = findings.find((f) => f.url.includes('?q=test'));
    assert.equal(paramUrl.evidence.hasParams, true, 'query-string flagged for the param loop');
    assert.equal(findings[0].source, 'katana');
  });
});

describe('normalizer: gau → archived-url', () => {
  it('dedups, drops static assets, flags parameterized URLs', async () => {
    const findings = normalizeGau(await FIX('gau.txt'), { baseHost: 'target.local' });
    findings.forEach((f) => assertFindingSchema(f, 'gau'));
    assert.ok(findings.every((f) => f.type === 'archived-url' && f.severity === 'info'));
    assert.ok(!findings.some((f) => /\.png/.test(f.url)), 'static assets dropped');
    assert.equal(new Set(findings.map((f) => f.url)).size, findings.length, 'deduped');
    assert.ok(findings.some((f) => f.evidence.hasParams), 'parameterized URL flagged');
    assert.equal(findings[0].source, 'gau');
  });
});

describe('normalizer dispatcher: all 12 tools → one schema', () => {
  it('routes every detection tool through normalizeToolFindings (5+ parsers proven)', async () => {
    const cases = [
      ['nuclei', await FIX('nuclei.jsonl'), 3],
      ['sqlmap', await FIX('sqlmap.txt'), 2],
      ['dalfox', await FIX('dalfox.json'), 1],
      ['httpx', await FIX('httpx.jsonl'), 3],
      ['subfinder', await FIX('subfinder.txt'), 5], // no baseHost here → other.com kept
      ['nmap', await FIX('nmap.xml'), 3],
      ['wafw00f', await FIX('wafw00f.json'), 1],
      ['sslscan', await FIX('sslscan.txt'), 3],
      ['corscanner', await FIX('cors.json'), 2],
      ['subzy', await FIX('subzy.json'), 1],
      ['katana', await FIX('katana.jsonl'), 4],
      ['gau', await FIX('gau.txt'), 6], // 8 lines − 1 dupe − 1 png asset
    ];
    for (const [tool, raw, expected] of cases) {
      const findings = normalizeToolFindings(tool, raw);
      assert.equal(findings.length, expected, `${tool}: expected ${expected} findings`);
      findings.forEach((f) => assertFindingSchema(f, `dispatcher:${tool}`));
    }
    assert.deepEqual(normalizeToolFindings('nope', 'x'), [], 'unknown tool → []');
    assert.deepEqual(normalizeToolFindings('gau', ''), [], 'empty output → []');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Loop plumbing: unavailable-output detection
// ═══════════════════════════════════════════════════════════════════
describe('isToolUnavailableOutput', () => {  it('recognizes the executor kali_required placeholder', () => {
    assert.equal(isToolUnavailableOutput(JSON.stringify({ status: 'kali_required', tool: 'nuclei' })), true);
    assert.equal(isToolUnavailableOutput('{ "status": "kali_required" }'), true);
    assert.equal(isToolUnavailableOutput('sh: nuclei: command not found'), true);
  });
  it('does not flag real output', async () => {
    assert.equal(isToolUnavailableOutput(await FIX('nuclei.jsonl')), false);
    assert.equal(isToolUnavailableOutput(await FIX('sqlmap.txt')), false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// nucleiLoop: template selection → executor → findings
// ═══════════════════════════════════════════════════════════════════
const stubExecutor = (rawOutput) => ({ execute: async () => ({ rawOutput }) });

describe('nucleiLoop', () => {
  it('selectNucleiTags: tech → template tags; unknown → safe generic baseline', () => {
    assert.ok(selectNucleiTags(['WordPress 6.4.1']).includes('wordpress'));
    assert.ok(selectNucleiTags(['WordPress 6.4.1']).includes('wp-plugin'));
    assert.ok(selectNucleiTags(['Express', 'Node.js']).includes('nodejs'));
    assert.deepEqual(selectNucleiTags(['SomeObscureServer 9.9']), ['misconfig', 'exposure']);
    assert.deepEqual(selectNucleiTags([]), ['misconfig', 'exposure']);
  });

  it('buildNucleiArgs: tags + severity, no aggressive flags', () => {
    const args = buildNucleiArgs({ tags: ['wordpress'], severity: 'high,critical' });
    assert.ok(args.includes('-tags') && args[args.indexOf('-tags') + 1] === 'wordpress');
    assert.ok(args.includes('-severity') && args[args.indexOf('-severity') + 1] === 'high,critical');
    assert.ok(args.includes('-silent') && args.includes('-json'));
    assert.ok(!args.some((a) => /-T[45]/.test(a)), 'no aggressive timing');
  });

  it('RAN: tech-selected scan normalizes to findings', async () => {
    const r = await nucleiLoop(stubExecutor(await FIX('nuclei.jsonl')), 'a1', 'u1',
      { target: 'https://target.local', techs: ['WordPress 6.4.1', 'PHP 8.1'] });
    assert.equal(r.status, 'ran');
    assert.equal(r.tool, 'nuclei');
    assert.equal(r.findings.length, 3);
    assert.ok(r.templateTags.includes('wordpress'), 'tech-selected tags recorded');
    r.findings.forEach((f) => assertFindingSchema(f, 'nucleiLoop'));
    assert.match(r.note, /3 finding/);
  });

  it('DEGRADES HONESTLY: kali_required → tool-unavailable, zero fake findings', async () => {
    const kaliRequired = JSON.stringify({ status: 'kali_required', tool: 'nuclei', message: 'no worker' });
    const r = await nucleiLoop(stubExecutor(kaliRequired), 'a1', 'u1', { target: 'https://target.local' });
    assert.equal(r.status, 'tool-unavailable');
    assert.deepEqual(r.findings, [], 'no fake findings');
    assert.equal(r.degraded, true);
    assert.match(r.note, /unavailable/i);
  });

  it('requires a target', async () => {
    await assert.rejects(nucleiLoop(stubExecutor(''), 'a1', 'u1', {}), /requires a target/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// sqlmapLoop: param discovery → boolean-based confirm
// ═══════════════════════════════════════════════════════════════════
describe('sqlmapLoop', () => {
  it('buildSqlmapBooleanArgs: boolean technique only, safe risk/level, batch', () => {
    const args = buildSqlmapBooleanArgs('q');
    assert.ok(args.includes('--technique=B'), 'boolean-based confirm');
    assert.ok(args.includes('--risk=1') && args.includes('--level=1'), 'stays at safe risk/level');
    assert.ok(args.includes('--batch'), 'never interactive');
    assert.ok(args.includes('-p') && args[args.indexOf('-p') + 1] === 'q');
    assert.ok(!args.some((a) => /--dump|--os-shell|--os-cmd|--os-pwn|--file-write|--sql-shell/i.test(a)),
      'no destructive/exfil flags in the confirm loop');
  });

  it('RAN: boolean confirm normalizes injectable params to findings', async () => {
    const r = await sqlmapLoop(stubExecutor(await FIX('sqlmap.txt')), 'a1', 'u1',
      { url: 'http://127.0.0.1:4562/search', params: ['q'] });
    assert.equal(r.status, 'ran');
    assert.equal(r.findings.length, 2);
    assert.equal(r.perParam.length, 1);
    assert.equal(r.perParam[0].param, 'q');
    assert.equal(r.perParam[0].status, 'ran');
    r.findings.forEach((f) => assertFindingSchema(f, 'sqlmapLoop'));
    assert.ok(r.findings.every((f) => f.type === 'sql-injection'));
  });

  it('SKIPS honestly when no params were discovered', async () => {
    const r = await sqlmapLoop(stubExecutor(''), 'a1', 'u1', { url: 'http://x/', params: [] });
    assert.equal(r.status, 'skipped');
    assert.deepEqual(r.findings, []);
    assert.match(r.note, /no parameters discovered/i);
  });

  it('DEGRADES HONESTLY: kali_required → tool-unavailable per param', async () => {
    const kaliRequired = JSON.stringify({ status: 'kali_required', tool: 'sqlmap' });
    const r = await sqlmapLoop(stubExecutor(kaliRequired), 'a1', 'u1',
      { url: 'http://127.0.0.1:4562/search', params: ['q', 'page'] });
    assert.equal(r.status, 'tool-unavailable');
    assert.deepEqual(r.findings, [], 'no fake findings');
    assert.ok(r.perParam.every((p) => p.status === 'tool-unavailable'));
  });
});

// ═══════════════════════════════════════════════════════════════════
// dalfoxLoop: reflected + stored
// ═══════════════════════════════════════════════════════════════════
describe('dalfoxLoop', () => {
  it('buildDalfoxArgs: url mode, silent JSON', () => {
    assert.deepEqual(buildDalfoxArgs(), ['url', '--silence', '--format', 'json']);
  });

  it('RAN: reflected finding lands in the reflected bucket', async () => {
    const r = await dalfoxLoop(stubExecutor(await FIX('dalfox.json')), 'a1', 'u1',
      { url: 'http://127.0.0.1:4562/search?q=1' });
    assert.equal(r.status, 'ran');
    assert.equal(r.findings.length, 1);
    assert.equal(r.reflected, 1);
    assert.equal(r.stored, 0);
    assert.equal(r.findings[0].type, 'reflected-xss');
    r.findings.forEach((f) => assertFindingSchema(f, 'dalfoxLoop'));
  });

  it('RAN: stored finding lands in the stored bucket (severity high)', async () => {
    const r = await dalfoxLoop(stubExecutor(await FIX('dalfox-stored.json')), 'a1', 'u1',
      { url: 'http://127.0.0.1:4562/guestbook' });
    assert.equal(r.status, 'ran');
    assert.equal(r.stored, 1);
    assert.equal(r.reflected, 0);
    assert.equal(r.findings[0].type, 'stored-xss');
    assert.equal(r.findings[0].severity, 'high');
    assert.equal(r.findings[0].evidence.param, 'comment');
  });

  it('DEGRADES HONESTLY: kali_required → tool-unavailable, zero fake findings', async () => {
    const kaliRequired = JSON.stringify({ status: 'kali_required', tool: 'dalfox' });
    const r = await dalfoxLoop(stubExecutor(kaliRequired), 'a1', 'u1', { url: 'http://127.0.0.1:4562/search' });
    assert.equal(r.status, 'tool-unavailable');
    assert.deepEqual(r.findings, [], 'no fake findings');
    assert.match(r.note, /unavailable/i);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Permission-service gating THROUGH the real ToolExecutor
// ═══════════════════════════════════════════════════════════════════
function realExecutor({ permissionService }) {
  const executions = new Map();
  let seq = 0;
  return new ToolExecutor({
    toolExecutionModel: {
      constructor: { fingerprint: (t, target, args) => `${t}|${target}|${JSON.stringify(args || {})}` },
      findByFingerprint: async () => null,
      create: async (aid, uid, data) => { const e = { id: `ex${++seq}`, ...data }; executions.set(e.id, e); return e; },
      markStarted: async () => {},
      markCompleted: async (id, data) => Object.assign(executions.get(id), data),
      markFailed: async (id, msg) => { executions.get(id).failed = msg; }
    },
    eventService: { publish: async () => {} },
    scopeEngine: { validateToolTarget: () => ({ valid: true }) },
    permissionService
  });
}

describe('scan loops: permission-service gating via the real executor', () => {
  it('sqlmap in ask mode → needs-approval with the approval id (nothing executed)', async () => {
    const perm = new PermissionService(); // default mode = ask
    const ex = realExecutor({ permissionService: perm });
    let kaliCalls = 0;
    ex.executeOnKali = async () => { kaliCalls++; return ''; };
    const r = await sqlmapLoop(ex, 'a1', 'u1', { url: 'http://127.0.0.1:4562/search', params: ['q'] });
    assert.equal(r.status, 'ran'); // loop-level ran; the param itself was gated
    assert.equal(r.perParam[0].status, 'needs-approval');
    assert.ok(r.perParam[0].approval?.id?.startsWith('apr_'), 'approval id surfaced for the frontend card');
    assert.equal(kaliCalls, 0, 'blocked before any execution attempt');
  });

  it('sqlmap approved in ask mode → proceeds, then degrades honestly (no worker here)', async () => {
    const perm = new PermissionService();
    const ex = realExecutor({ permissionService: perm });
    // approve the pending request first via the policy path
    const pre = await sqlmapLoop(ex, 'a1', 'u1', { url: 'http://127.0.0.1:4562/search', params: ['q'] });
    perm.resolveApproval(pre.perParam[0].approval.id, { approved: true, userId: 'u1' });
    const r = await sqlmapLoop(ex, 'a1', 'u1', { url: 'http://127.0.0.1:4562/search', params: ['q'] });
    assert.equal(r.perParam[0].status, 'tool-unavailable', 'approved → ran → honest degradation (no worker in sandbox)');
    assert.deepEqual(r.findings, []);
  });

  it('sqlmap in full mode → allowed by policy, then honest degradation', async () => {
    const perm = new PermissionService();
    perm.setPermissionMode('u1', 'full');
    const ex = realExecutor({ permissionService: perm });
    const r = await sqlmapLoop(ex, 'a1', 'u1', { url: 'http://127.0.0.1:4562/search', params: ['q'] });
    assert.equal(r.status, 'tool-unavailable');
    assert.ok(perm.getAuditLog({ userId: 'u1' }).some((e) => e.event === 'destructive_allowed_full_mode'),
      'full-mode execution left an audit trail');
  });

  it('nuclei in ask mode is NOT permission-gated (non-destructive) — degrades on missing worker', async () => {
    const perm = new PermissionService();
    const ex = realExecutor({ permissionService: perm });
    const r = await nucleiLoop(ex, 'a1', 'u1', { target: 'https://target.local' });
    assert.equal(r.status, 'tool-unavailable', 'policy passed; only the missing worker stopped it');
    assert.deepEqual(r.findings, []);
  });

  it('a policy HARD block (sqlmap --risk=3) surfaces as blocked — never an approval, never executed', async () => {
    const perm = new PermissionService();
    perm.setPermissionMode('u1', 'full'); // even full mode cannot override a hard block
    const ex = realExecutor({ permissionService: perm });
    let kaliCalls = 0;
    ex.executeOnKali = async () => { kaliCalls++; return ''; };
    const r = await sqlmapLoop(ex, 'a1', 'u1', {
      url: 'http://127.0.0.1:4562/search', params: ['q'], extraArgs: ['--risk=3']
    });
    assert.equal(r.perParam[0].status, 'blocked');
    assert.match(r.perParam[0].note, /Blocked argument pattern/);
    assert.deepEqual(r.findings, []);
    assert.equal(kaliCalls, 0, 'hard-blocked before any execution attempt');
  });
});

describe('runDetectionLoop dispatch', () => {
  it('invokes loops by name through one entry point', async () => {
    const r = await runDetectionLoop(stubExecutor(await FIX('nuclei.jsonl')), 'a1', 'u1', 'nuclei',
      { target: 'https://target.local' });
    assert.equal(r.status, 'ran');
    assert.equal(r.tool, 'nuclei');
    const d = await runDetectionLoop(
      stubExecutor(JSON.stringify({ status: 'kali_required' })), 'a1', 'u1', 'dalfox',
      { url: 'http://127.0.0.1:4562/search' });
    assert.equal(d.status, 'tool-unavailable');
  });

  it('rejects unknown loop names', async () => {
    await assert.rejects(runDetectionLoop(stubExecutor(''), 'a1', 'u1', 'nikto', {}), /Unknown detection loop/);
  });
});
