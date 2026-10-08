/**
 * toolRunner.js — Infinity AI external scanner pipeline.
 *
 * Runs the ProjectDiscovery recon/vuln toolchain (subfinder, dnsx, httpx,
 * katana, nuclei, naabu) as SEPARATE OS-level subprocesses via child_process
 * spawn. The binaries are never bundled, linked, imported, or modified —
 * they are external tools the operator installs; see THIRD_PARTY_NOTICES.md
 * for the licensing rationale.
 *
 * Speed design:
 *   - The standard fast pipeline: subfinder → dnsx → httpx → katana → nuclei,
 *     each stage streaming JSONL findings live so the report builds DURING
 *     the hunt, not after it.
 *   - Per-tool speed flags: nuclei (-c, -bs, -rl, -s critical,high, -ni,
 *     -timeout 10, -retries 1), httpx (-td, -t, -rl), katana (-c, -d 3, -jc),
 *     subfinder/dnsx (-t, -rl).
 *   - nuclei -ai is deliberately NOT used (cloud dependency).
 *
 * Safety:
 *   - argv arrays only — never shell:true, never string interpolation into
 *     a shell. Targets are validated as hostnames/URLs before use.
 *   - Per-tool timeouts with SIGKILL; graceful degradation when a binary is
 *     absent (log + continue with the engine-based recon feed).
 *   - Concurrency caps via a small semaphore.
 */

import { spawn as nodeSpawn } from 'node:child_process';
import { execOnVm } from './vmRunnerClient.js';
import { createTargetScope, hostOfTarget } from './targetScope.js';

/** Default per-tool wall-clock timeouts (ms). */
export const TOOL_TIMEOUTS = Object.freeze({
  subfinder: 120_000,
  dnsx: 120_000,
  httpx: 180_000,
  katana: 300_000,
  nuclei: 600_000,
  naabu: 300_000,
});

const DEFAULT_THREADS = 25;
const DEFAULT_RATE_LIMIT = 150;

/**
 * Tool definitions: binary, argv builder, and JSONL line parser.
 * Flags follow the ProjectDiscovery speed guidance; severities are capped
 * to critical/high for speed (standard profile widens this).
 */
export const PD_TOOLS = {
  subfinder: {
    bin: 'subfinder',
    stage: 'recon',
    buildArgs: (target, o) => [
      '-d',
      target,
      '-silent',
      '-json',
      '-t',
      String(o.threads),
      '-rl',
      String(o.rateLimit),
    ],
    parseLine: line => {
      const j = safeJson(line);
      if (!j?.host) return null;
      return { kind: 'host', host: j.host, source: j.source || 'subfinder', raw: j };
    },
  },
  dnsx: {
    bin: 'dnsx',
    stage: 'recon',
    buildArgs: (_t, o) => [
      '-silent',
      '-json',
      '-t',
      String(o.threads),
      '-rl',
      String(o.rateLimit),
      '-wd',
      _t,
    ],
    parseLine: line => {
      const j = safeJson(line);
      if (!j?.host) return null;
      return { kind: 'dns', host: j.host, a: j.a || [], cname: j.cname || [], raw: j };
    },
  },
  httpx: {
    bin: 'httpx',
    stage: 'recon',
    buildArgs: (_t, o) => [
      '-silent',
      '-json',
      '-td',
      '-t',
      String(o.threads),
      '-rl',
      String(o.rateLimit),
      '-timeout',
      '10',
      '-retries',
      '1',
    ],
    parseLine: line => {
      const j = safeJson(line);
      if (!j?.url) return null;
      return {
        kind: 'http',
        url: j.url,
        host: j.host || '',
        title: j.title || '',
        statusCode: j['status-code'] ?? j.status_code ?? 0,
        tech: j.tech || [],
        ip: j.ip || '',
        raw: j,
      };
    },
  },
  katana: {
    bin: 'katana',
    stage: 'recon',
    buildArgs: (_t, o) => [
      '-silent',
      '-jsonl',
      '-c',
      String(o.threads),
      '-d',
      '3',
      '-jc',
      '-kf',
      'all',
      '-timeout',
      '10',
    ],
    parseLine: line => {
      const j = safeJson(line);
      const endpoint = j?.request?.endpoint;
      if (!endpoint) return null;
      return { kind: 'endpoint', url: endpoint, method: j.request.method || 'GET', raw: j };
    },
  },
  nuclei: {
    bin: 'nuclei',
    stage: 'vuln',
    buildArgs: (_t, o) => {
      const args = [
        '-silent',
        '-j',
        '-c',
        String(o.threads),
        '-bs',
        '25',
        '-rl',
        String(o.rateLimit),
        '-timeout',
        '10',
        '-retries',
        '1',
        '-ni',
      ];
      if (o.profile === 'fast') args.push('-s', 'critical,high');
      return args;
    },
    parseLine: line => {
      const j = safeJson(line);
      if (!j?.['template-id']) return null;
      const info = j.info || {};
      return {
        kind: 'finding',
        title: info.name || j['template-id'],
        templateId: j['template-id'],
        severity: String(info.severity || 'info').toLowerCase(),
        target: j['matched-at'] || j.host || '',
        description: `Matched template ${j['template-id']}${j['matcher-name'] ? ` (matcher: ${j['matcher-name']})` : ''}.`,
        evidence: JSON.stringify({
          matchedAt: j['matched-at'],
          extracted: j['extracted-results'] || undefined,
        }).slice(0, 2000),
        remediation: info.remediation || '',
        raw: j,
      };
    },
  },
  naabu: {
    bin: 'naabu',
    stage: 'recon',
    buildArgs: (_t, o) => [
      '-silent',
      '-json',
      '-t',
      String(o.threads),
      '-rl',
      String(o.rateLimit),
      '-timeout',
      '10',
    ],
    parseLine: line => {
      const j = safeJson(line);
      if (!j?.host || j?.port == null) return null;
      return { kind: 'port', host: j.host, port: j.port, ip: j.ip || '', raw: j };
    },
  },
};

