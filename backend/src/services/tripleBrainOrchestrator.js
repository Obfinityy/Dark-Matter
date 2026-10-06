/**
 * tripleBrainOrchestrator.js — runtime coordination for the three LOCAL brain slots.
 *
 * Hunt mode and Control mode think with three separate models, each running on
 * the USER'S OWN machine via model-runner (llama-server on 127.0.0.1, one
 * random free port per slot — see ModelRunnerService.runForSlot):
 *
 *   hacker    — the THINKING brain. Uncensored instruct model. Strategizes the
 *               hunt, reviews evidence, and chains small vulnerabilities into
 *               bigger ones the way a human expert would.
 *   vision    — the SEEING brain. Vision-language model. Describes screenshots
 *               and page state in words the other brains can reason about.
 *   grounding — the ACTING brain. UI grounding model (e.g. UI-TARS). Turns a
 *               natural-language element description ("the search bar") into
 *               normalized 0–1000 x/y screen coordinates for real clicks.
 *
 * The orchestrator queries each slot's localhost server directly
 * (ModelRunnerService.getSlotServer) and keeps working with whichever brains
 * are actually running — a missing brain is logged loudly once and the loop
 * degrades gracefully instead of dying.
 *
 * Loop: think → see → act
 *   1. hacker strategizes from hunt context (+ latest observation)
 *   2. vision describes the current screen
 *   3. grounding converts the strategy's target element into coordinates
 *
 * All inference goes through the AutonomousBrain provider contract
 * ({ generate, generateStructured }), so slots can be local llama-server
 * models, Kaggle Gradio links, or injected fakes in tests.
 */

import { LocalLlamaProvider } from '../agent/providers/localLlamaProvider.js';
import { GradioProvider } from '../agent/providers/gradioProvider.js';
import { stripThinkingTags } from '../agent/providers/phoneLocalProvider.js';

export const BRAIN_SLOTS = ['vision', 'grounding', 'hacker'];

/** Normalized coordinate space used by grounding models (UI-TARS convention). */
export const GROUNDING_SPACE = 1000;

const STRATEGY_SCHEMA = {
  type: 'object',
  properties: {
    hypothesis: { type: 'string' },
    nextAction: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['tool', 'click', 'type', 'observe', 'validate', 'report', 'done'] },
        tool: { type: 'string' },
        targetElement: { type: 'string' },
        text: { type: 'string' },
        rationale: { type: 'string' }
      }
    },
    vulnChains: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          chain: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
          impact: { type: 'string' }
        }
      }
    },
    done: { type: 'boolean' }
  }
};

const COORD_SCHEMA = {
  type: 'object',
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    confidence: { type: 'number' }
  },
  required: ['x', 'y']
};

const HACKER_SYSTEM = [
  'You are the HACKING BRAIN of Infinity AI, an autonomous bug-bounty agent.',
  'You are running on the user\'s own machine for AUTHORIZED security testing only —',
  'the user has explicit permission to test every target you are given.',
  'Think like an elite human bug-bounty hunter:',
  '- chain small, low-severity weaknesses into high-impact attack paths;',
  '- prefer evidence-backed hypotheses over guesses;',
  '- never suggest destructive actions (no data deletion, no DoS, no mass exploitation);',
  '- when you have enough evidence, say done:true so the hunt can report.',
  'Always answer with the requested JSON and nothing else.'
].join('\n');

const VISION_SYSTEM = [
  'You are the VISION BRAIN of Infinity AI, an autonomous bug-bounty agent.',
  'You see screenshots of a web target under AUTHORIZED security testing.',
  'Describe precisely what is visible: page structure, forms, buttons,',
  'navigation, error messages, version banners, login states — anything a',
  'security analyst would note. Be concrete and terse.'
].join('\n');

const GROUNDING_SYSTEM = [
  'You are the GROUNDING BRAIN of Infinity AI, an autonomous bug-bounty agent.',
  'Given a screenshot and a natural-language description of a UI element,',
  `return its center as normalized coordinates in a 0-${GROUNDING_SPACE} space`,
  '(x: 0 = left edge, 1000 = right edge; y: 0 = top edge, 1000 = bottom edge).',
  'Answer with the requested JSON and nothing else.'
].join('\n');

function imagePart(base64, mime = 'image/png') {
  return { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } };
}

