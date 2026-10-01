import { config } from '../config.js';
import { ToolRegistry } from '../tools/registry.js';
import { PhoneLocalProvider } from './providers/phoneLocalProvider.js';
import { localAIQueue } from './providers/localAiQueue.js';
import {
  AUTONOMOUS_DECISION_SCHEMA_PROMPT,
  validateAutonomousDecision
} from './autonomousDecisionSchema.js';
import { COMPUTER_ACTION_PROMPT } from '../computer/actionSchema.js';
import {
  estimateTokens,
  modelContextCapacity,
  reservedOutputTokens
} from '../services/longContext/tokens.js';

/**
 * AutonomousBrain — the local phone Gemma as the ONE reasoning engine.
 *
 * Provider policy (requirement #1, #2, #75):
 *   • The phone-hosted OpenAI-compatible model is the only reasoning provider.
 *   • There is no cloud fallback of any kind. `callProvider`, the provider table
 *     and LLM_API_KEY are simply not reachable from this class.
 *   • If the phone is unreachable we throw LocalAiUnavailableError, and the
 *     worker moves the job to `waiting` with reason "LOCAL AI UNAVAILABLE".
 *     We do not quietly reason with something else.
 *
 * All inference is funnelled through the shared LocalAIQueue, which is a
 * hardware scheduler for a single phone — NOT a user quota. Jobs are queued,
 * never rejected (requirement #42).
 *
 * CONTEXT IS FINITE AND ENFORCED. The phone exposes no tokenizer, so the brain
 * estimates tokens (conservatively) and guarantees:
 *     system + user + outputReserve <= PHONE_AI_CONTEXT_TOKENS
 * When a prompt does not fit it is progressively compacted (compact system
 * prompt → smaller memory budget → truncated memory) and retried. If the model
 * still reports a context failure, the brain surfaces it as a real, typed
 * condition (kind: 'context_window') instead of a mystery 500.
 */

/** Errors from the phone that mean "this prompt does not fit the window". */
const CONTEXT_WINDOW_PATTERN = /tokenization failed|prompt too long|context (length|window|overflow)|too many tokens|CONTEXT_WINDOW_EXCEEDED/i;

/** Errors that mean "the phone cannot answer right now" (not a prompt problem). */
const UNAVAILABLE_PATTERN = /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed|socket hang up|Empty Phone AI response|50[2349]|42[89]/i;

/**
 * The phone serialises generations, so a busy signal is a normal, transient
 * condition — the queue's whole reason to exist. It is reported truthfully and
 * waited on; it is never faked, and never traded for a silent fallback.
 */
const BUSY_PATTERN = /42[89]|already in progress|too many requests|rate limit|\bbusy\b/i;

export function isContextWindowError(error) {
  return CONTEXT_WINDOW_PATTERN.test(String(error?.message || ''));
}

export function isUnavailableError(error) {
  return !isContextWindowError(error) && UNAVAILABLE_PATTERN.test(String(error?.message || ''));
}

export function isBusyError(error) {
  return BUSY_PATTERN.test(String(error?.message || ''));
}

/** Token-bounded truncation that keeps the head AND the tail (the operative parts). */
export function truncateToTokens(text, maxTokens) {
  if (!text) return text;
  if (estimateTokens(text) <= maxTokens) return text;
  const approxChars = Math.max(200, Math.floor(maxTokens * 3.1));
  const half = Math.floor(approxChars / 2);
  return `${text.slice(0, half)}\n\n[... memory truncated to fit the model context window ...]\n\n${text.slice(-half)}`;
}

export class LocalAiUnavailableError extends Error {
  constructor(message, { kind = 'unreachable', detail = null } = {}) {
    super(message);
    this.name = 'LocalAiUnavailableError';
    this.code = 'LOCAL_AI_UNAVAILABLE';
    this.kind = kind;
    this.detail = detail;
  }
}

export class BrainDecisionError extends Error {
  constructor(message, { raw = null, errors = [] } = {}) {
    super(message);
    this.name = 'BrainDecisionError';
    this.code = 'BRAIN_INVALID_DECISION';
    this.raw = raw;
    this.errors = errors;
  }
}

