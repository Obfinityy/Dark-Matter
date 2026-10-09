/**
 * modelLibrary.js — curated GGUF model library for the no-Ollama local runner.
 *
 * EVERY entry is an UNCENSORED instruct model (abliterated / Dolphin):
 * refusals were surgically removed from the weights, so the agent's brain
 * never stonewalls a legitimate security-testing question with a lecture.
 *
 * Repos + exact filenames verified live against the Hugging Face API on
 * 2026-10-02 (HEAD on every resolve URL; non-gated repos only — a 401-gated
 * repo was replaced, split-file quants removed since the downloader is
 * single-file). Single source of truth: the `siblings` arrays from
 * https://huggingface.co/api/models/<repo> — filenames are copied verbatim.
 *   - bartowski/*-GGUF tables (e.g. huihui-ai_Qwen3-14B-abliterated-Q4_K_M.gguf)
 *   - mradermacher/Llama-3.1-70B-Instruct-abliterated-GGUF quant table
 *   - Sowkwndms/Huihui-Qwen3-30B-A3B-Instruct-2507-abliterated-Q4_K_M-GGUF card
 *   - bartowski/huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-GGUF
 *   - dphn/Dolphin3.0-Llama3.1-8B-GGUF (in use since the Singularity QA)
 *   - failspy/Meta-Llama-3-70B-Instruct-abliterated-v3.5-GGUF (q4 legacy file)
 *
 * requirements:
 *   ramGB       — minimum system RAM (GB) for the model to load comfortably
 *   vramGB      — VRAM needed for full GPU offload (0 = runs fine on CPU)
 *   gpuRequired — true only when the model is unusable without a GPU
 *
 * The device-compatibility ranking lives in deviceInfo.js; it compares these
 * numbers against the detected hardware and produces ready / tight / risky /
 * blocked verdicts with human-readable reasons. The Models page ALSO ranks
 * with the browser-detected specs (see frontend/src/services/deviceDetect.js)
 * — browser detection is the source of truth for what fits YOUR machine.
 */

