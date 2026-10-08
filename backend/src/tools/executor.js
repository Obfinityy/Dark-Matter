import { config } from '../config.js';
import { AppError } from '../core/errors.js';
import { ToolRegistry } from './registry.js';
import { PolicyValidator } from './policyValidator.js';
import { parseToolOutput, summarizeForAI } from './parsers/index.js';
import { WafAdaptiveState, parseWafw00f } from '../recon/wafAdaptive.js';
import { HTTP_PROBES } from './builtin/httpProbes.js';
import { ADV_PROBES } from './builtin/advProbes.js';
import { permissionService as defaultPermissionService } from '../services/permissionService.js';

/**
 * Fallback tool map for bad-tool-output recovery (G33): when a tool errors
 * or returns garbage, the brain retries with a DIFFERENT approach instead of
 * dying. Order matters — cheapest/safest alternative first.
 */
export const FALLBACK_TOOLS = Object.freeze({
  nuclei: [{ tool: 'nikto', note: 'nuclei failed → nikto misconfiguration sweep as fallback' }],
  nikto: [{ tool: 'nuclei', note: 'nikto failed → nuclei broad sweep as fallback' }],
  katana: [
    { tool: 'gau', note: 'katana failed → gau archive URLs as fallback' },
    { tool: 'waybackurls', note: 'gau failed → waybackurls as fallback' }
  ],
  nmap: [{ tool: 'naabu', note: 'nmap failed → naabu fast port sweep as fallback', args: ['-silent', '-json', '-top-ports', '1000'] }],
  naabu: [{ tool: 'nmap', note: 'naabu failed → nmap fast scan as fallback', args: ['-F', '-T4', '-oX', '-'] }],
  dnsx: [{ tool: 'crtsh', note: 'dnsx failed → crt.sh passive lookup as fallback' }],
  whatweb: [{ tool: 'httpx', note: 'whatweb failed → httpx tech-detect as fallback', args: ['-silent', '-json', '-tech-detect'] }],
  ffuf: [{ tool: 'gobuster', note: 'ffuf failed → gobuster as fallback' }],
  dalfox: [{ tool: 'nuclei', note: 'dalfox failed → nuclei XSS-tagged templates as fallback', args: ['-silent', '-json', '-tags', 'xss'] }],
  arjun: [{ tool: 'paramspider', note: 'arjun failed → paramspider archive mining as fallback' }]
});

/** Heuristics for "the tool ran but the output is garbage". */
export function isGarbageResult(parseResult, rawOutput) {
  const raw = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput || '');
  if (parseResult && parseResult.success === false) return true;
  if (/command not found|not recognized as an internal/i.test(raw)) return true;
  if (raw.includes('"status":"kali_required"') || raw.includes('"status": "kali_required"')) return true;
  if (!raw.trim()) return true;
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * ToolExecutor — controlled execution layer between the AI brain and actual tools.
 *
 * Execution flow:
 *   AI Decision → PolicyValidator → ScopeEngine → Dedup Check → Execute → Parse → Store
 *
 * Supports two execution modes:
 *   1. Built-in (crt.sh HTTP lookup, no Kali needed)
 *   2. Kali Worker (sends structured requests to a Kali Linux worker)
 */
export class ToolExecutor {
  constructor({ toolExecutionModel, eventService, scopeEngine, permissionService = null } = {}) {
    this.toolExecutionModel = toolExecutionModel;
    this.eventService = eventService;
    this.scopeEngine = scopeEngine;
    this.permissionService = permissionService || defaultPermissionService;
    // G34: per-assessment WAF state — wafw00f detection ENFORCES stealth.
    this.wafState = new WafAdaptiveState();
  }

  /**
   * Feed a wafw00f result into the adaptive state. When a WAF is detected,
   * all later tool executions for this assessment are stealth-enforced.
   * Accepts raw wafw00f output or an already-parsed {detected, waf} object.
   */
  applyWafDetection(assessmentId, wafw00fRawOrParsed) {
    const parsed = typeof wafw00fRawOrParsed === 'string' || wafw00fRawOrParsed?.firewall
      ? parseWafw00f(typeof wafw00fRawOrParsed === 'string' ? wafw00fRawOrParsed : JSON.stringify(wafw00fRawOrParsed))
      : wafw00fRawOrParsed;
    return this.wafState.applyWafDetection(assessmentId, parsed);
  }

