import crypto from 'crypto';
import { newId } from './longContextStore.js';
import { Validator, Assembler, OutputPlanner } from './validator.js';
import { ContextWindowError } from './phoneModelAdapter.js';
import { estimateTokens } from './tokens.js';

/**
 * LongGenerationEngine — virtualized output generation.
 *
 *   request → requirement analysis → generation plan → artifact manifest
 *           → part generation → validation → next part → … → final assembly
 *
 * Each part has a stable id (artifactId/sequence), is persisted immediately,
 * and generation can resume/cancel without losing completed parts. Continuation
 * is boundary-aware and de-duplicated (hash overlap detection) — "continue" is
 * never a blind request; every call receives the exact tail context.
 *
 * The model context stays finite; the engine composes a bounded Generation
 * Context per part:
 *   SYSTEM + PLAN + CURRENT PART + RELEVANT PREV PARTS + INTERFACE CONTRACTS
 *   + GLOBAL REQUIREMENTS + VALIDATION ERRORS + USER INSTRUCTION
 */
class LongGenerationEngine {
  constructor({ store, model }) {
    this.store = store;               // LongGenerationStore
    this.model = model;               // PhoneModelAdapter
    this.validator = new Validator();
    this.assembler = new Assembler();
    this.planner = new OutputPlanner();
    this.running = new Map();         // generationId → AbortController-ish handle
  }

  // ── Requirement registry extraction (#19, #20) ────────────────────────
  extractRequirements(userRequest) {
    const reqs = [];
    const patterns = [
      /\buse (python|pygame|javascript|react|node|sqlite|mysql|typescript|java|c\+\+|go|rust)\b/gi,
      /\b(no external database|no database|offline|keyboard controls|save system|enemy ai|dark mode|responsive)\b/gi,
      /\bmust (have|include|support|use)\b([^.!?]*)/gi
    ];
    for (const p of patterns) {
      let m;
      while ((m = p.exec(userRequest)) !== null) {
        const text = m[0].trim();
        if (!reqs.some((r) => r.toLowerCase() === text.toLowerCase())) reqs.push(text);
      }
    }
    return reqs.slice(0, 20);
  }

