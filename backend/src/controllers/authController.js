import { asyncHandler } from '../core/utils.js';

const cookieName = 'darkmatter_session';

function setSessionCookie(response, token, sessionDays, secure) {
  const parts = [
    `${cookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(1, Math.floor(sessionDays * 86_400))}`
  ];
  if (secure) parts.push('Secure');
  response.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(response, secure) {
  const parts = [`${cookieName}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  response.setHeader('Set-Cookie', parts.join('; '));
}

export function createAuthController(authService, config) {
  return {
    register: asyncHandler(async (request, response) => {
      const result = await authService.register(request.body);
      setSessionCookie(response, result.token, config.sessionDays, config.nodeEnv === 'production');
      response.status(201).json({ user: result.user, jwt: result.jwt, jwtExpiresAt: result.jwtExpiresAt });
    }),
    login: asyncHandler(async (request, response) => {
      const result = await authService.login(request.body);
      setSessionCookie(response, result.token, config.sessionDays, config.nodeEnv === 'production');
      response.json({ user: result.user, jwt: result.jwt, jwtExpiresAt: result.jwtExpiresAt });
    }),
    me: asyncHandler(async (request, response) => {
      response.json({ user: request.user });
    }),
    updateProfile: asyncHandler(async (request, response) => {
      response.json({ user: await authService.updateProfile(request.user.id, request.body) });
    }),
    changePassword: asyncHandler(async (request, response) => {
      const { currentPassword, newPassword } = request.body || {};
      await authService.changePassword(request.user.id, currentPassword, newPassword);
      response.json({ message: 'Password changed successfully' });
    }),
    logout: asyncHandler(async (request, response) => {
      await authService.logout(request.sessionToken);
      clearSessionCookie(response, config.nodeEnv === 'production');
      response.status(204).send();
    })
  };
}
