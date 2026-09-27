import { AppError, assert } from '../core/errors.js';
import { id, normalizeUrlCandidate, now } from '../core/utils.js';

export function normalizeTargetUrl(value) {
  let parsed;
  try {
    parsed = new URL(normalizeUrlCandidate(value));
  } catch {
    throw new AppError(400, 'Target must be a valid URL', 'INVALID_TARGET_URL');
  }
  assert(['http:', 'https:'].includes(parsed.protocol), 400, 'Only HTTP and HTTPS targets are supported', 'UNSUPPORTED_TARGET_PROTOCOL');
  assert(!parsed.username && !parsed.password, 400, 'Target URL cannot contain credentials', 'INVALID_TARGET_URL');
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function normalizeDomain(value) {
  return String(value || '').trim().toLowerCase().replace(/^\*\./, '').replace(/^www\./, '');
}

export function normalizeScope(url, scope = {}) {
  const hostname = normalizeDomain(new URL(url).hostname);
  const included = Array.isArray(scope.included) && scope.included.length
    ? scope.included.map(normalizeDomain).filter(Boolean)
    : [hostname];
  const excluded = Array.isArray(scope.excluded) ? scope.excluded.map(normalizeDomain).filter(Boolean) : [];
  assert(included.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)), 400, 'Target is outside the declared scope', 'TARGET_OUT_OF_SCOPE');
  assert(!excluded.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)), 400, 'Target is excluded by scope', 'TARGET_EXCLUDED');
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
        confirmedAt: input.authorizationConfirmed === true ? now() : null
      },
      createdAt: now(),
      updatedAt: now()
    };
    assert(target.authorization.confirmed, 400, 'Explicit authorization confirmation is required', 'AUTHORIZATION_REQUIRED');
    try {
      await this.collection.insertOne(target);
    } catch (error) {
      if (error?.code === 11000) return this.findByUrl(target.userId, target.url);
      throw error;
    }
    return target;
  }
}
