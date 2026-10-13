# Hunt Engine — Docker stack (user's Linux machine)

Runs the Dark Matter hunt engine: the **PentAGI Go backend** (multi-agent
pentest orchestrator — orchestrator / researcher / developer / executor agents,
20+ tool sandbox, Postgres+pgvector memory), integrated **by reference** from
`../engine/pentagi` (vxcontrol/pentagi, MIT — legal copies in
`../third_party/pentagi/`). No React frontend, no observability stack.

## Quick start

```bash
cd docker
./setup-linux.sh
```

What it does:

1. Checks `docker` + the compose plugin.
2. Creates `.env` from `.env.example` (generates `COOKIE_SIGNING_SALT` and
   `POSTGRES_PASSWORD`; defaults `LLM_API_KEY` to `ollama`).
3. Builds `darkmatter/engine:latest` from `Dockerfile.engine`
   (backend-only multi-stage build — no Node, no frontend stage).
4. Starts `pgvector` (Postgres 17 + pgvector), then `engine`.
   First boot runs all DB migrations and seeds the `admin` user.
5. Mints `ENGINE_TOKEN` with the engine's **own** auth code
   (`tools/mint-engine-token`, a JWT stored in the `api_tokens` table) and
   writes it into `.env`.
6. Verifies `GET /api/v1/providers/` with the token, and checks the LLM
   server is reachable.

Re-running is idempotent: existing `.env` values are kept; the token is only
re-minted if `ENGINE_TOKEN` is empty.

## Services

| Service | Image | Ports | Data |
|---|---|---|---|
| `engine` | `darkmatter/engine:latest` (built) | `${ENGINE_PORT:-8080}` → 8080 | `dm-engine-data` volume + bind of `/var/run/docker.sock` |
| `pgvector` | `pgvector/pgvector:pg17` | none published | `dm-pgvector-data` volume |

The engine spawns pentest tool sandbox containers through the **host Docker
socket** — that bind mount is required, not optional.

## Environment

| Var | Default | Meaning |
|---|---|---|
| `ENGINE_PORT` | `8080` | Host port → engine API (`http://localhost:8080`) |
| `POSTGRES_PASSWORD` | (generated) | pgvector password |
| `COOKIE_SIGNING_SALT` | (generated) | Signs sessions + API tokens. **Rotating it invalidates `ENGINE_TOKEN`** — re-mint afterwards |
| `ENGINE_TOKEN` | (minted) | Bearer token for the engine API → hand to the Dark Matter backend |
| `LLM_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible LLM endpoint, **as seen from inside the container**. For host Ollama use `http://host.docker.internal:11434/v1` |
| `LLM_API_KEY` | `ollama` | Optional upstream; engine requires non-empty, Ollama accepts anything |
| `LLM_MODEL` | `qwen3:32b` | Model served at `LLM_BASE_URL` |
| `DOCKER_DEFAULT_IMAGE` | `debian:latest` | Sandbox image for tool containers (pulled on demand) |
| `TENANT_ID` | (empty) | Optional namespace for multiple instances |

## Useful commands

```bash
docker compose up -d            # start
docker compose logs -f engine   # engine logs
docker compose down             # stop (keeps volumes)
docker compose down -v          # stop AND wipe engine data + database

# Re-mint the orchestrator token (e.g. after salt rotation):
docker compose run --rm --no-deps \
  --entrypoint /opt/pentagi/bin/mint-engine-token engine

# Check the registered LLM provider:
curl -H "Authorization: Bearer $ENGINE_TOKEN" http://localhost:8080/api/v1/providers/
```

## API contract

`../engine/pentagi/INTEGRATION.md` — exact REST/GraphQL endpoints for
create flow `{target, scope}` → pause/resume/stop → poll/stream events →
fetch report/artifacts. The Dark Matter backend implements against that file.

## Security notes

- `.env` holds secrets (`chmod 600`, applied by the setup script). Never commit it.
- The engine API has no rate limiting by default; bind `ENGINE_PORT` to
  `127.0.0.1` (compose default publishes on all interfaces — set
  `"127.0.0.1:${ENGINE_PORT:-8080}:8080"` if the machine is shared).
- Hunts run only against authorized targets — the orchestrator enforces the
  TARGET/SCOPE contract from `INTEGRATION.md §3`.