export class AutonomousBrain {
  constructor({
    memory,
    eventService = null,
    computer = null,
    provider = null,
    queue = localAIQueue,
    configOverride = {}
  } = {}) {
    this.memory = memory;
    this.eventService = eventService;
    this.computer = computer;
    this.queue = queue;
    this.provider = provider || new PhoneLocalProvider(config);
    this.settings = {
      temperature: 0.25,
      // A decision is a small JSON object: keep the output reservation modest so
      // most of the finite window is available for real context.
      maxTokens: Number(configOverride.maxTokens || process.env.AGENT_BRAIN_MAX_TOKENS || 700),
      decisionRetries: Number(configOverride.decisionRetries ?? process.env.AGENT_BRAIN_RETRIES ?? 2),
      memoryBudgetTokens: Number(process.env.AGENT_BRAIN_MEMORY_TOKENS || 1400)
    };
    this.capacity = Number(configOverride.capacity || modelContextCapacity());
    this.outputReserve = Number(configOverride.outputReserve || reservedOutputTokens());
    this.lastProviderInfo = null;
    this.lastPromptDiagnostics = null;
  }

  /** Tokens available for the prompt itself (everything except the reserve). */
  get promptBudget() {
    return Math.max(256, this.capacity - Math.max(this.outputReserve, this.settings.maxTokens));
  }

  /** Whether the local brain is configured and reachable. */
  async health() {
    if (!this.provider.enabled) {
      return {
        available: false,
        reason: 'LOCAL AI UNAVAILABLE — PHONE_AI_ENABLED is not true',
        provider: this.provider.constructor.name
      };
    }
    const health = await this.provider.healthCheck();
    this.lastProviderInfo = health;
    if (!health.reachable) {
      return {
        available: false,
        reason: `LOCAL AI UNAVAILABLE — ${health.reason || 'phone model unreachable'}`,
        provider: this.provider.constructor.name,
        detail: health
      };
    }
    return { available: true, reason: null, provider: this.provider.constructor.name, model: health.model, detail: health };
  }

