# Dark Matter engine tools

Extra hunt tools for the PentAGI engine's Docker sandbox. The PentAGI agents
invoke these via their shell/code execution tools inside tool sandboxes —
no Go changes to the engine needed.

| Tool | What | Technique |
|------|------|-----------|
| `jwt-battery/` | JWT attack matrix: alg:none, RS256→HS256 confusion, weak-secret crack, kid traversal, claim-tamper replay | Research 5c |
| `nuclei/` | Verified-check template scanning (near-zero FP by construction) | Research 2a/2b |
| `api-sequencer/` | Stateful REST API fuzzing: producer→consumer sequences + 500 oracle | Research 5a |

All tools: **authorized targets only**, JSON output for the hunt pipeline.

## Usage from a hunt

```bash
# JWT observed in traffic? Run the battery:
python3 docker/tools/jwt-battery/jwt-battery.py \
  --token <jwt> --url https://target.test/api/me \
  --tamper '{"role":"admin"}'

# Template scan for known-exploited vulns:
bash docker/tools/nuclei/run-nuclei.sh https://target.test critical,high

# OpenAPI available? Sequence-fuzz it:
python3 docker/tools/api-sequencer/api-sequencer.py \
  --spec openapi.json --base https://target.test --auth "Bearer <tok>"
```

## Wiring into PentAGI

PentAGI agents get a shell in their Docker tool sandbox. Add these to the
agent's tool guidance (or a wrapper script on PATH inside the sandbox image):

1. Copy/symlink `docker/tools/*` into the sandbox image, or mount the
   directory read-only.
2. Tell the Orchestrator agent: "when you see a JWT, run jwt-battery;
   after recon, run nuclei critical/high; when OpenAPI is found, run
   api-sequencer."
3. Parse the JSON output into `finding` events — they flow into the
   backend's hunt-intel pipeline (dedupe → confirm → score → chain).

See `engine/pentagi/INTEGRATION.md` for the full contract.
