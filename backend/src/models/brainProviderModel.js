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
  lastGradioUrl: null,
  updatedAt: null,
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
      // The last connected Kaggle/Colab Gradio URL survives provider switches
      // so the brain fallback chain can still reach the remote GPU.
      lastGradioUrl: doc.lastGradioUrl || doc.endpointUrl || null,
      // Per-slot brain assignments: { vision: modelId, grounding: modelId, hacker: modelId }
      // Each slot is independent — the user picks one model per slot.
      slotAssignments: doc.slotAssignments || {},
      // Per-slot source: { vision: { source: 'local'|'kaggle', modelId?, kaggleUrl?, kaggleName? }, ... }
      // A slot runs on Kaggle remote GPU or a local model — user's choice per slot.
      slotSources: doc.slotSources || {},
      updatedAt: doc.updatedAt || null,
    };
  }

  /**
   * Set the model for a brain slot ('vision' | 'grounding' | 'hacker').
   * Each slot is independent with its own alternatives.
   */
  async setSlotAssignment(userId, slot, modelId) {
    if (!userId) throw new Error('setSlotAssignment requires a userId');
    if (!['vision', 'grounding', 'hacker'].includes(slot)) {
      throw new Error(`Unknown brain slot "${slot}" — must be vision, grounding, or hacker`);
    }
    const doc = await this.collection.findOne({ userId });
    const slotAssignments = { ...(doc?.slotAssignments || {}), [slot]: modelId };
    const slotSources = { ...(doc?.slotSources || {}) };
    slotSources[slot] = { source: 'local', modelId, updatedAt: now() };
    await this.collection.updateOne(
      { userId },
      { $set: { slotAssignments, slotSources, updatedAt: now() } },
      { upsert: true }
    );
    return this.getSelection(userId);
  }

  /**
   * Connect a Kaggle/Colab Gradio link as the source for a brain slot.
   * The slot then runs on the remote GPU instead of a local model.
   */
  async setSlotKaggle(userId, slot, url, name = null) {
    if (!userId) throw new Error('setSlotKaggle requires a userId');
    if (!['vision', 'grounding', 'hacker'].includes(slot)) {
      throw new Error(`Unknown brain slot "${slot}" — must be vision, grounding, or hacker`);
    }
    const validatedUrl = validateEndpointUrl(url);
    if (!validatedUrl) throw new Error('A valid Kaggle/Gradio URL is required');
    const doc = await this.collection.findOne({ userId });
    const slotSources = { ...(doc?.slotSources || {}) };
    slotSources[slot] = {
      source: 'kaggle',
      kaggleUrl: validatedUrl,
      kaggleName: name || 'Kaggle GPU',
      updatedAt: now(),
    };
    await this.collection.updateOne(
      { userId },
      { $set: { slotSources, updatedAt: now() } },
      { upsert: true }
    );
    return this.getSelection(userId);
  }

  /**
   * Disconnect the Kaggle link for a slot — falls back to the local model assignment.
   */
  async clearSlotKaggle(userId, slot) {
    if (!userId) throw new Error('clearSlotKaggle requires a userId');
    if (!['vision', 'grounding', 'hacker'].includes(slot)) {
      throw new Error(`Unknown brain slot "${slot}" — must be vision, grounding, or hacker`);
    }
    const doc = await this.collection.findOne({ userId });
    const slotSources = { ...(doc?.slotSources || {}) };
    const prev = slotSources[slot] || {};
    slotSources[slot] = {
      source: 'local',
      modelId: prev.modelId || doc?.slotAssignments?.[slot] || null,
      updatedAt: now(),
    };
    await this.collection.updateOne(
      { userId },
      { $set: { slotSources, updatedAt: now() } },
      { upsert: true }
    );
    return this.getSelection(userId);
  }

  /**
   * Get the assigned model for a slot, or null if none assigned.
   */
  async getSlotAssignment(userId, slot) {
    const selection = await this.getSelection(userId);
    return selection.slotAssignments?.[slot] || null;
  }

  async setSelection(userId, { provider, modelId = null, ollamaTag = null, endpointUrl = null }) {
    if (!userId) throw new Error('setSelection requires a userId');
    if (!BRAIN_PROVIDERS.includes(provider)) {
      throw new Error(`Unknown brain provider "${provider}"`);
    }
    const validatedUrl =
      provider === 'ollama' || provider === 'gradio' ? validateEndpointUrl(endpointUrl) : null;
    // Preserve a previously connected Gradio URL across switches (local/API/…).
    let lastGradioUrl = null;
    try {
      const prev = await this.collection.findOne({ userId });
      lastGradioUrl = prev?.lastGradioUrl || prev?.endpointUrl || null;
    } catch {
      /* first selection — nothing to preserve */
    }
    if (provider === 'gradio' && validatedUrl) lastGradioUrl = validatedUrl;
    const record = {
      userId,
      provider,
      modelId: provider === 'ollama' || provider === 'local' ? modelId : null,
      ollamaTag: provider === 'ollama' ? ollamaTag : null,
      endpointUrl: validatedUrl,
      lastGradioUrl,
      updatedAt: now(),
    };
    await this.collection.updateOne({ userId }, { $set: record }, { upsert: true });
    return this.getSelection(userId);
  }
}
