/**
 * utils — shared helper functions.
 * Small pure utilities used across the backend (formatting,
 * validation, collection helpers).
 * Part of: Infinity AI / Dark-Matter backend (core utilities).
 */

import crypto from 'node:crypto';

/**
 * Now.
 * @returns {*} Result.
 */
export const now = () => new Date().toISOString();
/**
 * Id.
 * @returns {*} Result.
 */
export const id = prefix => `${prefix}_${crypto.randomUUID()}`;
/**
 * Returns whether h token.
 * @returns {*} Result.
 */
export const hashToken = value => crypto.createHash('sha256').update(String(value)).digest('hex');

/**
 * Normalize Url Candidate.
 * @param {*} value
 * @returns {*} Result.
 */
export function normalizeUrlCandidate(value) {
  let candidate = String(value || '')
    .trim()
    .replace(/^<|>$/g, '')
    .replace(/[),.;!?]+$/, '');
  if (!candidate) return '';
  if (candidate.startsWith('//')) candidate = `https:${candidate}`;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  return candidate;
}

/**
 * Extract Url.
 * @param {*} text
 * @returns {*} Result.
 */
export function extractUrl(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(
    /(?:(?:https?:\/\/|www\.)[^\s<>()]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s<>()]*)?)/i
  );
  return match ? normalizeUrlCandidate(match[0]) : null;
}

/**
 * Redact Secret.
 * @param {*} value
 * @returns {*} Result.
 */
export function redactSecret(value) {
  if (!value) return null;
  return '••••••••';
}

/**
 * Async Handler.
 * @param {*} handler
 * @returns {*} Result.
 */
export function asyncHandler(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}
