/**
 * brainProviderFactory.js — builds the inference backend for a user's agent brain.
 *
 * Three providers, no cloud, no shared bottleneck:
 *   'phone'  → the phone-hosted OpenAI-compatible model (PhoneLocalProvider).
 *   'ollama' → a local uncensored model on the USER'S OWN machine via Ollama's
 *               OpenAI-compatible API (/v1). (Legacy path.)
 *   'local'  → a model RUNNING via the backend's own model-runner
 *               (LocalLlamaProvider): the user downloads a GGUF once, presses
 *               Run, and llama-server serves it on 127.0.0.1 — no Ollama,
 *               no separate install. Each user's brain is their own
 *               endpoint — there is deliberately no shared inference queue to
 *               throttle, so any number of users can hunt at once.
 *
 * The factory returns a provider implementing the AutonomousBrain contract:
 *   { enabled, healthCheck(), generate(messages, options),
 *     generateStructured(messages, schema, options) }
 */

import { PhoneLocalProvider } from './phoneLocalProvider.js';
import { OllamaProvider } from './ollamaProvider.js';
import { LocalLlamaProvider } from './localLlamaProvider.js';
import { GradioProvider } from './gradioProvider.js';

export const BRAIN_PROVIDERS = ['phone', 'ollama', 'local', 'gradio'];

export function createBrainProvider(
  provider,
  appConfig = {},
  { model = null, baseUrl = null, runner = null, slot = null } = {}
) {
  if (provider === 'local') {
    return new LocalLlamaProvider({ runner, slot });
  }
  if (provider === 'ollama') {
    return new OllamaProvider({
      baseUrl: baseUrl || appConfig?.ollama?.baseUrl || 'http://127.0.0.1:11434/v1',
      model: model || appConfig?.ollama?.model || 'huihui_ai/qwen3-abliterated:30b',
    });
  }
  if (provider === 'gradio') {
    return new GradioProvider({ baseUrl, model });
  }
  if (provider === 'phone' || !provider) {
    return new PhoneLocalProvider(appConfig);
  }
  throw new Error(`Unknown brain provider "${provider}"`);
}

/**
 * Which brain slots each feature uses:
 * - hunt: all three (vision + grounding + hacker)
 * - chat: vision only
 * - control: vision + grounding
 */
export const FEATURE_SLOTS = {
  hunt: ['vision', 'grounding', 'hacker'],
  chat: ['vision'],
  control: ['vision', 'grounding'],
};

/**
 * Resolve the inference provider for a brain slot.
 *
 * Each slot has a source: 'local' (llama-server on the slot's own port) or
 * 'kaggle' (the slot's Gradio link). Falls back to the legacy single-brain
 * selection when the slot has no explicit source.
 *
 * @param {string} slot — 'vision' | 'grounding' | 'hacker'
 * @param {object} selection — brainProviderModel.getSelection(userId)
 * @param {object} deps — { appConfig, runner }
 */
export function createSlotBrainProvider(slot, selection, { appConfig = {}, runner = null } = {}) {
  const slotSource = selection?.slotSources?.[slot];
  // Kaggle source for this slot → Gradio provider on the slot's link.
  if (slotSource?.source === 'kaggle' && slotSource?.kaggleUrl) {
    return new GradioProvider({
      baseUrl: slotSource.kaggleUrl,
      model: slotSource.kaggleName || slot,
    });
  }
  // Local source → slot-aware local provider (slot's own port).
  const modelId = slotSource?.modelId || selection?.slotAssignments?.[slot] || null;
  if (runner && (slotSource?.source === 'local' || modelId)) {
    return new LocalLlamaProvider({ runner, slot });
  }
  // Fallback: legacy single-brain selection.
  return createBrainProvider(selection?.provider || 'phone', appConfig, {
    model: selection?.modelId,
    baseUrl: selection?.endpointUrl,
    runner,
  });
}

/**
 * Resolve all brain providers for a feature (hunt | chat | control).
 * Returns { vision?, grounding?, hacker? } — only the slots the feature uses.
 */
export function createFeatureBrains(feature, selection, deps = {}) {
  const slots = FEATURE_SLOTS[feature] || FEATURE_SLOTS.hunt;
  const brains = {};
  for (const slot of slots) {
    brains[slot] = createSlotBrainProvider(slot, selection, deps);
  }
  return brains;
}
