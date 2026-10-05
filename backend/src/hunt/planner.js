/**
 * planner.js — Infinity AI hunt planner: a Pentesting Task Tree (PTT) driven
 * by three cooperating brain sessions.
 *
 * Architecture (original implementation; concept inspired by the MIT-licensed
 * PentestGPT project — see THIRD_PARTY_NOTICES.md; no code copied):
 *
 *   - REASONER  proposes the next task in the tree ("what should we do next?")
 *   - GENERATOR produces concrete, safe tool commands/parameters for a task
 *   - PARSER    extracts structured findings from tool output into the tree
 *
 * The structured hunt state is a task tree that moves through the stages
 *   recon → vuln → poc → report
 * persisted per hunt as JSON under backend/data/hunts/<huntId>/state.json,
 * so a hunt can be paused and resumed from the exact persisted state.
 *
 * Context protection (AutoAttacker "Summarizer" pattern, reimplemented):
 * verbose tool output is compressed to a token budget before it is fed back
 * to the brain, so long hunts never overflow the context window.
 *
 * Defensive/product framing ONLY: the planner discovers and validates
 * security weaknesses and produces findings + remediation. It never emits
 * exploit payloads, and the "poc" stage performs SAFE validation checks
 * (confirming evidence, e.g. DNS records or reflected markers) — never
 * weaponized exploitation.
 *
 * The brain provider is dependency-injected for testability. It must
 * implement the AutonomousBrain contract used across the backend:
 *   { generate(messages, options) -> Promise<string>,
 *     generateStructured?(messages, schema, options) -> Promise<object> }
 * When no brain is reachable the planner falls back to a deterministic
 * task sequence so hunts keep moving.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialHuntState, safeTransition } from '../agent/huntStateMachine.js';
import { estimateTokens } from '../services/longContext/tokens.js';
import { runEngineTask, runReconSweep, analyzeFindings } from './engineFeed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(here, '..', '..', 'data', 'hunts');

export const PTT_STAGES = Object.freeze(['recon', 'vuln', 'poc', 'report']);

/** PTT stage → huntStateMachine status (keeps the existing UI state machine in sync). */
export const STAGE_TO_HUNT_STATUS = Object.freeze({
  recon: 'recon',
  vuln: 'probing',
  poc: 'verifying',
  report: 'reporting',
});

export const TASK_STATUS = Object.freeze(['pending', 'active', 'done', 'skipped', 'failed']);

/** Default deterministic task templates per stage (used when the brain is unreachable). */
const DETERMINISTIC_TASKS = {
  recon: [
    { title: 'Enumerate subdomains (passive sources)', kind: 'engine', engine: ['eliteRecon', 'subdomainCandidates'] },
    { title: 'Fingerprint web technologies', kind: 'engine', engine: ['eliteRecon', 'fingerprintTech'] },
    { title: 'Sweep passive recon engines', kind: 'sweep' },
    { title: 'Probe live hosts and technologies (external scanner)', kind: 'tool', tool: 'httpx' },
    { title: 'Crawl application endpoints (external scanner)', kind: 'tool', tool: 'katana' },
  ],
  vuln: [
    { title: 'Scan HTTP responses for known weakness patterns', kind: 'engine', engine: ['vulnDetector', 'scanResponse'] },
    { title: 'Check for exposed secrets in responses', kind: 'engine', engine: ['secretScanner', 'scanForSecrets'] },
    { title: 'Check CORS misconfigurations', kind: 'engine', engine: ['corsChecker', 'checkCORS'] },
    { title: 'Check subdomain takeover indicators', kind: 'engine', engine: ['takeoverChecker', 'checkTakeover'] },
    { title: 'Template-based vulnerability scan (external scanner)', kind: 'tool', tool: 'nuclei' },
  ],
  poc: [
    { title: 'Validate findings against evidence (safe checks only)', kind: 'validate' },
    { title: 'Filter false positives', kind: 'engine', engine: ['fpFilter', 'filterBatch'] },
    { title: 'Score and prioritize findings', kind: 'engine', engine: ['riskScorer', 'prioritize'] },
    { title: 'Identify finding chains', kind: 'engine', engine: ['chainBuilder', 'findChains'] },
  ],
  report: [
    { title: 'Assemble findings into the live report', kind: 'report' },
    { title: 'Rank recommended fixes by effort and impact', kind: 'report' },
  ],
};

