#!/usr/bin/env python3
"""
capture_proof_shot.py — headless proof screenshot for a finding.

Usage:
  python3 capture_proof_shot.py <url> <output.jpg> [--inject-alert]

Navigates to <url> in headless Chromium, auto-dismisses JS dialogs (so the
page behind an alert() is captured, proving the injection rendered), and
saves a JPEG screenshot. Prints a JSON summary to stdout:
  {"ok": true, "path": ..., "dialogFired": true, "dialogMessage": ...}

Exit codes: 0 = ok, 1 = navigation failed, 2 = usage error.
"""
import json
import sys

URL = sys.argv[1] if len(sys.argv) > 1 else None
OUT = sys.argv[2] if len(sys.argv) > 2 else None

if not URL or not OUT:
    print("usage: capture_proof_shot.py <url> <output.jpg>", file=sys.stderr)
    sys.exit(2)


def main():
    from playwright.sync_api import sync_playwright

    dialog_info = {"fired": False, "message": None}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        def on_dialog(dialog):
            dialog_info["fired"] = True
            dialog_info["message"] = dialog.message
            dialog.dismiss()  # dismiss so the injected page is visible behind

        page.on("dialog", on_dialog)
        try:
            page.goto(URL, wait_until="domcontentloaded", timeout=20000)
        except Exception as e:
            browser.close()
            print(json.dumps({"ok": False, "error": f"navigation failed: {e}"}))
            sys.exit(1)
        page.wait_for_timeout(1500)  # let the injected script execute
        page.screenshot(path=OUT, type="jpeg", quality=82)
        browser.close()

    print(json.dumps({
        "ok": True,
        "path": OUT,
        "dialogFired": dialog_info["fired"],
        "dialogMessage": dialog_info["message"],
    }))


if __name__ == "__main__":
    main()