export const MODEL_LIBRARY = Object.freeze([
  // ── 8B · Lightweight ──────────────────────────────────────────────
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
      'Uncensored Dolphin fine-tune of Llama 3.1 8B — fast, runs on CPU, good for quick triage and chat.',
  },
  // ── 14B · Balanced ─────────────────────────────────────────────────
  {
    id: 'qwen3-14b-abliterated',
    name: 'Qwen3 14B Abliterated',
    params: '14B',
    quant: 'Q4_K_M',
    tier: 'balanced',
    tierLabel: 'Balanced',
    hfRepo: 'bartowski/huihui-ai_Qwen3-14B-abliterated-GGUF',
    hfFile: 'huihui-ai_Qwen3-14B-abliterated-Q4_K_M.gguf',
    sizeGB: 9.0,
    quants: {
      Q4_K_M: { file: 'huihui-ai_Qwen3-14B-abliterated-Q4_K_M.gguf', sizeGB: 9.0 },
      Q5_K_M: { file: 'huihui-ai_Qwen3-14B-abliterated-Q5_K_M.gguf', sizeGB: 10.51 },
      Q8_0: { file: 'huihui-ai_Qwen3-14B-abliterated-Q8_0.gguf', sizeGB: 15.7 },
    },
    contextWindow: 32768,
    uncensored: true,
    requirements: { ramGB: 12, vramGB: 0, gpuRequired: false },
    description:
      'Uncensored Qwen3 14B — the sweet spot: noticeably smarter than 8B, still happy on a 16GB laptop CPU.',
  },

  // ── 24B · Balanced ─────────────────────────────────────────────────
  {
    id: 'dolphin-mistral-24b-venice',
    name: 'Dolphin Mistral 24B Venice',
    params: '24B',
    quant: 'Q4_K_M',
    tier: 'balanced',
    tierLabel: 'Balanced',
    hfRepo: 'bartowski/huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-GGUF',
    hfFile: 'huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-Q4_K_M.gguf',
    sizeGB: 14.5,
    contextWindow: 32768,
    uncensored: true,
    requirements: { ramGB: 20, vramGB: 12, gpuRequired: false },
    description:
      'Uncensored Dolphin on Mistral Small 24B — excellent instruction following, the Venice uncensored edition.',
  },
  {
    id: 'dolphin3-r1-mistral-24b',
    name: 'Dolphin 3.0 R1 Mistral 24B',
    params: '24B',
    quant: 'Q4_K_M',
    tier: 'balanced',
    tierLabel: 'Balanced',
    hfRepo: 'bartowski/cognitivecomputations_Dolphin3.0-R1-Mistral-24B-GGUF',
    hfFile: 'cognitivecomputations_Dolphin3.0-R1-Mistral-24B-Q4_K_M.gguf',
    sizeGB: 14.9,
    contextWindow: 32768,
    uncensored: true,
    requirements: { ramGB: 20, vramGB: 12, gpuRequired: false },
    description:
      'Uncensored Dolphin 3.0 reasoning model on Mistral 24B — first-principles analysis, great for hunt planning.',
  },
  {
    id: 'mistral-small-24b-abliterated',
    name: 'Mistral Small 24B Abliterated',
    params: '24B',
    quant: 'Q4_K_M',
    tier: 'balanced',
    tierLabel: 'Balanced',
    hfRepo: 'bartowski/huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-GGUF',
    hfFile: 'huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-Q4_K_M.gguf',
    sizeGB: 14.5,
    contextWindow: 32768,
    uncensored: true,
    requirements: { ramGB: 20, vramGB: 12, gpuRequired: false },
    description:
      'Uncensored (abliterated) Mistral Small 24B 2501 — crisp instruction following with refusals removed.',
  },

  // ── 27B–32B · Powerful ─────────────────────────────────────────────
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
      'Uncensored Qwen3 27B — near-frontier reasoning for agentic hunts. Needs a strong machine: 24GB+ RAM or a 16GB+ GPU.',
  },
  {
    id: 'qwen3-30b-a3b-abliterated',
    name: 'Qwen3 30B A3B Abliterated',
    params: '30B',
    quant: 'Q4_K_M',
    tier: 'powerful',
    tierLabel: 'Powerful',
    hfRepo: 'Sowkwndms/Huihui-Qwen3-30B-A3B-Instruct-2507-abliterated-Q4_K_M-GGUF',
    hfFile: 'huihui-qwen3-30b-a3b-instruct-2507-abliterated-q4_k_m.gguf',
    sizeGB: 18.5,
    contextWindow: 32768,
    uncensored: true,
    requirements: { ramGB: 24, vramGB: 16, gpuRequired: false },
    description:
      'Uncensored Qwen3 30B mixture-of-experts (only 3B active per token) — 30B smarts at 8B speed.',
  },
  {
    id: 'deepseek-r1-distill-qwen-32b',
    name: 'DeepSeek R1 Distill Qwen 32B',
    params: '32B',
    quant: 'Q4_K_M',
    tier: 'powerful',
    tierLabel: 'Powerful',
    hfRepo: 'bartowski/DeepSeek-R1-Distill-Qwen-32B-abliterated-GGUF',
    hfFile: 'DeepSeek-R1-Distill-Qwen-32B-abliterated-Q4_K_M.gguf',
    sizeGB: 19.5,
    contextWindow: 32768,
    uncensored: true,
    requirements: { ramGB: 32, vramGB: 20, gpuRequired: false },
    description:
      'Uncensored DeepSeek-R1 reasoning distilled into Qwen 32B — chain-of-thought depth for hard targets.',
  },

  // ── 70B · Frontier ─────────────────────────────────────────────────
  {
    id: 'llama33-70b-ablated',
    name: 'Llama 3.3 70B Ablated',
    params: '70B',
    quant: 'Q4_K_M',
    tier: 'frontier',
    tierLabel: 'Frontier',
    hfRepo: 'bartowski/Llama-3.3-70B-Instruct-ablated-GGUF',
    hfFile: 'Llama-3.3-70B-Instruct-ablated-Q4_K_M.gguf',
    sizeGB: 42.5,
    // NOTE: Q5_K_M / Q8_0 exist here only as 2-part splits — the downloader
    // is single-file, so only Q4_K_M is offered.
    contextWindow: 131072,
    uncensored: true,
    requirements: { ramGB: 64, vramGB: 40, gpuRequired: false },
    description:
      'Uncensored Llama 3.3 70B — flagship-class reasoning, 128k context. For workstations and big GPUs.',
  },
  {
    id: 'llama31-nemotron-70b',
    name: 'Llama 3.1 Nemotron 70B',
    params: '70B',
    quant: 'Q4_K_M',
    tier: 'frontier',
    tierLabel: 'Frontier',
    hfRepo: 'bartowski/Llama-3.1-Nemotron-70B-Instruct-HF-abliterated-GGUF',
    hfFile: 'Llama-3.1-Nemotron-70B-Instruct-HF-abliterated-Q4_K_M.gguf',
    sizeGB: 42.5,
    // NOTE: Q5_K_M / Q8_0 exist here only as 2-part splits — the downloader
    // is single-file, so only Q4_K_M is offered.
    contextWindow: 131072,
    uncensored: true,
    requirements: { ramGB: 64, vramGB: 40, gpuRequired: false },
    description:
      "Uncensored NVIDIA Nemotron-tuned Llama 3.1 70B — NVIDIA's alignment-tuned 70B with refusals removed.",
  },
  {
    id: 'llama31-70b-abliterated',
    name: 'Llama 3.1 70B Abliterated',
    params: '70B',
    quant: 'Q4_K_M',
    tier: 'frontier',
    tierLabel: 'Frontier',
    hfRepo: 'mradermacher/Llama-3.1-70B-Instruct-abliterated-GGUF',
    hfFile: 'Llama-3.1-70B-Instruct-abliterated.Q4_K_M.gguf',
    sizeGB: 42.6,
    quants: {
      Q4_K_M: { file: 'Llama-3.1-70B-Instruct-abliterated.Q4_K_M.gguf', sizeGB: 42.6 },
      Q5_K_M: { file: 'Llama-3.1-70B-Instruct-abliterated.Q5_K_M.gguf', sizeGB: 50.0 },
      // NOTE: no Q8_0 single file in this repo — Q5_K_M is the largest offered.
    },
    contextWindow: 131072,
    uncensored: true,
    requirements: { ramGB: 64, vramGB: 40, gpuRequired: false },
    description:
      'Uncensored Llama 3.1 70B (static quant) — the classic open 70B workhorse, refusal-free.',
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill Llama 70B',
    params: '70B',
    quant: 'Q4_K_M',
    tier: 'frontier',
    tierLabel: 'Frontier',
    hfRepo: 'bartowski/huihui-ai_DeepSeek-R1-Distill-Llama-70B-abliterated-GGUF',
    hfFile: 'huihui-ai_DeepSeek-R1-Distill-Llama-70B-abliterated-Q4_K_M.gguf',
    sizeGB: 42.5,
    quants: {
      // NOTE: only single-file quants — Q8_0 exists here only as 2 split
      // parts, which the downloader does not support.
      Q4_K_M: {
        file: 'huihui-ai_DeepSeek-R1-Distill-Llama-70B-abliterated-Q4_K_M.gguf',
        sizeGB: 42.52,
      },
      Q5_K_S: {
        file: 'huihui-ai_DeepSeek-R1-Distill-Llama-70B-abliterated-Q5_K_S.gguf',
        sizeGB: 46.6,
      },
    },
    contextWindow: 32768,
    uncensored: true,
    requirements: { ramGB: 64, vramGB: 40, gpuRequired: false },
    description:
      'Uncensored DeepSeek-R1 reasoning distilled into Llama 70B — the deepest thinker in the library.',
  },
  {
    id: 'llama3-70b-abliterated-v35',
    name: 'Llama 3 70B Abliterated v3.5',
    params: '70B',
    quant: 'Q4_K_M',
    tier: 'frontier',
    tierLabel: 'Frontier',
    hfRepo: 'failspy/Meta-Llama-3-70B-Instruct-abliterated-v3.5-GGUF',
    // NOTE: this repo ships legacy quant files (no Q4_K_M) — q4 is the
    // single-file ~40 GB quant; q6/q8 exist only as splits.
    hfFile: 'Meta-Llama-3-70B-Instruct-abliterated-v3.5_q4.gguf',
    sizeGB: 40.0,
    contextWindow: 8192,
    uncensored: true,
    requirements: { ramGB: 64, vramGB: 40, gpuRequired: false },
    description:
      'failspy v3.5 abliteration of Llama 3 70B — single-layer orthogonalization, minimal behavior change beyond refusals.',
  },
  // ── Infinity Agent · Grounding (MANDATORY for Control mode) ──────────
  // UI-TARS locates buttons, search bars, and UI elements on screen and
  // returns x,y coordinates. Small enough to run on CPU — even on phones.
  // Downloaded once from Models → Plugins, then Control mode just works.
  // BRAIN SLOT: 'grounding' — local coordinates provider for Hunt + Control.
  {
    id: 'uitars-grounding-7b',
    name: 'UI-TARS 1.5 7B (Grounding)',
    params: '7B',
    quant: 'Q4_K_M',
    tier: 'plugin',
    tierLabel: 'Plugin · Control Mode',
    brainSlot: 'grounding',
    brainSlotLabel: 'Grounding (Coordinates)',
    hfRepo: 'Mungert/UI-TARS-1.5-7B-GGUF',
    hfFile: 'UI-TARS-1.5-7B-q4_k_m.gguf',
    // Vision projector — required for the runner to accept screenshots.
    // Verified against the Hugging Face API (2026-10-08).
    hfMmproj: 'UI-TARS-1.5-7B-f16.mmproj',
    sizeGB: 4.4,
    contextWindow: 4096,
    uncensored: true,
    mandatory: true,
    mandatoryFor: 'control',
    requirements: { ramGB: 8, vramGB: 0, gpuRequired: false },
    description:
      'Screen grounding for Infinity Agent — finds UI elements and returns coordinates. Tiny, runs on CPU/phone. Required for Control mode.',
  },
  {
    id: 'os-atlas-7b',
    name: 'OS-Atlas 7B (Grounding)',
    params: '7B',
    quant: 'Q4_K_M',
    tier: 'plugin',
    tierLabel: 'Plugin · Control Mode',
    brainSlot: 'grounding',
    brainSlotLabel: 'Grounding (Coordinates)',
    hfRepo: 'mradermacher/OS-Atlas-Base-7B-GGUF',
    hfFile: 'OS-Atlas-Base-7B.Q4_K_M.gguf',
    // Vision projector — required for the runner to accept screenshots.
    // Verified against the Hugging Face API (2026-10-08).
    hfMmproj: 'OS-Atlas-Base-7B.mmproj-fp16.gguf',
    sizeGB: 4.5,
    contextWindow: 4096,
    uncensored: true,
    requirements: { ramGB: 8, vramGB: 0, gpuRequired: false },
    description:
      'Alternative screen grounding model — locates buttons, icons, and text fields with x,y coordinates. CPU-friendly.',
  },
  // ── Infinity Agent · Vision brains (uncensored) ────────────────────────
  // Vision models SEE screenshots. Run locally via llama.cpp or connect
  // the same weights on Kaggle — your choice, same brain either way.
  // BRAIN SLOT: 'vision' — the main reasoning brain (Kaggle remote or local).
  // NOTE: repos/files verified live against the Hugging Face API (2026-10-03) —
  // all ungated, filenames copied verbatim (HF URLs are case-sensitive).
  {
    id: 'qwen25-vl-7b-abliterated',
    name: 'Qwen2.5-VL 7B (Abliterated)',
    params: '7B',
    quant: 'Q4_K_M',
    tier: 'vision',
    tierLabel: 'Vision',
    brainSlot: 'vision',
    brainSlotLabel: 'Vision Brain',
    hfRepo: 'mradermacher/Qwen2.5-VL-7B-Instruct-abliterated-GGUF',
    hfFile: 'Qwen2.5-VL-7B-Instruct-abliterated.Q4_K_M.gguf',
    // Vision projector: WITHOUT this file the runner loads the model text-only
    // and screenshots are invisible to the brain. Downloaded alongside hfFile
    // and passed to the runner as --mmproj. Filename verified against the
    // Hugging Face API (2026-10-08) — case-sensitive, copied verbatim.
    hfMmproj: 'Qwen2.5-VL-7B-Instruct-abliterated.mmproj-Q8_0.gguf',
    sizeGB: 4.9,
    contextWindow: 8192,
    uncensored: true,
    vision: true,
    requirements: { ramGB: 8, vramGB: 0, gpuRequired: false },
    description:
      'Uncensored vision brain — sees screenshots and reasons about them. Runs on CPU, or the same model on Kaggle for GPU speed.',
  },
  {
    id: 'qwen25-vl-7b',
    name: 'Qwen2.5-VL 7B',
    params: '7B',
    quant: 'Q4_K_M',
    tier: 'vision',
    tierLabel: 'Vision',
    brainSlot: 'vision',
    brainSlotLabel: 'Vision Brain',
    hfRepo: 'unsloth/Qwen2.5-VL-7B-Instruct-GGUF',
    hfFile: 'Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf',
    sizeGB: 4.9,
    contextWindow: 8192,
    uncensored: false,
    vision: true,
    requirements: { ramGB: 8, vramGB: 0, gpuRequired: false },
    description: 'Standard Qwen2.5-VL vision model — solid screenshot understanding, ungated repo.',
  },
  {
    id: 'minicpm-v-26-8b',
    name: 'MiniCPM-V 2.6 8B',
    params: '8B',
    quant: 'Q4_K_M',
    tier: 'vision',
    tierLabel: 'Vision',
    brainSlot: 'vision',
    brainSlotLabel: 'Vision Brain',
    hfRepo: 'lmstudio-community/MiniCPM-V-2_6-GGUF',
    hfFile: 'MiniCPM-V-2_6-Q4_K_M.gguf',
    sizeGB: 5.2,
    contextWindow: 8192,
    uncensored: true,
    vision: true,
    requirements: { ramGB: 8, vramGB: 0, gpuRequired: false },
    description:
      'Compact vision-language model — strong OCR and UI element reading, great for screen-heavy tasks.',
  },
  // ── Hacking brains (uncensored, local) ────────────────────────────────
  // The hacking brain strategizes attacks: what to test, which payloads,
  // how to chain vulnerabilities. Uncensored Qwen/Gemma-class models.
  // BRAIN SLOT: 'hacker' — used ONLY by Hunt mode for security strategy.
  // NOTE: repos/files verified live against the Hugging Face API (2026-10-03).
  {
    id: 'qwen3-8b-abliterated',
    name: 'Qwen3 8B (Abliterated)',
    params: '8B',
    quant: 'Q4_K_M',
    tier: 'hacker',
    tierLabel: 'Hacking Brain',
    brainSlot: 'hacker',
    brainSlotLabel: 'Hacking Brain',
    hfRepo: 'bartowski/mlabonne_Qwen3-8B-abliterated-GGUF',
    hfFile: 'mlabonne_Qwen3-8B-abliterated-Q4_K_M.gguf',
    sizeGB: 4.7,
    contextWindow: 32768,
    uncensored: true,
    requirements: { ramGB: 8, vramGB: 0, gpuRequired: false },
    description:
      'Uncensored hacking strategist — plans attacks, chooses payloads, chains vulnerabilities. Used only by Hunt mode.',
  },
  {
    id: 'gemma3-12b-abliterated',
    name: 'Gemma3 12B (Abliterated)',
    params: '12B',
    quant: 'Q4_K_M',
    tier: 'hacker',
    tierLabel: 'Hacking Brain',
    brainSlot: 'hacker',
    brainSlotLabel: 'Hacking Brain',
    hfRepo: 'mlabonne/gemma-3-12b-it-abliterated-GGUF',
    hfFile: 'gemma-3-12b-it-abliterated.q4_k_m.gguf',
    sizeGB: 7.3,
    contextWindow: 8192,
    uncensored: true,
    requirements: { ramGB: 12, vramGB: 0, gpuRequired: false },
    description:
      'Larger uncensored hacking brain — deeper strategy for complex targets. Used only by Hunt mode.',
  },
  {
    id: 'dolphin-mistral-24b-hacker',
    name: 'Dolphin Mistral 24B (Hacker)',
    params: '24B',
    quant: 'Q4_K_M',
    tier: 'hacker',
    tierLabel: 'Hacking Brain',
    brainSlot: 'hacker',
    brainSlotLabel: 'Hacking Brain',
    hfRepo: 'bartowski/huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-GGUF',
    hfFile: 'huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-Q4_K_M.gguf',
    sizeGB: 14.5,
    contextWindow: 32768,
    uncensored: true,
    requirements: { ramGB: 20, vramGB: 12, gpuRequired: false },
    description:
      'Heavy-duty uncensored hacking brain — 24B Venice edition for the hardest targets. Used only by Hunt mode.',
  },
]);

