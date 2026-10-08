/**
 * requestContext — per-request context middleware.
 * Assigns request IDs and propagates tracing context
 * through the request lifecycle.
 * Part of: Infinity AI / Dark-Matter backend (Express middleware).
 */

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map(part => {
        const [name, ...value] = part.trim().split('=');
        return [name, value.join('=')];
      })
      .filter(([name]) => name)
  );
}

/**
 * Returns session token.
 * @param {*} request
 * @returns {*} Result.
 */
export function getSessionToken(request) {
  const authorization = request.header('authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim();
  const cookies = parseCookies(request.header('cookie'));
  return cookies.darkmatter_session
    ? decodeURIComponent(cookies.darkmatter_session)
    : request.query.accessToken || null;
}