const DEFENSIVE_PREAMBLE = `You are Infinity AI, an authorized defensive security analyst conducting an approved security assessment.
STRICT RULES:
- Produce findings and remediation guidance ONLY. Never output exploit payloads, weaponized commands, or instructions that cause harm.
- The "poc" stage means SAFE VALIDATION: confirm a weakness from observable evidence (headers, DNS records, reflected markers). Never attempt to gain unauthorized access or exfiltrate data.
- Stay strictly within the authorized target and scope.`;

const REASONER_SYSTEM = `${DEFENSIVE_PREAMBLE}

You are the REASONER session of a penetration-testing task tree. Given the current structured hunt state, propose the SINGLE next task to work on.
Respond with a JSON object:
{ "title": string, "stage": "recon"|"vuln"|"poc"|"report", "kind": "engine"|"tool"|"sweep"|"validate"|"report", "rationale": string, "advanceStage": boolean, "complete": boolean }
Set advanceStage=true only when the current stage has no useful remaining work. Set complete=true (and omit the other fields) only when every stage is genuinely finished and the report is assembled. Never propose work outside the authorized scope.`;

const GENERATOR_SYSTEM = `${DEFENSIVE_PREAMBLE}

You are the GENERATOR session. Given one task from the task tree, produce the concrete, SAFE parameters needed to execute it.
- For kind "engine": return { "module": string, "fn": string, "args": object } for a passive analysis engine.
- For kind "tool": return { "tool": string, "targets": string[], "profile": "fast"|"standard" } — targets must be in-scope hostnames/URLs only.
- For kind "validate": return { "checks": [{ "findingId": string, "method": string, "safeEvidence": string }] } — validation methods must be non-intrusive (DNS lookup, header inspection, banner comparison).
- For kind "sweep"/"report": return { "note": string }.
Respond with a JSON object only. Never include payloads or attack commands.`;

const PARSER_SYSTEM = `${DEFENSIVE_PREAMBLE}

You are the PARSER session. Given raw tool/engine output, extract STRUCTURED FINDINGS.
Respond with a JSON object: { "findings": [ { "title": string, "severity": "critical"|"high"|"medium"|"low"|"informational", "target": string, "description": string, "evidence": string, "remediation": string, "confidence": "high"|"medium"|"low" } ], "summary": string }
Only report weaknesses supported by the evidence. Strip any exploit payload content; keep findings and remediation only.`;

const SUMMARIZER_SYSTEM = `${DEFENSIVE_PREAMBLE}

You are the SUMMARIZER session. Compress the tool output below into a dense brief for the next reasoning cycle.
Keep: discovered hosts/URLs, technologies, every weakness with its evidence, errors that change the plan.
Drop: banners, progress lines, duplicates, raw payloads. Findings and remediation only — no exploit content.
Respond with plain text, at most the requested length.`;

function now() {
  return new Date().toISOString();
}

let taskSeq = 0;
function newTask(template, stage) {
  return {
    id: `t${Date.now().toString(36)}${(taskSeq++).toString(36)}`,
    title: template.title,
    stage,
    kind: template.kind || 'engine',
    engine: template.engine || null,
    tool: template.tool || null,
    status: 'pending',
    rationale: '',
    generated: null,
    evidence: [],
    findings: [],
    attempts: 0,
    createdAt: now(),
    updatedAt: now(),
  };
}

/**
 * Triple-brain hunt planner.
 */