/** Lookup by id; returns null for unknown ids (never throws on user input). */
export function getLibraryEntry(modelId) {
  if (!modelId || typeof modelId !== 'string') return null;
  return MODEL_LIBRARY.find(m => m.id === modelId) || null;
}

/**
 * Returns default entry.
 * @returns {*} Result.
 */
export function getDefaultEntry() {
  return MODEL_LIBRARY.find(m => m.default) || MODEL_LIBRARY[0];
}

/**
 * Get all models for a brain slot: 'vision' | 'grounding' | 'hacker'.
 * Each slot has alternatives — the user picks one per slot.
 */
export function getModelsBySlot(slot) {
  if (!slot || typeof slot !== 'string') return [];
  return MODEL_LIBRARY.filter(m => m.brainSlot === slot);
}

/**
 * The three brain slots and which features use them.
 * - vision: Hunt + Infinity Chat + Control (Kaggle remote or local)
 * - grounding: Hunt + Control (local coordinates, e.g. UI-TARS)
 * - hacker: Hunt only (local uncensored strategy brain)
 */

/**
 * One-click defaults: the model each brain slot downloads + runs when the
 * user presses the slot's single "Download & Run" button. Chosen for a
 * typical machine (7–8B, uncensored where the role needs it):
 * - vision: Qwen2.5-VL 7B abliterated (sees images, uncensored)
 * - grounding: OS-Atlas 7B (purpose-built UI coordinate model)
 * - hacker: Qwen3 8B abliterated (uncensored reasoning strategist)
 */
