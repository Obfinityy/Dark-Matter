/**
 * modelRunnerController — Express route handlers for model Runner.
 * Factory that wires the model Runner service into REST endpoints.
 * Part of: Infinity AI / Dark-Matter backend (HTTP API controllers).
 */

import { buildBrainChain } from '../agent/providers/resilientBrainProvider.js';

/**
 * modelRunnerController.js — HTTP API for the no-Ollama local model runner.
 *
 *   GET  /api/v1/model-runner/status            — device, engine, downloads, running, models
 *   GET  /api/v1/model-runner/library           — models + compatibility ranking
 *   GET  /api/v1/model-runner/device            — hardware snapshot
 *   POST /api/v1/model-runner/engine            — download Infinity AI Runner (one-time, on demand)
 *   GET  /api/v1/model-runner/engine/stream     — SSE: engine download progress
 *   POST /api/v1/model-runner/download {modelId}— download a GGUF
 *   POST /api/v1/model-runner/download/cancel   — cancel the download
 *   GET  /api/v1/model-runner/download/stream   — SSE: model download progress
 *   DELETE /api/v1/model-runner/models/:modelId — delete a downloaded GGUF
 *   POST /api/v1/model-runner/custom {repo,file}— add any Hugging Face GGUF
 *   POST /api/v1/model-runner/run {modelId}     — Run on localhost + set as brain
 *   POST /api/v1/model-runner/stop              — stop the running model
 *
 * Per-model aliases (used by the Models page download → Run flow):
 *   POST /api/v1/models/:modelId/download      — start a real streaming download
 *   GET  /api/v1/models/:modelId/progress       — SSE: real 0% → 100% byte progress
 *   POST /api/v1/models/:modelId/run            — Run + set as the ACTIVE localhost brain
 *
 * Run also switches the CALLER's brain provider to 'local' so Hunt and
 * Infinity AI immediately think with the running model.
 */

function downloadErrorStatus(error) {
  switch (error?.code) {
    case 'UNKNOWN_MODEL':
    case 'UNKNOWN_QUANT':
    case 'INVALID_MODEL_REF':
      return 400;
    case 'DOWNLOAD_BUSY':
      return 409;
    case 'NOT_DOWNLOADED':
      return 409;
    case 'MODEL_UNREACHABLE':
      return 502;
    case 'RUN_FAILED':
      return 500;
    default:
      return 500;
  }
}

/**
 * Creates model runner controller.
 * @returns {*} Result.
 */
