/**
 * modelCatalog.js — frontend-only model library (no backend needed).
 *
 * The 22 curated uncensored GGUF models, hardcoded in the frontend so the
 * Models page works even when the backend is unreachable. Categories:
 * - hacking: uncensored instruct models (the hacking brain)
 * - vision: vision-language models (see screenshots)
 * - grounding: UI grounding models (find click coordinates)
 *
 * Downloads go DIRECTLY from Hugging Face (no backend proxy).
 */
export const MODEL_CATALOG = [
  {
    "id": "dolphin-llama31-8b",
    "name": "Dolphin 3.0 Llama 3.1 8B",
    "params": "8B",
    "quant": "Q4_K_M",
    "tier": "lightweight",
    "tierLabel": "Lightweight",
    "hfRepo": "dphn/Dolphin3.0-Llama3.1-8B-GGUF",
    "hfFile": "Dolphin3.0-Llama3.1-8B-Q4_K_M.gguf",
    "sizeGB": 4.9,
    "contextWindow": 8192,
    "uncensored": true,
    "requirements": {
      "ramGB": 8,
      "vramGB": 0,
      "gpuRequired": false
    },
    "description": "Uncensored Dolphin fine-tune of Llama 3.1 8B — fast, runs on CPU, good for quick triage and chat.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "qwen3-14b-abliterated",
    "name": "Qwen3 14B Abliterated",
    "params": "14B",
    "quant": "Q4_K_M",
    "tier": "balanced",
    "tierLabel": "Balanced",
    "hfRepo": "bartowski/huihui-ai_Qwen3-14B-abliterated-GGUF",
    "hfFile": "huihui-ai_Qwen3-14B-abliterated-Q4_K_M.gguf",
    "sizeGB": 9,
    "quants": {
      "Q4_K_M": {
        "file": "huihui-ai_Qwen3-14B-abliterated-Q4_K_M.gguf",
        "sizeGB": 9
      },
      "Q5_K_M": {
        "file": "huihui-ai_Qwen3-14B-abliterated-Q5_K_M.gguf",
        "sizeGB": 10.51
      },
      "Q8_0": {
        "file": "huihui-ai_Qwen3-14B-abliterated-Q8_0.gguf",
        "sizeGB": 15.7
      }
    },
    "contextWindow": 32768,
    "uncensored": true,
    "requirements": {
      "ramGB": 12,
      "vramGB": 0,
      "gpuRequired": false
    },
    "description": "Uncensored Qwen3 14B — the sweet spot: noticeably smarter than 8B, still happy on a 16GB laptop CPU.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "dolphin-mistral-24b-venice",
    "name": "Dolphin Mistral 24B Venice",
    "params": "24B",
    "quant": "Q4_K_M",
    "tier": "balanced",
    "tierLabel": "Balanced",
    "hfRepo": "bartowski/huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-GGUF",
    "hfFile": "huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-Q4_K_M.gguf",
    "sizeGB": 14.5,
    "contextWindow": 32768,
    "uncensored": true,
    "requirements": {
      "ramGB": 20,
      "vramGB": 12,
      "gpuRequired": false
    },
    "description": "Uncensored Dolphin on Mistral Small 24B — excellent instruction following, the Venice uncensored edition.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "dolphin3-r1-mistral-24b",
    "name": "Dolphin 3.0 R1 Mistral 24B",
    "params": "24B",
    "quant": "Q4_K_M",
    "tier": "balanced",
    "tierLabel": "Balanced",
    "hfRepo": "bartowski/cognitivecomputations_Dolphin3.0-R1-Mistral-24B-GGUF",
    "hfFile": "cognitivecomputations_Dolphin3.0-R1-Mistral-24B-Q4_K_M.gguf",
    "sizeGB": 14.9,
    "contextWindow": 32768,
    "uncensored": true,
    "requirements": {
      "ramGB": 20,
      "vramGB": 12,
      "gpuRequired": false
    },
    "description": "Uncensored Dolphin 3.0 reasoning model on Mistral 24B — first-principles analysis, great for hunt planning.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "mistral-small-24b-abliterated",
    "name": "Mistral Small 24B Abliterated",
    "params": "24B",
    "quant": "Q4_K_M",
    "tier": "balanced",
    "tierLabel": "Balanced",
    "hfRepo": "bartowski/huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-GGUF",
    "hfFile": "huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-Q4_K_M.gguf",
    "sizeGB": 14.5,
    "contextWindow": 32768,
    "uncensored": true,
    "requirements": {
      "ramGB": 20,
      "vramGB": 12,
      "gpuRequired": false
    },
    "description": "Uncensored (abliterated) Mistral Small 24B 2501 — crisp instruction following with refusals removed.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "qwen3-27b-abliterated",
    "name": "Qwen3 27B Abliterated",
    "params": "27B",
    "quant": "Q4_K_M",
    "tier": "powerful",
    "tierLabel": "Powerful",
    "hfRepo": "huihui-ai/Huihui-Qwen3.8-27B-abliterated-GGUF",
    "hfFile": "Huihui-Qwen3.8-27B-abliterated-UD-DW-Q4_K_M.gguf",
    "sizeGB": 16.5,
    "contextWindow": 32768,
    "uncensored": true,
    "requirements": {
      "ramGB": 24,
      "vramGB": 16,
      "gpuRequired": false
    },
    "description": "Uncensored Qwen3 27B — near-frontier reasoning for agentic hunts. Needs a strong machine: 24GB+ RAM or a 16GB+ GPU.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "qwen3-30b-a3b-abliterated",
    "name": "Qwen3 30B A3B Abliterated",
    "params": "30B",
    "quant": "Q4_K_M",
    "tier": "powerful",
    "tierLabel": "Powerful",
    "hfRepo": "Sowkwndms/Huihui-Qwen3-30B-A3B-Instruct-2507-abliterated-Q4_K_M-GGUF",
    "hfFile": "huihui-qwen3-30b-a3b-instruct-2507-abliterated-q4_k_m.gguf",
    "sizeGB": 18.5,
    "contextWindow": 32768,
    "uncensored": true,
    "requirements": {
      "ramGB": 24,
      "vramGB": 16,
      "gpuRequired": false
    },
    "description": "Uncensored Qwen3 30B mixture-of-experts (only 3B active per token) — 30B smarts at 8B speed.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "deepseek-r1-distill-qwen-32b",
    "name": "DeepSeek R1 Distill Qwen 32B",
    "params": "32B",
    "quant": "Q4_K_M",
    "tier": "powerful",
    "tierLabel": "Powerful",
    "hfRepo": "bartowski/DeepSeek-R1-Distill-Qwen-32B-abliterated-GGUF",
    "hfFile": "DeepSeek-R1-Distill-Qwen-32B-abliterated-Q4_K_M.gguf",
    "sizeGB": 19.5,
    "contextWindow": 32768,
    "uncensored": true,
    "requirements": {
      "ramGB": 32,
      "vramGB": 20,
      "gpuRequired": false
    },
    "description": "Uncensored DeepSeek-R1 reasoning distilled into Qwen 32B — chain-of-thought depth for hard targets.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "llama33-70b-ablated",
    "name": "Llama 3.3 70B Ablated",
    "params": "70B",
    "quant": "Q4_K_M",
    "tier": "frontier",
    "tierLabel": "Frontier",
    "hfRepo": "bartowski/Llama-3.3-70B-Instruct-ablated-GGUF",
    "hfFile": "Llama-3.3-70B-Instruct-ablated-Q4_K_M.gguf",
    "sizeGB": 42.5,
    "contextWindow": 131072,
    "uncensored": true,
    "requirements": {
      "ramGB": 64,
      "vramGB": 40,
      "gpuRequired": false
    },
    "description": "Uncensored Llama 3.3 70B — flagship-class reasoning, 128k context. For workstations and big GPUs.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "llama31-nemotron-70b",
    "name": "Llama 3.1 Nemotron 70B",
    "params": "70B",
    "quant": "Q4_K_M",
    "tier": "frontier",
    "tierLabel": "Frontier",
    "hfRepo": "bartowski/Llama-3.1-Nemotron-70B-Instruct-HF-abliterated-GGUF",
    "hfFile": "Llama-3.1-Nemotron-70B-Instruct-HF-abliterated-Q4_K_M.gguf",
    "sizeGB": 42.5,
    "contextWindow": 131072,
    "uncensored": true,
    "requirements": {
      "ramGB": 64,
      "vramGB": 40,
      "gpuRequired": false
    },
    "description": "Uncensored NVIDIA Nemotron-tuned Llama 3.1 70B — NVIDIA's alignment-tuned 70B with refusals removed.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "llama31-70b-abliterated",
    "name": "Llama 3.1 70B Abliterated",
    "params": "70B",
    "quant": "Q4_K_M",
    "tier": "frontier",
    "tierLabel": "Frontier",
    "hfRepo": "mradermacher/Llama-3.1-70B-Instruct-abliterated-GGUF",
    "hfFile": "Llama-3.1-70B-Instruct-abliterated.Q4_K_M.gguf",
    "sizeGB": 42.6,
    "quants": {
      "Q4_K_M": {
        "file": "Llama-3.1-70B-Instruct-abliterated.Q4_K_M.gguf",
        "sizeGB": 42.6
      },
      "Q5_K_M": {
        "file": "Llama-3.1-70B-Instruct-abliterated.Q5_K_M.gguf",
        "sizeGB": 50
      }
    },
    "contextWindow": 131072,
    "uncensored": true,
    "requirements": {
      "ramGB": 64,
      "vramGB": 40,
      "gpuRequired": false
    },
    "description": "Uncensored Llama 3.1 70B (static quant) — the classic open 70B workhorse, refusal-free.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "deepseek-r1-distill-llama-70b",
    "name": "DeepSeek R1 Distill Llama 70B",
    "params": "70B",
    "quant": "Q4_K_M",
    "tier": "frontier",
    "tierLabel": "Frontier",
    "hfRepo": "bartowski/huihui-ai_DeepSeek-R1-Distill-Llama-70B-abliterated-GGUF",
    "hfFile": "huihui-ai_DeepSeek-R1-Distill-Llama-70B-abliterated-Q4_K_M.gguf",
    "sizeGB": 42.5,
    "quants": {
      "Q4_K_M": {
        "file": "huihui-ai_DeepSeek-R1-Distill-Llama-70B-abliterated-Q4_K_M.gguf",
        "sizeGB": 42.52
      },
      "Q5_K_S": {
        "file": "huihui-ai_DeepSeek-R1-Distill-Llama-70B-abliterated-Q5_K_S.gguf",
        "sizeGB": 46.6
      }
    },
    "contextWindow": 32768,
    "uncensored": true,
    "requirements": {
      "ramGB": 64,
      "vramGB": 40,
      "gpuRequired": false
    },
    "description": "Uncensored DeepSeek-R1 reasoning distilled into Llama 70B — the deepest thinker in the library.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "llama3-70b-abliterated-v35",
    "name": "Llama 3 70B Abliterated v3.5",
    "params": "70B",
    "quant": "Q4_K_M",
    "tier": "frontier",
    "tierLabel": "Frontier",
    "hfRepo": "failspy/Meta-Llama-3-70B-Instruct-abliterated-v3.5-GGUF",
    "hfFile": "Meta-Llama-3-70B-Instruct-abliterated-v3.5_q4.gguf",
    "sizeGB": 40,
    "contextWindow": 8192,
    "uncensored": true,
    "requirements": {
      "ramGB": 64,
      "vramGB": 40,
      "gpuRequired": false
    },
    "description": "failspy v3.5 abliteration of Llama 3 70B — single-layer orthogonalization, minimal behavior change beyond refusals.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "uitars-grounding-7b",
    "name": "UI-TARS 1.5 7B (Grounding)",
    "params": "7B",
    "quant": "Q4_K_M",
    "tier": "plugin",
    "tierLabel": "Plugin · Control Mode",
    "brainSlot": "grounding",
    "brainSlotLabel": "Grounding (Coordinates)",
    "hfRepo": "Mungert/UI-TARS-1.5-7B-GGUF",
    "hfFile": "UI-TARS-1.5-7B-q4_k_m.gguf",
    "sizeGB": 4.4,
    "contextWindow": 4096,
    "uncensored": true,
    "mandatory": true,
    "mandatoryFor": "control",
    "requirements": {
      "ramGB": 8,
      "vramGB": 0,
      "gpuRequired": false
    },
    "description": "Screen grounding for Infinity Agent — finds UI elements and returns coordinates. Tiny, runs on CPU/phone. Required for Control mode.",
    "category": "grounding",
    "categoryLabel": "Grounding"
  },
  {
    "id": "os-atlas-7b",
    "name": "OS-Atlas 7B (Grounding)",
    "params": "7B",
    "quant": "Q4_K_M",
    "tier": "plugin",
    "tierLabel": "Plugin · Control Mode",
    "brainSlot": "grounding",
    "brainSlotLabel": "Grounding (Coordinates)",
    "hfRepo": "mradermacher/OS-Atlas-Base-7B-GGUF",
    "hfFile": "OS-Atlas-Base-7B.Q4_K_M.gguf",
    "sizeGB": 4.5,
    "contextWindow": 4096,
    "uncensored": true,
    "requirements": {
      "ramGB": 8,
      "vramGB": 0,
      "gpuRequired": false
    },
    "description": "Alternative screen grounding model — locates buttons, icons, and text fields with x,y coordinates. CPU-friendly.",
    "category": "grounding",
    "categoryLabel": "Grounding"
  },
  {
    "id": "qwen25-vl-7b-abliterated",
    "name": "Qwen2.5-VL 7B (Abliterated)",
    "params": "7B",
    "quant": "Q4_K_M",
    "tier": "vision",
    "tierLabel": "Vision",
    "brainSlot": "vision",
    "brainSlotLabel": "Vision Brain",
    "hfRepo": "mradermacher/Qwen2.5-VL-7B-Instruct-abliterated-GGUF",
    "hfFile": "Qwen2.5-VL-7B-Instruct-abliterated.Q4_K_M.gguf",
    "sizeGB": 4.9,
    "contextWindow": 8192,
    "uncensored": true,
    "vision": true,
    "requirements": {
      "ramGB": 8,
      "vramGB": 0,
      "gpuRequired": false
    },
    "description": "Uncensored vision brain — sees screenshots and reasons about them. Runs on CPU, or the same model on Kaggle for GPU speed.",
    "category": "vision",
    "categoryLabel": "Vision"
  },
  {
    "id": "qwen25-vl-7b",
    "name": "Qwen2.5-VL 7B",
    "params": "7B",
    "quant": "Q4_K_M",
    "tier": "vision",
    "tierLabel": "Vision",
    "brainSlot": "vision",
    "brainSlotLabel": "Vision Brain",
    "hfRepo": "unsloth/Qwen2.5-VL-7B-Instruct-GGUF",
    "hfFile": "Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf",
    "sizeGB": 4.9,
    "contextWindow": 8192,
    "uncensored": false,
    "vision": true,
    "requirements": {
      "ramGB": 8,
      "vramGB": 0,
      "gpuRequired": false
    },
    "description": "Standard Qwen2.5-VL vision model — solid screenshot understanding, ungated repo.",
    "category": "vision",
    "categoryLabel": "Vision"
  },
  {
    "id": "minicpm-v-26-8b",
    "name": "MiniCPM-V 2.6 8B",
    "params": "8B",
    "quant": "Q4_K_M",
    "tier": "vision",
    "tierLabel": "Vision",
    "brainSlot": "vision",
    "brainSlotLabel": "Vision Brain",
    "hfRepo": "lmstudio-community/MiniCPM-V-2_6-GGUF",
    "hfFile": "MiniCPM-V-2_6-Q4_K_M.gguf",
    "sizeGB": 5.2,
    "contextWindow": 8192,
    "uncensored": true,
    "vision": true,
    "requirements": {
      "ramGB": 8,
      "vramGB": 0,
      "gpuRequired": false
    },
    "description": "Compact vision-language model — strong OCR and UI element reading, great for screen-heavy tasks.",
    "category": "vision",
    "categoryLabel": "Vision"
  },
  {
    "id": "qwen3-8b-abliterated",
    "name": "Qwen3 8B (Abliterated)",
    "params": "8B",
    "quant": "Q4_K_M",
    "tier": "hacker",
    "tierLabel": "Hacking Brain",
    "brainSlot": "hacker",
    "brainSlotLabel": "Hacking Brain",
    "hfRepo": "bartowski/mlabonne_Qwen3-8B-abliterated-GGUF",
    "hfFile": "mlabonne_Qwen3-8B-abliterated-Q4_K_M.gguf",
    "sizeGB": 4.7,
    "contextWindow": 32768,
    "uncensored": true,
    "requirements": {
      "ramGB": 8,
      "vramGB": 0,
      "gpuRequired": false
    },
    "description": "Uncensored hacking strategist — plans attacks, chooses payloads, chains vulnerabilities. Used only by Hunt mode.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "gemma3-12b-abliterated",
    "name": "Gemma3 12B (Abliterated)",
    "params": "12B",
    "quant": "Q4_K_M",
    "tier": "hacker",
    "tierLabel": "Hacking Brain",
    "brainSlot": "hacker",
    "brainSlotLabel": "Hacking Brain",
    "hfRepo": "mlabonne/gemma-3-12b-it-abliterated-GGUF",
    "hfFile": "gemma-3-12b-it-abliterated.q4_k_m.gguf",
    "sizeGB": 7.3,
    "contextWindow": 8192,
    "uncensored": true,
    "requirements": {
      "ramGB": 12,
      "vramGB": 0,
      "gpuRequired": false
    },
    "description": "Larger uncensored hacking brain — deeper strategy for complex targets. Used only by Hunt mode.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  },
  {
    "id": "dolphin-mistral-24b-hacker",
    "name": "Dolphin Mistral 24B (Hacker)",
    "params": "24B",
    "quant": "Q4_K_M",
    "tier": "hacker",
    "tierLabel": "Hacking Brain",
    "brainSlot": "hacker",
    "brainSlotLabel": "Hacking Brain",
    "hfRepo": "bartowski/huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-GGUF",
    "hfFile": "huihui-ai_Mistral-Small-24B-Instruct-2501-abliterated-Q4_K_M.gguf",
    "sizeGB": 14.5,
    "contextWindow": 32768,
    "uncensored": true,
    "requirements": {
      "ramGB": 20,
      "vramGB": 12,
      "gpuRequired": false
    },
    "description": "Heavy-duty uncensored hacking brain — 24B Venice edition for the hardest targets. Used only by Hunt mode.",
    "category": "hacking",
    "categoryLabel": "Hacking Brain"
  }
];

/** Category groupings for the model catalog. */
export const MODEL_CATEGORIES = [
  { id: 'hacking', label: 'Hacking Brain', description: 'Uncensored instruct models — the main hacking brain' },
  { id: 'vision', label: 'Vision', description: 'See screenshots and images' },
  { id: 'grounding', label: 'Grounding', description: 'Find click coordinates on screen' },
];
