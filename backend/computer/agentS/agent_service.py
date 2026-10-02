#!/usr/bin/env python3
"""
Dark-Matter Agent S integration service.

Runs Simular's Agent S computer-use loop with the user's own vision brain
(Kaggle-hosted) + UI-TARS grounding model. The brain SEES screenshots and
reasons like a human: observe → think → click/type → observe again.

Protocol (newline-delimited JSON on stdin/stdout — same as openInterfaceBridge):
  request : {"id": "<str>", "cmd": "run_task", "params": {"instruction": "..."}}
            {"id": "<str>", "cmd": "stop"}
            {"id": "<str>", "cmd": "probe"}
  response: {"id": "<str>", "ok": true, "result": {...}}
            {"id": "<str>", "ok": false, "error": {"message": "...", "kind": "..."}}
  events  : {"event": "agent.thought", "data": {...}}     (no "id" — streamed)
            {"event": "agent.action", "data": {...}}
            {"event": "agent.screenshot", "data": {...}}
            {"event": "agent.done", "data": {...}}
            {"event": "agent.error", "data": {...}}

Config via environment:
  DM_VISION_URL      OpenAI-compatible endpoint for the vision brain
                     (e.g. https://xxx.gradio.live/v1) — runs on Kaggle
  DM_VISION_MODEL    Model name (e.g. Qwen2.5-VL-7B-Instruct)
  DM_VISION_API_KEY  API key if needed (default: empty)
  DM_GROUND_URL      Grounding endpoint — LOCAL Ollama by default:
                     http://localhost:11434/v1  (ollama pull hf.co/Mungert/UI-TARS-1.5-7B-GGUF:Q6_K_M)
                     Falls back to Kaggle if DM_GROUND_URL points there.
  DM_GROUND_MODEL    Grounding model name (default: hf.co/Mungert/UI-TARS-1.5-7B-GGUF:Q6_K_M)
  DM_PLATFORM        windows | linux | darwin (auto-detected if empty)

Requires: pip install gui-agents pyautogui pillow
"""

import base64
import io
import json
import os
import sys
import threading
import traceback

# ---------------------------------------------------------------- config

def _env(name, default=""):
    return os.environ.get(name, default).strip() or default

VISION_URL = _env("DM_VISION_URL")
VISION_MODEL = _env("DM_VISION_MODEL", "Qwen2.5-VL-7B-Instruct")
VISION_API_KEY = _env("DM_VISION_API_KEY", "not-needed")
# Grounding runs LOCALLY via Ollama (free) — user installs once:
#   ollama pull hf.co/Mungert/UI-TARS-1.5-7B-GGUF:Q6_K_M
GROUND_URL = _env("DM_GROUND_URL", "http://localhost:11434/v1")
GROUND_MODEL = _env("DM_GROUND_MODEL", "hf.co/Mungert/UI-TARS-1.5-7B-GGUF:Q6_K_M")

PLATFORM = _env("DM_PLATFORM") or {
    "win32": "windows", "linux": "linux", "darwin": "darwin",
}.get(sys.platform, "windows")

# ---------------------------------------------------------------- output

_out_lock = threading.Lock()

def _send(obj):
    line = json.dumps(obj, ensure_ascii=False)
    with _out_lock:
        sys.stdout.write(line + "\n")
        sys.stdout.flush()

def _event(name, data):
    _send({"event": name, "data": data or {}})

def _respond(req_id, ok, result=None, error=None):
    payload = {"id": req_id, "ok": bool(ok)}
    if ok:
        payload["result"] = result if result is not None else {}
    else:
        payload["error"] = error or {"message": "unknown error", "kind": "error"}
    _send(payload)

# ---------------------------------------------------------------- agent

_agent = None
_agent_lock = threading.Lock()
_stop_flag = threading.Event()