export const DEFAULT_SLOT_MODELS = {
  vision: 'qwen25-vl-7b-abliterated',
  grounding: 'os-atlas-7b',
  hacker: 'qwen3-8b-abliterated',
};

/** The default model entry for a brain slot (null when unknown). */
export function getDefaultModelForSlot(slot) {
  const id = DEFAULT_SLOT_MODELS[slot];
  if (!id) return null;
  // Prefer the slot-specific listing (the library lists some models twice:
  // once per tier, once per brain slot).
  return (
    MODEL_LIBRARY.find(m => m.id === id && m.brainSlot === slot) ||
    MODEL_LIBRARY.find(m => m.id === id) ||
    null
  );
}
export const BRAIN_SLOTS = {
  vision: {
    label: 'Vision Brain',
    icon: '🧠',
    description:
      'Main reasoning brain — sees and thinks. Used by Hunt, Infinity Chat, and Control.',
    usedBy: ['hunt', 'chat', 'control'],
  },
  grounding: {
    label: 'Grounding (Coordinates)',
    icon: '🎯',
    description:
      'Optional — finds UI elements and returns x,y coordinates. Used by Hunt and Control. When empty, the Vision brain handles click coordinates.',
    usedBy: ['hunt', 'control'],
    optional: true,
  },
  hacker: {
    label: 'Hacking Brain',
    icon: '💀',
    description:
      'Uncensored security strategist — plans attacks, chooses payloads. Used only by Hunt.',
    usedBy: ['hunt'],
  },
};

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
