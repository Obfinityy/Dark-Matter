#!/usr/bin/env bash
# Dark Matter hunt engine — one-shot setup for the user's Linux machine.
#   1. checks docker + compose plugin
#   2. creates .env from .env.example (random COOKIE_SIGNING_SALT, sane defaults)
#   3. builds the engine image (PentAGI backend only, no frontend)
#   4. starts pgvector, then the engine (DB migrations run at first boot)
#   5. mints ENGINE_TOKEN via the engine's own auth code, writes it to .env
#   6. verifies the API answers with the token
#
# Re-running is safe: it keeps existing .env values and re-mints the token only
# if ENGINE_TOKEN is empty.

set -euo pipefail
cd "$(dirname "$0")"

ENGINE_URL="http://localhost:${ENGINE_PORT:-8080}"

say()  { printf '\033[1;34m[setup]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[setup]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[setup] FATAL:\033[0m %s\n' "$*" >&2; exit 1; }

# --- 1. docker ---
command -v docker >/dev/null 2>&1 || die "docker not found — install Docker Engine first (https://docs.docker.com/engine/install/)"
docker compose version >/dev/null 2>&1 || die "docker compose plugin not found"
docker info >/dev/null 2>&1 || die "cannot talk to the Docker daemon — is it running? (try: sudo systemctl start docker)"
say "docker OK: $(docker --version | head -1)"

# --- 2. .env ---
if [[ ! -f .env ]]; then
  [[ -f .env.example ]] || die ".env.example missing"
  cp .env.example .env
  say "created .env from .env.example"
fi

get_env() { # get_env KEY -> value (empty if missing)
  grep -E "^${1}=" .env 2>/dev/null | tail -1 | cut -d= -f2- || true
}
set_env() { # set_env KEY VALUE (replace or append)
  local key="$1" val="$2"
  if grep -qE "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    printf '%s=%s\n' "$key" "$val" >> .env
  fi
}

if [[ -z "$(get_env COOKIE_SIGNING_SALT)" ]]; then
  command -v openssl >/dev/null 2>&1 || die "openssl not found (needed to generate COOKIE_SIGNING_SALT)"
  set_env COOKIE_SIGNING_SALT "$(openssl rand -hex 32)"
  say "generated COOKIE_SIGNING_SALT"
fi
if [[ -z "$(get_env POSTGRES_PASSWORD)" || "$(get_env POSTGRES_PASSWORD)" == "change-me-to-a-long-random-string" ]]; then
  set_env POSTGRES_PASSWORD "$(openssl rand -hex 24)"
  say "generated POSTGRES_PASSWORD"
fi
if [[ -z "$(get_env LLM_API_KEY)" ]]; then
  # The engine requires a non-empty key for its custom provider; Ollama accepts any string.
  set_env LLM_API_KEY "ollama"
  say "LLM_API_KEY empty -> defaulted to \"ollama\" (accepted by local Ollama)"
fi
if [[ "$(get_env LLM_BASE_URL)" == "http://localhost:11434/v1" ]]; then
  warn "LLM_BASE_URL is http://localhost:11434/v1 — from INSIDE the engine container"
  warn "'localhost' means the container itself. If Ollama runs on this host, set:"
  warn "  LLM_BASE_URL=http://host.docker.internal:11434/v1   (in .env, then re-run)"
fi
chmod 600 .env

# --- 3. build ---
say "building engine image (this downloads the Go toolchain image once; ~5-10 min first time)…"
docker compose build engine

# --- 4. start ---
say "starting pgvector…"
docker compose up -d pgvector
say "starting engine (first boot runs DB migrations)…"
docker compose up -d engine

say "waiting for the engine API…"
for i in $(seq 1 60); do
  if curl -fsS -m 5 "${ENGINE_URL}/api/v1/info" >/dev/null 2>&1; then
    say "engine is up at ${ENGINE_URL}"
    break
  fi
  [[ $i -eq 60 ]] && die "engine did not answer ${ENGINE_URL}/api/v1/info after 5 min — check: docker compose logs engine"
  sleep 5
done

# --- 5. mint ENGINE_TOKEN ---
if [[ -z "$(get_env ENGINE_TOKEN)" ]]; then
  say "minting ENGINE_TOKEN (engine's own auth code; stored in api_tokens)…"
  # The mint binary lives in the engine image; the service's environment block
  # already provides DATABASE_URL / COOKIE_SIGNING_SALT / TENANT_ID from .env.
  TOKEN="$(docker compose run --rm --no-deps \
      --entrypoint /opt/pentagi/bin/mint-engine-token engine 2>/tmp/mint-err.log || {
        cat /tmp/mint-err.log >&2; die "token minting failed";
      })"
  [[ -n "$TOKEN" ]] || die "mint returned empty token"
  set_env ENGINE_TOKEN "$TOKEN"
  chmod 600 .env
  say "ENGINE_TOKEN minted and saved to .env"
else
  say "ENGINE_TOKEN already present in .env — keeping it"
fi

# --- 6. verify ---
TOKEN="$(get_env ENGINE_TOKEN)"
if curl -fsS -m 10 -H "Authorization: Bearer ${TOKEN}" "${ENGINE_URL}/api/v1/providers/" >/dev/null 2>&1; then
  say "token verified: GET /api/v1/providers/ -> 200"
else
  warn "token check failed — the engine answered but rejected the token."
  warn "Try: docker compose logs engine | tail -50"
fi

# --- LLM sanity ---
LLM_URL="$(get_env LLM_BASE_URL)"
if curl -fsS -m 5 "${LLM_URL%/v1}/v1/models" >/dev/null 2>&1 || curl -fsS -m 5 "${LLM_URL}/models" >/dev/null 2>&1; then
  say "LLM server reachable at ${LLM_URL}"
else
  warn "could not reach an LLM server at ${LLM_URL}"
  warn "Start Ollama on this host (ollama serve) and pull the model: ollama pull $(get_env LLM_MODEL)"
  warn "Hunts will fail at flow creation until the LLM server answers."
fi

say "done. Engine API: ${ENGINE_URL}  |  contract: ../engine/pentagi/INTEGRATION.md"
say "Hand ENGINE_TOKEN to the Dark Matter backend as the ENGINE_TOKEN env var."