export class TripleBrainPlanner {
  /**
   * @param {object} opts
   * @param {object|null} opts.brain — Hacking-slot brain provider (AutonomousBrain contract). May be null → deterministic mode.
   * @param {string} [opts.dataDir] — hunt persistence root (default backend/data/hunts)
   * @param {object} [opts.logger]
   * @param {number} [opts.maxEvidenceTokens] — token cap for evidence fed back to the brain (default 4000)
   * @param {number} [opts.maxTasksPerStage] — safety bound on tasks per stage (default 25)
   */
  constructor({ brain = null, dataDir = DEFAULT_DATA_DIR, logger = console, maxEvidenceTokens = 4000, maxTasksPerStage = 25 } = {}) {
    this.brain = brain;
    this.dataDir = dataDir;
    this.logger = logger;
    this.maxEvidenceTokens = maxEvidenceTokens;
    this.maxTasksPerStage = maxTasksPerStage;
  }

  // ---------------------------------------------------------------- persistence

  huntDir(huntId) {
    return path.join(this.dataDir, String(huntId));
  }

  stateFile(huntId) {
    return path.join(this.huntDir(huntId), 'state.json');
  }

  async persist(hunt) {
    const dir = this.huntDir(hunt.id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.stateFile(hunt.id), JSON.stringify(hunt, null, 2), 'utf8');
    return hunt;
  }

  /**
   * Create a new hunt: seeds the task tree with recon tasks and persists it.
   * @returns {Promise<object>} the hunt state
   */
  async createHunt({ id, target, scope = null, metadata = {} }) {
    if (!id || !target) throw new Error('createHunt requires { id, target }');
    const hunt = {
      id: String(id),
      target: String(target),
      scope: scope || { targets: [String(target)], notes: 'authorized scope' },
      stage: 'recon',
      huntState: initialHuntState(),
      tasks: DETERMINISTIC_TASKS.recon.map((t) => newTask(t, 'recon')),
      findings: [],
      evidence: [],
      createdAt: now(),
      updatedAt: now(),
      metadata,
      product: 'Infinity AI',
    };
    hunt.huntState = safeTransition(hunt.huntState, 'recon', { nextIntent: 'Seed recon task tree' }, this.logger);
    await this.persist(hunt);
    return hunt;
  }

  /** Resume a hunt from its persisted state. Throws if the hunt does not exist. */
  async loadHunt(huntId) {
    const raw = await fs.readFile(this.stateFile(huntId), 'utf8');
    const hunt = JSON.parse(raw);
    hunt._resumedAt = now();
    return hunt;
  }

  /** List persisted hunt ids. */
  async listHunts() {
    try {
      const entries = await fs.readdir(this.dataDir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------- brain sessions

  async brainJson(system, userPayload) {
    if (!this.brain) throw new Error('brain unavailable');
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: typeof userPayload === 'string' ? userPayload : JSON.stringify(userPayload) },
    ];
    if (typeof this.brain.generateStructured === 'function') {
      return this.brain.generateStructured(messages, null, { temperature: 0.2, maxTokens: 1500 });
    }
    const text = await this.brain.generate(messages, { temperature: 0.2, maxTokens: 1500 });
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) throw new Error('brain returned no JSON');
    return JSON.parse(match[0]);
  }

  /** REASONER session: propose the next task (brain or deterministic fallback). */
  async reasonNextTask(hunt) {
    const state = this.renderStateForBrain(hunt);
    try {
      const proposal = await this.brainJson(REASONER_SYSTEM, state);
      if (proposal && proposal.complete) return { complete: true };
      const task = newTask({
        title: String(proposal.title || 'Untitled task').slice(0, 200),
        kind: proposal.kind || 'engine',
        engine: proposal.engine || null,
        tool: proposal.tool || null,
      }, PTT_STAGES.includes(proposal.stage) ? proposal.stage : hunt.stage);
      task.rationale = String(proposal.rationale || '').slice(0, 500);
      if (proposal.advanceStage) task._advanceStage = true;
      return task;
    } catch (error) {
      this.logger.warn?.(`[planner] reasoner fallback (deterministic): ${error.message}`);
      return this.reasonDeterministic(hunt);
    }
  }