  /** True when this assessment is under enforced stealth. */
  isStealthEnforced(assessmentId) {
    return this.wafState.isEnforced(assessmentId);
  }

  /**
   * Execute a tool with full policy validation, dedup, and result parsing.
   * @returns {{ execution, parsed, aiSummary }}
   */
  async execute(assessmentId, userId, request, opts = {}) {
    const tool = ToolRegistry.get(request.tool);
    if (!tool) throw new AppError(400, `Unknown tool: ${request.tool}`, 'UNKNOWN_TOOL');

    // 0. G34 WAF-adaptive enforcement: rewrite the request through the
    //    enforced stealth profile BEFORE policy validation.
    const { request: effectiveRequest, enforced, changes } = this.wafState.enforce(assessmentId, request);
    if (enforced) {
      await this.eventService.publish(assessmentId, {
        type: 'STEALTH_ENFORCED',
        level: 'INFO',
        message: `WAF-adaptive stealth enforced on ${request.tool}: ${changes.join('; ')}`,
        data: { tool: request.tool, changes }
      });
      // Pre-request jitter: timing randomization against WAF rate analysis.
      const jitter = effectiveRequest.meta?.preRequestJitterMs;
      if (jitter) await sleep(Math.round(jitter * (0.5 + Math.random())));
    }
    request = effectiveRequest;

    // 1. Policy validation (H41: permissionMode-aware). A per-call scopeEngine
    //    (the hunt's own authorized scope) overrides the executor's boot-time
    //    default — without it every in-scope tool would fail validation.
    const policy = PolicyValidator.validate(request, opts.scopeEngine || this.scopeEngine, {
      permissionService: this.permissionService,
      userId
    });
    if (!policy.allowed) {
      await this.eventService.publish(assessmentId, {
        type: 'TOOL_BLOCKED',
        level: 'WARN',
        message: `Policy blocked ${request.tool}: ${policy.reason}`,
        data: { tool: request.tool, reason: policy.reason }
      });
      // Attach the approval record (if the validator created one) so callers
      // — e.g. the detection scan loops — can surface the pending approval
      // to the user instead of just a bare denial.
      const blocked = new AppError(403, policy.reason, 'POLICY_VIOLATION');
      if (policy.approval) blocked.approval = policy.approval;
      throw blocked;
    }

    // 2. Deduplication check
    const fingerprint = this.toolExecutionModel.constructor.fingerprint(
      request.tool, request.target, request.arguments
    );
    const existing = await this.toolExecutionModel.findByFingerprint(assessmentId, fingerprint);
    if (existing) {
      await this.eventService.publish(assessmentId, {
        type: 'TOOL_DEDUPLICATED',
        level: 'INFO',
        message: `Skipping ${request.tool} — identical execution already completed`,
        data: { tool: request.tool, existingId: existing.id }
      });
      // Return cached result
      const cachedParsed = existing.parsedResults || {};
      return {
        execution: existing,
        parsed: cachedParsed,
        aiSummary: existing.aiSummary || summarizeForAI(request.tool, cachedParsed),
        deduplicated: true,
        parseOk: true,
        rawOutput: typeof existing.rawOutput === 'string' ? existing.rawOutput : ''
      };
    }

    // 3. Create execution record
    const execution = await this.toolExecutionModel.create(assessmentId, userId, {
      tool: request.tool,
      category: tool.category,
      target: request.target,
      arguments: request.arguments || {},
      riskLevel: tool.riskLevel,
      timeoutMs: Math.min(request.timeout || tool.timeout, config.toolDefaultTimeoutMs)
    });

    await this.eventService.publish(assessmentId, {
      type: 'TOOL_STARTED',
      level: 'INFO',
      message: `Executing ${request.tool} against ${request.target}`,
      data: { tool: request.tool, executionId: execution.id, target: request.target }
    });

    await this.toolExecutionModel.markStarted(execution.id);

    try {
      // 4. Execute
      let rawOutput;
      if (tool.managedBinary) {
        // Managed open-source binary (nuclei/subfinder/katana): download the
        // official release on first use and run it on the user's own machine.
        // Falls back to the Kali worker only if the download itself fails.
        try {
          rawOutput = await this.executeManaged(tool, request);
        } catch (err) {
          if (tool.requiresKali && config.kaliWorkerUrl && err.code === 'TOOL_DOWNLOAD_FAILED') {
            rawOutput = await this.executeOnKali(tool, request);
          } else {
            throw err;
          }
        }
      } else if (tool.requiresKali) {
        rawOutput = await this.executeOnKali(tool, request);
      } else {
        rawOutput = await this.executeBuiltIn(tool, request);
      }

      // 5. Parse result
      const parseResult = parseToolOutput(tool.parser, rawOutput, {
        hostname: request.target,
        target: request.target
      });

      // G34: a wafw00f run automatically arms stealth for the rest of the hunt.
      if (request.tool === 'wafw00f' && parseResult.success) {
        try {
          const state = this.applyWafDetection(assessmentId, rawOutput);
          if (state.detected) {
            await this.eventService.publish(assessmentId, {
              type: 'WAF_DETECTED',
              level: 'WARN',
              message: `WAF detected (${state.waf}) — stealth profile ENFORCED for remaining tools`,
              data: { waf: state.waf, method: state.method }
            });
          }
        } catch { /* detection parsing must never break the hunt */ }
      }

      const parsed = parseResult.result;
      const aiSummary = summarizeForAI(request.tool, parsed);

      // 6. Store
      await this.toolExecutionModel.markCompleted(execution.id, {
        raw: typeof rawOutput === 'string' ? rawOutput.slice(0, config.toolMaxOutputBytes) : JSON.stringify(rawOutput).slice(0, config.toolMaxOutputBytes),
        normalized: parsed,
        parsed,
        aiSummary
      });

      await this.eventService.publish(assessmentId, {
        type: 'TOOL_COMPLETED',
        level: 'INFO',
        message: `${request.tool} completed — ${aiSummary.slice(0, 200)}`,
        data: { tool: request.tool, executionId: execution.id, summary: aiSummary.slice(0, 500) }
      });

      return { execution, parsed, aiSummary, deduplicated: false, parseOk: parseResult.success, rawOutput: typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput) };

    } catch (error) {
      await this.toolExecutionModel.markFailed(execution.id, error.message);
      await this.eventService.publish(assessmentId, {
        type: 'TOOL_FAILED',
        level: 'ERROR',
        message: `${request.tool} failed: ${error.message}`,
        data: { tool: request.tool, executionId: execution.id, error: error.message }
      });
      throw error;
    }
  }

  /**
   * G33 — resilient execution: when a tool errors or returns garbage, retry
   * with a DIFFERENT approach (max attempts) instead of dying.
   *
   * Attempt plan:
   *   1. The requested tool as-is.
   *   2. Same tool, simplified: drop custom args, keep registry defaults
   *      (a bad custom flag is the most common cause of garbage output).
   *   3+. Fallback tools from FALLBACK_TOOLS (different tool, same objective).
   *
   * Policy violations are NEVER retried — retrying a blocked action would be
   * a safety bypass. Returns { execution, parsed, aiSummary, recovery } where
   * recovery describes the attempts. Throws the last error when exhausted.
   */
  async executeResilient(assessmentId, userId, request, { maxAttempts = 3 } = {}) {
    const attempts = [];
    const tryOnce = async (req, approach) => {
      try {
        const result = await this.execute(assessmentId, userId, req);
        const garbage = isGarbageResult({ success: result.parseOk !== false }, result.rawOutput || '');
        return { ok: !garbage, result, garbage, approach };
      } catch (error) {
        return { ok: false, error, approach, policyBlocked: error?.code === 'POLICY_VIOLATION' };
      }
    };

    // Attempt 1: as requested
    let outcome = await tryOnce(request, 'requested');
    attempts.push(outcome);
    if (outcome.ok) return { ...outcome.result, recovery: { recovered: false, attempts: attempts.map((a) => a.approach) } };
    if (outcome.policyBlocked) throw outcome.error; // never retry a safety block

    // Attempt 2: same tool, simplified args (drop everything but registry defaults)
    if (maxAttempts >= 2) {
      const simplified = { ...request, arguments: {} };
      outcome = await tryOnce(simplified, 'simplified-args');
      attempts.push(outcome);
      await this.eventService.publish(assessmentId, {
        type: outcome.ok ? 'TOOL_RECOVERED' : 'TOOL_RETRY_FAILED',
        level: outcome.ok ? 'INFO' : 'WARN',
        message: outcome.ok
          ? `${request.tool} recovered with simplified arguments`
          : `${request.tool} retry with simplified arguments failed: ${outcome.garbage ? 'garbage output' : outcome.error?.message}`,
        data: { tool: request.tool, approach: 'simplified-args' }
      }).catch(() => {});
      if (outcome.ok) return { ...outcome.result, recovery: { recovered: true, attempts: attempts.map((a) => a.approach) } };
      if (outcome.policyBlocked) throw outcome.error;
    }

    // Attempts 3+: fallback tools, each a different approach to the same objective
    const fallbacks = FALLBACK_TOOLS[request.tool] || [];
    for (const fb of fallbacks.slice(0, Math.max(0, maxAttempts - 2))) {
      const fbRequest = {
        tool: fb.tool,
        target: request.target,
        arguments: { args: fb.args || [] },
        description: fb.note
      };
      outcome = await tryOnce(fbRequest, `fallback:${fb.tool}`);
      attempts.push(outcome);
      await this.eventService.publish(assessmentId, {
        type: outcome.ok ? 'TOOL_RECOVERED' : 'TOOL_RETRY_FAILED',
        level: outcome.ok ? 'INFO' : 'WARN',
        message: outcome.ok
          ? `${request.tool} objective recovered via fallback ${fb.tool}`
          : `Fallback ${fb.tool} failed: ${outcome.garbage ? 'garbage output' : outcome.error?.message}`,
        data: { tool: request.tool, fallback: fb.tool }
      }).catch(() => {});
      if (outcome.ok) return { ...outcome.result, recovery: { recovered: true, attempts: attempts.map((a) => a.approach) } };
      if (outcome.policyBlocked) throw outcome.error;
    }

    const last = attempts[attempts.length - 1];
    const err = last.error instanceof Error ? last.error
      : new Error(`${request.tool} produced unusable output after ${attempts.length} approach(es)`);
    err.recoveryAttempts = attempts.map((a) => a.approach);
    throw err;
  }

  /** Built-in tool execution (no Kali required). Currently: crt.sh, python, HTTP probes. */
  async executeBuiltIn(tool, request) {
    if (tool.name === 'crtsh') {
      return this.executeCrtsh(request.target);
    }
    if (tool.name === 'python') {
      return this.executePython(request.arguments);
    }
    // Built-in HTTP detection probes (src/tools/builtin/httpProbes.js and
    // advProbes.js): real HTTP against the authorized target, normalized
    // finding candidates out.
    const probe = HTTP_PROBES[tool.name] || ADV_PROBES[tool.name];
    if (probe) {
      const args = request.arguments || {};
      // Probes share baseUrl/webProbe/timeoutMs; any other argument keys are
      // probe-specific (token, endpoint, expectation, ...) and pass through.
      const { baseUrl: _b, webProbe: _w, timeoutMs: _t, ...extra } = args;
      const result = await probe({
        baseUrl: args.baseUrl || request.target,
        webProbe: args.webProbe || null,
        timeoutMs: Math.min(request.timeout || tool.timeout, config.toolDefaultTimeoutMs),
        ...extra
      });
      return JSON.stringify(result);
    }
    throw new AppError(501, `Built-in execution not implemented for ${tool.name}`, 'NOT_IMPLEMENTED');
  }

  /**
   * Run a custom Python 3 script on the user's own machine.
   * The agent writes the code; we run it in a temp dir with a hard timeout
   * and capture stdout/stderr. This is the user's terminal — local-first,
   * no sandbox. Scope policy (authorized targets only) is enforced by the
   * PolicyValidator before we get here.
   */
  async executePython(args = {}) {
    const code = String(args.code || args.script || '');
    if (!code.trim()) {
      throw new AppError(400, 'python tool requires `code` (the Python script to run)', 'MISSING_CODE');
    }
    if (code.length > 50_000) {
      throw new AppError(400, 'Python script too large (max 50KB)', 'CODE_TOO_LARGE');
    }

    const { execFile } = await import('node:child_process');
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const path = (await import('node:path')).default;

    const workdir = await mkdtemp(path.join(tmpdir(), 'dm-python-'));
    const scriptPath = path.join(workdir, 'script.py');
    await writeFile(scriptPath, code, 'utf8');

    const timeoutMs = Math.min(Number(args.timeoutMs) || 120_000, 300_000);

    try {
      const output = await new Promise((resolve, reject) => {
        execFile('python3', [scriptPath], {
          cwd: workdir,
          timeout: timeoutMs,
          maxBuffer: 2 * 1024 * 1024, // 2MB cap on captured output
          env: { ...process.env, PYTHONUNBUFFERED: '1' }
        }, (error, stdout, stderr) => {
          const combined = [
            stdout ? `--- stdout ---\n${stdout}` : '',
            stderr ? `--- stderr ---\n${stderr}` : '',
            error ? `--- exit ---\n${error.killed ? 'killed (timeout)' : `code ${error.code}`}` : ''
          ].filter(Boolean).join('\n');
          // Resolve even on non-zero exit — the output IS the result.
          resolve(combined.slice(0, 100_000) || '(no output)');
        });
      });
      return output;
    } finally {
      await rm(workdir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /** crt.sh Certificate Transparency lookup. */
  async executeCrtsh(hostname) {
    const url = new URL('https://crt.sh/');
    url.searchParams.set('q', `%.${hostname}`);
    url.searchParams.set('output', 'json');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.toolRequestTimeoutMs);
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'DarkMatter-Agent/2.0' },
        signal: controller.signal
      });
      if (!response.ok) throw new AppError(502, `crt.sh returned HTTP ${response.status}`, 'CRTSH_FAILED');
      return await response.text();
    } catch (error) {
      if (error.name === 'AbortError') throw new AppError(504, 'crt.sh lookup timed out', 'CRTSH_TIMEOUT');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Run a managed open-source binary (nuclei / subfinder / katana) on the
   * user's own machine. The official release is downloaded on first use via
   * managedBinaries.js — no Kali box, no manual install.
   */
  async executeManaged(tool, request) {
    const { ensureBinary, MANAGED_TOOLS } = await import('./managedBinaries.js');
    const spec = MANAGED_TOOLS[tool.managedBinary];
    if (!spec) throw new AppError(400, `Unknown managed tool: ${tool.managedBinary}`, 'UNKNOWN_TOOL');

    let binary;
    try {
      binary = await ensureBinary(tool.managedBinary, (p) => {
        this.eventService.publish(request.assessmentId || 'n/a', {
          type: 'TOOL_DOWNLOAD',
          level: 'INFO',
          message: `${spec.displayName}: ${p.status} ${Math.round((p.progress || 0) * 100)}%`,
          data: { tool: tool.name, ...p }
        }).catch(() => {});
      });
    } catch (err) {
      throw new AppError(502, `Could not fetch ${spec.displayName}: ${err.message}`, 'TOOL_DOWNLOAD_FAILED');
    }

    const args = PolicyValidator.sanitize(tool.name, request.arguments?.args || []);
    const finalArgs = await this._managedArgs(tool, request, args, binary);

    const { execFile } = await import('node:child_process');
    const timeout = tool.timeout || config.toolDefaultTimeoutMs;
    return new Promise((resolve, reject) => {
      execFile(binary, finalArgs, { timeout, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
        const out = (stdout || '').trim();
        if (err && !out) {
          reject(new AppError(502,
            `${tool.name} failed: ${(stderr || err.message).slice(0, 500)}`, 'TOOL_EXEC_FAILED'));
        } else {
          resolve(out);
        }
      });
    });
  }

  /**
   * Per-tool argument shaping for managed binaries: guarantee the target flag
   * and machine-readable output the parsers expect.
   */
  async _managedArgs(tool, request, args, binary) {
    const out = [...args];
    const has = (flag) => out.includes(flag);
    const target = request.target;

    if (tool.managedBinary === 'nuclei') {
      await this._ensureNucleiTemplates(binary);
      if (target && !has('-u') && !has('-l')) out.push('-u', target);
      // JSON lines for the 'jsonlines' parser (nuclei v3: -jsonl, not -json).
      const jsonIdx = out.indexOf('-json');
      if (jsonIdx !== -1) out.splice(jsonIdx, 1);
      if (!has('-jsonl')) out.push('-jsonl');
      if (!has('-silent')) out.push('-silent');
      if (!has('-nc')) out.push('-nc');
    } else if (tool.managedBinary === 'subfinder') {
      if (target && !has('-d')) out.push('-d', target);
      if (!has('-silent')) out.push('-silent');
      if (!has('-nc')) out.push('-nc');
    } else if (tool.managedBinary === 'katana') {
      if (target && !has('-u') && !has('-l')) out.push('-u', target);
      const jsonIdx = out.indexOf('-json');
      if (jsonIdx !== -1) out.splice(jsonIdx, 1);
      if (!has('-jsonl')) out.push('-jsonl');
      if (!has('-silent')) out.push('-silent');
      if (!has('-nc')) out.push('-nc');
    }
    return out;
  }

  /**
   * Nuclei needs its template library before the first scan. Downloads once
   * to ~/nuclei-templates (upstream default); skips when already present.
   */
  async _ensureNucleiTemplates(binary) {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const tplDir = path.join(os.homedir(), 'nuclei-templates');
    try {
      fs.accessSync(tplDir);
      return; // already have templates
    } catch { /* download below */ }
    const { execFile } = await import('node:child_process');
    await new Promise((resolve, reject) => {
      execFile(binary, ['-update-templates', '-silent', '-nc'], { timeout: 600000 },
        (err, stdout, stderr) => {
          try { fs.accessSync(tplDir); return resolve(); } catch { /* fall through */ }
          reject(new Error(`template update failed: ${(stderr || err?.message || '').slice(0, 300)}`));
        });
    });
  }

  /**
   * Send a structured tool execution request to the Kali Linux worker.
   * The Kali worker is a separate service that runs on a Kali machine.
   * If no worker is configured, this returns a placeholder indicating the tool needs Kali.
   */
  async executeOnKali(tool, request) {
    const workerUrl = config.kaliWorkerUrl;
    if (!workerUrl) {
      // No Kali worker configured — return a message indicating this
      return JSON.stringify({
        status: 'kali_required',
        tool: tool.name,
        message: `Tool ${tool.name} requires a Kali Linux worker. Configure KALI_WORKER_URL in .env.`,
        target: request.target
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), tool.timeout || config.toolDefaultTimeoutMs);
    try {
      const response = await fetch(`${workerUrl}/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tool: tool.name,
          command: tool.command,
          args: PolicyValidator.sanitize(tool.name, request.arguments?.args || []),
          target: request.target,
          timeout: tool.timeout
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new AppError(502, `Kali worker returned HTTP ${response.status}: ${body.slice(0, 200)}`, 'KALI_WORKER_ERROR');
      }
      return await response.text();
    } catch (error) {
      if (error.name === 'AbortError') throw new AppError(504, `${tool.name} execution timed out`, 'TOOL_TIMEOUT');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Execute multiple INDEPENDENT tools in parallel (idea #3: parallel recon).
   * A human runs one tool at a time; the agent runs them all at once.
   * Only tools with no dependencies between them should be batched.
   * Failures are isolated — one tool failing doesn't kill the batch.
   *
   * @param {string} assessmentId
   * @param {string} userId
   * @param {Array<{tool, target, arguments}>} requests
   * @returns {Array<{request, ok, result|error}>}
   */
  async executeParallel(assessmentId, userId, requests = [], opts = {}) {
    if (!Array.isArray(requests) || !requests.length) return [];
    // Cap parallelism to avoid overwhelming the target or the machine.
    const batch = requests.slice(0, 6);
    const settled = await Promise.allSettled(
      batch.map((req) => this.execute(assessmentId, userId, req, opts))
    );
    return batch.map((request, i) => {
      const s = settled[i];
      return s.status === 'fulfilled'
        ? { request, ok: true, result: s.value }
        : { request, ok: false, error: s.reason?.message || String(s.reason) };
    });
  }

  /**
   * The standard parallel recon batch for a fresh target: passive subdomain
   * discovery + tech fingerprinting + certificate transparency, all at once.
   * The brain can trigger this with a single "parallel_recon" decision.
   */
  async parallelRecon(assessmentId, userId, target) {
    return this.executeParallel(assessmentId, userId, [
      { tool: 'crtsh', target, arguments: {} },
      { tool: 'whatweb', target, arguments: {} },
      { tool: 'wafw00f', target, arguments: {} },
    ]);
  }
}
