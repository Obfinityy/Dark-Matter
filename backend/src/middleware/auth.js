/**
 * auth — authentication middleware.
 * Verifies bearer tokens / sessions and attaches the user
 * context to incoming requests.
 * Part of: Infinity AI / Dark-Matter backend (Express middleware).
 */

import { getSessionToken } from './requestContext.js';

/**
 * Local no-auth mode (owner's own machine): when DM_LOCAL_MODE=true the
 * backend runs as a single-user local service — every request is treated as
 * the device owner, no account, no token, no login screen. DEFAULT OFF:
 * the hosted (Render) backend stays auth-gated. Never enable on a public
 * server.
 */
const LOCAL_MODE = process.env.DM_LOCAL_MODE === 'true';

const LOCAL_USER = Object.freeze({ id: 'local', email: 'local@device', role: 'owner' });

/**
 * Require Auth.
 * @param {*} request
 * @param {*} response
 * @param {*} next
 * @returns {*} Result.
 */
export function requireAuth(request, response, next) {
  if (LOCAL_MODE) return next();
  if (!request.user) {
    return response
      .status(401)
      .json({
        error: { code: 'AUTH_REQUIRED', message: 'Create an account or sign in to continue.' },
      });
  }
  return next();
}

/**
 * Attach Auth.
 * @param {*} authService
 * @returns {*} Result.
 */
export function attachAuth(authService) {
  // Local mode: single-user device — attach the owner identity directly,
  // never touching the auth service (no sessions, no tokens to resolve).
  if (LOCAL_MODE) {
    return (request, response, next) => {
      request.user = { ...LOCAL_USER };
      next();
    };
  }
  return async (request, response, next) => {
    try {
      request.sessionToken = getSessionToken(request);
      // Accepts the stateless JWT or the existing session token — one middleware, both credentials.
      request.user = await authService.resolveAny(request.sessionToken);
      next();
    } catch (error) {
      next(error);
    }
  };
}