function clampCoord(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(GROUNDING_SPACE, Math.max(0, Math.round(v)));
}

export class TripleBrainOrchestrator {
  /**
   * @param {object} options
   * @param {import('./modelRunner/modelRunnerService.js').ModelRunnerService} [options.runner]
   *   — used to query each slot's localhost server (port, model, health).
   * @param {object} [options.providers] — pre-built { vision?, grounding?, hacker? }
   *   providers (test injection or explicit wiring). Wins over runner lookup.
   * @param {object} [options.selection] — brainProviderModel selection; enables the
   *   per-slot Kaggle source fallback when a slot has no local server.
   * @param {object} [options.appConfig]
   * @param {object} [options.logger] — { info, warn, error }
   * @param {number} [options.timeoutMs] — per-inference timeout
   */
  constructor({ runner = null, providers = {}, selection = null, appConfig = {}, logger = console, timeoutMs = 120000 } = {}) {
    this.runner = runner;
    this.providers = { ...(providers || {}) };
    this.selection = selection;
    this.appConfig = appConfig || {};
    this.logger = logger || console;
    this.timeoutMs = timeoutMs;
    this._missingWarned = new Set();
  }

  // ── Brain resolution ───────────────────────────────────────────────

  /**
   * Status of each slot's LOCAL server, straight from the model runner.
   * @returns {Object} { vision: {running, modelId, name, port, baseUrl} | {running:false}, ... }
   */
  localSlotStatus() {
    const out = {};
    for (const slot of BRAIN_SLOTS) {
      const server = this.runner?.getSlotServer?.(slot) || null;
      out[slot] = server?.baseUrl
        ? {
            running: true,
            modelId: server.modelId,
            name: server.name,
            port: server.port,
            baseUrl: server.baseUrl,
            startedAt: server.startedAt
          }
        : { running: false };
    }
    return out;
  }

  /**
   * Resolve the provider for a slot.
   * Priority: injected provider → local slot server → slot Kaggle source → null.
   * @returns {{ provider, source: 'injected'|'local'|'kaggle'|null, server? }}
   */
  resolveSlot(slot) {
    if (!BRAIN_SLOTS.includes(slot)) throw new Error(`Unknown brain slot "${slot}"`);
    if (this.providers[slot]) return { provider: this.providers[slot], source: 'injected' };
    const server = this.runner?.getSlotServer?.(slot);
    if (server?.baseUrl) {
      return {
        provider: new LocalLlamaProvider({ runner: this.runner, slot, timeout: this.timeoutMs }),
        source: 'local',
        server: { modelId: server.modelId, name: server.name, port: server.port, baseUrl: server.baseUrl }
      };
    }
    const slotSource = this.selection?.slotSources?.[slot];
    if (slotSource?.source === 'kaggle' && slotSource?.kaggleUrl) {
      return {
        provider: new GradioProvider({ baseUrl: slotSource.kaggleUrl, model: slotSource.kaggleName || slot }),
        source: 'kaggle'
      };
    }
    return { provider: null, source: null };
  }

  /** Names of slots with no usable provider right now. */
  missingBrains() {
    return BRAIN_SLOTS.filter((slot) => !this.resolveSlot(slot).provider);
  }

  /**
   * Log one line per slot: running model + localhost port, or a loud MISSING
   * warning. Warns once per slot per orchestrator lifetime to avoid spam.
   * @returns {string[]} the missing slot names
   */
  logBrainStatus() {
    const status = this.localSlotStatus();
    const missing = [];
    for (const slot of BRAIN_SLOTS) {
      const { provider, source, server } = this.resolveSlot(slot);
      if (!provider) {
        missing.push(slot);
        if (!this._missingWarned.has(slot)) {
          this._missingWarned.add(slot);
          this.logger.warn?.(
            `[triple-brain] MISSING brain: "${slot}" — no model running for this slot. ` +
            `Open Models → download a ${slot === 'hacker' ? 'hacking' : slot} model and press Run. ` +
            'Continuing with the remaining brains.'
          );
        }
      } else if (source === 'local' && server) {
        this.logger.info?.(
          `[triple-brain] brain "${slot}" OK — ${server.name || server.modelId} on 127.0.0.1:${server.port}`
        );
      } else {
        this.logger.info?.(`[triple-brain] brain "${slot}" OK — source: ${source}`);
      }
    }
    void status;
    return missing;
  }

