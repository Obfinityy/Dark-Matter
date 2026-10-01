/**
 * brainProviderFactory.js — builds the inference backend for a user's agent brain.
 *
 * Two providers, no cloud, no shared bottleneck:
 *   'phone'  → the phone-hosted OpenAI-compatible model (PhoneLocalProvider).
 *   'ollama' → a local uncensored model on the USER'S OWN machine via Ollama's
 *               OpenAI-compatible API (/v1). Each user's brain is their own
 *               endpoint — there is deliberately no shared inference queue to
 *               throttle, so any number of users can hunt at once.
 *
 * The factory returns a provider implementing the AutonomousBrain contract:
 *   { enabled, healthCheck(), generate(messages, options),
 *     generateStructured(messages, schema, options) }
 */

import { PhoneLocalProvider } from './phoneLocalProvider.js';
import { OllamaProvider } from './ollamaProvider.js';

export const BRAIN_PROVIDERS = ['phone', 'ollama'];

export function createBrainProvider(provider, appConfig = {}, { model = null, baseUrl = null } = {}) {
  if (provider === 'ollama') {
    return new OllamaProvider({
      baseUrl: baseUrl || appConfig?.ollama?.baseUrl || 'http://127.0.0.1:11434/v1',
      model: model || appConfig?.ollama?.model || 'huihui_ai/qwen3-abliterated:30b'
    });
  }
  if (provider === 'phone' || !provider) {
    return new PhoneLocalProvider(appConfig);
  }
  throw new Error(`Unknown brain provider "${provider}"`);
}
