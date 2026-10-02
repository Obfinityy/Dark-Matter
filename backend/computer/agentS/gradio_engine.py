#!/usr/bin/env python3
"""
gradio_engine.py — Gradio-backed LLM engine for Infinity Agent.

The Infinity Agent expects an OpenAI-compatible engine, but our Kaggle
vision brain is a Gradio interface with a /predict endpoint using
MultimodalData format. This adapter bridges the gap.

Usage:
    from gradio_engine import GradioEngine
    engine = GradioEngine(base_url="https://xxx.gradio.live", model="Qwen2.5-VL")
    response = engine.generate("What do you see in this screenshot?")
"""

import json
import time
import urllib.request
import urllib.error


class GradioEngine:
    """
    LLM engine that talks to a Kaggle Gradio vision model.
    Implements the minimal interface Infinity Agent's worker needs.
    """

    def __init__(self, base_url, model="Qwen2.5-VL-7B", timeout=300):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def _post(self, path, data):
        url = self.base_url + path
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode("utf-8"),
            headers={"Content-Type": "application/json", "Connection": "close"},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="ignore")[:500]
            raise RuntimeError(f"Gradio HTTP {e.code}: {body}")

    def _poll_result(self, event_id):
        """Poll /call/predict/<event_id> until complete."""
        url = f"{self.base_url}/gradio_api/call/predict/{event_id}"
        deadline = time.time() + self.timeout
        while time.time() < deadline:
            req = urllib.request.Request(url, headers={"Connection": "close"})
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    text = resp.read().decode("utf-8")
            except Exception:
                time.sleep(2)
                continue

            if "event: complete" in text:
                for line in text.split("\n"):
                    if line.startswith("data: "):
                        data = json.loads(line[6:])
                        reply = data[0] if isinstance(data, list) else data
                        if isinstance(reply, str) and reply.strip():
                            return reply
                        raise RuntimeError("Empty reply from Gradio")
            elif "event: error" in text:
                raise RuntimeError(f"Gradio error: {text[:300]}")
            time.sleep(2)
        raise RuntimeError("Gradio predict timed out")

    def generate(self, prompt, max_tokens=2000):
        """
        Send a prompt to the vision model.
        Returns the text response.
        """
        # Step 1: Start prediction
        result = self._post("/gradio_api/call/predict", {
            "data": [{"text": prompt, "files": []}, None]
        })
        event_id = result.get("event_id")
        if not event_id:
            raise RuntimeError("No event_id from Gradio")

        # Step 2: Poll for result
        return self._poll_result(event_id)

    def generate_with_image(self, prompt, image_base64):
        """
        Send a prompt + screenshot to the vision model.
        image_base64: base64-encoded PNG/JPEG
        """
        # For now, pass image as file reference
        # Full implementation would upload via /gradio_api/upload
        return self.generate(
            f"[Screenshot attached as base64, {len(image_base64)} chars]\n\n{prompt}"
        )


if __name__ == "__main__":
    import sys
    url = sys.argv[1] if len(sys.argv) > 1 else "https://2c55290178ce4262a1.gradio.live"
    engine = GradioEngine(url)
    print("Testing:", url)
    try:
        resp = engine.generate("Reply with exactly: ok")
        print("Response:", resp[:100])
        print("SUCCESS" if "ok" in resp.lower() else "UNEXPECTED")
    except Exception as e:
        print("FAILED:", str(e)[:200])
