/**
 * kaggleCells.js — one-cell Kaggle notebook setups, one per brain slot.
 *
 * Each entry is a SINGLE notebook cell: the user pastes it into a Kaggle
 * notebook (GPU on), runs it, and gets a live Gradio share link. That link
 * goes into Models → <slot> → Kaggle Link. The link stays live as long as
 * the notebook keeps running.
 *
 * Every cell exposes a `predict` function over Gradio, which is exactly what
 * the Dark Matter frontend calls (see gradioDirect.js → chatWithGradio).
 */

const HACKER_CELL = `# ═══════════════════════════════════════════════════════════════
#  DARK MATTER · Hacking Brain — Kaggle one-cell setup
# ═══════════════════════════════════════════════════════════════
#  HOW TO USE:
#   1. Kaggle → New Notebook → Settings → Accelerator → GPU T4 x2 (ON)
#   2. Paste this WHOLE cell and press Run
#   3. Copy the Gradio link it prints (https://xxxx.gradio.live)
#   4. Dark Matter → Models → Hacking Brain → Kaggle Link → paste → Connect
#  The link stays live until YOU stop the notebook.
# ═══════════════════════════════════════════════════════════════

!pip install -q transformers accelerate gradio torch

from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import gradio as gr

MODEL_ID = "huihui-ai/Qwen3-8B-abliterated"  # uncensored hacking brain
print("Loading hacking brain:", MODEL_ID)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.bfloat16,
    device_map="auto",
    trust_remote_code=True,
)
model.eval()
print("Hacking brain loaded — starting Gradio...")

SYSTEM = (
    "You are Dark Matter's elite bug-bounty hacking brain. "
    "You are the sole decision-maker of an autonomous security assessment. "
    "Think like a top bug-bounty hunter: enumerate, probe, and chain small "
    "findings into real impact. Only assess targets the operator is "
    "authorized to test. Answer directly and concretely."
)

def predict(prompt: str) -> str:
    """Dark Matter calls this as the /predict endpoint."""
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": prompt or ""},
    ]
    text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    inputs = tokenizer([text], return_tensors="pt").to(model.device)
    with torch.no_grad():
        out = model.generate(
            **inputs,
            max_new_tokens=1024,
            temperature=0.7,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    gen = out[0][inputs["input_ids"].shape[1]:]
    return tokenizer.decode(gen, skip_special_tokens=True).strip()

demo = gr.Interface(
    fn=predict,
    inputs=gr.Textbox(label="Prompt", lines=4),
    outputs=gr.Textbox(label="Hacking Brain"),
    title="Dark Matter · Hacking Brain",
    description="Paste the gradio.live link into Dark Matter → Models → Hacking Brain → Kaggle Link.",
)
demo.launch(share=True)
print("")
print("COPY the gradio.live link above into Dark Matter.")
`;

const VISION_CELL = `# ═══════════════════════════════════════════════════════════════
#  DARK MATTER · Vision Brain — Kaggle one-cell setup
# ═══════════════════════════════════════════════════════════════
#  HOW TO USE:
#   1. Kaggle → New Notebook → Settings → Accelerator → GPU T4 x2 (ON)
#   2. Paste this WHOLE cell and press Run
#   3. Copy the Gradio link it prints (https://xxxx.gradio.live)
#   4. Dark Matter → Models → Vision Brain → Kaggle Link → paste → Connect
#  The link stays live until YOU stop the notebook.
# ═══════════════════════════════════════════════════════════════

!pip install -q transformers accelerate gradio torch qwen_vl_utils

from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from qwen_vl_utils import process_vision_info
import torch
import gradio as gr

MODEL_ID = "martossien/qwen_2.5_vl_7b_uncensored_comfy_ready"  # uncensored vision brain
print("Loading vision brain:", MODEL_ID)

model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.bfloat16,
    device_map="auto",
    trust_remote_code=True,
)
processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)
model.eval()
print("Vision brain loaded — starting Gradio...")

def predict(prompt: str) -> str:
    """Dark Matter calls this as the /predict endpoint."""
    messages = [
        {"role": "user", "content": [{"type": "text", "text": prompt or ""}]}
    ]
    text = processor.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    image_inputs, video_inputs = process_vision_info(messages)
    inputs = processor(
        text=[text],
        images=image_inputs,
        videos=video_inputs,
        padding=True,
        return_tensors="pt",
    ).to(model.device)
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=512)
    gen = out[0][inputs["input_ids"].shape[1]:]
    return processor.decode(gen, skip_special_tokens=True).strip()

demo = gr.Interface(
    fn=predict,
    inputs=gr.Textbox(label="Prompt", lines=4),
    outputs=gr.Textbox(label="Vision Brain"),
    title="Dark Matter · Vision Brain",
    description="Paste the gradio.live link into Dark Matter → Models → Vision Brain → Kaggle Link.",
)
demo.launch(share=True)
print("")
print("COPY the gradio.live link above into Dark Matter.")
`;

