import { getSessionToken } from './requestContext.js';

export function requireAuth(request, response, next) {
  if (!request.user) {
    return response
      .status(401)
      .json({
        error: { code: 'AUTH_REQUIRED', message: 'Create an account or sign in to continue.' },
      });
  }
  return next();
}

export function attachAuth(authService) {
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
