import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export function createRoutes({ controllers }) {
  const router = Router();
  router.get('/health', controllers.health.health);
  router.post('/auth/register', controllers.auth.register);
  router.post('/auth/login', controllers.auth.login);
  router.use(controllers.auth.attach);
  router.use(requireAuth);
  router.get('/auth/me', controllers.auth.me);
  router.put('/auth/me', controllers.auth.updateProfile);
  router.post('/auth/logout', controllers.auth.logout);
  router.get('/agent', controllers.health.agentInfo);
  router.get('/settings/providers', controllers.settings.listProviders);
  router.put('/settings/providers', controllers.settings.updateProviders);
  router.put('/settings/providers/:providerId', controllers.settings.updateProvider);
  router.delete('/settings/providers/:providerId', controllers.settings.removeProvider);
  router.get('/tools', controllers.tools.listTools);
  router.get('/targets', controllers.targets.list);
  router.get('/targets/:targetId', controllers.targets.get);
  router.get('/scans', controllers.scans.list);
  router.get('/scans/:scanId', controllers.scans.get);
  router.get('/scans/:scanId/events', controllers.scans.events);
  router.post('/agent/messages', controllers.agent.message);
  return router;
}
