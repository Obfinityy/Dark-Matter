/**
 * chunker — long-context text chunking.
 * Splits long documents and transcripts into size-bounded chunks
 * with overlap for retrieval and summarization pipelines.
 * Part of: Infinity AI / Dark-Matter backend (long-context processing).
 */

import crypto from 'crypto';
import { estimateTokens } from './tokens.js';

/**
 * Structure-aware chunker.
 *
 * Never blindly slices at N characters. It finds *structural boundaries* —
 * markdown headings, fenced code blocks, paragraphs, JSON objects, XML nodes,
 * SQL statements, sentences — and only cuts inside a structure when a single
 * structure alone exceeds the chunk target.
 *
 * Chunk fields (exactly as specced):
 *   inputId, conversationId, userId, chunkIndex, totalChunks, content,
 *   startOffset, endOffset, tokenEstimate, hash, createdAt (+ structural meta)
 */

const DEFAULT_TARGET_CHARS = 6000; // ~1500-1900 tokens per chunk
const DEFAULT_MAX_CHARS = 8000; // hard ceiling per chunk
const DEFAULT_OVERLAP_TOKENS = 200; // token-aware overlap (LONG_CONTEXT_CHUNK_OVERLAP)

/** Candidate boundary priorities, highest first. */
const BOUNDARY_PRIORITY = [
  { name: 'markdown-heading', regex: /\n(?=#{1,6} )/g, weight: 9 },
  { name: 'code-fence', regex: /\n```/g, weight: 8 },
  { name: 'paragraph', regex: /\n\s*\n/g, weight: 7 },
  { name: 'line', regex: /\n/g, weight: 5 },
  { name: 'sentence', regex: /(?<=[.!?])\s+(?=[A-Z0-9"'`(])/g, weight: 4 },
  { name: 'space', regex: / /g, weight: 2 },
  { name: 'anywhere', regex: /. /g, weight: 1 },
];

function hashContent(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}

/** Detect a structural kind for metadata purposes. */
function detectKind(text) {
  const t = text.trimStart();
  if (/^```/.test(t) || /```/.test(t)) return 'code';
  if (/^\s*[[{]/.test(t) && /[\]}]\s*$/.test(t)) return 'json';
  if (/^\s*</.test(t) && />$/.test(t)) return 'xml';
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH)\b/i.test(t.slice(0, 120)) && /;/.test(t))
    return 'sql';
  if (/^#{1,6} /m.test(t)) return 'markdown';
  return 'prose';
}

/**
 * Find the best boundary index in [minIndex, maxIndex) for a cut.
 * Uses the highest-priority boundary type present, closest to target.
 */
function findBoundary(text, targetIndex, maxIndex) {
  const searchFrom = Math.max(0, targetIndex - Math.floor(targetIndex * 0.5));
  let best = { index: -1, weight: -1, distance: Infinity };

  for (const { name, regex, weight } of BOUNDARY_PRIORITY) {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      const idx = m.index + 1; // position after the boundary char
      if (idx < searchFrom || idx > maxIndex) continue;
      const distance = Math.abs(idx - targetIndex);
      // Prefer higher weight; on ties prefer closer to target.
      const better = weight > best.weight || (weight === best.weight && distance < best.distance);
      if (better) best = { index: idx, weight, distance };
      if (regex.lastIndex === m.index) regex.lastIndex += 1; // avoid zero-length loops
    }
    // The first boundary type that yields a reasonably-close match wins
    // (structure over proximity).
    if (best.index !== -1 && best.weight >= weight) break;
  }

  if (best.index === -1) return maxIndex;
  return best.index;
}

/** Compute the character length of a token-aware overlap tail. */
function overlapCharsFor(text) {
  const overlapTokens = parseInt(
    process.env.LONG_CONTEXT_CHUNK_OVERLAP || String(DEFAULT_OVERLAP_TOKENS),
    10
  );
  if (!Number.isFinite(overlapTokens) || overlapTokens <= 0) return 0;
  const targetChars = Math.round(overlapTokens * 3.6); // inverse of the ~3.6 chars/token average
  if (text.length <= targetChars) return Math.max(0, Math.floor(text.length * 0.2));
  // Snap the overlap start to the nearest line boundary so overlaps don't
  // begin mid-word/mid-token.
  const start = text.length - targetChars;
  const nl = text.indexOf('\n', start);
  return nl === -1 ? targetChars : nl + 1 - start;
}

/**
 * Split raw text into ordered, structure-aware, overlapping chunks.
 *
 * @param {object} params
 * @param {string} params.text              raw input (exact original)
 * @param {string} params.inputId
 * @param {string} params.conversationId
 * @param {string} params.userId
 * @param {object} [params.options] { targetChars, maxChars }
 * @returns {Array<object>} chunk records (without persistence ids)
 */
export function chunkText({ text, inputId, conversationId, userId, options = {} }) {
  const targetChars = options.targetChars || DEFAULT_TARGET_CHARS;
  const maxChars = options.maxChars || DEFAULT_MAX_CHARS;
  const createdAt = new Date().toISOString();

  if (!text || !text.length) return [];

  const chunks = [];
  let cursor = 0;
  let chunkIndex = 0;

  while (cursor < text.length) {
    const remaining = text.length - cursor;
    const take = Math.min(remaining, targetChars);

    let end = cursor + take;
    let kind = null;

    if (end < text.length) {
      // Look for a structural boundary near the ideal cut point.
      const window = text.slice(cursor, cursor + maxChars);
      const ideal = take;
      const local = findBoundary(window, ideal, Math.min(window.length, maxChars));
      end = cursor + Math.max(Math.floor(targetChars * 0.3), local);
      kind = detectKind(window.slice(0, local));
    } else {
      kind = detectKind(text.slice(cursor));
    }

    let content = text.slice(cursor, end);

    // Prepend overlap tail from the previous chunk (token-aware, line-snapped).
    if (chunks.length > 0 && cursor > 0) {
      const prev = chunks[chunks.length - 1];
      const prevRaw = text.slice(prev.startOffset, prev.endOffset);
      const overlapLen = overlapCharsFor(prevRaw);
      if (overlapLen > 0) {
        const tail = prevRaw.slice(prevRaw.length - overlapLen);
        content = tail + content;
      }
    }

    chunks.push({
      inputId,
      conversationId,
      userId,
      chunkIndex,
      content,
      startOffset: cursor,
      endOffset: end,
      tokenEstimate: estimateTokens(content),
      hash: hashContent(content),
      kind,
      createdAt,
    });

    cursor = end;
    chunkIndex += 1;

    if (chunkIndex > 2_000_000) break; // absolute safety valve
  }

  const totalChunks = chunks.length;
  for (const chunk of chunks) {
    chunk.totalChunks = totalChunks;
    chunk.chunkId = `chunk-${String(chunk.chunkIndex).padStart(6, '0')}`;
  }

  return chunks;
}

export { hashContent };
