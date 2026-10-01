/**
 * Model Library — the curated, selectable library of local uncensored AI
 * models that can serve as the autonomous bug bounty agent's brain.
 *
 * Issue #3: every entry is UNCENSORED (abliterated / dolphin fine-tunes) so
 * the model does not refuse security-research tasks, and every entry is
 * served locally through Ollama — one-time download, then fully offline,
 * private, no API cost.
 *
 * Sorted small → large. Exactly one entry is the default recommendation.
 */

export const MODEL_LIBRARY = Object.freeze([
  {
    id: 'dolphin-llama3-8b',
    contextWindow: 8192,
    ollamaTag: 'dolphin-llama3:8b',
    name: 'Dolphin Llama 3 8B',
    tier: 'lightweight',
    tierLabel: 'Lightweight',
    params: '8B',
    downloadGB: 4.7,
    vramGB: 6,
    description: 'Uncensored Llama 3 8B fine-tune with function calling — fast on mid-range GPUs, good for quick triage.',
    uncensored: true,
    default: false
  },
  {
    id: 'qwen3-abliterated-30b',
    contextWindow: 32768,
    ollamaTag: 'huihui_ai/qwen3-abliterated:30b',
    name: 'Qwen3 30B Abliterated',
    tier: 'recommended',
    tierLabel: 'Recommended',
    params: '30B-A3B MoE',
    downloadGB: 19,
    vramGB: 24,
    description: 'Uncensored (abliterated) Qwen3 30B MoE — top open-weight agentic reasoning; will not refuse security-research tasks. Best for RTX 4090-class GPUs.',
    uncensored: true,
    default: true
  },
  {
    id: 'dolphin-mixtral-8x7b',
    contextWindow: 32768,
    ollamaTag: 'dolphin-mixtral:8x7b',
    name: 'Dolphin Mixtral 8x7B',
    tier: 'balanced',
    tierLabel: 'Balanced',
    params: '8x7B MoE',
    downloadGB: 26,
    vramGB: 28,
    description: 'Uncensored Mixtral 8x7B mixture-of-experts — strong reasoning per watt; a balanced step up for larger rigs.',
    uncensored: true,
    default: false
  },
  {
    id: 'dolphin-llama3-70b',
    contextWindow: 8192,
    ollamaTag: 'dolphin-llama3:70b',
    name: 'Dolphin Llama 3 70B',
    tier: 'maximum',
    tierLabel: 'Maximum intelligence',
    params: '70B',
    downloadGB: 40,
    vramGB: 48,
    description: 'Uncensored Llama 3 70B Dolphin — maximum intelligence for heavy rigs with 48GB+ VRAM.',
    uncensored: true,
    default: false
  }
]);

export const DEFAULT_MODEL_ID = 'qwen3-abliterated-30b';

export function getLibraryEntry(modelId) {
  return MODEL_LIBRARY.find((entry) => entry.id === modelId) || null;
}

export function getDefaultEntry() {
  return MODEL_LIBRARY.find((entry) => entry.default) || MODEL_LIBRARY[0];
}

/** Invariants the test suite enforces: all uncensored, small→large, one default. */
export function validateLibrary() {
  const errors = [];
  if (!MODEL_LIBRARY.length) errors.push('library is empty');
  const defaults = MODEL_LIBRARY.filter((entry) => entry.default);
  if (defaults.length !== 1) errors.push(`expected exactly one default model, found ${defaults.length}`);
  for (const entry of MODEL_LIBRARY) {
    if (!entry.uncensored) errors.push(`${entry.id} is not marked uncensored`);
    for (const field of ['id', 'ollamaTag', 'name', 'tier', 'description', 'contextWindow']) {
      if (!entry[field]) errors.push(`${entry.id} is missing ${field}`);
    }
  }
  const sizes = MODEL_LIBRARY.map((entry) => entry.downloadGB);
  const sorted = [...sizes].sort((a, b) => a - b);
  if (JSON.stringify(sizes) !== JSON.stringify(sorted)) errors.push('library is not sorted small → large');
  return { valid: errors.length === 0, errors };
}