export function createModelRunnerController({
  modelRunnerService,
  brainProviderModel,
  agentWorker,
}) {
  const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  const refreshBrain = userId => {
    try {
      agentWorker?.refreshBrainForUser?.(userId);
    } catch {
      /* best effort */
    }
  };

  /** SSE helper shared by both progress streams. */
  const progressStream = (subscribe, describe) =>
    asyncHandler(async (request, response) => {
      response.status(200).set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.flushHeaders?.();
      const send = state => {
        response.write(`event: progress\ndata: ${JSON.stringify(state || { status: 'idle' })}\n\n`);
      };
      send(describe());
      const unsubscribe = subscribe(send);
      const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15_000);
      request.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    });

  return {
    /** GET /api/v1/model-runner/status */
    status: asyncHandler(async (request, response) => {
      response.json(await modelRunnerService.status());
    }),

    /** GET /api/v1/model-runner/library */
    library: asyncHandler(async (request, response) => {
      response.json({ models: await modelRunnerService.library() });
    }),

    /**
     * GET /api/v1/model-runner/brain-slots
     * Returns the three brain slots with their models (alternatives per slot).
     * - vision: Hunt + Chat + Control (Kaggle remote or local)
     * - grounding: Hunt + Control (local coordinates)
     * - hacker: Hunt only (local uncensored)
     */
    brainSlots: asyncHandler(async (request, response) => {
      const { BRAIN_SLOTS, getModelsBySlot } =
        await import('../services/modelRunner/modelLibrary.js');
      const slots = {};
      for (const [slotId, slotInfo] of Object.entries(BRAIN_SLOTS)) {
        slots[slotId] = {
          ...slotInfo,
          models: getModelsBySlot(slotId),
        };
      }
      response.json({ slots });
    }),

    /**
     * GET /api/v1/model-runner/brain-slots/assignments
     * Returns the user's current model assignment per slot.
     */
    getSlotAssignments: asyncHandler(async (request, response) => {
      const userId = request.user?.id;
      if (!userId) {
        return response
          .status(401)
          .json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } });
      }
      const selection = await brainProviderModel.getSelection(userId);
      response.json({ assignments: selection.slotAssignments || {} });
    }),

    /**
     * POST /api/v1/model-runner/brain-slots/assign { slot, modelId }
     * Assigns a model to a brain slot (vision | grounding | hacker).
     */
    assignSlot: asyncHandler(async (request, response) => {
      const userId = request.user?.id;
      if (!userId) {
        return response
          .status(401)
          .json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } });
      }
      const { slot, modelId } = request.body || {};
      if (!slot || !modelId) {
        return response.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'slot and modelId are required' },
        });
      }
      // Validate the model exists and belongs to the slot
      const { getLibraryEntry, getModelsBySlot } =
        await import('../services/modelRunner/modelLibrary.js');
      const entry = getLibraryEntry(modelId);
      if (!entry) {
        return response.status(404).json({
          error: { code: 'UNKNOWN_MODEL', message: `Model "${modelId}" not found` },
        });
      }
      if (entry.brainSlot !== slot) {
        return response.status(400).json({
          error: {
            code: 'SLOT_MISMATCH',
            message: `"${entry.name}" belongs to slot "${entry.brainSlot}", not "${slot}"`,
          },
        });
      }
      const selection = await brainProviderModel.setSlotAssignment(userId, slot, modelId);
      response.json({
        assignments: selection.slotAssignments || {},
        slotSources: selection.slotSources || {},
      });
    }),

    /**
     * GET /api/v1/model-runner/brain-slots/sources
     * Returns the user's per-slot source: local model or Kaggle link.
     */
    getSlotSources: asyncHandler(async (request, response) => {
      const userId = request.user?.id;
      if (!userId) {
        return response
          .status(401)
          .json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } });
      }
      const selection = await brainProviderModel.getSelection(userId);
      response.json({ slotSources: selection.slotSources || {} });
    }),

    /**
     * POST /api/v1/model-runner/brain-slots/kaggle { slot, url, name? }
     * Connect a Kaggle/Colab Gradio link as the source for a brain slot.
     */
    connectSlotKaggle: asyncHandler(async (request, response) => {
      const userId = request.user?.id;
      if (!userId) {
        return response
          .status(401)
          .json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } });
      }
      const { slot, url, name } = request.body || {};
      if (!slot || !url) {
        return response.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'slot and url are required' },
        });
      }
      try {
        const selection = await brainProviderModel.setSlotKaggle(userId, slot, url, name);
        response.json({ slotSources: selection.slotSources || {} });
      } catch (err) {
        response.status(400).json({
          error: { code: 'INVALID_SLOT_SOURCE', message: err.message },
        });
      }
    }),

    /**
     * DELETE /api/v1/model-runner/brain-slots/kaggle/:slot
     * Disconnect the Kaggle link for a slot — falls back to local model.
     */
    disconnectSlotKaggle: asyncHandler(async (request, response) => {
      const userId = request.user?.id;
      if (!userId) {
        return response
          .status(401)
          .json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } });
      }
      const { slot } = request.params;
      try {
        const selection = await brainProviderModel.clearSlotKaggle(userId, slot);
        response.json({ slotSources: selection.slotSources || {} });
      } catch (err) {
        response.status(400).json({
          error: { code: 'INVALID_SLOT_SOURCE', message: err.message },
        });
      }
    }),

    /** GET /api/v1/model-runner/device */
    device: asyncHandler(async (request, response) => {
      response.json({ device: await modelRunnerService.getDevice() });
    }),

    /** POST /api/v1/model-runner/engine — one-time Infinity AI Runner download.
     *  Returns 202 immediately; progress arrives over the SSE stream. */
    ensureEngine: asyncHandler(async (request, response) => {
      try {
        const device = await modelRunnerService.getDevice();
        const result = modelRunnerService.engine.startEngineDownload(device);
        response.status(result.ready ? 200 : 202).json(result);
      } catch (error) {
        response.status(500).json({ error: { code: 'ENGINE_FAILED', message: error.message } });
      }
    }),

    /** GET /api/v1/model-runner/engine/stream — SSE */
    engineStream: progressStream(
      send => modelRunnerService.engine.onProgress(send),
      () => modelRunnerService.engine.describeDownload()
    ),

    /** POST /api/v1/model-runner/download { modelId, quant? } */
    download: asyncHandler(async (request, response) => {
      const { modelId, quant } = request.body || {};
      try {
        const result = await modelRunnerService.startDownload(modelId, { quant });
        response.status(202).json(result);
      } catch (error) {
        response.status(downloadErrorStatus(error)).json({
          error: { code: error.code || 'DOWNLOAD_FAILED', message: error.message },
        });
      }
    }),

    /** POST /api/v1/model-runner/download/cancel */
    cancelDownload: asyncHandler(async (request, response) => {
      response.json(modelRunnerService.cancelDownload());
    }),

    /** POST /api/v1/model-runner/download/pause — pause keeping the partial file for resume */
    pauseDownload: asyncHandler(async (request, response) => {
      response.json(modelRunnerService.pauseDownload());
    }),

    /** GET /api/v1/model-runner/download/stream — SSE */
    downloadStream: progressStream(
      send => modelRunnerService.onDownloadProgress(send),
      () => modelRunnerService.describeDownload()
    ),

    /** DELETE /api/v1/model-runner/models/:modelId */
    deleteModel: asyncHandler(async (request, response) => {
      try {
        const result = await modelRunnerService.deleteModel(request.params.modelId);
        response.json(result);
      } catch (error) {
        response.status(downloadErrorStatus(error)).json({
          error: { code: error.code || 'DELETE_FAILED', message: error.message },
        });
      }
    }),

    /** POST /api/v1/model-runner/custom { repo, file, name?, ramGB? } */
    addCustom: asyncHandler(async (request, response) => {
      const { repo, file, name, ramGB } = request.body || {};
      try {
        const result = await modelRunnerService.addCustomModel({ repo, file, name, ramGB });
        response.status(201).json(result);
      } catch (error) {
        response.status(downloadErrorStatus(error)).json({
          error: { code: error.code || 'CUSTOM_ADD_FAILED', message: error.message },
        });
      }
    }),

    /**
     * POST /api/v1/model-runner/run { modelId }
     * POST /api/v1/models/:modelId/run
     * Starts the model on localhost AND switches the caller's brain to it —
     * Hunt + Infinity AI immediately use the running model.
     * Optional body: { contextSize } — context window in tokens, clamped to
     * the model's supported maximum (see catalog `contextWindow`).
     * Optional body: { quant } — which downloaded quantization to run
     * ('Q4_K_M' default; falls back to any downloaded quant).
     */
    run: asyncHandler(async (request, response) => {
      const modelId = request.params.modelId || request.body?.modelId;
      const contextSize =
        request.body?.contextSize != null ? Number(request.body.contextSize) : undefined;
      const quant = request.body?.quant || undefined;
      try {
        const result = await modelRunnerService.run(modelId, {
          ...(Number.isFinite(contextSize) && contextSize > 0
            ? { contextSize: Math.floor(contextSize) }
            : {}),
          ...(quant ? { quant } : {}),
        });
        const userId = request.user?.id || null;
        const activation = await modelRunnerService.activateBrainForUser({
          userId,
          modelId,
          brainProviderModel,
          onBrainSwitched: () => refreshBrain(userId),
        });
        response.json({ ...result, brainSwitched: Boolean(activation.selection) });
      } catch (error) {
        response.status(downloadErrorStatus(error)).json({
          error: { code: error.code || 'RUN_FAILED', message: error.message },
        });
      }
    }),

    /**
     * POST /api/v1/models/:modelId/download
     * Alias of the model-runner download with the id in the path.
     * Optional body: { quant } — 'Q4_K_M' | 'Q5_K_M' | 'Q8_0'.
     */
    downloadById: asyncHandler(async (request, response) => {
      const modelId = request.params.modelId;
      const { quant } = request.body || {};
      try {
        const result = await modelRunnerService.startDownload(modelId, { quant });
        response.status(202).json(result);
      } catch (error) {
        response.status(downloadErrorStatus(error)).json({
          error: { code: error.code || 'DOWNLOAD_FAILED', message: error.message },
        });
      }
    }),

    /**
     * GET /api/v1/models/:modelId/progress — SSE.
     * Emits the REAL byte progress of THIS model's download as 0% → 100%
     * `progress` events: { modelId, status, receivedBytes, totalBytes, percent }.
     * A terminal `progress` event with status 'done' (percent 100) is emitted
     * when the download completes; 'error'/'cancelled' surface failures.
     * Events for other models' downloads are filtered out.
     */
    progressById: asyncHandler(async (request, response) => {
      const modelId = request.params.modelId;
      response.status(200).set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.flushHeaders?.();
      const snapshot = state => {
        const s = state || { status: 'idle' };
        const total = s.totalBytes || null;
        const received = s.receivedBytes || 0;
        return {
          modelId,
          status: s.status,
          name: s.name || null,
          receivedBytes: received,
          totalBytes: total,
          percent:
            total > 0
              ? Math.min(100, Math.round((received / total) * 100))
              : s.status === 'done'
                ? 100
                : 0,
          error: s.error || null,
        };
      };
      const current = modelRunnerService.describeDownload();
      const matches = current?.modelId === modelId && current?.status !== 'idle';
      const send = state => {
        response.write(`event: progress\ndata: ${JSON.stringify(snapshot(state))}\n\n`);
      };
      // Initial event: the live state when it belongs to this model,
      // otherwise an honest idle (0%).
      send(matches ? current : { status: 'idle' });
      const unsubscribe = modelRunnerService.onDownloadProgress(state => {
        if (!state || state.modelId !== modelId) return; // not ours — skip
        send(state);
      });
      const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15_000);
      request.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    }),

    /** POST /api/v1/model-runner/stop */
    stop: asyncHandler(async (request, response) => {
      const result = await modelRunnerService.stop();
      const userId = request.user?.id || null;
      if (result.stopped && brainProviderModel && userId) {
        // Brain back to phone default when the local model stops.
        await brainProviderModel.setSelection(userId, { provider: 'phone' });
        refreshBrain(userId);
      }
      response.json(result);
    }),

    /**
     * POST /api/v1/model-runner/slots/:slot/run { modelId, quant?, contextSize? }
     * Run a model for a specific brain slot on its OWN localhost port.
     * Each slot (vision | grounding | hacker) gets its own llama-server,
     * so all three brains run simultaneously on different ports.
     */
    runSlot: asyncHandler(async (request, response) => {
      const { slot } = request.params;
      const { modelId, quant, contextSize } = request.body || {};
      if (!modelId) {
        return response.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'modelId is required' },
        });
      }
      try {
        const result = await modelRunnerService.runForSlot(slot, modelId, {
          ...(quant ? { quant } : {}),
          ...(Number.isFinite(Number(contextSize)) && Number(contextSize) > 0
            ? { contextSize: Math.floor(Number(contextSize)) }
            : {}),
        });
        // Also record the slot assignment so Hunt/Control/Chat resolve it.
        const userId = request.user?.id || null;
        if (userId && brainProviderModel) {
          try {
            await brainProviderModel.setSlotAssignment(userId, slot, modelId);
          } catch {
            /* non-fatal */
          }
        }
        response.json(result);
      } catch (error) {
        response.status(downloadErrorStatus(error)).json({
          error: { code: error.code || 'RUN_FAILED', message: error.message },
        });
      }
    }),

    /**
     * POST /api/v1/model-runner/slots/:slot/download-and-run { modelId?, quant? }
     * ONE-CLICK brain setup: downloads the model when missing, then runs it
     * for the slot. Returns 202 immediately; progress arrives over the
     * existing download/run SSE events. When modelId is omitted the slot's
     * default model is used.
     */
    downloadAndRunSlot: asyncHandler(async (request, response) => {
      const { slot } = request.params;
      let { modelId, quant } = request.body || {};
      if (!modelId) {
        const { getDefaultModelForSlot } = await import('../services/modelRunner/modelLibrary.js');
        const def = getDefaultModelForSlot(slot);
        if (!def) {
          return response.status(400).json({
            error: {
              code: 'BAD_REQUEST',
              message: `No default model for slot "${slot}" — pass modelId`,
            },
          });
        }
        modelId = def.id;
      }
      try {
        const result = modelRunnerService.downloadAndRunForSlot(slot, modelId, {
          ...(quant ? { quant } : {}),
        });
        // Record the slot assignment so Hunt/Control/Chat resolve it.
        const userId = request.user?.id || null;
        if (userId && brainProviderModel) {
          try {
            await brainProviderModel.setSlotAssignment(userId, slot, modelId);
          } catch {
            /* non-fatal */
          }
        }
        response.status(202).json(result);
      } catch (error) {
        response.status(downloadErrorStatus(error)).json({
          error: { code: error.code || 'RUN_FAILED', message: error.message },
        });
      }
    }),

    /**
     * GET /api/v1/model-runner/slots/setup-status
     * Per-slot one-click setup state: idle | setting-up | running | error.
     */
    slotSetupStatus: asyncHandler(async (request, response) => {
      response.json({
        setup: modelRunnerService.describeSlotSetup(),
        errors: modelRunnerService.slotSetupError || {},
        defaults: (await import('../services/modelRunner/modelLibrary.js')).DEFAULT_SLOT_MODELS,
      });
    }),

    /**
     * POST /api/v1/model-runner/slots/:slot/stop
     * Stop the server running for a specific brain slot.
     */
    stopSlot: asyncHandler(async (request, response) => {
      const { slot } = request.params;
      const result = await modelRunnerService.stopSlot(slot);
      response.json(result);
    }),

    /**
     * GET /api/v1/model-runner/slots/servers
     * Returns the running server per brain slot (each on its own port).
     */
    getSlotServers: asyncHandler(async (request, response) => {
      response.json({ slotServers: modelRunnerService.describeSlotServers() });
    }),
    /**
     * GET /api/v1/model-runner/brain-chain
     * The caller's brain fallback chain (describe-only, nothing is started):
     * ordered link names, which is active, and the remembered remote GPU.
     * Shown in the Models UI so the user sees what the brain falls back to.
     */
    brainChain: asyncHandler(async (request, response) => {
      const userId = request.user?.id || null;
      const selection = brainProviderModel
        ? await brainProviderModel.getSelection(userId)
        : { provider: 'phone' };
      let downloaded = null;
      if (selection.provider === 'local') {
        try {
          downloaded = await modelRunnerService.library();
        } catch {
          /* describe-only */
        }
      }
      const chain = buildBrainChain({
        selection,
        appConfig: {},
        runner: modelRunnerService,
        downloaded,
      });
      response.json({
        provider: selection.provider,
        modelId: selection.modelId || null,
        remoteGpu: selection.lastGradioUrl || null,
        chain: chain.map(l => l.name),
      });
    }),
  };
}
