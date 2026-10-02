/**
 * Loopback safety guard — recon helpers that perform real HTTP must refuse
 * non-loopback URLs unless the caller explicitly opts out. Tests run against
 * fixtures on 127.0.0.1; hunts run this same guard against the scope engine.
 */
export function isLoopbackUrl(raw) {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}