  // ── Context construction (requirement #61) ────────────────────────────
  /**
   * @param {object} [options]
   * @param {boolean} [options.compact] names-only tool list and a condensed
   *        action/schema section, for a small context window.
   */
  buildSystemPrompt({ compact = false } = {}) {
    const registry = ToolRegistry.list();
    const tools = compact
      ? registry.map((tool) => tool.name).join(', ')
      : registry
        .map((tool) => `  - ${tool.name} (${tool.category}, risk: ${tool.riskLevel})${tool.requiresKali ? ' [needs Kali worker]' : ''}: ${tool.description}`)
        .join('\n');

    const computerSection = compact
      ? `COMPUTER ACTIONS (whitelisted, scope-checked): screenshot, click, double_click, move_mouse, type, press_key, hotkey, scroll, sleep, open_application, navigate, get_active_window, get_browser_state.\nThere is no shell action — terminal work goes through registry tools.`
      : COMPUTER_ACTION_PROMPT;

    const schemaSection = compact
      ? `REPLY WITH ONE JSON OBJECT ONLY:
{"objective":"...","observation":"...","nextAction":{"type":"tool|computer_action|observation|hypothesis|validate|finding|plan_update|wait|complete","name":"tool","target":"host","arguments":{},"action":{"type":"...","params":{}},"hypothesis":"..."},"reason":"...","expectedOutcome":"...","confidence":0.0,"phase":"..."}`
      : AUTONOMOUS_DECISION_SCHEMA_PROMPT;

    return `You are DARKMATTER — an autonomous, authorized bug-bounty security research agent.
You are NOT a chatbot. You plan and execute an authorized security assessment, one action at a time,
inside an explicitly authorized scope. Every action you propose is validated by DARKMATTER's scope
engine and policy validator before it runs. You never receive a shell.

Think like a LEAD bug-bounty hunter — not a junior running a checklist, but the
expert who finds what scanners miss. Your thinking must be:

  DEEP, not shallow: Before acting, reason through MULTIPLE angles.
  Ask yourself: "If this is true, then what? What would a developer have
  gotten wrong here? What's the second-order effect? What's the weird edge
  case nobody tests?" A login form is not just "test SQLi" — it's "what if
  the password reset token is predictable? what if the session doesn't
  expire? what if the API returns more data than the UI shows?"

  CREATIVE, not mechanical: Scanners check known patterns. YOU find the
  novel. Combine observations: "The API returns a user ID AND the frontend
  trusts it for auth — that's an IDOR hypothesis." "This endpoint is slow
  AND takes a query param — that's a potential injection or DoS angle."
  Write down 2-3 competing hypotheses when the evidence is ambiguous, then
  design ONE action that discriminates between them.

  ADVERSARIAL, not trusting: Every input is attacker-controlled until proven
  otherwise. Every "it looks safe" needs a reason. When something behaves
  unexpectedly (weird error, slow response, extra data), treat it as a lead,
  not noise.

  CHAIN-BUILDING, not isolated: Senior hunters don't stop at single bugs —
  they CHAIN them. A low-severity info leak + a medium auth weakness can
  become a HIGH or CRITICAL when combined. Always ask: "What does this
  finding UNLOCK? If I have this, what becomes possible that wasn't before?"
  When you confirm a finding, immediately hunt for what chains with it.
  File completed chains with category "vulnerability-chain" — low+low=high
  is how elite hunters win bounties.

  ELITE PLAYBOOK — techniques that separate senior hunters from juniors.
  You know ALL of these and apply them creatively. You have a "python" tool
  to write custom scripts for anything no pre-built tool covers:

  RECON: JS bundle analysis (hidden APIs, keys, internal URLs in frontend
  code); API schema inference from responses; subdomain takeover via dangling
  DNS/CNAME; Wayback Machine mining for forgotten endpoints; GitHub dorking
  for leaked secrets tied to the target.

  VULN HUNTING: Business-logic bugs (price/quantity manipulation, workflow
  bypass, coupon abuse); auth matrix testing (every role × every endpoint for
  IDOR/BOLA); race conditions via concurrent requests; JWT attacks (weak
  secret, alg=none, alg confusion); GraphQL introspection for hidden
  operations; SSRF toward cloud metadata endpoints; prototype pollution in
  JS-heavy targets; CORS misconfigurations with credentials.

  EXPLOITATION: Custom payload mutation for WAF bypass (encode, fragment,
  polyglot); chaining primitives into full attack paths; proving impact
  with the MINIMUM proof that demonstrates the vulnerability — never
  destructive, never touching other users' data.

  INTELLIGENCE: Correlate detected software versions with known CVEs;
  recognize honeypots/tar pits and move on fast; track scope changes.

  When the user asks in plain language ("jo zyada bounty de sake wo bugs
  dikha", "sirf high severity wali report de", "har vulnerability ka alag
  report bana"), YOU understand the intent and do it — using your tools,
  your memory, and your judgment. No hardcoded filters: you are the filter.

  EFFICIENT, not wasteful: You never sleep, but every action costs time.
  Prefer the action with the highest information-per-cost. Don't re-run what
  you already know. Chain: recon → hypothesis → targeted probe → validate.
  When several INDEPENDENT recon tools would all help (e.g. subdomain enum +
  tech fingerprint + WAF detect at hunt start), fire them TOGETHER with a
  single "parallel_tools" action — you are faster than any human because you
  don't wait. Never put dependent tools in one parallel batch.

  HONEST, not hopeful: A suspicious response is NEVER automatically a
  vulnerability. You distinguish clearly between:
  observation  → something you actually saw in a tool/computer observation
  hypothesis   → a testable guess that still needs validation
  finding      → a vulnerability confirmed by stored evidence
A suspicious response is NEVER automatically a vulnerability.

ANSWER HONESTY:
- Anything not present in the memory block or the observations you were given is UNKNOWN. Say "unknown".
- Never claim an earlier discovery that is not in memory.
- Never fabricate tool output, screenshots, or HTTP responses.

REGISTRY TOOLS (the only way to run security tooling):
${tools || '  (registry empty)'}

${computerSection}

${schemaSection}`;
  }

  /**
   * Compose the exact message list for one reasoning step, guaranteed to fit
   * the model's finite window.
   */
  composePrompt(context, { compact = false, memoryBudget } = {}) {
    // Pre-empt the failure instead of discovering it: if the detailed prompt
    // plus a workable memory budget would not fit, start compact.
    const fullTokens = estimateTokens(this.buildSystemPrompt({ compact: false }));
    const useCompact = compact || (fullTokens + 600 > this.promptBudget);
    const system = useCompact ? this.buildSystemPrompt({ compact: true }) : this.buildSystemPrompt({ compact: false });
    const systemTokens = estimateTokens(system);
    const wasCompacted = compact;

    // Memory gets whatever is left after the system block and a request reserve.
    const remaining = this.promptBudget - systemTokens - 420; // 420 ≈ the non-memory part of the user message
    const budget = Math.max(160, Math.min(memoryBudget ?? this.settings.memoryBudgetTokens, remaining));
    const memoryContext = context.memoryContext
      ? truncateToTokens(context.memoryContext, budget)
      : context.memoryContext;

    const user = this.buildUserMessageSync({ ...context, memoryContext });
    const userTokens = estimateTokens(user);

    this.lastPromptDiagnostics = {
      capacity: this.capacity,
      outputReserve: Math.max(this.outputReserve, this.settings.maxTokens),
      systemTokens,
      userTokens,
      total: systemTokens + userTokens,
      memoryBudget: budget,
      compact: useCompact,
      compactedByBudget: useCompact && !wasCompacted
    };

    return { system, user, diagnostics: this.lastPromptDiagnostics };
  }

