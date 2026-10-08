/**
 * retriever — long-context retrieval.
 * Fetches the most relevant chunks for a query from the
 * long-context store.
 * Part of: Infinity AI / Dark-Matter backend (long-context processing).
 */

import { newId } from './longContextStore.js';

/**
 * Retriever — decides which stored material enters the bounded prompt.
 *
 * First implementation (provider-agnostic, zero external dependencies):
 *   1. exact chunk references (user explicitly asked for chunk N)
 *   2. keyword scoring over chunk contents (deterministic, in-database)
 *   3. summary references (hierarchical summaries carry source chunk refs)
 *   4. recency (recently ingested / recently referenced material)
 *
 * The interface is deliberately shaped so a vector-embedding retriever can be
 * added later behind the same `retrieve()` signature.
 */
class Retriever {
  constructor(store) {
    this.store = store;
  }

  /** Extract meaningful keywords from a request, dropping stopwords. */
  extractKeywords(text, { maxTerms = 12 } = {}) {
    if (!text) return [];
    const STOP = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'if',
      'then',
      'else',
      'for',
      'of',
      'to',
      'in',
      'on',
      'at',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'it',
      'its',
      'this',
      'that',
      'these',
      'those',
      'with',
      'without',
      'from',
      'as',
      'into',
      'about',
      'over',
      'under',
      'can',
      'could',
      'should',
      'would',
      'will',
      'shall',
      'do',
      'does',
      'did',
      'have',
      'has',
      'had',
      'i',
      'you',
      'he',
      'she',
      'we',
      'they',
      'me',
      'my',
      'your',
      'our',
      'their',
      'what',
      'which',
      'who',
      'whom',
      'when',
      'where',
      'why',
      'how',
      'kya',
      'hai',
      'hain',
      'ho',
      'kar',
      'ke',
      'ka',
      'ki',
      'ko',
      'mein',
      'se',
      'par',
      'aur',
      'ya',
      'bhi',
    ]);
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9_\-\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w));
    // Deduplicate, preserve order, cap.
    return [...new Set(words)].slice(0, maxTerms);
  }

  /** Parse explicit chunk references like "chunk 732", "chunk-000732". */
  extractChunkRefs(text) {
    if (!text) return [];
    const refs = [];
    const re = /chunk[\s\-#]*(\d{1,7})/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      refs.push(`chunk-${String(parseInt(m[1], 10)).padStart(6, '0')}`);
    }
    return [...new Set(refs)];
  }

  /**
   * Retrieve the most relevant material for a request.
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.conversationId
   * @param {string} params.request           the current user request
   * @param {Array<object>} [params.inputs]   ingested inputs for this conversation
   * @param {number} [params.maxChunks]
   * @param {number} [params.maxSummaries]
   * @returns {Promise<Array<{id,label,content,score,kind,sourceChunks}>>}
   */
  async retrieve({
    userId,
    conversationId,
    request,
    inputs = [],
    maxChunks = 6,
    maxSummaries = 4,
  }) {
    const blocks = [];
    const keywords = this.extractKeywords(request);
    const refs = this.extractChunkRefs(request);

    for (const input of inputs) {
      const { inputId } = input;

      // 1. Exact chunk references always win.
      if (refs.length > 0) {
        const referenced = await this.store.getChunks(userId, conversationId, inputId, refs);
        for (const chunk of referenced) {
          blocks.push({
            id: `${inputId}/${chunk.chunkId}`,
            label: `exact chunk ${chunk.chunkId} of "${input.title || inputId}"`,
            content: chunk.content,
            score: 1000,
            kind: 'chunk',
            sourceChunks: [chunk.chunkId],
          });
        }
      }

      // 2. Keyword scoring over raw chunks (deterministic search).
      if (keywords.length > 0) {
        const hits = await this.store.searchChunks(userId, conversationId, keywords, {
          limit: maxChunks * 3,
        });
        const seen = new Set(blocks.map(b => b.id));
        for (const hit of hits) {
          const id = `${inputId}/${hit.chunk.chunkId}`;
          if (seen.has(id)) continue;
          seen.add(id);
          blocks.push({
            id,
            label: `chunk ${hit.chunk.chunkId} of "${input.title || inputId}" (matched: ${hit.matchedTerms.join(', ')})`,
            content: hit.chunk.content,
            score: hit.score * 10,
            kind: 'chunk',
            sourceChunks: [hit.chunk.chunkId],
          });
        }
      }

      // 3. Hierarchical summaries (they carry source chunk references).
      const summaries = await this.store.listSummaries(userId, conversationId, inputId);
      const summaryHits = summaries
        .filter(
          s =>
            keywords.length === 0 || keywords.some(k => (s.summary || '').toLowerCase().includes(k))
        )
        .slice(0, maxSummaries);
      for (const s of summaryHits) {
        blocks.push({
          id: s.summaryId,
          label:
            `${s.level === 'global' ? 'global' : `level-${s.level}`} summary of "${input.title || inputId}"` +
            (s.sourceChunks?.length ? ` (covers ${s.sourceChunks.length} chunks)` : ''),
          content: s.summary,
          score: 30,
          kind: 'summary',
          sourceChunks: s.sourceChunks || [],
        });
      }

      // 4. Recency: if nothing matched at all, surface the newest chunks.
      if (blocks.length === 0 && input.chunkCount > 0) {
        const recent = await this.store.listChunks(userId, conversationId, inputId, {
          skip: Math.max(0, input.chunkCount - maxChunks),
          limit: maxChunks,
        });
        for (const chunk of recent) {
          blocks.push({
            id: `${inputId}/${chunk.chunkId}`,
            label: `recent chunk ${chunk.chunkId} of "${input.title || inputId}"`,
            content: chunk.content,
            score: 1,
            kind: 'chunk',
            sourceChunks: [chunk.chunkId],
          });
        }
      }
    }

    // Global sort by score, cap counts (chunks prioritized over summaries).
    blocks.sort((a, b) => b.score - a.score);
    const chunksFirst = blocks.filter(b => b.kind === 'chunk').slice(0, maxChunks);
    const summariesAfter = blocks.filter(b => b.kind === 'summary').slice(0, maxSummaries);
    return [...chunksFirst, ...summariesAfter];
  }
}

export { Retriever, newId };