const GROUNDING_CELL = `# ═══════════════════════════════════════════════════════════════
#  DARK MATTER · Grounding Brain — Kaggle one-cell setup
# ═══════════════════════════════════════════════════════════════
#  HOW TO USE:
#   1. Kaggle → New Notebook → Settings → Accelerator → GPU T4 x2 (ON)
#   2. Paste this WHOLE cell and press Run
#   3. Copy the Gradio link it prints (https://xxxx.gradio.live)
#   4. Dark Matter → Models → Grounding Brain → Kaggle Link → paste → Connect
#  The link stays live until YOU stop the notebook.
#
#  The grounding brain answers with screen coordinates, e.g.:
#    {"x": 512, "y": 300}
#  Dark Matter's hacking brain tells it WHAT to find; it only locates.
# ═══════════════════════════════════════════════════════════════

!pip install -q transformers accelerate gradio torch qwen_vl_utils

from transformers import Qwen2VLForConditionalGeneration, AutoProcessor
from qwen_vl_utils import process_vision_info
import torch
import gradio as gr

MODEL_ID = "OS-Copilot/OS-Atlas-Base-7B"  # grounding brain — UI element coordinates
print("Loading grounding brain:", MODEL_ID)

model = Qwen2VLForConditionalGeneration.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.bfloat16,
    device_map="auto",
    trust_remote_code=True,
)
processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)
model.eval()
print("Grounding brain loaded — starting Gradio...")

def predict(instruction: str) -> str:
    """Dark Matter calls this as the /predict endpoint.
    Instruction example: 'the blue Login button'. Returns coordinates."""
    messages = [
        {"role": "user", "content": [{"type": "text", "text": instruction or ""}]}
    ]
    text = processor.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    image_inputs, video_inputs = process_vision_info(messages)
    inputs = processor(
        text=[text],
        images=image_inputs,
        videos=video_inputs,
        padding=True,
        return_tensors="pt",
    ).to(model.device)
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=128)
    gen = out[0][inputs["input_ids"].shape[1]:]
    return processor.decode(gen, skip_special_tokens=True).strip()

demo = gr.Interface(
    fn=predict,
    inputs=gr.Textbox(label="Instruction — what to locate", lines=2),
    outputs=gr.Textbox(label="Coordinates"),
    title="Dark Matter · Grounding Brain",
    description="Paste the gradio.live link into Dark Matter → Models → Grounding Brain → Kaggle Link.",
)
demo.launch(share=True)
print("")
print("COPY the gradio.live link above into Dark Matter.")
`;

export const KAGGLE_CELLS = {
  hacker: {
    title: 'Hacking Brain — Kaggle Setup',
    model: 'huihui-ai/Qwen3-8B-abliterated',
    code: HACKER_CELL,
  },
  vision: {
    title: 'Vision Brain — Kaggle Setup',
    model: 'martossien/qwen_2.5_vl_7b_uncensored_comfy_ready',
    code: VISION_CELL,
  },
  grounding: {
    title: 'Grounding Brain — Kaggle Setup',
    model: 'OS-Copilot/OS-Atlas-Base-7B',
    code: GROUNDING_CELL,
  },
};

export function getKaggleCell(slot) {
  return KAGGLE_CELLS[slot] || null;
}