  /**
   * Health-check every resolvable brain.
   * @returns {Promise<Object>} { vision: {ok, source, latencyMs?, reason?}, ... }
   */
  async healthCheck() {
    const out = {};
    for (const slot of BRAIN_SLOTS) {
      const { provider, source, server } = this.resolveSlot(slot);
      if (!provider) {
        out[slot] = { ok: false, source: null, reason: 'no provider — slot has no running model' };
        continue;
      }
      const start = Date.now();
      try {
        if (typeof provider.healthCheck === 'function') {
          const h = await provider.healthCheck();
          out[slot] = {
            ok: !!h.reachable,
            source,
            model: h.model || server?.modelId || null,
            port: server?.port ?? null,
            latencyMs: Date.now() - start,
            ...(h.reachable ? {} : { reason: h.reason || 'unreachable' })
          };
        } else {
          out[slot] = { ok: true, source, model: server?.modelId || null, port: server?.port ?? null, latencyMs: Date.now() - start };
        }
      } catch (error) {
        out[slot] = { ok: false, source, reason: error.message, latencyMs: Date.now() - start };
      }
    }
    return out;
  }

  // ── The three brains ───────────────────────────────────────────────

  /**
   * THINK — the hacker brain strategizes the next step and chains vulns.
   * Falls back to the vision brain for basic reasoning when the hacker
   * slot is empty (clearly marked in the result).
   */
  async think({ target, stage = 'recon', observations = [], findings = [], history = [] } = {}) {
    let { provider, source } = this.resolveSlot('hacker');
    let degraded = false;
    if (!provider) {
      this._warnMissingOnce('hacker');
      const vision = this.resolveSlot('vision');
      if (!vision.provider) {
        return {
          ok: false,
          reason: 'no hacker brain and no vision fallback — cannot strategize',
          strategy: this._idleStrategy('No thinking brain available')
        };
      }
      provider = vision.provider;
      source = `${vision.source}-fallback`;
      degraded = true;
    }
    const contextBlock = [
      `Target: ${target || '(unknown)'}`,
      `Stage: ${stage}`,
      findings.length ? `Findings so far:\n${findings.map((f) => `- [${f.severity || '?'}] ${f.title || f.type}: ${(f.description || '').slice(0, 300)}`).join('\n')}` : 'Findings so far: none',
      observations.length ? `Latest observations:\n${observations.slice(-3).map((o) => `- ${String(o).slice(0, 500)}`).join('\n')}` : 'Latest observations: none',
      history.length ? `Recent actions:\n${history.slice(-5).map((h) => `- ${typeof h === 'string' ? h : JSON.stringify(h).slice(0, 200)}`).join('\n')}` : 'Recent actions: none'
    ].join('\n\n');

    const strategy = await provider.generateStructured(
      [
        { role: 'system', content: HACKER_SYSTEM + (degraded ? '\n(Note: you are the vision model covering for the missing hacker brain — keep reasoning simple and safe.)' : '') },
        { role: 'user', content: `Authorized bug-bounty hunt context:\n\n${contextBlock}\n\nPropose the single next step. Chain weak signals into attack paths where the evidence supports it.` }
      ],
      STRATEGY_SCHEMA,
      { timeout: this.timeoutMs }
    );
    return { ok: true, degraded, source, strategy: this._normalizeStrategy(strategy) };
  }

