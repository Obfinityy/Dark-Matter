/**
 * kaggleCells.js — one-cell Kaggle notebook setups, one per brain slot.
 *
 * Each slot card's "?" button opens a modal showing exactly ONE copyable cell.
 * The user pastes it into a Kaggle notebook (GPU on), runs it, and copies the
 * printed https://xxxx.gradio.live share URL back into the slot's Kaggle Link tab.
 *
 * Interface contract (must match the frontend's Gradio callers):
 *  - hacker:    Blocks, api_name="predict", inputs [prompt:text] -> text
 *  - vision:    Blocks, api_name="predict", inputs [question:text, image] -> text
 *  - grounding: Blocks, api_name="predict", inputs [element:text, image] -> JSON text
 *
 * NOTE: api_name="predict" is REQUIRED — api_name=False would hide the API
 * and the website could never call the brain.
 */

export const KAGGLE_CELLS = {
  hacker: {
    slot: 'hacker',
    title: 'Hacking Brain',
    modelId: 'huihui-ai/Huihui-Qwen3-8B-abliterated-v2',
    kind: 'text in → text out',
    steps: [
      'Kaggle.com → Create → New Notebook, accelerator = GPU T4 x2 (free).',
      'Paste the cell below into the notebook and press Run.',
      'When it prints a https://xxxx.gradio.live link, copy it into the Kaggle Link box here and press Connect.',
    ],
    cell: `# ============================================================
# DARK MATTER · HACKING BRAIN — KAGGLE + T4 + GRADIO
# SINGLE CELL / CLEAN SERVER
# ============================================================

import os
import sys
import gc
import time
import signal
import subprocess

print("============================================================")
print("HACKING BRAIN KAGGLE SERVER")
print("============================================================")

# ------------------------------------------------------------
# 1. KILL OLD GRADIO / UVICORN PROCESSES
# ------------------------------------------------------------
print("\\nCleaning old Gradio servers...")

try:
    subprocess.run(["pkill", "-9", "-f", "gradio"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
except:
    pass

try:
    subprocess.run(["pkill", "-9", "-f", "uvicorn"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
except:
    pass

time.sleep(2)

# ------------------------------------------------------------
# ------------------------------------------------------------
# 2. INSTALL ONLY MISSING PACKAGES
# ------------------------------------------------------------
print("Checking required packages (needs internet)...")

# IMPORTANT: Do NOT upgrade torch here.
# Kaggle already has the CUDA-compatible PyTorch stack.

def _ensure_packages(pkgs):
    """Install only the packages that are missing. If pip fails it is
    almost always because the notebook has no internet:
    Kaggle right sidebar -> Settings -> Internet -> ON, then re-run."""
    import importlib
    mod_map = {"qwen-vl-utils": "qwen_vl_utils", "pillow": "PIL"}
    missing = []
    for pkg in pkgs:
        try:
            importlib.import_module(mod_map.get(pkg, pkg.replace("-", "_")))
        except ImportError:
            missing.append(pkg)
    if not missing:
        print("All required packages already present - skipping pip.")
        return
    print("Installing missing packages:", ", ".join(missing))
    r = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-q", "-U"] + missing)
    if r.returncode != 0:
        print("\\n" + "=" * 60)
        print("PIP INSTALL FAILED.")
        print("Most likely cause: this Kaggle notebook has NO internet.")
        print("Fix: right sidebar -> Settings -> Internet -> ON,")
        print("then press Run on this cell again.")
        print("=" * 60)
        raise RuntimeError(
            "pip install failed - turn notebook Internet ON and re-run.")

_ensure_packages(["transformers", "accelerate", "gradio"])


# ------------------------------------------------------------
# 3. IMPORTS
# ------------------------------------------------------------
import torch
import gradio as gr
from transformers import AutoTokenizer, AutoModelForCausalLM

# ------------------------------------------------------------
# 4. GPU CHECK
# ------------------------------------------------------------
print("\\nHardware check...")
print("PyTorch :", torch.__version__)
print("CUDA    :", torch.cuda.is_available())

if not torch.cuda.is_available():
    raise RuntimeError("CUDA GPU is not available. "
                       "Set Kaggle Accelerator = GPU.")

print("GPU Name:", torch.cuda.get_device_name(0))

# ------------------------------------------------------------
# 5. DEVICE / DTYPE
# ------------------------------------------------------------
MODEL_DEVICE = "cuda:0"
DTYPE = torch.bfloat16   # T4-safe in modern PyTorch
print("Precision:", DTYPE)

# ------------------------------------------------------------
# 6. LOAD MODEL (uncensored security strategist)
# ------------------------------------------------------------
MODEL_NAME = "huihui-ai/Huihui-Qwen3-8B-abliterated-v2"

print("\\nLoading:")
print(MODEL_NAME)

tok = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME, torch_dtype=DTYPE, device_map="auto",
    trust_remote_code=True)
model.eval()

print("\\n============================================================")
print("HACKING BRAIN LOADED")
print("============================================================")

# ------------------------------------------------------------
# 7. MODEL FUNCTION
# ------------------------------------------------------------
def ask_hacker(prompt):
    try:
        if not prompt:
            return "Please enter a prompt."
        msgs = [{"role": "user", "content": prompt}]
        text = tok.apply_chat_template(
            msgs, tokenize=False, add_generation_prompt=True)
        inp = tok(text, return_tensors="pt").to(MODEL_DEVICE)
        with torch.inference_mode():
            out = model.generate(
                **inp, max_new_tokens=1024,
                do_sample=True, temperature=0.7, top_p=0.9)
        return tok.decode(
            out[0][inp.input_ids.shape[1]:],
            skip_special_tokens=True).strip()
    except torch.cuda.OutOfMemoryError:
        torch.cuda.empty_cache()
        return ("CUDA OUT OF MEMORY — "
                "try a shorter prompt.")
    except Exception as e:
        import traceback; traceback.print_exc()
        return f"ERROR\\n\\n{type(e).__name__}: {e}"

# ------------------------------------------------------------
# 8. GRADIO UI
# ------------------------------------------------------------
print("\\nCreating Gradio interface...")

with gr.Blocks(title="Dark Matter · Hacking Brain",
               analytics_enabled=False) as demo:
    gr.Markdown("# Dark Matter · Hacking Brain\\n"
                "Uncensored security strategist. Ask anything.")
    with gr.Row():
        with gr.Column():
            prompt_input = gr.Textbox(
                label="Prompt", lines=6,
                placeholder="Example: how do I test this login form for SQLi?")
            with gr.Row():
                ask_button = gr.Button("Ask", variant="primary")
                clear_button = gr.Button("Clear")
        with gr.Column():
            answer_output = gr.Textbox(
                label="Reply", lines=20, interactive=False)

    # api_name="predict" exposes the API the website calls.
    ask_button.click(fn=ask_hacker, inputs=[prompt_input],
                     outputs=answer_output,
                     api_name="predict", show_progress="full")
    clear_button.click(fn=lambda: ("", ""),
                       inputs=[], outputs=[prompt_input, answer_output],
                       api_name=False)

# ------------------------------------------------------------
# 9. LAUNCH ONE CLEAN GRADIO SERVER
# ------------------------------------------------------------
print("\\n============================================================")
print("STARTING GRADIO SERVER")
print("============================================================")
print("""
IMPORTANT:
- Open ONLY the NEW public URL shown below.
- Do NOT run this cell again while the server is running.
- To stop it, interrupt/stop this Kaggle cell.
""")

demo.launch(share=True, debug=False, show_error=True,
            prevent_thread_lock=False,
            server_name="0.0.0.0", server_port=7860)`,
  },

  vision: {
    slot: 'vision',
    title: 'Vision Brain',
    modelId: 'huihui-ai/Qwen2.5-VL-7B-Instruct-abliterated',
    kind: 'text + image in → text out',
    steps: [
      'Kaggle.com → Create → New Notebook, accelerator = GPU T4 x2 (free).',
      'Paste the cell below into the notebook and press Run.',
      'When it prints a https://xxxx.gradio.live link, copy it into the Kaggle Link box here and press Connect.',
    ],
    cell: "# ============================================================\n# DARK MATTER · VISION BRAIN — KAGGLE + T4 + GRADIO (FIXED)\n# SINGLE CELL / CLEAN SERVER\n# Model: huihui-ai/Qwen2.5-VL-7B-Instruct-abliterated\n# (uncensored Qwen2.5-VL, full transformers support)\n#\n# FIXES vs previous version:\n#  1. qwen-vl-utils pinned to a known-good version (API drift broke\n#     process_vision_info on newer releases).\n#  2. Image is explicitly opened as PIL before process_vision_info —\n#     filepath strings alone fail on some qwen-vl-utils builds.\n#  3. transformers version gate runs BEFORE the model import, with a\n#     clear restart instruction instead of a cryptic ImportError.\n# ============================================================\n\nimport sys\nimport time\nimport subprocess\n\nprint(\"============================================================\")\nprint(\"VISION BRAIN KAGGLE SERVER (FIXED)\")\nprint(\"============================================================\")\n\n# ------------------------------------------------------------\n# 1. KILL OLD GRADIO / UVICORN PROCESSES\n# ------------------------------------------------------------\nprint(\"\\nCleaning old Gradio servers...\")\n\nfor pattern in (\"gradio\", \"uvicorn\"):\n    try:\n        subprocess.run([\"pkill\", \"-9\", \"-f\", pattern],\n                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)\n    except Exception:\n        pass\n\ntime.sleep(2)\n\n# ------------------------------------------------------------\n# 2. INSTALL / VERIFY PACKAGES\n# ------------------------------------------------------------\nprint(\"Checking required packages (needs internet)...\")\n\ndef _pip_install(pkgs):\n    print(\"pip installing:\", \", \".join(pkgs))\n    r = subprocess.run(\n        [sys.executable, \"-m\", \"pip\", \"install\", \"-q\"] + pkgs)\n    if r.returncode != 0:\n        print(\"\\n\" + \"=\" * 60)\n        print(\"PIP INSTALL FAILED.\")\n        print(\"Most likely cause: this Kaggle notebook has NO internet.\")\n        print(\"Fix: right sidebar -> Settings -> Internet -> ON,\")\n        print(\"then press Run on this cell again.\")\n        print(\"=\" * 60)\n        raise RuntimeError(\n            \"pip install failed - turn notebook Internet ON and re-run.\")\n\nimport importlib\n\ndef _mod(name):\n    try:\n        return importlib.import_module(name)\n    except ImportError:\n        return None\n\n# transformers first — Qwen2.5-VL needs >= 4.49 for the model class\n# and the AutoProcessor to exist at all.\ntf = _mod(\"transformers\")\nneed_tf = True\nif tf is not None:\n    try:\n        from packaging.version import Version\n        need_tf = Version(tf.__version__) < Version(\"4.49.0\")\n        print(\"transformers\", tf.__version__,\n              \"- OK\" if not need_tf else \"- TOO OLD, upgrading\")\n    except Exception:\n        need_tf = False\nif need_tf:\n    _pip_install([\"-U\", \"transformers>=4.49.0\"])\n    print(\"transformers installed/upgraded - RESTARTING cell run so the\")\n    print(\"new version loads (Kaggle: Runtime -> Restart and run all).\")\n    raise SystemExit(0)\n\n# qwen-vl-utils pinned: newer releases changed process_vision_info\n# behaviour and break the filepath flow.\nif _mod(\"qwen_vl_utils\") is None:\n    _pip_install([\"qwen-vl-utils==0.0.6\"])\nelse:\n    print(\"qwen_vl_utils present - OK\")\n\nfor pkg, mod in ((\"accelerate\", \"accelerate\"),\n                 (\"gradio\", \"gradio\"),\n                 (\"pillow\", \"PIL\")):\n    if _mod(mod) is None:\n        _pip_install([pkg])\n    else:\n        print(mod, \"present - OK\")\n\n# ------------------------------------------------------------\n# 3. IMPORTS (only after the version gates above)\n# ------------------------------------------------------------\nimport torch\nimport gradio as gr\nfrom PIL import Image\nfrom transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor\nfrom qwen_vl_utils import process_vision_info\n\nprint(\"\\ntransformers:\", __import__(\"transformers\").__version__)\nprint(\"gradio:\", gr.__version__)\n\n# ------------------------------------------------------------\n# 4. GPU CHECK\n# ------------------------------------------------------------\nprint(\"\\nHardware check...\")\nprint(\"PyTorch :\", torch.__version__)\nprint(\"CUDA    :\", torch.cuda.is_available())\n\nif not torch.cuda.is_available():\n    raise RuntimeError(\"CUDA GPU is not available. \"\n                       \"Set Kaggle Accelerator = GPU.\")\n\nprint(\"GPU Name:\", torch.cuda.get_device_name(0))\n\n# ------------------------------------------------------------\n# 5. DEVICE / DTYPE\n# ------------------------------------------------------------\nMODEL_DEVICE = \"cuda:0\"\nDTYPE = torch.bfloat16   # T4-safe in modern PyTorch\nprint(\"Precision:\", DTYPE)\n\n# ------------------------------------------------------------\n# 6. LOAD MODEL\n# ------------------------------------------------------------\nMODEL_NAME = \"huihui-ai/Qwen2.5-VL-7B-Instruct-abliterated\"\n\nprint(\"\\nLoading:\")\nprint(MODEL_NAME)\nprint(\"This may take some time on first run...\\n\")\n\nprocessor = AutoProcessor.from_pretrained(\n    MODEL_NAME, trust_remote_code=True)\nmodel = Qwen2_5_VLForConditionalGeneration.from_pretrained(\n    MODEL_NAME, torch_dtype=DTYPE, device_map=\"auto\",\n    trust_remote_code=True)\nmodel.eval()\n\nprint(\"\\n============================================================\")\nprint(\"VISION BRAIN LOADED\")\nprint(\"============================================================\")\nprint(\"Model device:\", next(model.parameters()).device)\n\n# ------------------------------------------------------------\n# 7. MODEL FUNCTION\n# ------------------------------------------------------------\ndef _as_pil(image):\n    \"\"\"Accept a gradio filepath, URL, numpy array or PIL image and\n    return a PIL image. Explicit conversion avoids the filepath\n    handling drift across qwen-vl-utils releases.\"\"\"\n    if image is None:\n        return None\n    if isinstance(image, Image.Image):\n        return image.convert(\"RGB\")\n    if isinstance(image, str):\n        # local filepath from gr.Image(type=\"filepath\")\n        return Image.open(image).convert(\"RGB\")\n    try:\n        import numpy as np\n        if isinstance(image, np.ndarray):\n            return Image.fromarray(image).convert(\"RGB\")\n    except Exception:\n        pass\n    # last resort: let PIL try\n    return Image.open(image).convert(\"RGB\")\n\ndef ask_vision(question, image):\n    try:\n        pil_image = _as_pil(image)\n        if not question and pil_image is None:\n            return \"Please enter a question or upload an image.\"\n\n        content = []\n        if pil_image is not None:\n            content.append({\"type\": \"image\", \"image\": pil_image})\n        if question:\n            content.append({\"type\": \"text\", \"text\": question})\n        messages = [{\"role\": \"user\", \"content\": content}]\n\n        prompt = processor.apply_chat_template(\n            messages, tokenize=False, add_generation_prompt=True)\n        image_inputs, video_inputs = process_vision_info(messages)\n        inputs = processor(\n            text=[prompt], images=image_inputs, videos=video_inputs,\n            padding=True, return_tensors=\"pt\")\n        inputs = {k: v.to(MODEL_DEVICE) if hasattr(v, \"to\") else v\n                  for k, v in inputs.items()}\n\n        with torch.inference_mode():\n            generated_ids = model.generate(\n                **inputs, max_new_tokens=1024, do_sample=False)\n\n        trimmed = [o[len(i):] for i, o in\n                   zip(inputs[\"input_ids\"], generated_ids)]\n        answer = processor.batch_decode(\n            trimmed, skip_special_tokens=True,\n            clean_up_tokenization_spaces=False)[0]\n        return answer.strip()\n\n    except torch.cuda.OutOfMemoryError:\n        torch.cuda.empty_cache()\n        return (\"CUDA OUT OF MEMORY\\n\\n\"\n                \"Try a smaller image or shorter prompt.\")\n    except Exception as e:\n        import traceback; traceback.print_exc()\n        return f\"ERROR\\n\\n{type(e).__name__}: {e}\"\n\n# ------------------------------------------------------------\n# 8. GRADIO UI\n# ------------------------------------------------------------\nprint(\"\\nCreating Gradio interface...\")\n\nwith gr.Blocks(title=\"Dark Matter · Vision Brain\",\n               analytics_enabled=False) as demo:\n    gr.Markdown(\"# Dark Matter · Vision Brain\\n\"\n                \"Upload a screenshot and ask what it shows.\")\n    with gr.Row():\n        with gr.Column():\n            image_input = gr.Image(type=\"filepath\", label=\"Screenshot\")\n            question_input = gr.Textbox(\n                label=\"Question\", lines=4,\n                placeholder=\"Example: What is shown in this image?\")\n            with gr.Row():\n                ask_button = gr.Button(\"Ask\", variant=\"primary\")\n                clear_button = gr.Button(\"Clear\")\n        with gr.Column():\n            answer_output = gr.Textbox(\n                label=\"Description\", lines=20, interactive=False)\n\n    # api_name=\"predict\" exposes the API the website calls.\n    # Input order: [question, image].\n    ask_button.click(fn=ask_vision,\n                     inputs=[question_input, image_input],\n                     outputs=answer_output,\n                     api_name=\"predict\", show_progress=\"full\")\n    clear_button.click(fn=lambda: (\"\", None, \"\"),\n                       inputs=[],\n                       outputs=[question_input, image_input,\n                                answer_output],\n                       api_name=False)\n\n# ------------------------------------------------------------\n# 9. LAUNCH ONE CLEAN GRADIO SERVER\n# ------------------------------------------------------------\nprint(\"\\n============================================================\")\nprint(\"STARTING GRADIO SERVER\")\nprint(\"============================================================\")\nprint(\"\"\"\nIMPORTANT:\n- Open ONLY the NEW public URL shown below.\n- Do NOT run this cell again while the server is running.\n- To stop it, interrupt/stop this Kaggle cell.\n\"\"\")\n\ndemo.launch(share=True, debug=False, show_error=True,\n            prevent_thread_lock=False,\n            server_name=\"0.0.0.0\", server_port=7860)\n",
  },

  grounding: {
    slot: 'grounding',
    title: 'Grounding Brain',
    modelId: 'OS-Copilot/OS-Atlas-Base-7B',
    kind: 'text + image in → coordinates JSON out',
    steps: [
      'Kaggle.com → Create → New Notebook, accelerator = GPU T4 x2 (free).',
      'Paste the cell below into the notebook and press Run.',
      'When it prints a https://xxxx.gradio.live link, copy it into the Kaggle Link box here and press Connect.',
    ],
    cell: `# ============================================================
# DARK MATTER · GROUNDING BRAIN — KAGGLE + T4 + GRADIO
# SINGLE CELL / CLEAN SERVER
# Screenshot + element name  ->  {"x": 0-1000, "y": 0-1000}
# ============================================================

import os
import sys
import gc
import time
import signal
import subprocess

print("============================================================")
print("GROUNDING BRAIN KAGGLE SERVER")
print("============================================================")

# ------------------------------------------------------------
# 1. KILL OLD GRADIO / UVICORN PROCESSES
# ------------------------------------------------------------
print("\\nCleaning old Gradio servers...")

try:
    subprocess.run(["pkill", "-9", "-f", "gradio"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
except:
    pass

try:
    subprocess.run(["pkill", "-9", "-f", "uvicorn"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
except:
    pass

time.sleep(2)

# ------------------------------------------------------------
# ------------------------------------------------------------
# 2. INSTALL ONLY MISSING PACKAGES
# ------------------------------------------------------------
print("Checking required packages (needs internet)...")

# IMPORTANT: Do NOT upgrade torch here.
# Kaggle already has the CUDA-compatible PyTorch stack.

def _ensure_packages(pkgs):
    """Install only the packages that are missing. If pip fails it is
    almost always because the notebook has no internet:
    Kaggle right sidebar -> Settings -> Internet -> ON, then re-run."""
    import importlib
    mod_map = {"qwen-vl-utils": "qwen_vl_utils", "pillow": "PIL"}
    missing = []
    for pkg in pkgs:
        try:
            importlib.import_module(mod_map.get(pkg, pkg.replace("-", "_")))
        except ImportError:
            missing.append(pkg)
    if not missing:
        print("All required packages already present - skipping pip.")
        return
    print("Installing missing packages:", ", ".join(missing))
    r = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-q", "-U"] + missing)
    if r.returncode != 0:
        print("\\n" + "=" * 60)
        print("PIP INSTALL FAILED.")
        print("Most likely cause: this Kaggle notebook has NO internet.")
        print("Fix: right sidebar -> Settings -> Internet -> ON,")
        print("then press Run on this cell again.")
        print("=" * 60)
        raise RuntimeError(
            "pip install failed - turn notebook Internet ON and re-run.")

_ensure_packages(["transformers", "accelerate", "gradio", "pillow"])


# ------------------------------------------------------------
# 3. IMPORTS
# ------------------------------------------------------------
import torch
import gradio as gr
from transformers import Qwen2VLForConditionalGeneration, AutoProcessor

# ------------------------------------------------------------
# 4. GPU CHECK
# ------------------------------------------------------------
print("\\nHardware check...")
print("PyTorch :", torch.__version__)
print("CUDA    :", torch.cuda.is_available())

if not torch.cuda.is_available():
    raise RuntimeError("CUDA GPU is not available. "
                       "Set Kaggle Accelerator = GPU.")

print("GPU Name:", torch.cuda.get_device_name(0))

# ------------------------------------------------------------
# 5. DEVICE / DTYPE
# ------------------------------------------------------------
MODEL_DEVICE = "cuda:0"
DTYPE = torch.bfloat16   # T4-safe in modern PyTorch
print("Precision:", DTYPE)

# ------------------------------------------------------------
# 6. LOAD MODEL (UI element grounding)
# ------------------------------------------------------------
MODEL_NAME = "OS-Copilot/OS-Atlas-Base-7B"

print("\\nLoading:")
print(MODEL_NAME)
print("This may take some time on first run...\\n")

processor = AutoProcessor.from_pretrained(
    MODEL_NAME, trust_remote_code=True)
model = Qwen2VLForConditionalGeneration.from_pretrained(
    MODEL_NAME, torch_dtype=DTYPE, device_map="auto",
    trust_remote_code=True)
model.eval()

print("\\n============================================================")
print("GROUNDING BRAIN LOADED")
print("============================================================")
print("Model device:", next(model.parameters()).device)

# ------------------------------------------------------------
# 7. MODEL FUNCTION
# ------------------------------------------------------------
def locate(element, image):
    import json, re
    try:
        if image is None or not element:
            return json.dumps({"x": None, "y": None,
                               "confidence": 0.0,
                               "error": "need both a screenshot and an element name"})
        query = f"<|object_ref_start|>{element}<|object_ref_end|>"
        messages = [{"role": "user", "content": [
            {"type": "image", "image": image},
            {"type": "text", "text": query}]}]
        prompt = processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True)
        inputs = processor(text=[prompt], images=[image],
                           padding=True, return_tensors="pt")
        inputs = {k: v.to(MODEL_DEVICE) if hasattr(v, "to") else v
                  for k, v in inputs.items()}

        with torch.inference_mode():
            out = model.generate(**inputs, max_new_tokens=64,
                                 do_sample=False)

        txt = processor.batch_decode(
            out[:, inputs["input_ids"].shape[1]:],
            skip_special_tokens=True)[0]
        m = re.search(r"\\{.*\\}", txt, re.S)
        try:
            coords = json.loads(m.group(0)) if m else {}
        except Exception:
            coords = {}
        ok = isinstance(coords.get("x"), (int, float)) and \\
             isinstance(coords.get("y"), (int, float))
        return json.dumps({"x": coords.get("x"), "y": coords.get("y"),
                           "confidence": 0.9 if ok else 0.0})

    except torch.cuda.OutOfMemoryError:
        torch.cuda.empty_cache()
        return json.dumps({"x": None, "y": None, "confidence": 0.0,
                           "error": "CUDA OUT OF MEMORY"})
    except Exception as e:
        import traceback; traceback.print_exc()
        return json.dumps({"x": None, "y": None, "confidence": 0.0,
                           "error": f"{type(e).__name__}: {e}"})

# ------------------------------------------------------------
# 8. GRADIO UI
# ------------------------------------------------------------
print("\\nCreating Gradio interface...")

with gr.Blocks(title="Dark Matter · Grounding Brain",
               analytics_enabled=False) as demo:
    gr.Markdown("# Dark Matter · Grounding Brain\\n"
                "Screenshot + element name → click coordinates "
                '{"x": 0-1000, "y": 0-1000}.')
    with gr.Row():
        with gr.Column():
            image_input = gr.Image(type="filepath", label="Screenshot")
            element_input = gr.Textbox(
                label="Element to find", lines=2,
                placeholder='Example: the "Sign in" button')
            with gr.Row():
                ask_button = gr.Button("Locate", variant="primary")
                clear_button = gr.Button("Clear")
        with gr.Column():
            answer_output = gr.Textbox(
                label='Coordinates JSON', lines=6, interactive=False)

    # api_name="predict" exposes the API the website calls.
    # Input order: [element, image].
    ask_button.click(fn=locate,
                     inputs=[element_input, image_input],
                     outputs=answer_output,
                     api_name="predict", show_progress="full")
    clear_button.click(fn=lambda: ("", None, ""),
                       inputs=[],
                       outputs=[element_input, image_input,
                                answer_output],
                       api_name=False)

# ------------------------------------------------------------
# 9. LAUNCH ONE CLEAN GRADIO SERVER
# ------------------------------------------------------------
print("\\n============================================================")
print("STARTING GRADIO SERVER")
print("============================================================")
print("""
IMPORTANT:
- Open ONLY the NEW public URL shown below.
- Do NOT run this cell again while the server is running.
- To stop it, interrupt/stop this Kaggle cell.
""")

demo.launch(share=True, debug=False, show_error=True,
            prevent_thread_lock=False,
            server_name="0.0.0.0", server_port=7860)`,
  },
};

/** Cell spec for a slot id ('vision' | 'grounding' | 'hacker'), or null. */
export function getKaggleCell(slotId) {
  return KAGGLE_CELLS[slotId] || null;
}
