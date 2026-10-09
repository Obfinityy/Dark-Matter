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
    modelId: 'huihui-ai/Qwen3-8B-abliterated',
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
MODEL_NAME = "huihui-ai/Qwen3-8B-abliterated"

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
    modelId: 'martossien/qwen_2.5_vl_7b_uncensored_comfy_ready',
    kind: 'text + image in → text out',
    steps: [
      'Kaggle.com → Create → New Notebook, accelerator = GPU T4 x2 (free).',
      'Paste the cell below into the notebook and press Run.',
      'When it prints a https://xxxx.gradio.live link, copy it into the Kaggle Link box here and press Connect.',
    ],
    cell: `# ============================================================
# DARK MATTER · VISION BRAIN — KAGGLE + T4 + GRADIO
# SINGLE CELL / CLEAN SERVER
# (cell style by owner — model swapped to the uncensored pick;
#  change MODEL_NAME back to "Qwen/Qwen2.5-VL-7B-Instruct" if you
#  ever want the stock model)
# ============================================================

import os
import sys
import gc
import time
import signal
import subprocess

print("============================================================")
print("VISION BRAIN KAGGLE SERVER")
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

_ensure_packages(["transformers", "accelerate", "qwen-vl-utils", "gradio"])


# ------------------------------------------------------------
# 3. IMPORTS
# ------------------------------------------------------------
import torch
import gradio as gr
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from qwen_vl_utils import process_vision_info

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
# 6. LOAD MODEL
# ------------------------------------------------------------
MODEL_NAME = "martossien/qwen_2.5_vl_7b_uncensored_comfy_ready"

print("\\nLoading:")
print(MODEL_NAME)
print("This may take some time on first run...\\n")

processor = AutoProcessor.from_pretrained(
    MODEL_NAME, trust_remote_code=True)
model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
    MODEL_NAME, torch_dtype=DTYPE, device_map="auto",
    trust_remote_code=True)
model.eval()

print("\\n============================================================")
print("VISION BRAIN LOADED")
print("============================================================")
print("Model device:", next(model.parameters()).device)

# ------------------------------------------------------------
# 7. MODEL FUNCTION
# ------------------------------------------------------------
def ask_vision(question, image):
    try:
        if not question and image is None:
            return "Please enter a question or upload an image."

        content = []
        if image is not None:
            content.append({"type": "image", "image": image})
        if question:
            content.append({"type": "text", "text": question})
        messages = [{"role": "user", "content": content}]

        prompt = processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True)
        image_inputs, video_inputs = process_vision_info(messages)
        inputs = processor(
            text=[prompt], images=image_inputs, videos=video_inputs,
            padding=True, return_tensors="pt")
        inputs = {k: v.to(MODEL_DEVICE) if hasattr(v, "to") else v
                  for k, v in inputs.items()}

        with torch.inference_mode():
            generated_ids = model.generate(
                **inputs, max_new_tokens=1024, do_sample=False)

        trimmed = [o[len(i):] for i, o in
                   zip(inputs["input_ids"], generated_ids)]
        answer = processor.batch_decode(
            trimmed, skip_special_tokens=True,
            clean_up_tokenization_spaces=False)[0]
        return answer.strip()

    except torch.cuda.OutOfMemoryError:
        torch.cuda.empty_cache()
        return ("CUDA OUT OF MEMORY\\n\\n"
                "Try a smaller image or shorter prompt.")
    except Exception as e:
        import traceback; traceback.print_exc()
        return f"ERROR\\n\\n{type(e).__name__}: {e}"

# ------------------------------------------------------------
# 8. GRADIO UI
# ------------------------------------------------------------
print("\\nCreating Gradio interface...")

with gr.Blocks(title="Dark Matter · Vision Brain",
               analytics_enabled=False) as demo:
    gr.Markdown("# Dark Matter · Vision Brain\\n"
                "Upload a screenshot and ask what it shows.")
    with gr.Row():
        with gr.Column():
            image_input = gr.Image(type="filepath", label="Screenshot")
            question_input = gr.Textbox(
                label="Question", lines=4,
                placeholder="Example: What is shown in this image?")
            with gr.Row():
                ask_button = gr.Button("Ask", variant="primary")
                clear_button = gr.Button("Clear")
        with gr.Column():
            answer_output = gr.Textbox(
                label="Description", lines=20, interactive=False)

    # api_name="predict" exposes the API the website calls.
    # Input order: [question, image].
    ask_button.click(fn=ask_vision,
                     inputs=[question_input, image_input],
                     outputs=answer_output,
                     api_name="predict", show_progress="full")
    clear_button.click(fn=lambda: ("", None, ""),
                       inputs=[],
                       outputs=[question_input, image_input,
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
