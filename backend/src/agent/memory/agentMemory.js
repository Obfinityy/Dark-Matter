import { MEMORY_TYPES } from '../../models/agentMemoryModel.js';
import { estimateTokens } from '../../services/longContext/tokens.js';

/**
 * AgentMemory — the retrieval layer over MongoDB memory.
 *
 * The local phone model has a finite context window and no memory of its own.
 * This service turns an unbounded Mongo history into a *bounded* memory block
 * for the brain, and answers targeted questions ("was this parameter already
 * tested?") by retrieving only relevant entries (requirement #43, #44).
 *
 * Retrieval is deliberately dependency-free and provider-agnostic:
 *   1. exact key match
 *   2. keyword scoring over stored content
 *   3. recency + salience
 * A vector-embedding retriever can be added later behind the same `recall()`.
 *
 * HONESTY RULE (#62): recall never invents. If nothing matches, it returns an
 * empty list and the brain prompt says the information is unknown.
 */

const STOPWORDS = new Set([
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

export class AgentMemory {
  constructor({ memoryModel, contextBudgetManager = null, logger = console } = {}) {
    this.memoryModel = memoryModel;
    this.contextBudgetManager = contextBudgetManager;
    this.logger = logger;
  }

  // ── Writes ────────────────────────────────────────────────────────────
  async remember(entry) {
    return this.memoryModel.remember(entry);
  }

  async rememberEpisodic({
    userId,
    assessmentId,
    jobId,
    content,
    refs,
    importance = 0.4,
    key = null,
  }) {
    return this.remember({
      userId,
      assessmentId,
      jobId,
      type: 'episodic',
      content,
      refs,
      importance,
      key,
    });
  }

  async rememberSemantic({
    userId,
    assessmentId,
    jobId,
    content,
    key,
    structured,
    importance = 0.6,
  }) {
    return this.remember({
      userId,
      assessmentId,
      jobId,
      type: 'semantic',
      content,
      key,
      structured,
      importance,
    });
  }

  async rememberTarget({
    userId,
    assessmentId,
    jobId,
    content,
    key,
    structured,
    importance = 0.7,
  }) {
    return this.remember({
      userId,
      assessmentId,
      jobId,
      type: 'target',
      content,
      key,
      structured,
      importance,
    });
  }

  async rememberTool({
    userId,
    assessmentId,
    jobId,
    content,
    key,
    refs,
    structured,
    importance = 0.6,
  }) {
    return this.remember({
      userId,
      assessmentId,
      jobId,
      type: 'tool',
      content,
      key,
      refs,
      structured,
      importance,
    });
  }

  async rememberFinding({
    userId,
    assessmentId,
    jobId,
    content,
    key,
    refs,
    structured,
    importance = 0.9,
  }) {
    return this.remember({
      userId,
      assessmentId,
      jobId,
      type: 'finding',
      content,
      key,
      refs,
      structured,
      importance,
    });
  }

  async rememberConversation({
    userId,
    assessmentId,
    jobId,
    conversationId,
    content,
    key = null,
    importance = 0.5,
  }) {
    return this.remember({
      userId,
      assessmentId,
      jobId,
      conversationId,
      type: 'conversation',
      content,
      key,
      importance,
    });
  }

  /** Task memory is a snapshot, not an append log: the plan is upserted. */
  async rememberTask({ userId, assessmentId, jobId, content, structured }) {
    return this.remember({
      userId,
      assessmentId,
      jobId,
      type: 'task',
      key: 'current-plan',
      content,
      structured,
      importance: 0.95,
    });
  }

  // ── Retrieval ─────────────────────────────────────────────────────────
  extractKeywords(text, { maxTerms = 14 } = {}) {
    if (!text) return [];
    const words = String(text)
      .toLowerCase()
      .replace(/[^a-z0-9_\-./:\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOPWORDS.has(word));
    return [...new Set(words)].slice(0, maxTerms);
  }

  /**
   * Retrieve relevant memory.
   * @returns {Promise<Array<object>>} ranked entries (highest first)
   */
  async recall({ assessmentId, query = '', types = null, limit = 12, userId = null } = {}) {
    const rows = await this.memoryModel.listAll(assessmentId, { types, limit: 4000 });
    if (rows.length === 0) return [];
    if (userId) rows.filter(row => row.userId === userId);

    const keywords = this.extractKeywords(query);
    const queryLower = String(query || '').toLowerCase();
    const nowMs = Date.now();

    const scored = rows.map(row => {
      const haystack = `${row.key || ''} ${row.content}`.toLowerCase();
      let score = 0;

      if (queryLower && row.key && queryLower.includes(String(row.key).toLowerCase())) score += 50;
      for (const keyword of keywords) {
        if (haystack.includes(keyword)) score += 10;
      }
      score += (row.importance || 0.5) * 5;

      const ageHours = Math.max(
        0,
        (nowMs - new Date(row.updatedAt || row.createdAt).getTime()) / 3_600_000
      );
      score += Math.max(0, 3 - ageHours / 24); // gentle recency boost, not dominance

      return { row, score };
    });

    return scored
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(entry => ({ ...entry.row, score: Number(entry.score.toFixed(3)) }));
  }

  /**
   * Build the bounded memory block handed to the local brain.
   *
   * Priority: task memory (what remains) → findings → target facts → relevant
   * tool results → episodic → conversation. Dropped material is reported, never
   * silently sent in full.
   */
  async buildBrainContext({ userId, assessmentId, query = '', maxTokens = 1200 } = {}) {
    const [task, findings, target, tool, episodic, conversation] = await Promise.all([
      this.memoryModel.listByType(assessmentId, 'task', 1),
      this.recall({ assessmentId, userId, query, types: ['finding'], limit: 12 }),
      this.recall({ assessmentId, userId, query, types: ['target', 'semantic'], limit: 12 }),
      this.recall({ assessmentId, userId, query, types: ['tool'], limit: 8 }),
      this.memoryModel.listByType(assessmentId, 'episodic', 200),
      this.memoryModel.listByType(assessmentId, 'conversation', 60),
    ]);

    const sections = [];
    if (task.length)
      sections.push({
        label: 'TASK MEMORY (what remains)',
        content: task[task.length - 1].content,
      });
    if (findings.length) {
      sections.push({
        label: 'FINDING MEMORY',
        content: findings.map(f => `- ${f.content}`).join('\n'),
      });
    }
    if (target.length) {
      sections.push({
        label: 'TARGET / SEMANTIC MEMORY',
        content: target.map(t => `- ${t.content}`).join('\n'),
      });
    }
    if (tool.length) {
      sections.push({
        label: 'RELEVANT TOOL MEMORY',
        content: tool.map(t => `- ${t.content}`).join('\n'),
      });
    }
    if (episodic.length) {
      sections.push({
        label: 'RECENT EPISODIC MEMORY',
        content: episodic
          .slice(-12)
          .map(e => `- ${e.content}`)
          .join('\n'),
      });
    }
    if (conversation.length) {
      sections.push({
        label: 'CONVERSATION MEMORY',
        content: conversation
          .slice(-8)
          .map(c => `- ${c.content}`)
          .join('\n'),
      });
    }

    if (sections.length === 0) {
      return {
        text: 'MEMORY: (empty — nothing has been stored for this assessment yet)',
        included: [],
        dropped: [],
        tokens: 0,
        unknown: true,
      };
    }

    // Budget the block honestly: keep whole sections, drop the least important.
    const included = [];
    const dropped = [];
    let used = 0;
    for (const section of sections) {
      const cost = estimateTokens(section.content) + 6;
      if (used + cost > maxTokens) {
        dropped.push(section.label);
        continue;
      }
      included.push(`[${section.label}]\n${section.content}`);
      used += cost;
    }

    const text = included.length
      ? `MEMORY (retrieved from MongoDB — this is the ONLY historical knowledge you have; anything not here is UNKNOWN):\n\n${included.join('\n\n')}`
      : 'MEMORY: (nothing relevant retrieved — treat historical specifics as UNKNOWN)';

    return {
      text,
      included: included.length,
      dropped,
      tokens: used,
      unknown: included.length === 0,
    };
  }

  async countByType(assessmentId) {
    return this.memoryModel.countByType(assessmentId);
  }

  /** Deterministic condensation — no model call, no unbounded growth. */
  async consolidate(assessmentId) {
    return this.memoryModel.consolidate(assessmentId);
  }
}

export { MEMORY_TYPES };
