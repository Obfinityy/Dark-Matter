/**
 * rateLimiter — dependency-free in-memory rate limiting middleware.
 * Tracks request counts per IP address in a Map with sliding windows.
 * Part of: Infinity AI / Dark-Matter backend (Express middleware).
 */

/**
 * Creates a rate-limiting middleware.
 * @param {object} options - Configuration.
 * @param {number} [options.max=60] - Max requests per window per IP.
 * @param {number} [options.windowMs=60000] - Window duration in milliseconds.
 * @param {string} [options.message] - Error message when limit exceeded.
 * @returns {Function} Express middleware.
 */
export function createRateLimiter({ max = 60, windowMs = 60_000, message = 'Too many requests' } = {}) {
  // ip -> { count, resetTime }. Entries expire lazily on access; a periodic
  // sweep prevents unbounded growth from many distinct IPs.
  const buckets = new Map();

  // Sweep stale buckets every window to bound memory. unref() so the timer
  // never keeps the process alive on its own.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of buckets) {
      if (bucket.resetTime <= now) buckets.delete(ip);
    }
  }, windowMs);
  if (typeof sweeper.unref === 'function') sweeper.unref();

  return function rateLimiter(request, response, next) {
    // Prefer the leftmost X-Forwarded-For entry when behind a trusted proxy;
    // fall back to the direct socket address. Express's req.ip is used when
    // 'trust proxy' is configured, otherwise req.socket.remoteAddress.
    const forwarded = request.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
      request.ip ||
      request.socket?.remoteAddress ||
      'unknown';

    const now = Date.now();
    let bucket = buckets.get(ip);
    if (!bucket || bucket.resetTime <= now) {
      bucket = { count: 0, resetTime: now + windowMs };
      buckets.set(ip, bucket);
    }
    bucket.count += 1;

    // Informative headers (standard RateLimit draft fields).
    response.setHeader('X-RateLimit-Limit', String(max));
    response.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    response.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetTime / 1000)));

    if (bucket.count > max) {
      return response.status(429).json({
        error: { code: 'RATE_LIMITED', message },
      });
    }
    return next();
  };
}

/**
 * Strict limiter for authentication endpoints (login / register / recover).
 * 10 requests per minute per IP — slows credential stuffing and
 * account-recovery enumeration without blocking legitimate users.
 */
export const authRateLimiter = createRateLimiter({
  max: 10,
  windowMs: 60_000,
  message: 'Too many authentication attempts — please wait a minute and try again',
});