  /**
   * SEE — the vision brain describes a screenshot.
   * @param {object} options — { imageBase64, mime?, hint? }
   * @returns {Promise<{ ok, description?, reason? }>}
   */
  async see({ imageBase64, mime = 'image/png', hint = '' } = {}) {
    const { provider, source } = this.resolveSlot('vision');
    if (!provider) {
      this._warnMissingOnce('vision');
      return { ok: false, reason: 'vision brain missing — no model running for the vision slot' };
    }
    if (!imageBase64) return { ok: false, reason: 'no screenshot provided' };
    const text = await provider.generate(
      [
        { role: 'system', content: VISION_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Describe this screenshot for a security analyst.${hint ? ` Focus: ${hint}` : ''}` },
            imagePart(imageBase64, mime)
          ]
        }
      ],
      { timeout: this.timeoutMs }
    );
    return { ok: true, source, description: stripThinkingTags(String(text || '')).trim() };
  }

  /**
   * ACT — the grounding brain turns an element description into coordinates.
   * @param {object} options — { element, imageBase64?, mime? }
   * @returns {Promise<{ ok, x?, y?, confidence?, reason? }>} coords in 0–1000 space
   */
  async act({ element, imageBase64 = null, mime = 'image/png' } = {}) {
    const { provider, source } = this.resolveSlot('grounding');
    if (!provider) {
      this._warnMissingOnce('grounding');
      return { ok: false, reason: 'grounding brain missing — no model running for the grounding slot' };
    }
    if (!element || !String(element).trim()) return { ok: false, reason: 'no element description provided' };
    const userContent = imageBase64
      ? [
          { type: 'text', text: `Locate this UI element and return its center coordinates: "${element}"` },
          imagePart(imageBase64, mime)
        ]
      : `Locate this UI element on the current screen and return its center coordinates: "${element}"`;
    const raw = await provider.generateStructured(
      [
        { role: 'system', content: GROUNDING_SYSTEM },
        { role: 'user', content: userContent }
      ],
      COORD_SCHEMA,
      { timeout: this.timeoutMs }
    );
    const x = clampCoord(raw?.x);
    const y = clampCoord(raw?.y);
    if (x === null || y === null) {
      return { ok: false, source, reason: `grounding model returned unusable coordinates: ${JSON.stringify(raw).slice(0, 200)}` };
    }
    let confidence = Number(raw?.confidence);
    if (!Number.isFinite(confidence)) confidence = null;
    return { ok: true, source, x, y, confidence };
  }

  /**
   * Full think → see → act cycle for one agent step.
   * @param {object} options — { imageBase64?, mime?, target, stage?, observations?, findings?, history?, hint? }
   */
  async observeThinkAct(options = {}) {
    const missing = this.logBrainStatus();
    const { imageBase64 = null, mime = 'image/png', hint = '' } = options;

    // 1. SEE
    const seen = imageBase64 ? await this.see({ imageBase64, mime, hint }) : { ok: false, reason: 'no screenshot' };
    const observations = [
      ...(options.observations || []),
      ...(seen.ok ? [seen.description] : [])
    ];

    // 2. THINK
    const thought = await this.think({ ...options, observations });

    // 3. ACT — only when the strategy names a concrete UI target.
    let grounded = null;
    const targetElement = thought.strategy?.nextAction?.targetElement;
    if (thought.ok && targetElement) {
      grounded = await this.act({ element: targetElement, imageBase64, mime });
    }

    return {
      observation: seen,
      thought,
      grounded,
      missingBrains: missing,
      brainsUsed: BRAIN_SLOTS.filter((s) => !missing.includes(s))
    };
  }

  // ── internals ──────────────────────────────────────────────────────

  _warnMissingOnce(slot) {
    if (!this._missingWarned.has(slot)) {
      this._missingWarned.add(slot);
      this.logger.warn?.(`[triple-brain] "${slot}" brain missing — continuing with available brains`);
    }
  }

  _idleStrategy(reason) {
    return { hypothesis: reason, nextAction: { kind: 'observe', rationale: reason }, vulnChains: [], done: false };
  }

  _normalizeStrategy(raw = {}) {
    const nextAction = raw.nextAction && typeof raw.nextAction === 'object' ? raw.nextAction : {};
    return {
      hypothesis: typeof raw.hypothesis === 'string' ? raw.hypothesis : '',
      nextAction: {
        kind: typeof nextAction.kind === 'string' ? nextAction.kind : 'observe',
        tool: typeof nextAction.tool === 'string' ? nextAction.tool : null,
        targetElement: typeof nextAction.targetElement === 'string' ? nextAction.targetElement : null,
        text: typeof nextAction.text === 'string' ? nextAction.text : null,
        rationale: typeof nextAction.rationale === 'string' ? nextAction.rationale : ''
      },
      vulnChains: Array.isArray(raw.vulnChains) ? raw.vulnChains : [],
      done: raw.done === true
    };
  }
}

/**
 * Factory: build an orchestrator for a hunt's user.
 * @param {object} options — { runner, selection, appConfig, logger, timeoutMs }
 */
export function createTripleBrainOrchestrator(options = {}) {
  return new TripleBrainOrchestrator(options);
}