  /**
   * Build the user message for one reasoning step.
   * Everything here is bounded: big raw data lives in Mongo and is referenced.
   */
  async buildUserMessage(context) {
    return this.buildUserMessageSync(context);
  }

  buildUserMessageSync({ job, memoryContext, recentObservations = [], toolResults = [], findings = [], computerStatus = null, userInstruction = null }) {
    const parts = [];
    parts.push('## AUTHORIZED SCOPE');
    parts.push(`Target: ${job.target}`);
    parts.push(`Included: ${(job.scope?.included || []).join(', ') || job.target}`);
    parts.push(`Excluded: ${(job.scope?.excluded || []).join(', ') || 'none'}`);
    parts.push(`Authorization: confirmed by the account owner (userId ${job.userId})`);

    parts.push('\n## CURRENT OBJECTIVE');
    parts.push(job.currentObjective || job.objective || 'Assess the target');

    parts.push('\n## TASK PLAN');
    parts.push(this.renderPlan(job.plan));

    parts.push(`\n## JOB STATE`);
    parts.push(`Status: ${job.status}`);
    parts.push(`Phase: ${job.phase}`);
    parts.push(`Steps taken so far: ${job.stepCount}`);
    parts.push(`Findings so far: ${job.findingsCount}`);

    if (computerStatus) {
      parts.push('\n## COMPUTER STATE (the hands layer)');
      parts.push(`State: ${computerStatus.state}`);
      parts.push(`Available: ${computerStatus.available}`);
      if (computerStatus.reason) parts.push(`Reason: ${computerStatus.reason}`);
      if (computerStatus.screen) parts.push(`Screen: ${computerStatus.screen.width}x${computerStatus.screen.height}`);
      if (computerStatus.inputSimulation === false) {
        parts.push(`DEGRADED: input simulation is unavailable (${computerStatus.capabilities?.pyautoguiError || 'pyautogui missing'}). click/type/press_key/screenshot will fail — prefer registry tools or URL navigation.`);
      }
      if (computerStatus.lastObservation?.summary) parts.push(`Last observation: ${computerStatus.lastObservation.summary}`);
      if (computerStatus.visionCapable === false) {
        parts.push('Note: you are a TEXT model. Screenshots are captured and stored as evidence, but you cannot see them — reason from textual observations only.');
      }
    }

    if (memoryContext) {
      parts.push('\n## MEMORY');
      parts.push(memoryContext);
    }

    if (findings.length) {
      parts.push('\n## CONFIRMED FINDINGS (stored)');
      for (const finding of findings.slice(0, 10)) {
        parts.push(`  - [${finding.status}] ${finding.title} (${finding.severity}) @ ${finding.affectedAsset || 'n/a'}`);
      }
    }

    // --- Hypothesis Engine: competing theories the agent is actively testing ---
    const hypotheses = job.hypotheses || [];
    if (hypotheses.length) {
      parts.push('\n## ACTIVE HYPOTHESES (competing theories — test to discriminate)');
      for (const h of hypotheses.slice(0, 8)) {
        const status = h.status || 'open';
        parts.push(`  - [${status}] "${h.text}" (confidence: ${h.confidence ?? '?'})`);
        if (h.evidence) parts.push(`      evidence so far: ${String(h.evidence).slice(0, 200)}`);
        if (h.nextTest) parts.push(`      discriminating test: ${String(h.nextTest).slice(0, 200)}`);
      }
      parts.push('  RULE: when evidence is ambiguous, keep 2-3 competing hypotheses OPEN.');
      parts.push('  Design ONE action that discriminates between them (kills at least one).');
      parts.push('  Mark a hypothesis "confirmed" only with stored evidence, "killed" when disproven.');
    } else {
      parts.push('\n## ACTIVE HYPOTHESES');
      parts.push('  (none yet — when you spot something suspicious, open 2-3 competing hypotheses');
      parts.push('   instead of chasing the first idea. Use the "hypothesis" action type to register them.)');
    }

    if (toolResults.length) {
      parts.push('\n## RELEVANT TOOL RESULTS');
      for (const result of toolResults.slice(0, 6)) {
        parts.push(`  - ${result.tool} @ ${result.target}: ${String(result.summary || '').slice(0, 600)}`);
      }
    }

    if (recentObservations.length) {
      parts.push('\n## RECENT OBSERVATIONS (oldest → newest)');
      for (const observation of recentObservations.slice(-12)) {
        parts.push(`  - [${observation.kind || 'observation'}] ${String(observation.summary || '').slice(0, 400)}`);
      }
    }

    if (userInstruction) {
      parts.push('\n## USER INSTRUCTION');
      parts.push(String(userInstruction).slice(0, 2000));
    }

    parts.push('\n## YOUR TASK');
    parts.push('Choose the single next action. Be concrete and in-scope. Reply with the JSON decision object only.');
    return parts.join('\n');
  }

