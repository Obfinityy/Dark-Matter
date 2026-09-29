import { newId } from './longContextStore.js';
import { estimateTokens } from './tokens.js';

/**
 * Hierarchical summarizer — map-reduce over chunks.
 *
 *   chunks ──batch──> local summaries ──group──> section summaries ──> global summary
 *
 * Every summary record carries sourceChunks (exact chunk ids it covers) so the
 * retriever can walk back from a summary to the raw source. Summaries are
 * cached per (inputId, level, order, sourceHash): re-summarizing the same
 * material never re-calls the model (performance requirement #41), and partial
 * progress is persisted so ingestion resumes where it stopped (resumability
 * requirement #28).
 */
class Summarizer {
  constructor(store, model) {
    this.store = store;
    this.model = model; // PhoneModelAdapter
  }

  groupSize() {
    const raw = parseInt(process.env.LONG_CONTEXT_SUMMARY_GROUP || '4', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 4;
  }

  async summarizeText(text, { kind = 'local' } = {}) {
    const maxTokens = Math.max(160, Math.min(512, Math.floor(estimateTokens(text) / 8)));
    const { text: summary } = await this.model.complete(
      [
        {
          role: 'system',
          content:
            'You compress source material into a dense factual summary. Preserve exact names, numbers, function signatures, identifiers, requirements and conclusions. Never invent facts. Reply with the summary only — no preamble.'
        },
        { role: 'user', content: text }
      ],
      { maxTokens, maxAttempts: 3 }
    );
    return { text: summary.trim(), kind };
  }

  /**
   * Build the full hierarchy for an input. Resumable and cached.
   * @returns {Promise<{global: object|null, localCount: number, sectionCount: number}>}
   */
  async buildHierarchy({ userId, conversationId, input }) {
    const { inputId } = input;
    const chunkCount = await this.store.countChunks(userId, conversationId, inputId);
    if (chunkCount === 0) return { global: null, localCount: 0, sectionCount: 0 };

    const groupSize = this.groupSize();
    const all = await this.store.listChunks(userId, conversationId, inputId, { skip: 0, limit: chunkCount });

    // ── Level 1: local summaries (per group of chunks) ────────────────
    const localSummaries = [];
    let order = 0;
    for (let start = 0; start < all.length; start += groupSize) {
      const group = all.slice(start, start + groupSize);
      const summaryId = `sum-${inputId}-L1-${String(order).padStart(4, '0')}`;
      const sourceChunks = group.map((c) => c.chunkId);
      const sourceHash = group.map((c) => c.hash).join('');

      const existing = await this.store.getSummary(userId, conversationId, summaryId);
      if (!existing || existing.sourceHash !== sourceHash) {
        const combined = group.map((c) => c.content).join('\n\n');
        const { text } = await this.summarizeText(combined, { kind: 'local' });
        await this.store.upsertSummary({
          summaryId,
          userId,
          conversationId,
          inputId,
          level: 1,
          order,
          summary: text,
          sourceChunks,
          sourceHash,
          tokenEstimate: estimateTokens(text),
          createdAt: new Date().toISOString()
        });
      }
      localSummaries.push(await this.store.getSummary(userId, conversationId, summaryId));
      order += 1;
    }

    // If the whole input fits in one local summary, that IS the global.
    if (localSummaries.length === 1) {
      return { global: localSummaries[0], localCount: 1, sectionCount: 0 };
    }

    // ── Level 2: section summaries (per group of local summaries) ─────
    const sectionGroup = groupSize * 2;
    const sectionSummaries = [];
    order = 0;
    for (let start = 0; start < localSummaries.length; start += sectionGroup) {
      const group = localSummaries.slice(start, start + sectionGroup);
      const summaryId = `sum-${inputId}-L2-${String(order).padStart(4, '0')}`;
      const sourceChunks = group.flatMap((s) => s.sourceChunks);
      const sourceHash = group.map((s) => s.sourceHash || s.summaryId).join('');

      const existing = await this.store.getSummary(userId, conversationId, summaryId);
      if (!existing || existing.sourceHash !== sourceHash) {
        const combined = group.map((s) => s.summary).join('\n\n');
        const { text } = await this.summarizeText(combined, { kind: 'section' });
        await this.store.upsertSummary({
          summaryId,
          userId,
          conversationId,
          inputId,
          level: 2,
          order,
          summary: text,
          sourceChunks,
          sourceHash,
          tokenEstimate: estimateTokens(text),
          createdAt: new Date().toISOString()
        });
      }
      sectionSummaries.push(await this.store.getSummary(userId, conversationId, summaryId));
      order += 1;
    }

    // ── Global summary (possibly via one more hop for massive inputs) ─
    let candidates = sectionSummaries;
    let level = 2;
    while (candidates.length > groupSize * 2) {
      const nextLevel = [];
      const nextSummaryIdBase = `sum-${inputId}-L${level + 1}`;
      for (let start = 0, o = 0; start < candidates.length; start += sectionGroup, o++) {
        const group = candidates.slice(start, start + sectionGroup);
        const summaryId = `${nextSummaryIdBase}-${String(o).padStart(4, '0')}`;
        const sourceChunks = group.flatMap((s) => s.sourceChunks);
        const sourceHash = group.map((s) => s.sourceHash || s.summaryId).join('');
        const existing = await this.store.getSummary(userId, conversationId, summaryId);
        if (!existing || existing.sourceHash !== sourceHash) {
          const combined = group.map((s) => s.summary).join('\n\n');
          const { text } = await this.summarizeText(combined, { kind: 'section' });
          await this.store.upsertSummary({
            summaryId,
            userId,
            conversationId,
            inputId,
            level: level + 1,
            order: o,
            summary: text,
            sourceChunks,
            sourceHash,
            tokenEstimate: estimateTokens(text),
            createdAt: new Date().toISOString()
          });
        }
        nextLevel.push(await this.store.getSummary(userId, conversationId, summaryId));
      }
      candidates = nextLevel;
      level += 1;
    }

    // Final single global summary.
    const globalId = `sum-${inputId}-global`;
    const sourceChunks = candidates.flatMap((s) => s.sourceChunks);
    const sourceHash = candidates.map((s) => s.sourceHash || s.summaryId).join('');
    const existingGlobal = await this.store.getSummary(userId, conversationId, globalId);
    if (!existingGlobal || existingGlobal.sourceHash !== sourceHash) {
      const combined = candidates.map((s) => s.summary).join('\n\n');
      const { text } = await this.summarizeText(combined, { kind: 'global' });
      await this.store.upsertSummary({
        summaryId: globalId,
        userId,
        conversationId,
        inputId,
        level: 99,
        order: 0,
        summary: text,
        sourceChunks,
        sourceHash,
        tokenEstimate: estimateTokens(text),
        createdAt: new Date().toISOString()
      });
    }
    const global = await this.store.getSummary(userId, conversationId, globalId);

    return { global, localCount: localSummaries.length, sectionCount: sectionSummaries.length };
  }
}

export { Summarizer, newId };