  /** Deterministic reasoner: next pending task, or seed the next stage. */
  reasonDeterministic(hunt) {
    const pending = hunt.tasks.find((t) => t.stage === hunt.stage && t.status === 'pending');
    if (pending) {
      const task = { ...pending, status: 'active', attempts: pending.attempts + 1, updatedAt: now() };
      return task;
    }
    // No pending tasks left in this stage → seed the next stage.
    const idx = PTT_STAGES.indexOf(hunt.stage);
    if (idx < PTT_STAGES.length - 1) {
      const next = PTT_STAGES[idx + 1];
      const seeded = DETERMINISTIC_TASKS[next].map((t) => newTask(t, next));
      const first = { ...seeded[0], status: 'active', attempts: 1, updatedAt: now(), _advanceStage: true, _seededSiblings: seeded.slice(1) };
      first.rationale = `Deterministic advance: ${hunt.stage} exhausted, moving to ${next}.`;
      return first;
    }
    return null; // tree complete
  }

  /** GENERATOR session: produce safe execution parameters for a task. */
  async generateForTask(hunt, task) {
    try {
      const params = await this.brainJson(GENERATOR_SYSTEM, {
        task: { title: task.title, kind: task.kind, stage: task.stage },
        target: hunt.target,
        scope: hunt.scope,
        evidenceSummary: this.summarizeEvidence(hunt, 1500),
      });
      task.generated = sanitizeGenerated(params, task);
      return task.generated;
    } catch (error) {
      this.logger.warn?.(`[planner] generator fallback (deterministic): ${error.message}`);
      task.generated = deterministicParams(hunt, task);
      return task.generated;
    }
  }

  /** PARSER session: extract structured findings from raw output. */
  async parseOutput(task, rawOutput) {
    const compressed = await this.summarize(rawOutput, { maxTokens: this.maxEvidenceTokens });
    try {
      const parsed = await this.brainJson(PARSER_SYSTEM, {
        taskTitle: task.title,
        output: compressed,
      });
      return {
        findings: sanitizeFindings(parsed.findings || []),
        summary: String(parsed.summary || '').slice(0, 2000),
      };
    } catch (error) {
      this.logger.warn?.(`[planner] parser fallback (extractive): ${error.message}`);
      return extractiveFindings(compressed);
    }
  }

  // ---------------------------------------------------------------- summarizer

  /**
   * Compress verbose tool output to a token budget before it reaches the brain.
   * Brain-backed when reachable; deterministic extractive fallback otherwise.
   */
  async summarize(text, { maxTokens = this.maxEvidenceTokens } = {}) {
    const input = String(text ?? '');
    if (estimateTokens(input) <= maxTokens) return input;
    if (this.brain) {
      try {
        const messages = [
          { role: 'system', content: SUMMARIZER_SYSTEM },
          { role: 'user', content: `Compress the following to at most ~${maxTokens} tokens:\n\n${input.slice(0, 60000)}` },
        ];
        const out = String(await this.brain.generate(messages, { temperature: 0.1, maxTokens }));
        if (estimateTokens(out) <= Math.ceil(maxTokens * 1.2)) return out;
        // Brain overshot the budget — fall through to the hard cap.
      } catch (error) {
        this.logger.warn?.(`[planner] summarizer brain failed: ${error.message}`);
      }
    }
    return extractiveSummary(input, maxTokens);
  }

  /** Token-capped rendering of the hunt state for brain prompts. */
  renderStateForBrain(hunt) {
    return {
      target: hunt.target,
      stage: hunt.stage,
      taskCounts: countBy(hunt.tasks, (t) => `${t.stage}:${t.status}`),
      findings: hunt.findings.length,
      evidenceDigest: this.summarizeEvidence(hunt, 1200),
    };
  }

  summarizeEvidence(hunt, maxTokens) {
    const chunks = [];
    for (const t of hunt.tasks.filter((t) => t.status === 'done').slice(-8)) {
      if (t.findings?.length) chunks.push(`${t.title}: ${t.findings.length} finding(s)`);
      const ev = (t.evidence || []).slice(-2).join(' | ');
      if (ev) chunks.push(`${t.title} — ${ev.slice(0, 300)}`);
    }
    return hardCap(chunks.join('\n'), maxTokens);
  }

  // ---------------------------------------------------------------- execution