function safeJson(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/** Validate that a target is a plausible hostname/URL before handing it to a binary. */
export function sanitizeTarget(target) {
  const t = String(target || '').trim();
  if (!t) throw new Error('empty target');
  // Allow hostnames, IPv4/IPv6, and http(s) URLs — nothing shell-ish.
  if (/[;&|`$(){}[\]<>!#'"\\]/.test(t))
    throw new Error(`unsafe target rejected: ${t.slice(0, 60)}`);
  if (t.length > 253) throw new Error('target too long');
  const host = t
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0];
  if (!/^[A-Za-z0-9_.-]+$/.test(host) && !/^\[[0-9a-fA-F:]+\]$/.test(host)) {
    throw new Error(`invalid target host: ${t.slice(0, 60)}`);
  }
  return t;
}

function sanitizeTargets(targets) {
  const list = (Array.isArray(targets) ? targets : [targets]).map(sanitizeTarget);
  return [...new Set(list)].slice(0, 500);
}

/** Tiny semaphore for concurrency caps. */
function createSemaphore(limit) {
  let active = 0;
  const queue = [];
  const acquire = () =>
    new Promise(resolve => {
      if (active < limit) {
        active++;
        resolve();
      } else queue.push(resolve);
    });
  const release = () => {
    active--;
    const next = queue.shift();
    if (next) {
      active++;
      next();
    }
  };
  return { acquire, release };
}

/**
 * Quote one argv element for the guest shell. Targets are already sanitized
 * (no shell metacharacters allowed), so single-quote wrapping is sufficient.
 */
function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/**
 * Build the exact command string the VM runner executes inside the guest.
 * Same binary + argv the local path would spawn; stdin-fed tools get their
 * targets via a printf pipe (identical semantics to the spawn path).
 */
function buildVmCommand(def, name, list, o, stdinLines) {
  const argv = [def.bin, ...def.buildArgs(list[0], o)].map(shellQuote).join(' ');
  if (!stdinLines.length) return argv;
  return `printf '%s\\n' ${stdinLines.map(shellQuote).join(' ')} | ${argv}`;
}

/**
 * Run one tool inside the attached VM session via POST /vm/exec instead of
 * spawning a binary on the backend host. The target-scope gate (design §7)
 * runs first: out-of-scope targets are blocked without touching the runner.
 */
async function runToolOnVm({ def, name, list, o, vm, started, logger }) {
  const scope = createTargetScope(vm.targets || []);
  for (const t of list) {
    const host = hostOfTarget(t);
    if (!scope.allows(host)) {
      const error = `target "${t.slice(0, 80)}" is outside the authorized hunt scope (${scope.hosts.join(', ') || 'none declared'}) — blocked`;
      logger.warn?.(`[toolRunner] ${name}: ${error}`);
      return { tool: name, records: [], findings: [], skipped: false, blocked: true, durationMs: Date.now() - started, error };
    }
  }
  const records = [];
  const findings = [];
  const stdinLines = o.stdinLines ?? (['subfinder'].includes(name) ? [] : list);
  const command = buildVmCommand(def, name, list, o, stdinLines);
  let execRes;
  try {
    execRes = await execOnVm({
      baseUrl: vm.baseUrl,
      token: vm.token,
      sessionId: vm.sessionId,
      command,
      timeoutMs: o.timeoutMs,
    });
  } catch (err) {
    const error = `VM runner exec failed: ${err?.message || err}`;
    logger.warn?.(`[toolRunner] ${name}: ${error}`);
    return { tool: name, records, findings, skipped: false, durationMs: Date.now() - started, error };
  }
  for (const line of String(execRes.stdout || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let rec = null;
    try {
      rec = def.parseLine(trimmed);
    } catch (e) {
      logger.warn?.(`[toolRunner] ${name} (vm) line handler: ${e.message}`);
      continue;
    }
    if (!rec) continue;
    records.push(rec);
    o.onRecord?.(rec);
    if (rec.kind === 'finding') {
      findings.push(rec);
      o.onFinding?.(rec);
    }
  }
  return {
    tool: name,
    records,
    findings,
    skipped: false,
    durationMs: Date.now() - started,
    exitCode: execRes.exit_code,
    timedOut: execRes.timed_out,
    error: execRes.timed_out ? `timed out after ${o.timeoutMs}ms` : undefined,
  };
}

/**
 * Create a tool runner. `spawnFn` is injectable for tests.
 *
 * `vm` (optional) attaches a VM session: shell-type tool actions then run
 * inside the session's Kali VM via POST /vm/exec instead of spawning binaries
 * on this host. Shape: { sessionId, baseUrl?, token?, targets? } where
 * `targets` is the hunt's declared target scope for the allowlist gate
 * (defaults to the runTool targets when omitted).
 */
export function createToolRunner({
  spawnFn = nodeSpawn,
  logger = console,
  timeouts = TOOL_TIMEOUTS,
  maxConcurrent = 3,
  vm = null,
} = {}) {
  const sem = createSemaphore(Math.max(1, maxConcurrent));

  /**
   * Probe whether a binary exists by spawning `<bin> -version`.
   * Resolves true/false — never throws.
   */
  async function isAvailable(name) {
    const def = PD_TOOLS[name];
    if (!def) return false;
    return new Promise(resolve => {
      let child;
      try {
        child = spawnFn(def.bin, ['-version'], { stdio: 'ignore' });
      } catch {
        resolve(false);
        return;
      }
      child.on('error', () => resolve(false));
      child.on('exit', code => resolve(code === 0 || code === 2));
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* noop */
        }
        resolve(false);
      }, 8000);
    });
  }

  /**
   * Run one tool as a subprocess, streaming parsed JSONL records.
   *
   * @param {string} name — tool key in PD_TOOLS
   * @param {string|string[]} targets
   * @param {object} opts — { profile, threads, rateLimit, timeoutMs, stdinLines, onRecord, onFinding, signal }
   * @returns {Promise<{ tool, records, findings, skipped, durationMs, error? }>}
   */
  async function runTool(name, targets, opts = {}) {
    const def = PD_TOOLS[name];
    if (!def) throw new Error(`unknown tool "${name}"`);
    const list = sanitizeTargets(targets);
    const o = {
      profile: opts.profile === 'standard' ? 'standard' : 'fast',
      threads: opts.threads || DEFAULT_THREADS,
      rateLimit: opts.rateLimit || DEFAULT_RATE_LIMIT,
      timeoutMs: opts.timeoutMs || timeouts[name] || 180_000,
    };
    const started = Date.now();

    // VM-attached path (design §6): shell-type tool actions run inside the
    // session's Kali VM via POST /vm/exec — never spawned on this host.
    if (vm && vm.sessionId) {
      return runToolOnVm({
        def,
        name,
        list,
        vm,
        started,
        logger,
        o: { ...o, stdinLines: opts.stdinLines, onRecord: opts.onRecord, onFinding: opts.onFinding },
      });
    }

    const records = [];
    const findings = [];

    await sem.acquire();
    try {
      const argv = def.buildArgs(list[0], o);
      // stdin-fed tools (dnsx/httpx/katana/nuclei) get the remaining targets on stdin.
      const stdinLines = opts.stdinLines ?? (['subfinder'].includes(name) ? [] : list);
      const child = await spawnChecked(def.bin, argv);
      if (!child) {
        logger.warn?.(
          `[toolRunner] ${def.bin} not installed — skipping ${name}, continuing with engine-based recon`
        );
        return {
          tool: name,
          records,
          findings,
          skipped: true,
          durationMs: Date.now() - started,
          error: 'binary not found',
        };
      }

      const outcome = await streamChild(child, {
        tool: name,
        bin: def.bin,
        timeoutMs: o.timeoutMs,
        stdinLines,
        signal: opts.signal,
        onLine: line => {
          const rec = def.parseLine(line);
          if (!rec) return;
          records.push(rec);
          opts.onRecord?.(rec);
          if (rec.kind === 'finding') {
            findings.push(rec);
            opts.onFinding?.(rec);
          }
        },
        logger,
      });
      const skipped = outcome.skipped === true;
      if (skipped) {
        logger.warn?.(
          `[toolRunner] ${def.bin} not installed — skipping ${name}, continuing with engine-based recon`
        );
      }
      return {
        tool: name,
        records,
        findings,
        skipped,
        durationMs: Date.now() - started,
        ...outcome,
      };
    } finally {
      sem.release();
    }
  }

  /** Spawn and translate a synchronous spawn failure into null (binary absent). */
  function spawnChecked(bin, argv) {
    try {
      return spawnFn(bin, argv, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      return null;
    }
  }

  return { isAvailable, runTool };
}

/** Stream a child's stdout line-by-line with a wall-clock timeout. */
function streamChild(child, { tool, bin, timeoutMs, stdinLines, signal, onLine, logger }) {
  return new Promise(resolve => {
    let buffer = '';
    let killed = false;
    const finish = result => {
      clearTimeout(timer);
      try {
        child.stdin?.end();
      } catch {
        /* noop */
      }
      resolve(result);
    };
    const timer = setTimeout(() => {
      killed = true;
      logger.warn?.(`[toolRunner] ${bin} timed out after ${timeoutMs}ms — killing`);
      try {
        child.kill('SIGKILL');
      } catch {
        /* noop */
      }
      finish({ timedOut: true });
    }, timeoutMs);

    if (signal) {
      const abort = () => {
        killed = true;
        try {
          child.kill('SIGKILL');
        } catch {
          /* noop */
        }
        finish({ aborted: true });
      };
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    }

    if (Array.isArray(stdinLines) && stdinLines.length && child.stdin?.writable) {
      child.stdin.write(`${stdinLines.join('\n')}\n`);
    }
    try {
      child.stdin?.end();
    } catch {
      /* noop */
    }

    child.stdout?.on('data', chunk => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line) {
          try {
            onLine(line);
          } catch (e) {
            logger.warn?.(`[toolRunner] ${tool} line handler: ${e.message}`);
          }
        }
      }
    });
    child.stderr?.on('data', () => {
      /* PD tools are chatty on stderr; ignore */
    });
    child.on('error', err => {
      // ENOENT = binary not installed → graceful skip, not a failure.
      if (err?.code === 'ENOENT') {
        logger.warn?.(`[toolRunner] ${bin} not installed — skipping`);
        finish({ skipped: true, error: 'binary not found' });
        return;
      }
      if (!killed) {
        logger.warn?.(`[toolRunner] ${bin} error: ${err.message}`);
        finish({ error: err.message });
      }
    });
    child.on('close', code => {
      if (buffer.trim()) {
        try {
          onLine(buffer.trim());
        } catch {
          /* noop */
        }
      }
      finish({ exitCode: code, timedOut: killed && undefined });
    });
  });
}

/**
 * The standard fast pipeline: subfinder → dnsx → httpx → katana → nuclei.
 * Findings stream live via onFinding as each stage produces them, so the
 * report builds DURING the hunt.
 *
 * @param {string|string[]} targets
 * @param {object} opts — { profile, onFinding, onRecord, onStage, signal, logger, spawnFn, timeouts, maxConcurrent, skipTools, vm }
 * `vm` — optional { sessionId, baseUrl?, token?, targets? }: route tool execs to the VM runner instead of spawning locally.
 * @returns {Promise<{ findings, recordsByTool, stages }>}
 */
export async function runPipeline(targets, opts = {}) {
  const logger = opts.logger || console;
  const runner = createToolRunner({
    spawnFn: opts.spawnFn, logger,
    timeouts: opts.timeouts, maxConcurrent: opts.maxConcurrent,
    vm: opts.vm,
  });
  const list = sanitizeTargets(targets);
  const profile = opts.profile === 'standard' ? 'standard' : 'fast';
  const skip = new Set(opts.skipTools || []);
  const findings = [];
  const recordsByTool = {};
  const stages = [];

  const onFinding = rec => {
    findings.push({ ...rec, pipelineStage: rec.kind });
    opts.onFinding?.(rec);
  };

  async function stage(name, stageTargets, extra = {}) {
    if (skip.has(name)) {
      stages.push({ tool: name, skipped: true, reason: 'operator skip' });
      return { records: [], findings: [] };
    }
    opts.onStage?.({ tool: name, phase: 'start', targets: stageTargets.length });
    const res = await runner.runTool(name, stageTargets, {
      profile,
      onFinding,
      onRecord: opts.onRecord,
      signal: opts.signal,
      ...extra,
    });
    recordsByTool[name] = res.records;
    stages.push({
      tool: name,
      skipped: res.skipped,
      records: res.records.length,
      findings: res.findings.length,
      durationMs: res.durationMs,
    });
    opts.onStage?.({
      tool: name,
      phase: 'done',
      records: res.records.length,
      findings: res.findings.length,
      skipped: res.skipped,
    });
    return res;
  }

  // 1. subfinder: passive subdomain enumeration for the root target(s).
  const roots = list.map(t => t.replace(/^https?:\/\//i, '').split('/')[0]);
  const sub = await stage('subfinder', roots);
  const subdomains = sub.records.map(r => r.host).filter(Boolean);

  // 2. dnsx: resolve + wildcard-filter the discovered names.
  const dnsTargets = subdomains.length ? subdomains : roots;
  const dns = await stage('dnsx', roots, { stdinLines: dnsTargets });
  const liveHosts = [...new Set(dns.records.map(r => r.host).filter(Boolean))];
  const resolveTargets = liveHosts.length ? liveHosts : dnsTargets;

  // 3. httpx: probe live HTTP services + technology detection.
  const http = await stage('httpx', roots, { stdinLines: resolveTargets });
  const urls = [...new Set(http.records.map(r => r.url).filter(Boolean))];
  const httpTargets = urls.length ? urls : resolveTargets;

  // 4. katana: crawl endpoints/JS from live URLs.
  const kat = await stage('katana', httpTargets.slice(0, 50), {
    stdinLines: httpTargets.slice(0, 50),
  });
  const endpoints = [...new Set(kat.records.map(r => r.url).filter(Boolean))];

  // 5. nuclei: template scan over live hosts/endpoints (severity-capped in fast profile).
  const nucleiTargets = [...new Set([...httpTargets, ...endpoints])].slice(0, 200);
  if (nucleiTargets.length) {
    await stage('nuclei', nucleiTargets.slice(0, 1), { stdinLines: nucleiTargets });
  } else {
    stages.push({ tool: 'nuclei', skipped: true, reason: 'no live targets discovered' });
    logger.warn?.('[toolRunner] nuclei skipped: no live targets discovered upstream');
  }

  // 6. naabu: optional port sweep on resolved hosts (fast profile skips by default).
  if (profile === 'standard' && resolveTargets.length) {
    await stage('naabu', resolveTargets.slice(0, 20), { stdinLines: resolveTargets.slice(0, 20) });
  }

  logger.info?.(
    `[toolRunner] pipeline complete: ${findings.length} findings from ${stages.length} stages`
  );
  return { findings, recordsByTool, stages };
}

export default { createToolRunner, runPipeline, PD_TOOLS, TOOL_TIMEOUTS, sanitizeTarget };