  renderPlan(plan) {
    if (!plan || (!plan.phases?.length && !plan.pendingSteps?.length)) {
      return 'No plan yet — produce one with a plan_update action if the objective is unclear.';
    }
    const lines = [];
    for (const phase of plan.phases || []) {
      const done = (phase.steps || []).filter((step) => step.status === 'done').length;
      lines.push(`  ${phase.name}: ${done}/${(phase.steps || []).length} steps done`);
      for (const step of phase.steps || []) {
        lines.push(`    ${step.status === 'done' ? '[x]' : '[ ]'} ${step.step}`);
      }
    }
    if (plan.pendingSteps?.length) {
      lines.push(`  Pending: ${plan.pendingSteps.slice(0, 20).join(', ')}`);
    }
    return lines.join('\n');
  }

  /**
   * Ask the local brain for the next decision.
   *
   * @throws {LocalAiUnavailableError} when the phone cannot reason right now
   * @throws {BrainDecisionError} when the model replies with an unusable decision
   */
  async decide(context) {
    const health = await this.health();
    if (!health.available) {
      throw new LocalAiUnavailableError(health.reason, { kind: 'unreachable', detail: health.detail });
    }

    const attempts = this.settings.decisionRetries + 1;
    let compact = false;
    let memoryBudget = this.settings.memoryBudgetTokens;
    let lastError = null;
    let sawContextError = false;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const { system, user, diagnostics } = this.composePrompt(context, { compact, memoryBudget });

      await this.publish(context.job?.id, {
        type: 'brain.thinking',
        level: 'INFO',
        message: `Local AI (${health.model || 'phone gemma'}) reasoning — ~${diagnostics.total} prompt tokens of ${this.promptBudget} available${compact ? ' (compacted prompt)' : ''}`,
        data: { ...diagnostics, queue: this.queue.stats?.() || null }
      });

      let raw = null;
      try {
        // The queue is a phone-hardware scheduler; jobs wait, they are not dropped.
        raw = await this.queue.enqueue(
          () => this.provider.generateStructured(
            [{ role: 'system', content: system }, { role: 'user', content: user }],
            null,
            { temperature: this.settings.temperature, maxTokens: this.settings.maxTokens }
          ),
          context.job?.id || 'agent-brain'
        );
      } catch (error) {
        lastError = error;

        if (isContextWindowError(error)) {
          // The prompt does not fit. Compact and retry instead of dying — this is
          // the whole point of a finite local model.
          sawContextError = true;
          compact = true;
          memoryBudget = Math.max(160, Math.floor(memoryBudget * 0.5));
          await this.publish(context.job?.id, {
            type: 'brain.thinking',
            level: 'WARN',
            message: `Local model rejected the prompt as too long — compacting context (memory budget → ${memoryBudget} tokens) and retrying`,
            data: { error: String(error.message).slice(0, 300) }
          });
          continue;
        }

        if (isUnavailableError(error)) {
          const busy = isBusyError(error);
          throw new LocalAiUnavailableError(
            busy
              ? `LOCAL AI BUSY — the phone is serialising generations: ${error.message}`
              : `LOCAL AI UNAVAILABLE — ${error.message}`,
            { kind: busy ? 'busy' : 'inference_failed', detail: { attempt } }
          );
        }
        continue;
      }

      const validation = validateAutonomousDecision(raw, {
        // The computer layer is a capability, not a constant: when it is
        // disabled by configuration, reject computer_action decisions here so
        // the retry loop below forces the brain onto registry tools instead
        // of looping on a dead layer.
        computerActionAllowed: context.computerStatus?.available !== false
      });
      if (validation.valid) {
        return {
          decision: validation.decision,
          raw,
          provider: this.provider.constructor.name,
          model: health.model,
          estimatedTokens: diagnostics.total,
          diagnostics
        };
      }

      lastError = new BrainDecisionError(
        `Model returned a decision that violates the schema: ${validation.errors.join('; ')}`,
        { raw, errors: validation.errors }
      );
      await this.publish(context.job?.id, {
        type: 'brain.decision',
        level: 'WARN',
        message: `Rejected malformed decision (attempt ${attempt + 1}): ${validation.errors.join('; ')}`,
        data: { errors: validation.errors }
      });

      // A retry is cheaper and more likely to succeed with a slimmer prompt.
      compact = true;
      memoryBudget = Math.max(160, Math.floor(memoryBudget * 0.75));
    }

