import { AppError, assert } from '../core/errors.js';
import { id, normalizeUrlCandidate, now } from '../core/utils.js';
import { scopeEntryCovers } from '../agent/scopeEngine.js';

export function normalizeTargetUrl(value) {
  let parsed;
  try {
    parsed = new URL(normalizeUrlCandidate(value));
  } catch {
    throw new AppError(400, 'Target must be a valid URL', 'INVALID_TARGET_URL');
  }
  assert(
    ['http:', 'https:'].includes(parsed.protocol),
    400,
    'Only HTTP and HTTPS targets are supported',
    'UNSUPPORTED_TARGET_PROTOCOL'
  );
  assert(
    !parsed.username && !parsed.password,
    400,
    'Target URL cannot contain credentials',
    'INVALID_TARGET_URL'
  );
  // Reject single-label hostnames like "not-a-url" (no TLD) — they can never
  // resolve. Allow localhost and IP literals (v4/v6) which are valid targets.
  const host = parsed.hostname;
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
  const isLocalhost = host.toLowerCase() === 'localhost';
  assert(
    isIp || isLocalhost || host.includes('.'),
    400,
    'Target must be a valid hostname or IP address',
    'INVALID_TARGET_URL'
  );
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\*\./, '')
    .replace(/^www\./, '');
}

export function normalizeScope(url, scope = {}) {
  // host (not hostname): the port is part of the authorized scope, so the
  // default grant covers exactly the target's host:port (127.0.0.1:4555).
  const hostport = normalizeDomain(new URL(url).host);
  const included =
    Array.isArray(scope.included) && scope.included.length
      ? scope.included.map(normalizeDomain).filter(Boolean)
      : [hostport];
  const excluded = Array.isArray(scope.excluded)
    ? scope.excluded.map(normalizeDomain).filter(Boolean)
    : [];
  // A portless entry covers the host on any port; a ported entry pins the port.
  assert(
    included.some(domain => scopeEntryCovers(domain, hostport)),
    400,
    'Target is outside the declared scope',
    'TARGET_OUT_OF_SCOPE'
  );
  assert(
    !excluded.some(domain => scopeEntryCovers(domain, hostport)),
    400,
    'Target is excluded by scope',
    'TARGET_EXCLUDED'
  );
  return { included, excluded };
}

export class TargetModel {
  constructor(database) {
    this.collection = database.collection('targets');
  }

  async list(userId) {
    return this.collection.find({ userId }).sort({ createdAt: -1 }).toArray();
  }

  async get(userId, targetId) {
    const target = await this.collection.findOne({ id: targetId, userId });
    assert(target && target.userId === userId, 404, 'Target not found', 'TARGET_NOT_FOUND');
    return target;
  }

  async getInternal(targetId) {
    return this.collection.findOne({ id: targetId });
  }

  async findByUrl(userId, url) {
    return this.collection.findOne({ userId, url });
  }

  async create(userId, input) {
    const url = normalizeTargetUrl(input.url);
    const target = {
      id: id('target'),
      userId,
      name: String(input.name || new URL(url).hostname).slice(0, 120),
      url,
      hostname: new URL(url).hostname.toLowerCase().replace(/^www\./, ''),
      scope: normalizeScope(url, input.scope),
      authorization: {
        confirmed: input.authorizationConfirmed === true,
        notes: String(input.authorizationNotes || '').slice(0, 1000),
        confirmedAt: input.authorizationConfirmed === true ? now() : null,
      },
      createdAt: now(),
      updatedAt: now(),
    };
    assert(
      target.authorization.confirmed,
      400,
      'Explicit authorization confirmation is required',
      'AUTHORIZATION_REQUIRED'
    );
    try {
      await this.collection.insertOne(target);
    } catch (error) {
      if (error?.code === 11000) return this.findByUrl(target.userId, target.url);
      throw error;
    }
    return target;
  }
}
