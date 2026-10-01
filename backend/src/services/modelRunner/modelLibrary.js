/**
 * modelLibrary.js — curated GGUF model library for the no-Ollama local runner.
 *
 * Every entry is an UNCESORED (abliterated / dolphin) instruct model, verified
 * against the Hugging Face API (repo + exact GGUF filename). Nothing is
 * downloaded by default — the user picks a model, the backend downloads the
 * single .gguf file into the models dir, and the local llama-server runs it.
 *
 * requirements:
 *   ramGB       — minimum system RAM (GB) for the model to load comfortably
 *   vramGB      — VRAM needed for full GPU offload (0 = runs fine on CPU)
 *   gpuRequired — true only when the model is unusable without a GPU
 *
 * The device-compatibility ranking lives in deviceInfo.js; it compares these
 * numbers against the detected hardware and produces ready / tight / risky /
 * blocked verdicts with human-readable reasons.
 */

export const MODEL_LIBRARY = Object.freeze([
  {
    id: 'dolphin-llama31-8b',
    name: 'Dolphin 3.0 Llama 3.1 8B',
    params: '8B',
    quant: 'Q4_K_M',
    tier: 'lightweight',
    tierLabel: 'Lightweight',
    hfRepo: 'dphn/Dolphin3.0-Llama3.1-8B-GGUF',
    hfFile: 'Dolphin3.0-Llama3.1-8B-Q4_K_M.gguf',
    sizeGB: 4.9,
    contextWindow: 8192,
    uncensored: true,
    requirements: { ramGB: 8, vramGB: 0, gpuRequired: false },
    description:
      'Uncensored Dolphin fine-tune of Llama 3.1 8B — fast, runs on CPU, good for quick triage and chat.'
  },
  {
    id: 'qwen3-8b-abliterated',
    name: 'Qwen3 8B Abliterated',
    params: '8B',
    quant: 'Q4_K_M',
    tier: 'balanced',
    tierLabel: 'Balanced',
    hfRepo: 'bartowski/mlabonne_Qwen3-8B-abliterated-GGUF',
    hfFile: 'mlabonne_Qwen3-8B-abliterated-Q4_K_M.gguf',
    sizeGB: 4.7,
    sizeBytes: 5027784288, // exact size verified from HuggingFace download (1 Oct 2026)
    contextWindow: 32768,
    uncensored: true,
    requirements: { ramGB: 8, vramGB: 0, gpuRequired: false },
    description:
      'Uncensored (abliterated) Qwen3 8B — strong reasoning for its size, 32k context, runs on CPU.'
  },
  {
    id: 'qwen3-27b-abliterated',
    name: 'Qwen3 27B Abliterated',
    params: '27B',
    quant: 'Q4_K_M',
    tier: 'powerful',
    tierLabel: 'Powerful',
    hfRepo: 'huihui-ai/Huihui-Qwen3.8-27B-abliterated-GGUF',
    hfFile: 'Huihui-Qwen3.8-27B-abliterated-UD-DW-Q4_K_M.gguf',
    sizeGB: 16.5,
    contextWindow: 32768,
    uncensored: true,
    requirements: { ramGB: 24, vramGB: 16, gpuRequired: false },
    description:
      'Uncensored Qwen3 27B — near-frontier reasoning for agentic hunts. Needs a strong machine: 24GB+ RAM or a 16GB+ GPU.'
  }
]);

/** Lookup by id; returns null for unknown ids (never throws on user input). */
export function getLibraryEntry(modelId) {
  if (!modelId || typeof modelId !== 'string') return null;
  return MODEL_LIBRARY.find((m) => m.id === modelId) || null;
}

export function getDefaultEntry() {
  return MODEL_LIBRARY.find((m) => m.default) || MODEL_LIBRARY[0];
}

/**
 * Resolve a Hugging Face download URL.
 * Accepts either a library entry ({ hfRepo, hfFile }) or a user-supplied
 * custom model ({ repo, file }). The URL is built from validated parts only —
 * callers must sanitize repo/file with sanitizeHfPart() first.
 */
export function hfDownloadUrl(repo, file) {
  return `https://huggingface.co/${repo}/resolve/main/${file}`;
}

/**
 * Allow-list style sanitizer for Hugging Face repo/file parts coming from
 * user input. Rejects path traversal, absolute paths, and odd characters.
 * Returns the cleaned part or throws with code INVALID_MODEL_REF.
 */
export function sanitizeHfPart(part, kind) {
  if (typeof part !== 'string') {
    const error = new Error(`Invalid ${kind}: must be a string`);
    error.code = 'INVALID_MODEL_REF';
    throw error;
  }
  const cleaned = part.trim();
  if (!cleaned || cleaned.length > 200) {
    const error = new Error(`Invalid ${kind}: empty or too long`);
    error.code = 'INVALID_MODEL_REF';
    throw error;
  }
  if (cleaned.includes('..') || cleaned.startsWith('/') || cleaned.startsWith('\\')) {
    const error = new Error(`Invalid ${kind}: path traversal not allowed`);
    error.code = 'INVALID_MODEL_REF';
    throw error;
  }
  // HF repo ids: owner/name (letters, digits, -, _, .). Filenames: same plus
  // a few extras. One shared conservative pattern is fine for both.
  if (!/^[A-Za-z0-9][A-Za-z0-9._\-/]*[A-Za-z0-9._\-]$/.test(cleaned)) {
    const error = new Error(`Invalid ${kind}: "${cleaned}" is not a valid Hugging Face reference`);
    error.code = 'INVALID_MODEL_REF';
    throw error;
  }
  return cleaned;
}