def _get_agent():
    global _agent
    with _agent_lock:
        if _agent is not None:
            return _agent
        try:
            from infinity_agents.s3.agents.infinity_agent import InfinityAgent3
            from infinity_agents.s3.agents.grounding import OSWorldGroundingAgent
        except ImportError as e:
            raise RuntimeError(
                "infinity-agents not installed. Run: pip install -e /path/to/infinity-agent"
            ) from e

        if not VISION_URL:
            raise RuntimeError("DM_VISION_URL is not set — no vision brain configured.")
        if not GROUND_URL:
            raise RuntimeError("DM_GROUND_URL is not set — no grounding model configured.")

        # Vision brain via OpenAI-compatible endpoint (vLLM / Gradio).
        engine_params = {
            "engine_type": "openai",
            "model": VISION_MODEL,
            "base_url": VISION_URL.rstrip("/"),
            "api_key": VISION_API_KEY,
        }

        # UI-TARS grounding: turns "the search bar" into x,y coordinates.
        grounding_agent = OSWorldGroundingAgent(
            ground_provider="huggingface",
            ground_url=GROUND_URL.rstrip("/"),
            ground_model=GROUND_MODEL,
            grounding_width=1920,
            grounding_height=1080,
        )

        _agent = InfinityAgent3(
            engine_params,
            grounding_agent,
            platform=PLATFORM,
        )
        return _agent

def _run_task(instruction):
    """Run one Agent S task, streaming events. Blocking — call in a thread."""
    _stop_flag.clear()
    agent = _get_agent()

    _event("agent.started", {"instruction": instruction, "platform": PLATFORM})

    try:
        # Agent S3 entry point: predict() runs the observe→think→act loop.
        # We wrap it so thoughts/actions stream as events.
        result = agent.predict(
            instruction=instruction,
            observation_callback=_on_observation,
        )
        _event("agent.done", {"result": str(result)[:2000]})
        return {"done": True, "result": str(result)[:2000]}
    except Exception as e:
        if _stop_flag.is_set():
            _event("agent.stopped", {})
            return {"done": False, "stopped": True}
        _event("agent.error", {"message": str(e)[:500]})
        raise

def _on_observation(obs):
    """Called by the agent loop with screenshots/thoughts/actions."""
    if _stop_flag.is_set():
        raise InterruptedError("task stopped by user")
    kind = (obs or {}).get("type", "unknown")
    if kind == "screenshot":
        # Don't ship raw pixels over the pipe by default — metadata only.
        # The brain already saw the image; the UI doesn't need it.
        png = (obs or {}).get("image")
        _event("agent.screenshot", {
            "width": (obs or {}).get("width"),
            "height": (obs or {}).get("height"),
        })
    elif kind == "thought":
        _event("agent.thought", {"text": str((obs or {}).get("text", ""))[:1000]})
    elif kind == "action":
        _event("agent.action", {
            "action": str((obs or {}).get("action", ""))[:300],
            "detail": str((obs or {}).get("detail", ""))[:300],
        })

# ---------------------------------------------------------------- commands

def _cmd_probe(_params):
    try:
        import gui_agents  # noqa
        has_agent_s = True
    except ImportError:
        has_agent_s = False
    return {
        "driver": "agent_s",
        "agent_s_installed": has_agent_s,
        "platform": PLATFORM,
        "vision_configured": bool(VISION_URL),
        "vision_model": VISION_MODEL,
        "grounding_configured": bool(GROUND_URL),
        "grounding_model": GROUND_MODEL,
    }

def _cmd_run_task(params, req_id):
    instruction = str((params or {}).get("instruction", "")).strip()
    if not instruction:
        _respond(req_id, False, error={"message": "instruction is required", "kind": "bad_request"})
        return
    # Run in this thread but stream events; respond when done.
    try:
        result = _run_task(instruction)
        _respond(req_id, True, result=result)
    except Exception as e:
        _respond(req_id, False, error={
            "message": str(e)[:500],
            "kind": "agent_failed",
            "trace": traceback.format_exc()[-2000:],
        })

def _cmd_stop(_params):
    _stop_flag.set()
    return {"stopped": True}

_COMMANDS = {
    "probe": _cmd_probe,
    "run_task": _cmd_run_task,  # handled specially (needs req_id)
    "stop": _cmd_stop,
}

def main():
    _event("service.ready", {"driver": "agent_s", "platform": PLATFORM})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue
        req_id = req.get("id")
        cmd = req.get("cmd")
        params = req.get("params") or {}
        try:
            if cmd == "run_task":
                _cmd_run_task(params, req_id)
            elif cmd in _COMMANDS:
                _respond(req_id, True, result=_COMMANDS[cmd](params))
            else:
                _respond(req_id, False, error={"message": f"unknown cmd: {cmd}", "kind": "bad_request"})
        except Exception as e:
            _respond(req_id, False, error={"message": str(e)[:500], "kind": "error"})

if __name__ == "__main__":
    main()