    if (sawContextError) {
      throw new LocalAiUnavailableError(
        `LOCAL AI UNAVAILABLE — the local model's context window (${this.capacity} tokens) is too small for the current prompt even after compaction: ${lastError?.message || 'context_window'}`,
        { kind: 'context_window', detail: { capacity: this.capacity, diagnostics: this.lastPromptDiagnostics } }
      );
    }

    throw lastError || new BrainDecisionError('Model produced no usable decision');
  }

  /**
   * Conversational mode — the human asks the agent about a running/previous
   * assessment. Same local-only provider, same honesty rules: if it is not in
   * the retrieved memory it is UNKNOWN.
   */
  async answerQuestion({ job, question, memoryContext = '', findings = [] }) {
    const health = await this.health();
    if (!health.available) {
      throw new LocalAiUnavailableError(health.reason, { kind: 'unreachable', detail: health.detail });
    }

    const system = `You are DARKMATTER, an autonomous authorized bug-bounty agent.
You are answering a question from the human operator about an assessment you are running (or ran).
Rules:
- Answer ONLY from the MEMORY, FINDINGS and STATE given to you below.
- If the answer is not present, say plainly that it is unknown and what action would reveal it.
- Never invent findings, tool output, or discoveries.
- Be concise, technical and precise.`;

    const userParts = [
      `ASSESSMENT: ${job.target} (status: ${job.status}, phase: ${job.phase}, steps: ${job.stepCount})`,
      `AUTHORIZED SCOPE: ${(job.scope?.included || [job.target]).join(', ')}`,
      `CURRENT OBJECTIVE: ${job.currentObjective || job.objective}`,
      findings.length
        ? `FINDINGS:\n${findings.map((f) => `  - [${f.status}] ${f.title} (${f.severity}) @ ${f.affectedAsset || 'n/a'}`).join('\n')}`
        : 'FINDINGS: none stored',
      memoryContext,
      `QUESTION: ${String(question).slice(0, 2000)}`
    ];

    const text = await this.queue.enqueue(
      () => this.provider.generate(
        [{ role: 'system', content: system }, { role: 'user', content: userParts.join('\n\n') }],
        { temperature: 0.3, maxTokens: 1200 }
      ),
      `${job.id}:ask`
    );

    return { text, model: health.model, provider: this.provider.constructor.name };
  }

  async publish(jobId, event) {
    if (!jobId || !this.eventService) return null;
    try {
      return await this.eventService.publish(jobId, event);
    } catch {
      return null;
    }
  }

  /** Structured, high-level status for the UI — never raw chain-of-thought. */
  static statusLabel(decision) {
    const type = decision?.nextAction?.type;
    switch (type) {
      case 'tool':
        return `Planning next validation step… (${decision.nextAction.name})`;
      case 'parallel_tools': {
        const names = (decision.nextAction.tools || decision.nextAction.parallelTools || []).map((t) => t.name).join(', ');
        return `Running parallel recon (${names})…`;
      }
      case 'computer_action':
        return `Driving the computer layer (${decision.nextAction.action?.type})…`;
      case 'validate':
        return 'Validating a hypothesis…';
      case 'finding':
        return 'Confirming a finding with evidence…';
      case 'hypothesis':
        return 'Generating a hypothesis from observations…';
      case 'observation':
        return 'Recording an observation…';
      case 'plan_update':
        return 'Updating the assessment plan…';
      case 'wait':
        return 'Waiting for a required runtime…';
      case 'complete':
        return 'Assessment objectives satisfied.';
      default:
        return 'Analyzing discovered attack surface…';
    }
  }
}
