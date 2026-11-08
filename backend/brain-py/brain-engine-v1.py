#!/usr/bin/env python3
"""
Brain Engine v1 — Rule-Based Autonomous Bug Bounty Hunter
Built 29 Oct 2026. NO Meta API. NO local LLM. Pure deterministic expert system.

Architecture:
- Reads the playbook (brain-playbook-v1.md) for attack patterns.
- Polls the backend for hunt state (memory, process).
- Decides next action via deterministic rules.
- Submits via Brain Console JSON API.
- Loops until DVWA (or target) is exhausted.

Usage:
  python3 brain-engine-v1.py --hunt-id h_XXX --api https://api.thebhavesh.online --dry-run
  python3 brain-engine-v1.py --hunt-id h_XXX --api https://api.thebhavesh.online  # live
"""

import argparse
import json
import sys
import time
import urllib.request
import urllib.error

# DVWA modules in attack order (from playbook — easiest first, then harder)
DVWA_MODULES = [
    # (module_path, vuln_class, severity, pattern_key)
    ("vulnerabilities/xss_r/", "xss", "HIGH", "reflected_xss"),
    ("vulnerabilities/exec/", "cmdi", "CRITICAL", "command_injection"),
    ("vulnerabilities/fi/", "lfi", "HIGH", "file_inclusion"),
    ("vulnerabilities/xss_s/", "xss", "HIGH", "stored_xss"),
    ("vulnerabilities/sqli/", "sqli", "CRITICAL", "sqli_union"),
    ("vulnerabilities/sqli_blind/", "sqli", "CRITICAL", "sqli_blind"),
    ("vulnerabilities/brute/", "brute", "HIGH", "brute_force"),
    ("vulnerabilities/xss_d/", "xss", "HIGH", "dom_xss"),
    ("vulnerabilities/javascript/", "javascript", "MEDIUM", "js_logic"),
    ("vulnerabilities/csp/", "csp", "MEDIUM", "csp_bypass"),
    ("vulnerabilities/csrf/", "CSRF", "HIGH", "csrf"),
]

# Dead ends — never try these (from playbook)
DEAD_ENDS = [
    "vulnerabilities/upload/",  # rejected 2x
    "vulnerabilities/weak_id/",  # rejected 2x
    "vulnerabilities/captcha/",  # dead on all angles
    "vulnerabilities/open_redirect/",  # 404
    "vulnerabilities/authbypass/",  # 404
]

class BrainEngine:
    def __init__(self, hunt_id, api_base, dry_run=False):
        self.hunt_id = hunt_id
        self.api_base = api_base.rstrip("/")
        self.dry_run = dry_run
        self.tried_modules = set()
        self.verified_count = 0

    def api_get(self, path):
        url = f"{self.api_base}{path}"
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            print(f"API GET failed {url}: {e}", file=sys.stderr)
            return None

    def api_post(self, path, data):
        url = f"{self.api_base}{path}"
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            print(f"API POST failed {url}: {e}", file=sys.stderr)
            return None

    def get_hunt_state(self):
        """Fetch current hunt memory and process from backend."""
        # NOTE: Not yet implemented — returns an empty state until it is
        # wired to the backend hunt-state API.
        # For now, return empty state (fresh hunt)
        return {"memory": [], "process": None, "iteration": 0}

    def decide_next_module(self, state):
        """Pick the next untested module (deterministic order, skip dead ends and tried)."""
        tried = set(m.get("module") for m in state.get("memory", []))
        tried.update(self.tried_modules)

        for module_path, vuln_class, severity, pattern in DVWA_MODULES:
            if module_path in tried:
                continue
            if module_path in DEAD_ENDS:
                continue
            return {
                "module": module_path,
                "class": vuln_class,
                "severity": severity,
                "pattern": pattern,
            }
        return None  # All modules exhausted

    def generate_probe_action(self, module_info, turn_num):
        """
        Generate a probe action for the given module.
        Returns the JSON action object for the Brain Console.
        """
        pattern = module_info["pattern"]
        module = module_info["module"]

        # Each pattern maps to a probe template
        # The actual probe script is generated based on the pattern
        # For v1, we output a 'note' action describing the plan
        # (Full probe execution via shell actions comes in v2)

        return {
            "task": f"Probe {module} for {module_info['class']}",
            "goal": f"Verify {module_info['class']} vulnerability in {module}",
            "progress": f"Testing module {len(self.tried_modules)+1}/{len(DVWA_MODULES)}",
            "action": {
                "type": "note",
                "text": f"[Brain v1] Starting probe of {module} (pattern: {pattern}, class: {module_info['class']}, severity: {module_info['severity']}). See playbook for attack pattern."
            }
        }

    def run(self, max_turns=50):
        """Main loop: decide, act, observe, repeat."""
        print(f"[Brain v1] Starting on hunt {self.hunt_id} (dry_run={self.dry_run})")

        for turn in range(1, max_turns + 1):
            state = self.get_hunt_state()
            module = self.decide_next_module(state)

            if not module:
                print(f"[Brain v1] All modules exhausted. Verified: {self.verified_count}")
                break

            print(f"[Brain v1] Turn {turn}: Probing {module['module']} ({module['pattern']})")

            action_json = self.generate_probe_action(module, turn)

            if self.dry_run:
                print(f"[DRY RUN] Would submit: {json.dumps(action_json, indent=2)}")
            else:
                result = self.api_post(
                    f"/api/v1/hunts/{self.hunt_id}/brain-action",
                    action_json
                )
                if result:
                    print(f"[Brain v1] Action submitted, result: {result.get('ok', '?')}")
                else:
                    print(f"[Brain v1] Action submission failed")

            self.tried_modules.add(module["module"])
            time.sleep(2)  # Rate limit

        print(f"[Brain v1] Done. Modules tried: {len(self.tried_modules)}, Verified: {self.verified_count}")


def main():
    p = argparse.ArgumentParser(description="Brain Engine v1 — Rule-Based Bug Bounty Hunter")
    p.add_argument("--hunt-id", required=True, help="Hunt ID (e.g. h_830317bdc184)")
    p.add_argument("--api", default="https://api.thebhavesh.online", help="Backend API base URL")
    p.add_argument("--dry-run", action="store_true", help="Don't submit actions, just print them")
    p.add_argument("--max-turns", type=int, default=50, help="Max turns to run")
    args = p.parse_args()

    engine = BrainEngine(args.hunt_id, args.api, dry_run=args.dry_run)
    engine.run(max_turns=args.max_turns)


if __name__ == "__main__":
    main()
