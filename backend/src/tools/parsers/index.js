/**
 * Parser dispatcher — routes raw tool output to the appropriate parser.
 */
import { parseCrtsh } from './crtsh.js';
import { parseLines, parseJsonLines, parseJson, parseGeneric } from './generic.js';

const PARSERS = {
  crtsh: parseCrtsh,
  lines: parseLines,
  jsonlines: parseJsonLines,
  json: parseJson,
  generic: parseGeneric,
  nmap_xml: parseGeneric, // Full Nmap XML parser can be added later
};

/**
 * Parse raw tool output using the parser named in the tool's registry metadata.
 * @param {string} parserName — from ToolRegistry entry
 * @param {string} rawOutput — stdout from the tool
 * @param {object} context — optional context (hostname, target, etc.)
 * @returns {object} Structured parsed result
 */
export function parseToolOutput(parserName, rawOutput, context = {}) {
  const parser = PARSERS[parserName] || PARSERS.generic;
  try {
    return { success: true, result: parser(rawOutput, context) };
  } catch (error) {
    return { success: false, error: error.message, result: parseGeneric(rawOutput) };
  }
}

/**
 * Create an AI-friendly summary of parsed results — prevents context-window explosion.
 * RAW DATA → NORMALIZED DATA → AI RELEVANT SUMMARY
 */
export function summarizeForAI(toolName, parsedResult, maxItems = 30) {
  if (!parsedResult) return 'No output received.';

  // Subdomains
  if (parsedResult.subdomains) {
    const subs = parsedResult.subdomains;
    if (!subs.length) return `${toolName}: No subdomains discovered.`;
    const shown = subs.slice(0, maxItems).join(', ');
    const more = subs.length > maxItems ? ` ... and ${subs.length - maxItems} more` : '';
    return `${toolName}: Discovered ${subs.length} subdomain(s): ${shown}${more}`;
  }

  // Line items (URLs, domains, etc.)
  if (parsedResult.items) {
    const items = parsedResult.items;
    if (!items.length) return `${toolName}: No results.`;
    if (typeof items[0] === 'string') {
      const shown = items.slice(0, maxItems).join('\n');
      const more = items.length > maxItems ? `\n... and ${items.length - maxItems} more` : '';
      return `${toolName}: ${items.length} result(s):\n${shown}${more}`;
    }
    // JSON items — summarize keys
    return `${toolName}: ${items.length} structured result(s). Sample keys: ${Object.keys(items[0] || {}).join(', ')}`;
  }

  // JSON data
  if (parsedResult.data) {
    const summary = JSON.stringify(parsedResult.data).slice(0, 1000);
    return `${toolName}: JSON output (${summary.length > 990 ? 'truncated' : 'complete'}): ${summary}`;
  }

  // Generic text
  if (parsedResult.text) {
    return `${toolName}: ${parsedResult.lineCount} lines of output${parsedResult.truncated ? ' (truncated)' : ''}:\n${parsedResult.text.slice(0, 1000)}`;
  }

  return `${toolName}: Execution completed.`;
}