  /**
   * Start a long generation. Persists state immediately (survives restarts).
   * Runs asynchronously; the caller receives generationId and can poll status.
   */
  async startGeneration({ userId, conversationId, request, artifactHint }) {
    const generationId = newId('gen');
    const record = {
      generationId,
      userId,
      conversationId,
      request: request.slice(0, 2000),
      status: 'planning', // queued|planning|generating|validating|repairing|assembling|completed|cancelled|failed
      requirements: this.extractRequirements(request),
      plan: null,
      parts: [],           // [{partId, sequence, filename, language, content, status, validation}]
      assembly: null,
      errors: [],
      progress: { current: 0, total: 0, label: 'Analyzing requirements…' },
      cancelled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this.store.save(record);
    // Fire and forget — the controller returns immediately with generationId.
    setImmediate(() => { this.run(generationId).catch(() => {}); });
    return record;
  }

  async get(generationId) { return this.store.get(generationId); }

  async cancel(generationId, userId) {
    const record = await this.store.get(generationId);
    if (!record || record.userId !== userId) return null;
    record.cancelled = true;
    record.status = record.parts.length > 0 ? record.status : 'cancelled';
    await this.store.save(record);
    const handle = this.running.get(generationId);
    handle?.abort?.();
    return record;
  }

  /** Resume from the last stable checkpoint (#26) — unfinished parts only. */
  async resume(generationId, userId) {
    const record = await this.store.get(generationId);
    if (!record || record.userId !== userId) return null;
    if (record.status === 'completed') return record;
    record.cancelled = false;
    record.status = 'generating';
    await this.store.save(record);
    setImmediate(() => { this.run(generationId, { resume: true }).catch(() => {}); });
    return record;
  }

  persist(record) {
    record.updatedAt = new Date().toISOString();
    return this.store.save(record);
  }

  // ── Core runner ───────────────────────────────────────────────────────
  async run(generationId, { resume = false } = {}) {
    const record = await this.store.get(generationId);
    if (!record) return;
    const abort = { aborted: false };
    this.running.set(generationId, { abort });

    try {
      if (!record.plan || !resume) {
        record.status = 'planning';
        record.progress = { current: 0, total: 0, label: 'Analyzing requirements…' };
        await this.persist(record);
        record.plan = await this.makePlan(record);
        record.progress = { current: 0, total: record.plan.totalSegments, label: 'Plan ready' };
        await this.persist(record);
      }

      record.status = 'generating';
      await this.persist(record);

      await this.generateAllParts(record, abort);
      if (abort.aborted || record.cancelled) return this.finalizeCancelled(record);

      record.status = 'validating';
      record.progress = { current: record.progress.total, total: record.progress.total, label: 'Validating…' };
      await this.persist(record);

      const validation = this.validateArtifact(record);
      if (!validation.ok && record.plan && record.status !== 'failed') {
        record.status = 'repairing';
        await this.persist(record);
        const repaired = await this.repair(record, validation, abort);
        if (!repaired && !validation.ok) {
          // Persist validation issues but do not fabricate success (#21).
          record.errors.push(...validation.errors.map((e) => `validation: ${e}`));
        }
      }
      if (abort.aborted || record.cancelled) return this.finalizeCancelled(record);

      record.status = 'assembling';
      record.progress = { current: record.progress.total, total: record.progress.total, label: 'Finalizing…' };
      await this.persist(record);

      record.assembly = this.assembleArtifact(record);
      record.status = 'completed';
      record.progress = { current: record.progress.total, total: record.progress.total, label: 'Completed' };
      await this.persist(record);
    } catch (error) {
      record.errors.push(`${new Date().toISOString()} ${error.message}`.slice(0, 400));
      record.status = record.cancelled ? 'cancelled' : 'failed';
      await this.persist(record);
    } finally {
      this.running.delete(generationId);
    }
  }

  finalizeCancelled(record) {
    record.status = 'cancelled';
    record.progress = { ...record.progress, label: 'Cancelled (resumable)' };
    return this.persist(record);
  }

  // ── Planning (#12) ────────────────────────────────────────────────────
  async makePlan(record) {
    const sys = [
      'You are a software architect. Produce a JSON generation plan for the requested artifact.',
      'Reply with ONLY a JSON object: {',
      '  "taskType": "code_generation" | "document" | "other",',
      '  "artifact": "short-name",',
      '  "language": "python|javascript|…",',
      '  "files": [{"path": "main.py", "purpose": "…"}],',
      '  "generationOrder": ["file path", "file path", …],',
      '  "constraints": ["…"]',
      '}'
    ].join('\n');

    let plan = null;
    try {
      plan = await this.model.completeJson(
        [
          { role: 'system', content: sys },
          { role: 'user', content: `Request: ${record.request}\nPersistent requirements: ${record.requirements.join('; ') || 'none'}` }
        ],
        { maxTokens: 500, maxAttempts: 2 }
      );
    } catch {
      plan = null;
    }

    // Deterministic fallback plan — never blocks generation on planner hiccups.
    if (!plan || !Array.isArray(plan.files) || plan.files.length === 0) {
      const lang = (record.request.match(/\b(python|javascript|typescript|java)\b/i) || [, 'python'])[1].toLowerCase();
      plan = {
        taskType: 'code_generation',
        artifact: (record.request.match(/["']([\w\- ]{3,40})["']/)?.[1] || 'artifact').toLowerCase().replace(/\s+/g, '_'),
        language: lang === 'javascript' ? 'javascript' : 'python',
        files: [{ path: lang === 'javascript' ? 'main.js' : 'main.py', purpose: 'entry point and core logic' }],
        generationOrder: [lang === 'javascript' ? 'main.js' : 'main.py'],
        constraints: []
      };
    }

    // Normalize + assign segment ranges (each file may need multiple segments).
    const maxSegTokens = this.planner.partMaxTokens();
    const files = plan.files.map((f, i) => ({
      path: String(f.path || `file_${i}`).replace(/[^\w./\-]/g, '_'),
      purpose: String(f.purpose || ''),
      segments: [],
      sequence: i
    }));
    const planTotal = Math.max(1, files.length * 2); // refined below after first pass
    return {
      ...plan,
      files,
      totalSegments: planTotal,
      estimatedParts: planTotal,
      requirements: record.requirements
    };
  }

  // ── Part generation with continuation + dedupe (#13–#17) ─────────────
  async generateAllParts(record, abort) {
    const order = record.plan.generationOrder?.length
      ? record.plan.generationOrder
      : record.plan.files.map((f) => f.path);

    let sequence = record.parts.length ? Math.max(...record.parts.map((p) => p.sequence)) + 1 : 0;
    const totalSegments = Math.max(record.plan.totalSegments, order.length);
    record.plan.totalSegments = totalSegments;

    for (const path of order) {
      if (abort.aborted || record.cancelled) return;
      const file = record.plan.files.find((f) => f.path === path) || { path, purpose: '', segments: [] };
      if (file.segments.length > 0 && file.segments.every((s) => record.parts.some((p) => p.partId === s))) {
        continue; // already generated (resume path)
      }

      let segmentIndex = file.segments.length;
      let previousTail = file.segments.length
        ? (record.parts.find((p) => p.partId === file.segments[file.segments.length - 1])?.content || '')
        : '';

      // Segment loop for this file.
      let guard = 0;
      while (guard < this.planner.maxParts()) {
        guard += 1;
        if (abort.aborted || record.cancelled) return;

        const partId = `${record.plan.artifact}-${String(record.parts.length + 1).padStart(3, '0')}`;
        record.progress = {
          current: record.parts.length,
          total: totalSegments,
          label: `Generating ${path} (segment ${segmentIndex + 1})…`
        };
        await this.persist(record);

        const context = this.buildGenerationContext(record, { path, purpose: file.purpose, segmentIndex, previousTail });

        let result;
        try {
          result = await this.model.complete(context.messages, {
            maxTokens: this.planner.partMaxTokens(),
            maxAttempts: 4,
            onAttempt: (info) => {
              record.errors.push(`retry ${info.attempt} (upstream ${info.status || 'network'})`.slice(0, 120));
            }
          });
        } catch (error) {
          if (error.code === 'CONTEXT_WINDOW_EXCEEDED') {
            // Shrink continuation tail and retry once with minimal context (#32, TEST L).
            const slim = this.buildGenerationContext(record, { path, purpose: file.purpose, segmentIndex, previousTail: previousTail.slice(-800), slim: true });
            result = await this.model.complete(slim.messages, { maxTokens: this.planner.partMaxTokens(), maxAttempts: 2 });
          } else {
            throw error;
          }
        }

        const raw = result.text || '';
        const cleaned = this.dedupeContinuation(previousTail, raw);

        if (!cleaned.trim()) {
          // Model returned only duplicated overlap; treat as completion of file.
          break;
        }

        const part = {
          partId,
          sequence: sequence++,
          filename: path,
          language: record.plan.language,
          segmentIndex,
          content: cleaned,
          finishReason: result.finishReason,
          status: 'generated',
          validation: null,
          createdAt: new Date().toISOString()
        };
        record.parts.push(part);
        file.segments.push(partId);
        await this.persist(record);

        const truncated = this.planner.isTruncated({ finishReason: result.finishReason, text: raw });
        if (!truncated) break; // file complete

        // Continuation: exact boundary = current tail.
        previousTail = (previousTail + cleaned).slice(-4000);
        segmentIndex += 1;
      }
    }
  }

  /**
   * Compose the bounded Generation Context for one part (#17).
   */
  buildGenerationContext(record, { path, purpose, segmentIndex, previousTail, slim = false }) {
    const planSummary = {
      artifact: record.plan.artifact,
      language: record.plan.language,
      files: record.plan.files.map((f) => ({ path: f.path, purpose: f.purpose })),
      generationOrder: record.plan.generationOrder
    };

    const doneParts = record.parts
      .filter((p) => p.filename === path)
      .map((p) => `[segment ${p.segmentIndex} of ${path}] ${p.content.length} chars`);

    const symbols = this.validator.buildSymbolRegistry(record.parts);
    const symbolLines = Object.entries(symbols).slice(0, 40)
      .map(([name, info]) => `- ${name} (defined in ${info.file})`);

    const system = [
      'You are DARKMATTER\'s code generation engine. You are generating ONE SEGMENT of a large artifact.',
      'Rules:',
      '- Output ONLY the raw segment content. No explanations, no markdown fences.',
      '- Continue EXACTLY from the provided tail when present — never repeat it.',
      '- Respect the symbol registry: reuse existing names/signatures exactly.',
      `- Language: ${record.plan.language}.`,
      '- End the segment at a clean boundary when near completion.',
      slim ? 'CONTEXT IS TIGHT: be extremely concise.' : ''
    ].filter(Boolean).join('\n');

    const userParts = [
      `GLOBAL REQUIREMENTS:\n${(record.plan.requirements || []).join('\n') || 'none'}`,
      `PLAN:\n${JSON.stringify(planSummary)}`,
      `CURRENT TASK: generate segment ${segmentIndex + 1} of "${path}" — ${purpose}`,
      doneParts.length ? `PREVIOUS SEGMENTS OF THIS FILE:\n${doneParts.join('\n')}` : 'PREVIOUS SEGMENTS OF THIS FILE: none',
      symbolLines.length ? `SYMBOL REGISTRY (must match):\n${symbolLines.join('\n')}` : '',
      previousTail ? `TAIL OF PREVIOUS OUTPUT (continue exactly after this, do NOT repeat it):\n...${previousTail.slice(-1600)}` : 'TAIL: none (this is the file start — begin with header/imports)',
      'NOW OUTPUT THE NEXT SEGMENT:'
    ].filter(Boolean).join('\n\n');

    return { messages: [{ role: 'system', content: system }, { role: 'user', content: userParts }] };
  }

  /**
   * Dedupe continuation overlap (#16): find the longest suffix of `previous`
   * that is a prefix of `next` and strip it. Hash-seeded, line-aware, safe.
   */
  dedupeContinuation(previous, next) {
    if (!previous || !next) return next;
    const tail = previous.slice(-2000);
    const lines = tail.split('\n');
    let bestOverlap = 0;

    // Try progressively shorter tails of `previous` (line-aligned).
    for (let take = Math.min(lines.length, 40); take >= 1; take--) {
      const candidate = lines.slice(lines.length - take).join('\n');
      if (!candidate.trim()) continue;
      if (next.startsWith(candidate)) { bestOverlap = candidate.length; break; }
    }
    if (bestOverlap > 0) return next.slice(bestOverlap).replace(/^\n+/, '');

    // Sub-line overlap (e.g. repeated short fragment).
    const short = tail.slice(-120);
    if (short && next.startsWith(short)) return next.slice(short.length);
    return next;
  }

  // ── Validation + repair loop (#21) ────────────────────────────────────
  validateArtifact(record) {
    const errors = [];
    const warnings = [];

    for (const part of record.parts) {
      const result = this.validator.validateSegment(part);
      part.validation = result;
      if (!result.ok) errors.push(`${part.filename} [${part.partId}]: ${result.errors.join('; ')}`);
      warnings.push(...result.warnings.map((w) => `${part.filename}: ${w}`));
    }

    const dupSymbols = this.validator.findDuplicateSymbols(record.parts);
    for (const d of dupSymbols) {
      warnings.push(`symbol "${d.symbol}" defined in multiple parts: ${d.parts.join(', ')}`);
    }

    return { ok: errors.length === 0, errors, warnings };
  }

  async repair(record, validation, abort, { maxLoops } = {}) {
    const loops = maxLoops || parseInt(process.env.LONG_CONTEXT_REPAIR_LOOPS || '2', 10);
    for (let i = 0; i < loops; i++) {
      if (abort.aborted || record.cancelled) return false;
      const failedParts = record.parts.filter((p) => p.validation && !p.validation.ok);
      if (failedParts.length === 0) return true;

      const part = failedParts[0];
      record.progress = { ...record.progress, label: `Repairing ${part.filename}…` };
      await this.persist(record);

      const messages = [
        { role: 'system', content: 'Fix the syntax errors in this code segment. Output ONLY the corrected full segment, no explanations.' },
        { role: 'user', content: `Language: ${part.language}\nErrors: ${part.validation.errors.join('; ')}\n\nSegment:\n${part.content.slice(0, 6000)}` }
      ];
      try {
        const { text } = await this.model.complete(messages, { maxTokens: this.planner.partMaxTokens(), maxAttempts: 2 });
        part.content = text || part.content;
      } catch (error) {
        record.errors.push(`repair attempt ${i + 1} failed: ${error.message}`.slice(0, 200));
        return false;
      }
      const result = this.validator.validateSegment(part);
      part.validation = result;
      await this.persist(record);
      if (result.ok && record.parts.every((p) => !p.validation || p.validation.ok)) return true;
    }
    return false;
  }

  // ── Deterministic assembly (#22) ──────────────────────────────────────
  assembleArtifact(record) {
    if (record.plan.taskType === 'code_generation') {
      const filesByPath = new Map();
      for (const part of record.parts) {
        if (!filesByPath.has(part.filename)) filesByPath.set(part.filename, []);
        filesByPath.get(part.filename).push({ sequence: part.sequence, content: part.content, seam: 'partial' });
      }
      const files = {};
      for (const [path, content] of this.assembler.assembleFiles(filesByPath)) {
        files[path] = content;
      }
      return {
        type: 'code_project',
        artifact: record.plan.artifact,
        language: record.plan.language,
        files,
        manifest: record.plan.files.map((f) => ({ path: f.path, purpose: f.purpose }))
      };
    }
    return {
      type: 'text',
      artifact: record.plan.artifact,
      text: this.assembler.assembleText(record.parts)
    };
  }
}

export { LongGenerationEngine };
