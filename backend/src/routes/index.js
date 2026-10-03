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

  // ─── Infinity AI modes (plan / build / control) ──────────────────────
  router.post('/infinite/plan', controllers.infiniteChat.plan);
  router.post('/infinite/build', controllers.infiniteChat.build);
  router.post('/infinite/control', controllers.infiniteChat.control);
  router.post('/infinite/action', controllers.infiniteChat.action);

  // ─── Infinity Voice: built-in neural TTS ─────────────────────────
  router.get('/voice/health', controllers.voice.health);
  router.get('/voice/voices', controllers.voice.voices);
  router.post('/voice/speak', controllers.voice.speak);
  
  router.get('/auth/me', controllers.auth.me);
  router.put('/auth/me', controllers.auth.updateProfile);
  router.put('/auth/password', controllers.auth.changePassword);
  router.post('/auth/logout', controllers.auth.logout);

  // ─── Agent permission mode (ask-every-time vs full control) ─────────
  router.get('/users/me/permissions', controllers.permissions.get);
  router.put('/users/me/permissions', controllers.permissions.update);
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

  // ─── Autonomous Bug Bounty Agent (persistent jobs) ───────────────
  router.post('/jobs', controllers.jobs.create);
  router.get('/jobs', controllers.jobs.list);
  router.get('/jobs/:id', controllers.jobs.get);
  router.get('/jobs/:id/activity', controllers.jobs.activity);
  router.get('/jobs/:id/events', controllers.jobs.events);
  router.get('/jobs/:id/events/history', controllers.jobs.eventHistory);
  router.post('/jobs/:id/pause', controllers.jobs.pause);
  router.post('/jobs/:id/continue', controllers.jobs.continue);
  router.post('/jobs/:id/resume', controllers.jobs.resume);
  router.post('/jobs/:id/cancel', controllers.jobs.cancel);
  router.post('/jobs/:id/ask', controllers.jobs.ask);
  router.get('/jobs/:id/computer-actions', controllers.jobs.computerActions);
  router.get('/jobs/:id/reasoning-cycles', controllers.jobs.reasoningCycles);
  router.get('/jobs/:id/findings', controllers.jobs.findings);
  router.get('/jobs/:id/vulnerability-report', controllers.jobs.vulnerabilityReport);
  router.get('/jobs/:id/attack-surface', controllers.jobs.attackSurface);
  router.get('/jobs/:id/posture', controllers.jobs.posture);
  router.get('/jobs/:id/diary', controllers.jobs.diary);

  // ─── Recursive self-learning — the agent's evolution stats (local-only) ──
  router.get('/agent/evolution', asyncHandler(async (req, res) => {
    const { getEvolutionStats } = await import('../engines/recursiveLearner.js');
    res.json({ ok: true, evolution: getEvolutionStats() });
  }));

  // ─── Hunt records — report history (hybrid storage: DB artifacts) ──
  // Completed hunts' final reports, versioned per target. Powers target
  // dedup (POST /jobs returns these instantly) + the past-reports browser.
  router.get('/hunt-records', controllers.huntRecords.list);
  router.get('/hunt-records/:id', controllers.huntRecords.get);
  router.get('/hunt-records/:id/report.md', controllers.huntRecords.downloadMarkdown);
  router.get('/hunt-records/:id/findings/:findingId/poc', controllers.huntRecords.downloadPoc);

  // ─── Alerts — the notification center ─────────────────────────────
  router.get('/alerts', controllers.alerts.list);
  router.post('/alerts/:id/read', controllers.alerts.markRead);
  router.post('/alerts/read-all', controllers.alerts.markAllRead);

  // ─── Target queues — multi-target hunts ───────────────────────────
  router.post('/queues', controllers.queues.create);
  router.get('/queues', controllers.queues.list);
  router.get('/queues/:id', controllers.queues.get);
  router.post('/queues/:id/pause', controllers.queues.pause);
  router.post('/queues/:id/resume', controllers.queues.resume);
  router.delete('/queues/:id', controllers.queues.remove);

  // ─── Schedules — scheduled hunts with alerts ──────────────────────
  router.post('/schedules', controllers.schedules.create);
  router.get('/schedules', controllers.schedules.list);
  router.patch('/schedules/:id', controllers.schedules.update);
  router.delete('/schedules/:id', controllers.schedules.remove);

  // ─── Payload library — self-learning payloads ─────────────────────
  router.get('/payload-library', controllers.payloadLibrary.list);
  router.get('/payload-library/stats', controllers.payloadLibrary.stats);

  // ─── Computer Control (Open-Interface adapter) ──────────────────
  router.get('/computer', controllers.computer.status);
  router.get('/computer/capabilities', controllers.computer.capabilities);
  router.get('/computer/active-window', controllers.computer.activeWindow);
  router.get('/computer/browser-state', controllers.computer.browserState);
  router.post('/computer/screenshot', controllers.computer.screenshot);
  router.post('/computer/action', controllers.computer.action);
  router.get('/computer/setup', controllers.computer.setup);
  router.post('/computer/repair', controllers.computer.repair);
  router.post('/computer/pause', controllers.computer.pause);
  router.post('/computer/resume', controllers.computer.resume);

  // ─── Local uncensored model library ("Run Locally", issue #3) ─────────
  router.get('/local-models/library', controllers.localModels.library);
  router.get('/local-models/status', controllers.localModels.status);
  router.get('/local-models/install-guide', controllers.localModels.installGuide);
  router.post('/local-models/pull', controllers.localModels.pull);
  router.post('/local-models/pull/cancel', controllers.localModels.cancelPull);
  router.get('/local-models/pull/stream', controllers.localModels.pullStream);
  router.delete('/local-models/:modelId', controllers.localModels.remove);
  router.post('/local-models/activate', controllers.localModels.activate);
  router.post('/local-models/deactivate', controllers.localModels.deactivate);
  router.post('/local-models/custom', controllers.localModels.addCustom);
  router.delete('/local-models/custom/:id', controllers.localModels.removeCustom);

  // ─── Local GGUF model runner (no Ollama: Download → Run → localhost) ─
  router.get('/model-runner/status', controllers.modelRunner.status);
  router.get('/model-runner/library', controllers.modelRunner.library);
  router.get('/model-runner/device', controllers.modelRunner.device);
  router.post('/model-runner/engine', controllers.modelRunner.ensureEngine);
  router.get('/model-runner/engine/stream', controllers.modelRunner.engineStream);
  router.post('/model-runner/download', controllers.modelRunner.download);
  router.post('/model-runner/download/cancel', controllers.modelRunner.cancelDownload);
  router.get('/model-runner/download/stream', controllers.modelRunner.downloadStream);
  // ── Brain slots: three independent slots (vision/grounding/hacker) ──
  // Each slot has alternatives; user picks one model per slot.
  // Hunt uses all 3; Infinity Chat uses vision only; Control uses vision+grounding.
  router.get('/model-runner/brain-slots', controllers.modelRunner.brainSlots);
  router.get('/model-runner/brain-slots/assignments', controllers.modelRunner.getSlotAssignments);
  router.post('/model-runner/brain-slots/assign', controllers.modelRunner.assignSlot);
  // Per-slot source: local model or Kaggle/Colab link per slot.
  router.get('/model-runner/brain-slots/sources', controllers.modelRunner.getSlotSources);
  router.post('/model-runner/brain-slots/kaggle', controllers.modelRunner.connectSlotKaggle);
  router.delete('/model-runner/brain-slots/kaggle/:slot', controllers.modelRunner.disconnectSlotKaggle);

  // ─── Local memory (infinite, on user's disk) + ZIP transfer ─────────
  router.get('/memory/stats', controllers.memory.stats);
  router.get('/memory/export', controllers.memory.exportZip);
  router.post('/memory/import', controllers.memory.importZip);
  router.delete('/model-runner/models/:modelId', controllers.modelRunner.deleteModel);
  router.post('/model-runner/custom', controllers.modelRunner.addCustom);
  router.post('/model-runner/run', controllers.modelRunner.run);
  router.post('/model-runner/stop', controllers.modelRunner.stop);
  // Per-slot servers: each brain slot runs on its own localhost port.
  router.get('/model-runner/slots/servers', controllers.modelRunner.getSlotServers);
  router.post('/model-runner/slots/:slot/run', controllers.modelRunner.runSlot);
  router.post('/model-runner/slots/:slot/stop', controllers.modelRunner.stopSlot);
  router.get('/model-runner/brain-chain', controllers.modelRunner.brainChain);

  // ─── Per-model download → Run aliases (Models page flow) ──────────
  router.post('/models/:modelId/download', controllers.modelRunner.downloadById);
  router.get('/models/:modelId/progress', controllers.modelRunner.progressById);
  router.post('/models/:modelId/run', controllers.modelRunner.run);

  // ─── Remote GPU brain (Kaggle/Colab Gradio share link) ─────────────
  router.get('/remote-model', controllers.remoteModel.status);
  router.post('/remote-model/test', controllers.remoteModel.test);
  router.post('/remote-model/connect', controllers.remoteModel.connect);
  router.post('/remote-model/disconnect', controllers.remoteModel.disconnect);

  // ─── InfiniteChat Computer Tasks (natural-language desktop control) ──
  router.post('/computer-tasks', controllers.computerTasks.create);
  router.get('/computer-tasks', controllers.computerTasks.list);
  router.get('/computer-tasks/:id', controllers.computerTasks.get);
  router.get('/computer-tasks/:id/activity', controllers.computerTasks.activity);
  router.get('/computer-tasks/:id/events', controllers.computerTasks.events);
  router.get('/computer-tasks/:id/events/history', controllers.computerTasks.eventHistory);
  router.post('/computer-tasks/:id/answer', controllers.computerTasks.answer);
  router.post('/computer-tasks/:id/cancel', controllers.computerTasks.cancel);

  // ─── Report System ──────────────────────────────────────────────
  router.post('/assessments/:id/report', controllers.reports.generate);
  router.get('/assessments/:id/report', controllers.reports.getLatest);
  router.get('/assessments/:id/report.md', controllers.reports.markdown);
  router.get('/assessments/:id/reports', controllers.reports.listVersions);
  router.get('/reports', controllers.reports.listAll);

  return router;
}