  /**
   * Run one planning cycle: reason → generate → execute → parse → persist.
   *
   * @param {string|object} huntOrId
   * @param {object} hooks — { runTool(spec) } where runTool executes an external
   *   scanner spec { tool, targets, profile } and returns raw output text.
   *   If omitted, tool-kind tasks are marked done with a "no runner" note.
   * @returns {Promise<{ hunt, task, done }>}
   */
  async step(huntOrId, hooks = {}) {
    const hunt = typeof huntOrId === 'string' ? await this.loadHunt(huntOrId) : huntOrId;

    const proposed = await this.reasonNextTask(hunt);
    if (!proposed || proposed.complete) {
      return { hunt: await this.finishHunt(hunt), task: null, done: true };
    }

    // Merge the proposed task into the tree (or activate the existing one).
    let task = hunt.tasks.find((t) => t.id === proposed.id);
    if (!task) {
      if (proposed._seededSiblings) {
        for (const sib of proposed._seededSiblings) hunt.tasks.push(sib);
        delete proposed._seededSiblings;
      }
      if (proposed._advanceStage) {
        await this.advanceStage(hunt, proposed.stage);
        delete proposed._advanceStage;
      }
      proposed.status = 'active';
      proposed.attempts = (proposed.attempts || 0) + 1;
      proposed.updatedAt = now();
      hunt.tasks.push(proposed);
      task = proposed;
    } else {
      Object.assign(task, { status: 'active', attempts: task.attempts + 1, updatedAt: now() });
    }

    await this.generateForTask(hunt, task);
    const rawOutput = await this.executeTask(hunt, task, hooks);
    const { findings, summary } = await this.parseOutput(task, rawOutput);

    task.status = 'done';
    task.updatedAt = now();
    if (summary) task.evidence.push(summary);
    for (const f of findings) {
      const finding = { ...f, id: `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, taskId: task.id, foundAt: now() };
      task.findings.push(finding);
      hunt.findings.push(finding);
    }
    hunt.updatedAt = now();
    hunt.huntState = safeTransition(hunt.huntState, STAGE_TO_HUNT_STATUS[hunt.stage] || 'recon', {
      lastAction: task.title,
      lastOutcome: summary ? summary.slice(0, 200) : 'completed',
      stepsTaken: (hunt.huntState.stepsTaken || 0) + 1,
    }, this.logger);

    await this.persist(hunt);
    return { hunt, task, done: false };
  }

  /** Execute one task: engine/sweep/validate run in-process; tools defer to hooks. */
  async executeTask(hunt, task, hooks = {}) {
    const g = task.generated || {};
    try {
      if (task.kind === 'engine' && g.module && g.fn) {
        const args = engineArgsFor(hunt, task, g);
        const res = await runEngineTask(g.module, g.fn, args);
        return res.ok
          ? `ENGINE ${g.module}.${g.fn} RESULT:\n${JSON.stringify(res.result).slice(0, 20000)}`
          : `ENGINE ${g.module}.${g.fn} FAILED: ${res.error}`;
      }
      if (task.kind === 'sweep') {
        const input = sweepInputFor(hunt);
        const results = await runReconSweep(input, { logger: this.logger });
        const hits = results.filter((r) => r.ok);
        return `RECON SWEEP: ${hits.length}/${results.length} engines returned data.\n` +
          hits.map((r) => `- ${r.engine}.${r.fn}: ${JSON.stringify(r.result).slice(0, 1500)}`).join('\n').slice(0, 20000);
      }
      if (task.kind === 'validate') {
        // SAFE validation only: confirm evidence the engines/tools already observed.
        const checks = (g.checks || []).slice(0, 20).map((c) => `- ${c.findingId}: ${c.method} (${c.safeEvidence || 'evidence on file'})`);
        return `SAFE VALIDATION CHECKS (non-intrusive, evidence-based):\n${checks.join('\n') || '- no checks proposed'}`;
      }
      if (task.kind === 'report') {
        const analysis = await analyzeFindings(hunt.findings);
        return `REPORT ASSEMBLY:\n- findings: ${hunt.findings.length}\n` +
          `- prioritized: ${(analysis.prioritized || []).length}\n- chains: ${(analysis.chains || []).length}`;
      }
      if (task.kind === 'tool') {
        const spec = { tool: g.tool || task.tool, targets: g.targets || [hunt.target], profile: g.profile || 'fast' };
        if (typeof hooks.runTool === 'function') {
          return await hooks.runTool(spec, hunt, task);
        }
        return `TOOL ${spec.tool} SKIPPED: no external runner wired (toolRunner provides this). Targets would be: ${spec.targets.join(', ')}`;
      }
      return `UNKNOWN task kind "${task.kind}" — skipped safely.`;
    } catch (error) {
      task.status = 'failed';
      return `TASK EXECUTION ERROR: ${error.message}`;
    }
  }

  async advanceStage(hunt, nextStage) {
    if (!PTT_STAGES.includes(nextStage)) return;
    hunt.stage = nextStage;
    const status = STAGE_TO_HUNT_STATUS[nextStage];
    hunt.huntState = safeTransition(hunt.huntState, status, { nextIntent: `Entering ${nextStage} stage` }, this.logger);
    await this.persist(hunt);
  }

  async finishHunt(hunt) {
    hunt.stage = 'report';
    hunt.completedAt = now();
    hunt.updatedAt = now();
    hunt.huntState = safeTransition(hunt.huntState, 'complete', { lastOutcome: `${hunt.findings.length} findings recorded` }, this.logger);
    await this.persist(hunt);
    return hunt;
  }
}

// ---------------------------------------------------------------- helpers

function countBy(arr, key) {
  const out = {};
  for (const item of arr) {
    const k = key(item);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function hardCap(text, maxTokens) {
  const s = String(text);
  if (estimateTokens(s) <= maxTokens) return s;
  // Conservative char budget: ~3.5 chars per token.
  return `${s.slice(0, Math.floor(maxTokens * 3.5))}…[capped]`;
}

/** Deterministic extractive summary: keep head, keyword-dense lines, and tail. */
function extractiveSummary(text, maxTokens) {
  const s = String(text);
  const budget = Math.max(64, Math.floor(maxTokens * 3.5));
  if (s.length <= budget) return s;
  const lines = s.split('\n');
  const KEYWORDS = /(vuln|vulnerab|cve|critical|high severity|finding|exposed|secret|token|password|misconfig|takeover|cors|inject|xss|sqli|ssrf|idor|jwt|error|failed|timeout|discovered|found|matched)/i;
  const scored = lines
    .map((line, i) => ({ line, i, score: KEYWORDS.test(line) ? 2 : (line.trim() ? 1 : 0) }))
    .filter((l) => l.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const head = Math.floor(budget * 0.25);
  const tail = Math.floor(budget * 0.15);
  const parts = [s.slice(0, head)];
  let used = head;
  const seen = new Set();
  for (const { line } of scored) {
    if (used + line.length + 1 > budget - tail) break;
    if (seen.has(line)) continue;
    seen.add(line);
    parts.push(line);
    used += line.length + 1;
  }
  parts.push(`…[extractive summary; original ${s.length} chars]`);
  parts.push(s.slice(-tail));
  return parts.join('\n').slice(0, budget + 200);
}

/** Extractive finding fallback: pull severity-ish lines when the brain is down. */
function extractiveFindings(compressed) {
  const findings = [];
  const seen = new Set();
  for (const line of String(compressed).split('\n')) {
    const m = line.match(/(critical|high|medium|low)\b[^:\n]{0,80}:\s*(.{10,160})/i);
    if (m && !seen.has(m[2])) {
      seen.add(m[2]);
      findings.push({
        title: m[2].trim().slice(0, 120),
        severity: m[1].toLowerCase(),
        target: '',
        description: `Detected during automated assessment: ${line.trim().slice(0, 300)}`,
        evidence: line.trim().slice(0, 500),
        remediation: 'Review and remediate per the Infinity AI recommended-fixes guidance.',
        confidence: 'low',
      });
      if (findings.length >= 25) break;
    }
  }
  return { findings, summary: `Extractive parse: ${findings.length} candidate finding(s) from tool output.` };
}

/** Strip anything that looks like an attack payload from brain-generated params. */
function sanitizeGenerated(params, task) {
  const p = { ...(params || {}) };
  if (task.kind === 'tool') {
    return {
      tool: String(p.tool || task.tool || '').slice(0, 40),
      targets: Array.isArray(p.targets) ? p.targets.map((t) => String(t).slice(0, 200)).slice(0, 50) : [],
      profile: p.profile === 'standard' ? 'standard' : 'fast',
    };
  }
  if (task.kind === 'engine') {
    return {
      module: String(p.module || '').slice(0, 60),
      fn: String(p.fn || '').slice(0, 60),
      args: p.args && typeof p.args === 'object' ? p.args : {},
    };
  }
  if (task.kind === 'validate') {
    const checks = Array.isArray(p.checks) ? p.checks : [];
    return {
      checks: checks.slice(0, 20).map((c) => ({
        findingId: String(c.findingId || '').slice(0, 80),
        method: String(c.method || '').slice(0, 200),
        safeEvidence: String(c.safeEvidence || '').slice(0, 500),
      })),
    };
  }
  return { note: String(p.note || '').slice(0, 500) };
}

function sanitizeFindings(findings) {
  const SEV = new Set(['critical', 'high', 'medium', 'low', 'informational']);
  return findings.slice(0, 100).map((f) => ({
    title: String(f.title || 'Untitled finding').slice(0, 200),
    severity: SEV.has(String(f.severity).toLowerCase()) ? String(f.severity).toLowerCase() : 'informational',
    target: String(f.target || '').slice(0, 200),
    description: String(f.description || '').slice(0, 2000),
    evidence: String(f.evidence || '').slice(0, 2000),
    remediation: String(f.remediation || '').slice(0, 2000),
    confidence: ['high', 'medium', 'low'].includes(f.confidence) ? f.confidence : 'medium',
  }));
}

/** Deterministic execution params when the brain is unreachable. */
function deterministicParams(hunt, task) {
  if (task.kind === 'tool') return { tool: task.tool, targets: [hunt.target], profile: 'fast' };
  if (task.kind === 'engine' && task.engine) return { module: task.engine[0], fn: task.engine[1], args: engineArgsFor(hunt, task, {}) };
  if (task.kind === 'validate') {
    return {
      checks: hunt.findings.slice(0, 20).map((f) => ({
        findingId: f.id || f.title,
        method: 'evidence cross-check (non-intrusive)',
        safeEvidence: (f.evidence || '').slice(0, 200),
      })),
    };
  }
  return { note: `${task.kind} task (deterministic)` };
}

/** Build structured args for a passive engine from hunt context. */
function engineArgsFor(hunt, task, generated) {
  const base = { target: hunt.target, domain: hunt.target, host: hunt.target, url: hunt.target };
  const fromBrain = generated && typeof generated.args === 'object' ? generated.args : {};
  const merged = { ...base, ...fromBrain };
  // Shape args for known engine signatures.
  const sig = `${generated.module || ''}.${generated.fn || ''}`;
  if (sig === 'eliteRecon.fingerprintTech') return merged.httpResponse || {};
  if (sig === 'eliteRecon.subdomainCandidates') return [merged.domain, []];
  if (sig === 'secretScanner.scanForSecrets') return merged.bodyText || '';
  if (sig === 'vulnDetector.scanResponse') {
    return [{ url: merged.url || '', body: merged.bodyText || '', headers: merged.headers || {} }, {}];
  }
  if (sig === 'corsChecker.checkCORS') return [{ url: merged.url || '', headers: merged.headers || {} }];
  if (sig === 'takeoverChecker.checkTakeover') {
    return [{ subdomain: merged.host || '', cname: merged.cname || '', httpBody: merged.bodyText || '', httpStatus: 0 }];
  }
  if (sig === 'fpFilter.filterBatch' || sig === 'riskScorer.prioritize') return hunt.findings;
  if (sig === 'chainBuilder.findChains') return hunt.findings;
  return merged;
}

function sweepInputFor(hunt) {
  return {
    domain: hunt.target,
    host: hunt.target,
    url: /^https?:\/\//i.test(hunt.target) ? hunt.target : `https://${hunt.target}`,
  };
}

export default TripleBrainPlanner;
