import crypto from 'node:crypto';

export const now = () => new Date().toISOString();
export const id = (prefix) => `${prefix}_${crypto.randomUUID()}`;
export const hashToken = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

export function normalizeUrlCandidate(value) {
  let candidate = String(value || '').trim().replace(/^<|>$/g, '').replace(/[),.;!?]+$/, '');
  if (!candidate) return '';
  if (candidate.startsWith('//')) candidate = `https:${candidate}`;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  return candidate;
}

export function extractUrl(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(/(?:(?:https?:\/\/|www\.)[^\s<>()]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s<>()]*)?)/i);
  return match ? normalizeUrlCandidate(match[0]) : null;
}

export function redactSecret(value) {
  if (!value) return null;
  return '••••••••';
}

export function asyncHandler(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}
