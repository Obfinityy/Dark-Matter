/**
 * validator — long-context output validation.
 * Checks generated content for completeness and consistency
 * before it is returned.
 * Part of: Infinity AI / Dark-Matter backend (long-context processing).
 */

import { estimateTokens, modelContextCapacity, reservedOutputTokens } from './tokens.js';
import { ContextWindowError } from './phoneModelAdapter.js';

/**
 * Validator — deterministic post-generation checks (#21). No model calls.
 */
class Validator {
  /**
   * Validate a generated code segment for a file.
   * @param {{language:string, filename:string, content:string}} part
   * @returns {{ok: boolean, errors: string[], warnings: string[]}}
   */
  validateSegment(part) {
    const errors = [];
    const warnings = [];
    const content = part.content || '';

    if (!content.trim()) {
      errors.push('segment is empty');
      return { ok: false, errors, warnings };
    }

    if (part.language === 'python') {
      this.validatePython(content, errors, warnings);
    } else if (part.language === 'javascript' || part.language === 'js') {
      this.validateJavaScript(content, errors, warnings);
    } else if (part.language === 'json') {
      this.validateJson(content, errors);
    } else {
      warnings.push(`no deterministic validator for language "${part.language}"`);
    }

    return { ok: errors.length === 0, errors, warnings };
  }

  validatePython(content, errors, warnings) {
    const lines = content.split('\n');

    // Balanced delimiters across the whole segment (continuation-friendly).
    const pairs = { '(': ')', '[': ']', '{': '}' };
    const stack = [];
    let inString = null;
    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      const prev = content[i - 1];
      if (inString) {
        if (ch === inString && prev !== '\\') inString = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inString = ch;
        continue;
      }
      if (pairs[ch]) stack.push({ ch, line: i });
      else if (ch === ')' || ch === ']' || ch === '}') {
        const open = stack.pop();
        if (!open || pairs[open.ch] !== ch) {
          errors.push(`unbalanced "${ch}" near offset ${i}`);
          break;
        }
      }
    }
    if (stack.length > 0) {
      errors.push(
        `unclosed "${stack[stack.length - 1].ch}" opened near offset ${stack[stack.length - 1].line}`
      );
    }

    // def lines must end with ":" (when not a partial continuation)
    for (const line of lines) {
      const t = line.trimEnd();
      if (/^\s*def\s+\w+\s*\([^)]*$/.test(t)) {
        warnings.push(`def line may be incomplete: ${t.slice(0, 60)}`);
      }
    }
  }

  validateJavaScript(content, errors) {
    const pairs = { '(': ')', '[': ']', '{': '}' };
    const stack = [];
    let inString = null;
    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      const prev = content[i - 1];
      if (inString) {
        if (ch === inString && prev !== '\\') inString = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = ch;
        continue;
      }
      if (pairs[ch]) stack.push(ch);
      else if (ch === ')' || ch === ']' || ch === '}') {
        const open = stack.pop();
        if (!open || pairs[open] !== ch) {
          errors.push(`unbalanced "${ch}" near offset ${i}`);
          break;
        }
      }
    }
    if (stack.length > 0) errors.push(`unclosed "${stack[stack.length - 1]}"`);
  }

  validateJson(content, errors) {
    try {
      JSON.parse(content);
    } catch (e) {
      errors.push(`invalid JSON: ${e.message.slice(0, 80)}`);
    }
  }

  /**
   * Cross-part symbol registry consistency: detect conflicting definitions of
   * the same symbol (class/function) across parts (#18).
   */
  buildSymbolRegistry(parts) {
    const registry = {};
    for (const part of parts) {
      if (part.language !== 'python') continue;
      const content = part.content || '';
      for (const m of content.matchAll(/^(?:class|def)\s+([A-Za-z_]\w*)/gm)) {
        const name = m[1];
        if (!registry[name]) registry[name] = { file: part.filename, occurrences: [] };
        registry[name].occurrences.push(part.partId || part.sequence);
      }
    }
    return registry;
  }

  findDuplicateSymbols(parts) {
    const registry = this.buildSymbolRegistry(parts);
    const duplicates = [];
    for (const [name, info] of Object.entries(registry)) {
      const unique = [...new Set(info.occurrences)];
      if (unique.length > 1) duplicates.push({ symbol: name, parts: unique });
    }
    return duplicates;
  }
}

/**
 * Assembler — deterministic final assembly (#22).
 * file → ordered segments → final file; artifacts → ordered parts → artifact.
 */
class Assembler {
  /**
   * Assemble files from ordered segments.
   * @param {Map<string, Array<{content}>>} filesByPath
   * @returns {Map<string, string>} path → final content
   */
  assembleFiles(filesByPath) {
    const out = new Map();
    for (const [path, segments] of filesByPath) {
      const ordered = [...segments].sort((a, b) => a.sequence - b.sequence);
      let content = '';
      let lastNonEmpty = '';
      for (const seg of ordered) {
        let piece = seg.content || '';
        // Seam repair: guarantee a newline between segments unless the next
        // segment deliberately starts mid-line (continuation).
        if (
          content &&
          !content.endsWith('\n') &&
          !piece.startsWith('\n') &&
          lastNonEmpty !== 'partial'
        ) {
          content += '\n';
        }
        content += piece;
        lastNonEmpty = seg.seam || 'full';
      }
      out.set(path, content);
    }
    return out;
  }

  assembleText(parts) {
    const ordered = [...parts].sort((a, b) => a.sequence - b.sequence);
    return ordered.map(p => p.content).join('');
  }
}

/**
 * OutputBudget — plans how much text one model call may produce and detects
 * truncation from finish_reason + heuristics (#15).
 */
class OutputPlanner {
  constructor() {
    this.capacity = modelContextCapacity();
    this.reserve = reservedOutputTokens();
  }

  /** Max output tokens per part request. */
  partMaxTokens() {
    const raw = parseInt(process.env.LONG_CONTEXT_PART_MAX_TOKENS || '700', 10);
    return Number.isFinite(raw) && raw > 0 ? Math.min(raw, this.reserve) : this.reserve;
  }

  /** Detect whether a response looks truncated. */
  isTruncated({ finishReason, text }) {
    if (finishReason === 'length' || finishReason === 'max_tokens') return true;
    if (!text) return false;
    // Heuristics: output used essentially all of the budget AND ends mid-line.
    const budgetChars = this.partMaxTokens() * 3.2;
    if (text.length >= budgetChars * 0.95 && !/[}\])"'\n`]$/.test(text.trimEnd())) return true;
    return false;
  }

  /** Guard against absurd generation loops. */
  maxParts() {
    const raw = parseInt(process.env.LONG_CONTEXT_MAX_PARTS || '120', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 120;
  }
}

export {
  Validator,
  Assembler,
  OutputPlanner,
  modelContextCapacity,
  reservedOutputTokens,
  ContextWindowError,
  estimateTokens,
};
