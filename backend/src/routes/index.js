import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export function createRoutes({ controllers }) {
  const router = Router();
  router.get('/health', controllers.health.health);
  router.get('/health/local-ai', controllers.health.localAiHealth);
  router.post('/auth/register', controllers.auth.register);
  router.post('/auth/login', controllers.auth.login);
  router.use(controllers.auth.attach);

  router.use(requireAuth);
  
  // Authenticated routes below
  router.post('/infinite/chat', controllers.infiniteChat.chat);
  router.get('/infinite/chat/:conversationId', controllers.infiniteChat.getHistory);

  // ─── Infinity Long-Context Engine ─────────────────────────────────
  router.post('/infinite/ingest', controllers.infiniteChat.ingest);
  router.get('/infinite/ingest/:conversationId/:inputId', controllers.infiniteChat.getIngestion);
  router.post('/infinite/ingest/:conversationId/:inputId/resume', controllers.infiniteChat.resumeIngestion);
  router.post('/infinite/search/:conversationId', controllers.infiniteChat.searchChunks);
  router.get('/infinite/chunk/:conversationId/:inputId/:chunkRef', controllers.infiniteChat.getChunk);
  router.post('/infinite/summarize/:conversationId/:inputId', controllers.infiniteChat.summarizeDocument);

  // ─── Long Generation Engine ───────────────────────────────────────
  router.post('/infinite/generations', controllers.infiniteChat.startGeneration);
  router.get('/infinite/generations', controllers.infiniteChat.listGenerations);
  router.get('/infinite/generations/:generationId', controllers.infiniteChat.getGeneration);
  router.post('/infinite/generations/:generationId/cancel', controllers.infiniteChat.cancelGeneration);
  router.post('/infinite/generations/:generationId/resume', controllers.infiniteChat.resumeGeneration);
  
  router.get('/auth/me', controllers.auth.me);
  router.put('/auth/me', controllers.auth.updateProfile);
  router.put('/auth/password', controllers.auth.changePassword);
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

  // ─── Assessment System ───────────────────────────────────────────
  router.post('/assessments', controllers.assessments.create);
  router.get('/assessments', controllers.assessments.list);
  router.get('/assessments/:id', controllers.assessments.get);
  router.post('/assessments/:id/start', controllers.assessments.start);
  router.post('/assessments/:id/pause', controllers.assessments.pause);
  router.post('/assessments/:id/resume', controllers.assessments.resume);
  router.post('/assessments/:id/stop', controllers.assessments.stop);
  router.get('/assessments/:id/timeline', controllers.assessments.timeline);
  router.get('/assessments/:id/findings', controllers.assessments.findings);
  router.get('/assessments/:id/tool-executions', controllers.assessments.toolExecutions);
  router.post('/assessments/:id/chat', controllers.assessments.chat);
  router.get('/assessments/:id/events', controllers.assessments.events);

  // ─── Report System ──────────────────────────────────────────────
  router.post('/assessments/:id/report', controllers.reports.generate);
  router.get('/assessments/:id/report', controllers.reports.getLatest);
  router.get('/assessments/:id/reports', controllers.reports.listVersions);
  router.get('/reports', controllers.reports.listAll);

  return router;
}
