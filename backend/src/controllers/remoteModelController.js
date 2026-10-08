/**
 * remoteModelController.js — HTTP API for the "Remote GPU" brain option.
 *
 *   GET  /api/v1/remote-model                 — current remote brain status
 *   POST /api/v1/remote-model/test {gradioUrl}— test the Gradio link (no save)
 *   POST /api/v1/remote-model/connect {gradioUrl, name?}
 *                                             — test + set as the caller's brain
 *   POST /api/v1/remote-model/disconnect      — brain back to phone default
 *
 * The user runs a model on Kaggle/Colab (e.g. Qwen3-8B on a T4), copies the
 * public Gradio share link (https://xxxx.gradio.live), pastes it in the
 * Models page and presses Connect. The agent's brain then thinks on that
 * remote GPU — no download, no local RAM needed.
 *
 * Connect also switches the CALLER's brain provider to 'gradio' so Hunt and
 * Infinity AI immediately use the remote model.
 */
import { GradioProvider, normalizeGradioUrl } from '../agent/providers/gradioProvider.js';

/**
 * Creates remote model controller.
 * @param {object} options - Named options.
 * @returns {*} Result.
 */
export function createRemoteModelController({ brainProviderModel, agentWorker }) {
  const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  const refreshBrain = userId => {
    try {
      agentWorker?.refreshBrainForUser?.(userId);
    } catch {
      /* best effort */
    }
  };

  const getUserId = req => req.user?.id || null;

  /** Describe the current remote-brain state for this user. */
  const describe = async userId => {
    const selection = brainProviderModel
      ? await brainProviderModel.getSelection(userId)
      : { provider: 'phone', endpointUrl: null };
    const connected = selection.provider === 'gradio' && !!selection.endpointUrl;
    let health = null;
    if (connected) {
      try {
        const provider = new GradioProvider({ baseUrl: selection.endpointUrl });
        health = await provider.healthCheck();
      } catch (err) {
        health = { provider: 'GradioProvider', reachable: false, reason: err?.message };
      }
    }
    return {
      connected,
      provider: selection.provider,
      gradioUrl: connected ? selection.endpointUrl : null,
      name: connected ? selection.modelId || 'Remote GPU' : null,
      health,
    };
  };

  return {
    /** GET /api/v1/remote-model */
    status: asyncHandler(async (request, response) => {
      response.json(await describe(getUserId(request)));
    }),

    /**
     * POST /api/v1/remote-model/test { gradioUrl }
     * Verifies the link reaches a Gradio ChatInterface WITHOUT saving it.
     */
    test: asyncHandler(async (request, response) => {
      const { gradioUrl } = request.body || {};
      let normalized;
      try {
        normalized = normalizeGradioUrl(gradioUrl);
      } catch (err) {
        return response.status(400).json({
          error: { code: 'INVALID_URL', message: err.message },
        });
      }
      const provider = new GradioProvider({ baseUrl: normalized });
      const health = await provider.healthCheck();
      if (!health.reachable) {
        return response.status(502).json({
          ok: false,
          health,
          error: {
            code: 'UNREACHABLE',
            message: health.reason || 'Could not reach the Gradio app',
          },
        });
      }
      // One real inference round-trip to prove the chat endpoint works.
      try {
        const probe = await provider.chatOnce('Reply with exactly: ok', { timeoutMs: 120000 });
        return response.json({
          ok: true,
          health,
          probe: String(probe).slice(0, 50),
          gradioUrl: normalized,
        });
      } catch (err) {
        return response.status(502).json({
          ok: false,
          health,
          error: { code: 'CHAT_FAILED', message: err.message },
        });
      }
    }),

    /**
     * POST /api/v1/remote-model/connect { gradioUrl, name? }
     * Tests the link, then sets it as the caller's brain provider.
     */
    connect: asyncHandler(async (request, response) => {
      const { gradioUrl, name } = request.body || {};
      const userId = getUserId(request);
      let normalized;
      try {
        normalized = normalizeGradioUrl(gradioUrl);
      } catch (err) {
        return response.status(400).json({
          error: { code: 'INVALID_URL', message: err.message },
        });
      }
      const provider = new GradioProvider({ baseUrl: normalized });
      const health = await provider.healthCheck();
      if (!health.reachable) {
        return response.status(502).json({
          error: {
            code: 'UNREACHABLE',
            message: health.reason || 'Could not reach the Gradio app',
          },
        });
      }
      if (brainProviderModel && userId) {
        await brainProviderModel.setSelection(userId, {
          provider: 'gradio',
          modelId: (name && String(name).trim()) || 'Remote GPU',
          endpointUrl: normalized,
        });
        refreshBrain(userId);
      }
      response.json({
        ok: true,
        connected: true,
        gradioUrl: normalized,
        name: (name && String(name).trim()) || 'Remote GPU',
        health,
        brainSwitched: Boolean(userId),
      });
    }),

    /**
     * POST /api/v1/remote-model/disconnect
     * Brain back to the phone default.
     */
    disconnect: asyncHandler(async (request, response) => {
      const userId = getUserId(request);
      if (brainProviderModel && userId) {
        await brainProviderModel.setSelection(userId, { provider: 'phone' });
        refreshBrain(userId);
      }
      response.json({ ok: true, connected: false });
    }),
  };
}
