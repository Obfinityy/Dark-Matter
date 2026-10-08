import { asyncHandler } from '../core/utils.js';
import { MODEL_LIBRARY } from '../services/localModel/modelLibrary.js';

/**
 * Local Model Controller — REST + SSE surface of the local uncensored model
 * library (issue #3, the "Run Locally" flow).
 *
 * The plugins section drives these endpoints: library listing, Ollama status,
 * pull with live progress (SSE), remove, and brain activation. The model
 * picker in the agent UI reads status and calls activate — the selection
 * persists server-side and actually switches the inference backend.
 */
export function createLocalModelController({ localModelService, agentWorker = null }) {
  if (!localModelService) throw new Error('createLocalModelController requires localModelService');
  // When the user switches brains, the worker's cached per-user brain must be
  // dropped so the next reasoning step rebuilds it from the new selection.
  const refreshBrain = userId => {
    try {
      agentWorker?.refreshBrainForUser?.(userId);
    } catch {
      // never fail a model switch on cache bookkeeping
    }
  };

  const pullErrorStatus = error => {
    switch (error.code) {
      case 'UNKNOWN_MODEL':
        return 404;
      case 'PULL_IN_PROGRESS':
        return 409;
      case 'OLLAMA_NOT_RUNNING':
        return 503;
      case 'MODEL_NOT_INSTALLED':
        return 409;
      default:
        return 500;
    }
  };

  return {
    /** GET /api/v1/local-models/library — the curated uncensored catalog */
    library: asyncHandler(async (request, response) => {
      response.json({ models: MODEL_LIBRARY });
    }),

    /** GET /api/v1/local-models/status — catalog + installed/ready + active brain + pull */
    status: asyncHandler(async (request, response) => {
      response.json(await localModelService.getStatus(request.user?.id || null));
    }),

    /** GET /api/v1/local-models/install-guide — first-time Ollama setup help */
    installGuide: asyncHandler(async (request, response) => {
      response.json(localModelService.installGuide());
    }),

    /** POST /api/v1/local-models/pull { modelId } — start a one-time download */
    pull: asyncHandler(async (request, response) => {
      const { modelId } = request.body || {};
      try {
        const pull = await localModelService.startPull(modelId);
        response.status(202).json({ started: true, pull });
      } catch (error) {
        response.status(pullErrorStatus(error)).json({
          error: { code: error.code || 'PULL_FAILED', message: error.message },
        });
      }
    }),

    /** POST /api/v1/local-models/pull/cancel — stop tracking the download */
    cancelPull: asyncHandler(async (request, response) => {
      const cancelled = localModelService.cancelPull();
      response.json({ cancelled });
    }),

    /** GET /api/v1/local-models/pull/stream — SSE: live download progress */
    pullStream: asyncHandler(async (request, response) => {
      response.status(200).set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.flushHeaders?.();

      const send = pull => {
        response.write(
          `event: pull-progress\ndata: ${JSON.stringify(pull || { status: 'idle' })}\n\n`
        );
      };

      // Current state first, then live updates.
      send(localModelService.describePull());
      const unsubscribe = localModelService.onPullProgress(send);
      const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15_000);

      request.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    }),

    /** DELETE /api/v1/local-models/:modelId — remove a downloaded model */
    remove: asyncHandler(async (request, response) => {
      try {
        response.json(
          await localModelService.removeModel(request.user?.id || null, request.params.modelId)
        );
      } catch (error) {
        response.status(pullErrorStatus(error)).json({
          error: { code: error.code || 'REMOVE_FAILED', message: error.message },
        });
      }
    }),

    /** POST /api/v1/local-models/activate { modelId } — switch the agent's brain */
    activate: asyncHandler(async (request, response) => {
      const { modelId } = request.body || {};
      try {
        const result = await localModelService.activate(request.user?.id || null, modelId);
        refreshBrain(request.user?.id || null);
        response.json(result);
      } catch (error) {
        response.status(pullErrorStatus(error)).json({
          error: { code: error.code || 'ACTIVATE_FAILED', message: error.message },
        });
      }
    }),

    /** POST /api/v1/local-models/deactivate — brain back to the phone model */
    deactivate: asyncHandler(async (request, response) => {
      const result = await localModelService.deactivate(request.user?.id || null);
      refreshBrain(request.user?.id || null);
      response.json(result);
    }),

    /**
     * POST /api/v1/local-models/custom { tag } — add ANY model of the user's
     * choice (Ollama tag or HuggingFace reference). Validated, then pulled.
     */
    addCustom: asyncHandler(async (request, response) => {
      const { tag } = request.body || {};
      try {
        const result = await localModelService.addCustomModel(tag, {
          addedBy: request.user?.id || null,
        });
        response.status(202).json(result);
      } catch (error) {
        const status =
          error.code === 'INVALID_TAG'
            ? 400
            : error.code === 'NOT_CONFIGURED'
              ? 503
              : pullErrorStatus(error);
        response.status(status).json({
          error: { code: error.code || 'CUSTOM_ADD_FAILED', message: error.message },
        });
      }
    }),

    /** DELETE /api/v1/local-models/custom/:id — remove a user-added model */
    removeCustom: asyncHandler(async (request, response) => {
      try {
        response.json(
          await localModelService.removeCustomModel(request.user?.id || null, request.params.id)
        );
      } catch (error) {
        response.status(pullErrorStatus(error)).json({
          error: { code: error.code || 'REMOVE_FAILED', message: error.message },
        });
      }
    }),
  };
}
