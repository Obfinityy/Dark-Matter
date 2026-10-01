import { now } from '../core/utils.js';
import { BRAIN_PROVIDERS } from '../agent/providers/brainProviderFactory.js';

/**
 * BrainProviderModel — persists which provider serves each user's autonomous
 * agent inference (issue #3), and WHERE that provider lives.
 *
 * Multi-tenancy: one document per user —
 *   { userId, provider: 'phone'|'ollama'|'local'|'gradio', modelId, ollamaTag, endpointUrl, updatedAt }
 *
 * `endpointUrl` is how a hosted backend reaches the user's OWN machine: with
 * "Run Locally" the model runs on the user's hardware via Ollama, and the
 * backend is pure orchestration. Each user's brain is their own endpoint —
 * there is deliberately no shared inference bottleneck to throttle.
 *
 * For 'gradio', endpointUrl is the public Gradio share URL of a ChatInterface
 * (e.g. https://xxxx.gradio.live) running on Kaggle/Colab — the remote GPU
 * becomes the agent's brain. No download, no local RAM needed.
 *
 * A user with no selection gets the phone default.
 */

const DEFAULT_SELECTION = Object.freeze({
  provider: 'phone',
  modelId: null,
  ollamaTag: null,
  endpointUrl: null,
  updatedAt: null
});

/**
 * Validate a user-supplied Ollama endpoint URL. Only http(s), no embedded
 * credentials, no query/fragment — a raw credential in a stored URL would
 * leak into logs and health checks.
 */
export function validateEndpointUrl(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw new Error('endpointUrl must be a valid http(s) URL, e.g. http://192.168.1.10:11434');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('endpointUrl must use http or https');
  }
  if (url.username || url.password) {
    throw new Error('endpointUrl must not embed credentials');
  }
  if (!url.hostname) {
    throw new Error('endpointUrl must include a host');
  }
  return url.toString().replace(/\/$/, '');
}

export class BrainProviderModel {
  constructor(database) {
    this.collection = database.collection('brain_provider');
  }

  async getSelection(userId) {
    const doc = userId ? await this.collection.findOne({ userId }) : null;
    if (!doc) return { ...DEFAULT_SELECTION };
    return {
      provider: BRAIN_PROVIDERS.includes(doc.provider) ? doc.provider : 'phone',
      modelId: doc.modelId || null,
      ollamaTag: doc.ollamaTag || null,
      endpointUrl: doc.endpointUrl || null,
      updatedAt: doc.updatedAt || null
    };
  }

  async setSelection(userId, { provider, modelId = null, ollamaTag = null, endpointUrl = null }) {
    if (!userId) throw new Error('setSelection requires a userId');
    if (!BRAIN_PROVIDERS.includes(provider)) {
      throw new Error(`Unknown brain provider "${provider}"`);
    }
    const record = {
      userId,
      provider,
      modelId: provider === 'ollama' || provider === 'local' ? modelId : null,
      ollamaTag: provider === 'ollama' ? ollamaTag : null,
      endpointUrl: provider === 'ollama' || provider === 'gradio' ? validateEndpointUrl(endpointUrl) : null,
      updatedAt: now()
    };
    await this.collection.updateOne({ userId }, { $set: record }, { upsert: true });
    return this.getSelection(userId);
  }
}
