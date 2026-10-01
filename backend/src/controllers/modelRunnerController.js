/**
 * modelRunnerController.js — HTTP API for the no-Ollama local model runner.
 *
 *   GET  /api/v1/model-runner/status            — device, engine, downloads, running, models
 *   GET  /api/v1/model-runner/library           — models + compatibility ranking
 *   GET  /api/v1/model-runner/device            — hardware snapshot
 *   POST /api/v1/model-runner/engine            — download llama-server (one-time)
 *   GET  /api/v1/model-runner/engine/stream     — SSE: engine download progress
 *   POST /api/v1/model-runner/download {modelId}— download a GGUF
 *   POST /api/v1/model-runner/download/cancel   — cancel the download
 *   GET  /api/v1/model-runner/download/stream   — SSE: model download progress
 *   DELETE /api/v1/model-runner/models/:modelId — delete a downloaded GGUF
 *   POST /api/v1/model-runner/custom {repo,file}— add any Hugging Face GGUF
 *   POST /api/v1/model-runner/run {modelId}     — Run on localhost + set as brain
 *   POST /api/v1/model-runner/stop              — stop the running model
 *
 * Run also switches the CALLER's brain provider to 'local' so Hunt and
 * Infinity AI immediately think with the running model.
 */

function downloadErrorStatus(error) {
  switch (error?.code) {
    case 'UNKNOWN_MODEL':
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

export function createModelRunnerController({ modelRunnerService, brainProviderModel, agentWorker }) {
  const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  const refreshBrain = (userId) => {
    try { agentWorker?.refreshBrainForUser?.(userId); } catch { /* best effort */ }
  };

  /** SSE helper shared by both progress streams. */
  const progressStream = (subscribe, describe) =>
    asyncHandler(async (request, response) => {
      response.status(200).set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      response.flushHeaders?.();
      const send = (state) => {
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

    /** GET /api/v1/model-runner/device */
    device: asyncHandler(async (request, response) => {
      response.json({ device: await modelRunnerService.getDevice() });
    }),

    /** POST /api/v1/model-runner/engine — one-time llama-server download.
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
      (send) => modelRunnerService.engine.onProgress(send),
      () => modelRunnerService.engine.describeDownload()
    ),

    /** POST /api/v1/model-runner/download { modelId } */
    download: asyncHandler(async (request, response) => {
      const { modelId } = request.body || {};
      try {
        const result = await modelRunnerService.startDownload(modelId);
        response.status(202).json(result);
      } catch (error) {
        response.status(downloadErrorStatus(error)).json({
          error: { code: error.code || 'DOWNLOAD_FAILED', message: error.message }
        });
      }
    }),

    /** POST /api/v1/model-runner/download/cancel */
    cancelDownload: asyncHandler(async (request, response) => {
      response.json(modelRunnerService.cancelDownload());
    }),

    /** GET /api/v1/model-runner/download/stream — SSE */
    downloadStream: progressStream(
      (send) => modelRunnerService.onDownloadProgress(send),
      () => modelRunnerService.describeDownload()
    ),

    /** DELETE /api/v1/model-runner/models/:modelId */
    deleteModel: asyncHandler(async (request, response) => {
      try {
        const result = await modelRunnerService.deleteModel(request.params.modelId);
        response.json(result);
      } catch (error) {
        response.status(downloadErrorStatus(error)).json({
          error: { code: error.code || 'DELETE_FAILED', message: error.message }
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
          error: { code: error.code || 'CUSTOM_ADD_FAILED', message: error.message }
        });
      }
    }),

    /**
     * POST /api/v1/model-runner/run { modelId }
     * Starts the model on localhost AND switches the caller's brain to it —
     * Hunt + Infinity AI immediately use the running model.
     */
    run: asyncHandler(async (request, response) => {
      const { modelId } = request.body || {};
      try {
        const result = await modelRunnerService.run(modelId);
        const userId = request.user?.id || null;
        if (brainProviderModel && userId) {
          await brainProviderModel.setSelection(userId, { provider: 'local', modelId });
          refreshBrain(userId);
        }
        response.json({ ...result, brainSwitched: Boolean(userId) });
      } catch (error) {
        response.status(downloadErrorStatus(error)).json({
          error: { code: error.code || 'RUN_FAILED', message: error.message }
        });
      }
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
    })
  };
}
