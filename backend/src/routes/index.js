/**
 * routes — top-level Express router.
 * Mounts all API controllers under their versioned paths.
 * Part of: Infinity AI / Dark-Matter backend (Express route definitions).
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../core/utils.js';

/**
 * Creates routes.
 * @param {object} options - Named options.
 * @returns {*} Result.
 */
export function createRoutes({ controllers }) {
  const router = Router();
  router.get('/health', controllers.health.health);
  router.get('/health/local-ai', controllers.health.localAiHealth);
  router.post('/auth/register', controllers.auth.register);
  router.post('/auth/login', controllers.auth.login);
  router.post('/auth/recover', controllers.auth.recover);

  // ─── Dark Matter Engine one-click launcher (PUBLIC — the user downloads
  // this before they have any local backend running) ─────────────────────
  router.get('/engine/launcher', controllers.engineLauncher.launcher);
  // Loopback-only: the launcher calls this after starting the local backend.
  router.post('/engine/bootstrap', controllers.engineLauncher.bootstrap);

  router.use(controllers.auth.attach);

  router.use(requireAuth);

  // Authenticated routes below
  router.post('/infinite/chat', controllers.infiniteChat.chat);
  router.get('/infinite/chat/:conversationId', controllers.infiniteChat.getHistory);

  // ─── Infinity Long-Context Engine ─────────────────────────────────
  router.post('/infinite/ingest', controllers.infiniteChat.ingest);
  router.get('/infinite/ingest/:conversationId/:inputId', controllers.infiniteChat.getIngestion);
  router.post(
    '/infinite/ingest/:conversationId/:inputId/resume',
    controllers.infiniteChat.resumeIngestion
  );
  router.post('/infinite/search/:conversationId', controllers.infiniteChat.searchChunks);
  router.get(
    '/infinite/chunk/:conversationId/:inputId/:chunkRef',
    controllers.infiniteChat.getChunk
  );
  router.post(
    '/infinite/summarize/:conversationId/:inputId',
    controllers.infiniteChat.summarizeDocument
  );

  // ─── Long Generation Engine ───────────────────────────────────────
  router.post('/infinite/generations', controllers.infiniteChat.startGeneration);
  router.get('/infinite/generations', controllers.infiniteChat.listGenerations);
  router.get('/infinite/generations/:generationId', controllers.infiniteChat.getGeneration);
  router.post(
    '/infinite/generations/:generationId/cancel',
    controllers.infiniteChat.cancelGeneration
  );
  router.post(
    '/infinite/generations/:generationId/resume',
    controllers.infiniteChat.resumeGeneration
  );

  // ─── Infinity AI modes (plan / build / control) ──────────────────────
  router.post('/infinite/plan', controllers.infiniteChat.plan);
  router.post('/infinite/build', controllers.infiniteChat.build);
  router.post('/infinite/control', controllers.infiniteChat.control);
  router.post('/infinite/action', controllers.infiniteChat.action);

  // ─── Infinity Voice: built-in neural TTS ─────────────────────────
  router.get('/voice/health', controllers.voice.health);
  router.get('/voice/voices', controllers.voice.voices);
  router.post('/voice/speak', controllers.voice.speak);

  // ─── Infinity AI Billing (Razorpay) ────────────────────────────────
  router.get('/billing/status', controllers.billing.status);
  router.get('/billing/subscription', controllers.billing.subscription);
  router.get('/billing/balance', controllers.billing.balance);
  router.post('/billing/order', controllers.billing.createOrder);
  router.post('/billing/verify', controllers.billing.verify);

  router.post('/billing/topup/order', controllers.billing.createTopupOrder);
  router.post('/billing/topup/verify', controllers.billing.verifyTopup);

  // ─── Per-account Kaggle brain links (encrypted at rest) ─────────────
  // Saved once from the Models page; the agent poller fetches them with the
  // user's token so hunts run 24/7 without the browser open.
  router.get('/brain-links', controllers.brainLinks.list);
  router.post('/brain-links', controllers.brainLinks.save);
  router.delete('/brain-links/:slot', controllers.brainLinks.remove);

  router.get('/auth/me', controllers.auth.me);
  router.put('/auth/me', controllers.auth.updateProfile);
  router.put('/auth/password', controllers.auth.changePassword);
  router.post('/auth/logout', controllers.auth.logout);

  // ─── Agent permission mode (ask-every-time vs full control) ─────────
  router.get('/users/me/permissions', controllers.permissions.get);
  router.put('/users/me/permissions', controllers.permissions.update);
  router.get('/agent', controllers.health.agentInfo);
  // ─── Agent-machine presence (Hunt console) ─────────────────────────
  // The headless agent poller heartbeats here every poll tick; the Hunt
  // console reads presence + per-account brain slots here so it can show
  // the one-click start action when no agent machine is connected.
  router.post('/agent/heartbeat', controllers.agentStatus.heartbeat);
  router.get('/agent/status', controllers.agentStatus.status);
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
  router.post('/jobs/:id/events', controllers.jobs.postEvent);
  router.get('/jobs/:id/events/history', controllers.jobs.eventHistory);
  router.post('/jobs/:id/pause', controllers.jobs.pause);
  router.post('/jobs/:id/claim', controllers.jobs.claim);
  router.post('/jobs/:id/continue', controllers.jobs.continue);
  router.post('/jobs/:id/resume', controllers.jobs.resume);
  router.post('/jobs/:id/cancel', controllers.jobs.cancel);
  router.post('/jobs/:id/ask', controllers.jobs.ask);
  router.get('/jobs/:id/computer-actions', controllers.jobs.computerActions);
  router.get('/jobs/:id/reasoning-cycles', controllers.jobs.reasoningCycles);
  router.get('/jobs/:id/findings', controllers.jobs.findings);
  router.get('/jobs/:id/vulnerability-report', controllers.jobs.vulnerabilityReport);
  router.get('/jobs/:id/report.pdf', controllers.jobs.reportPdf);
  router.post('/jobs/:id/report.html', controllers.jobs.reportHtmlStart);
  router.get('/jobs/:id/report.html/:generationId', controllers.jobs.reportHtmlGet);
  router.get('/jobs/:id/attack-surface', controllers.jobs.attackSurface);
  router.get('/jobs/:id/posture', controllers.jobs.posture);
  router.get('/jobs/:id/diary', controllers.jobs.diary);

  // ─── Continuous autonomous hunt (issue #298) ───────────────────────
  // The loop itself is started/registered by the hunt worker; these are the
  // user-facing controls. report-snapshot is read-only and never pauses the
  // loop. force-stop is terminal and requires explicit { confirmed: true }.
  router.post('/hunts', controllers.continuousHunt.create);
  router.post('/hunts/:id/report-snapshot', controllers.continuousHunt.reportSnapshot);
  router.get('/hunts/:id/tally', controllers.continuousHunt.tally);
  router.get('/hunts/:id/events', controllers.continuousHunt.events);
  router.post('/hunts/:id/chat', controllers.continuousHunt.chat);
  router.post('/hunts/:id/pause', controllers.continuousHunt.pause);
  router.post('/hunts/:id/resume', controllers.continuousHunt.resume);
  router.post('/hunts/:id/force-stop', controllers.continuousHunt.forceStop);

  // ─── Recursive self-learning — the agent's evolution stats (local-only) ──
  router.get(
    '/agent/evolution',
    asyncHandler(async (req, res) => {
      const { getEvolutionStats } = await import('../engines/recursiveLearner.js');
      res.json({ ok: true, evolution: getEvolutionStats() });
    })
  );

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

  // ─── Payload library — self-learning payloads + curated dataset ───
  // NOTE: /categories and /search MUST be registered before /:category.
  router.get('/payload-library', controllers.payloadLibrary.list);
  router.get('/payload-library/categories', controllers.payloadLibrary.categories);
  router.get('/payload-library/search', controllers.payloadLibrary.search);
  router.get('/payload-library/stats', controllers.payloadLibrary.stats);
  router.get('/payload-library/:category', controllers.payloadLibrary.catalog);

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
  router.post('/model-runner/download/pause', controllers.modelRunner.pauseDownload);
  router.get('/model-runner/download/stream', controllers.modelRunner.downloadStream);
  // ── Brain slots: three independent slots (vision/grounding/hacker) ──
  // Each slot has alternatives; user picks one model per slot.
  // Hunt uses all 3; Infinity Chat uses vision only; Control uses vision+grounding.
  router.get('/model-runner/brain-slots', controllers.modelRunner.brainSlots);
  router.get('/model-runner/brain-slots/assignments', controllers.modelRunner.getSlotAssignments);
  router.post('/model-runner/brain-slots/assign', controllers.modelRunner.assignSlot);
  // ── Brain chat: dynamic (non-template) chat with local brains ──
  // Per-chat memory on local disk; replies generated live by the brain.
  router.post('/brain-chat', controllers.brainChat.chat);
  router.get('/brain-chat/brains', controllers.brainChat.brains);
  router.get('/brain-chat/list', controllers.brainChat.list);
  router.get('/brain-chat/:chatId/memory', controllers.brainChat.getMemory);
  router.delete('/brain-chat/:chatId/memory', controllers.brainChat.deleteMemory);
  // Per-slot source: local model or Kaggle/Colab link per slot.
  router.get('/model-runner/brain-slots/sources', controllers.modelRunner.getSlotSources);
  router.post('/model-runner/brain-slots/kaggle', controllers.modelRunner.connectSlotKaggle);
  router.delete(
    '/model-runner/brain-slots/kaggle/:slot',
    controllers.modelRunner.disconnectSlotKaggle
  );

  // ─── Local memory (infinite, on user's disk) + ZIP transfer ─────────
  router.get('/memory/stats', controllers.memory.stats);
  router.get('/memory/export', controllers.memory.exportZip);
  router.get('/memory/jobs/:jobId/export', controllers.memory.exportHuntZip);
  router.post('/memory/import', controllers.memory.importZip);
  router.delete('/model-runner/models/:modelId', controllers.modelRunner.deleteModel);
  router.post('/model-runner/custom', controllers.modelRunner.addCustom);
  router.post('/model-runner/run', controllers.modelRunner.run);
  router.post('/model-runner/stop', controllers.modelRunner.stop);
  // Per-slot servers: each brain slot runs on its own localhost port.
  router.get('/model-runner/slots/servers', controllers.modelRunner.getSlotServers);
  router.get('/model-runner/slots/setup-status', controllers.modelRunner.slotSetupStatus);
  router.post('/model-runner/slots/:slot/run', controllers.modelRunner.runSlot);
  router.post(
    '/model-runner/slots/:slot/download-and-run',
    controllers.modelRunner.downloadAndRunSlot
  );
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

  // ─── Infinity Crew (persistent AI coworkers) ─────────────────────
  router.post('/crew', controllers.crew.create);
  router.get('/crew', controllers.crew.list);
  router.get('/crew/:id', controllers.crew.get);
  router.patch('/crew/:id', controllers.crew.update);
  router.delete('/crew/:id', controllers.crew.remove);
  router.post('/crew/:id/chat', controllers.crew.chat);
  router.get('/crew/:id/events', controllers.crew.events);
  router.post('/crew/:id/stop', controllers.crew.stop);

  // ─── Report System ──────────────────────────────────────────────
  router.post('/assessments/:id/report', controllers.reports.generate);
  router.get('/assessments/:id/report', controllers.reports.getLatest);
  router.get('/assessments/:id/report.md', controllers.reports.markdown);
  router.get('/assessments/:id/report.pdf', controllers.reports.pdf);
  router.get('/assessments/:id/reports', controllers.reports.listVersions);
  router.get('/reports', controllers.reports.listAll);

  return router;
}
