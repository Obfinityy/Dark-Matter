# Dark Matter ↔ PentAGI Engine — Integration Contract

This document is the exact API contract the Dark Matter backend (orchestrator)
uses to drive the PentAGI hunt engine. Every path, header, and payload shape
below was read from the engine source in this directory
(`backend/pkg/server/router.go`, `backend/pkg/server/services/*`,
`backend/pkg/graph/schema.graphqls`, `backend/pkg/config/config.go`).

Upstream: vxcontrol/pentagi (MIT). Integrated by reference; UI fully replaced by
Dark Matter. `third_party/pentagi/LICENSE` + `NOTICE` are the legal copies.

## 1. Connection

| Item | Value |
|---|---|
| Engine base URL | `http://localhost:8080` (default; override via `ENGINE_BASE_URL`) |
| REST base path | `/api/v1` |
| GraphQL endpoint | `/api/v1/graphql` (HTTP POST for queries/mutations, WebSocket for subscriptions) |
| Auth | `Authorization: Bearer <ENGINE_TOKEN>` on every `/api/v1/*` call (token tier) |
| Health / token check | `GET /api/v1/info` — public; with a valid token it returns session info (type, privs, expiry). Use this to validate `ENGINE_TOKEN` |

`ENGINE_TOKEN` is a PentAGI API token (JWT signed with the engine's
`COOKIE_SIGNING_SALT`). It is **not** a static secret you invent: it is minted
once by the bootstrap tool (`docker/tools/mint-engine-token/`) and stored in
the engine's `api_tokens` table. Token creation is disabled when the salt is the
default, so the setup script always generates a real salt. The backend
orchestrator must treat `ENGINE_TOKEN` as a secret (never log it).

Port: the engine listens on plain HTTP (no TLS) on `SERVER_PORT`
(default `8080`; `SERVER_USE_SSL=false`). Bind is loopback-friendly; the compose
file maps it to the host.

## 2. LLM provider (no external key required)

The engine's `custom` provider is an OpenAI-compatible client, selected at flow
creation time with `"provider": "custom"`. Configure it with these env vars
(setup script maps the friendly names in the left column):

| Dark Matter env | PentAGI env | Default | Notes |
|---|---|---|---|
| `LLM_BASE_URL` | `LLM_SERVER_URL` | `http://localhost:11434/v1` | local Ollama |
| `LLM_API_KEY` | `LLM_SERVER_KEY` | `ollama` | PentAGI **requires** this non-empty; for Ollama any string works, so the setup script substitutes `ollama` when unset |
| `LLM_MODEL` | `LLM_SERVER_MODEL` | `qwen3:32b` | model served at `LLM_BASE_URL` |
| (optional) | `LLM_SERVER_PROVIDER` | `` | provider prefix, usually left empty |

If `LLM_SERVER_URL` is set but `LLM_SERVER_KEY` is empty, the custom provider
is disabled (warning in logs) and flow creation fails — the defaults above
prevent this. Verify provider availability with `GET /api/v1/providers/`
(returns the providers the engine actually registered).

## 3. Authorized targets only — scope contract

PentAGI is authorized-testing-only by design (see upstream `EULA.md`; "Only test
systems you own or are explicitly authorized to assess"). The engine itself
does **not** hard-enforce scope — scope is a contract the orchestrator enforces
and passes to the engine inside the flow `input`. Every create-flow call MUST
use this input template:

```
TARGET: <primary target, e.g. https://target.example.com>
SCOPE:
  - <in-scope host/URL 1>
  - <in-scope host/URL 2>
AUTHORIZATION: <who authorized this test, e.g. "owner self-test" / bug-bounty program name + URL>
OUT_OF_SCOPE: <explicitly excluded hosts, if any>

<task instructions for the hunt>
```

The DM backend MUST refuse to create a flow when target/scope are missing or
unverifiable. The engine will happily attack anything in `input` — the guard
rails live in the orchestrator, never bypass them.

## 4. REST API (verified)

All paths below are relative to `/api/v1`. All require the Bearer token.
Responses are JSON: `{"data": ..., "error": null}` on success.

### 4.1 Create a hunt (flow)

```
POST /api/v1/flows/
Content-Type: application/json
Authorization: Bearer <ENGINE_TOKEN>

{
  "input": "<TARGET/SCOPE block + task, see §3> (required)",
  "provider": "custom",
  "functions": { ... },        // optional: enable/disable tool functions
  "resource_ids": [ ... ]      // optional: resource IDs to attach
}
```

→ `201` with the flow object: `{"data": {"id": 12, "status": "created",
"title": "...", "model": "...", "model_provider_name": "custom", ...}}`.
The flow starts executing immediately.

### 4.2 Get flow status (poll)

```
GET /api/v1/flows/
GET /api/v1/flows/:flowID
GET /api/v1/flows/:flowID/graph     # task/subtask graph
```

`status` is one of: `created | running | waiting | finished | failed`.
`waiting` = the flow is paused at an ask-checkpoint and needs input (see
`action: "input"` below) — this is the closest thing to "paused".

### 4.3 Control a flow (stop / finish / resume / report / rename)

```
PUT /api/v1/flows/:flowID
Content-Type: application/json

{"action": "stop"}                                  # terminal stop
{"action": "finish"}                                # mark finished (waits for in-flight reports)
{"action": "input", "input": "<operator reply>"}    # resume a waiting flow / answer its question
{"action": "report", "timeout": 600}                # async: generate write-up (30–7200s budget)
{"action": "rename", "name": "<new title>"}
```

→ `200` with the updated flow object.

**Pause/resume:** PentAGI has **no native pause**. Contract mapping:
- *Pause* → the flow pauses itself at checkpoints (`status: "waiting"`);
  there is no operator-initiated pause. If the operator needs to halt work,
  `stop` is terminal (the flow cannot be resumed afterwards).
- *Resume* → when `status == "waiting"`, send `{"action":"input", ...}`.
  DM-side hunt checkpointing should snapshot flow state via the poll
  endpoints (§4.2/§4.5) so a stopped hunt can be recreated as a new flow.
- *Stop* → `{"action":"stop"}` (terminal).

```
DELETE /api/v1/flows/:flowID    # delete a flow and its data
```

### 4.4 Stream events

Two options. REST polling is the simple, recommended one for v1.

**A. Poll (recommended for v1)**

```
GET /api/v1/flows/:flowID/agentlogs       # agent "thinking" steps
GET /api/v1/flows/:flowID/msglogs         # LLM messages; type "report" = generated write-ups
GET /api/v1/flows/:flowID/toolcalls       # tool_call records (name, args, result)
GET /api/v1/flows/:flowID/termlogs        # terminal output
GET /api/v1/flows/:flowID/screenshots     # screenshots
GET /api/v1/flows/:flowID/searchlogs      # web-search activity
GET /api/v1/flows/:flowID/vecstorelogs    # vector-store / memory activity
GET /api/v1/flows/:flowID/tasks           # tasks
GET /api/v1/flows/:flowID/tasks/:taskID/subtasks
GET /api/v1/flows/:flowID/containers      # sandbox containers
```

Map to the DM event model: thinking → `agentlogs`, tool_call →
`toolcalls`, finding → `msglogs` (scan for finding-style entries; formal
write-ups arrive as `type: "report"`), status → `GET /flows/:flowID`,
done → `status: "finished" | "failed"`.

**B. GraphQL subscriptions (live push)**

WebSocket to `/api/v1/graphql` (graphql-ws protocol, `Authorization` header
or connection params carrying the Bearer token):

```graphql
subscription { flowUpdated(flowId: "12") { id status title } }
subscription { taskUpdated(flowId: "12") { id status title } }
subscription { toolCallLogAdded(flowId: "12") { id toolName args result } }
subscription { toolCallLogUpdated(flowId: "12") { id status } }
subscription { messageLogAdded(flowId: "12") { id type content } }
subscription { messageLogUpdated(flowId: "12") { id content } }
subscription { agentLogAdded(flowId: "12") { id content } }
subscription { terminalLogAdded(flowId: "12") { id content } }
subscription { screenshotAdded(flowId: "12") { id } }
subscription { flowFileAdded(flowId: "12") { id name path } }
```

(Other subscriptions exist: `flowCreated`, `flowDeleted`, `taskCreated`,
`assistantCreated/Updated/Deleted`, `searchLogAdded`, `vectorStoreLogAdded`,
`assistantLogAdded/Updated`, `providerCreated/Updated/Deleted`. Full list in
`backend/pkg/graph/schema.graphqls`.)

Mutations mirror the REST calls:
`createFlow(modelProvider: String!, input: String!, resourceIds: [ID!])`,
`putUserInput(flowId:, input:, ...)`, `stopFlow`, `finishFlow`, `deleteFlow`,
`renameFlow`.

### 4.5 Fetch report / artifacts

1. Trigger: `PUT /api/v1/flows/:flowID {"action":"report","timeout":600}`
   (async — returns `200` immediately; the write-up runs in the background).
2. Poll `GET /api/v1/flows/:flowID/msglogs` for an entry with
   `"type": "report"` — that is the written report.
3. List files: `GET /api/v1/flows/:flowID/files` → `{"data":{"files":[{name,path,...}],"total":n}}`.
4. Download: `GET /api/v1/flows/:flowID/files/download?path=<path>`
   (repeat `paths[]=<p>` for several). Also `GET .../files/container`
   lists the sandbox container filesystem.

## 5. Providers & misc

```
GET /api/v1/providers/        # providers actually registered (expect "custom")
GET /api/v1/settings/         # engine settings (read-only)
```

## 6. Known gaps / honest caveats

- **No SSE stream of flow events.** Live updates are GraphQL subscriptions
  (WebSocket) or REST polling — both verified above. There is no
  `text/event-stream` endpoint.
- **No operator pause.** See §4.3 mapping. A stopped flow cannot be resumed;
  DM checkpointing must recreate flows.
- **Report is asynchronous.** `action: "report"` returns before the write-up
  exists; the caller must poll `msglogs` for `type: "report"`.
- **Scope is not engine-enforced.** The TARGET/SCOPE contract (§3) is enforced
  by the DM orchestrator, not by PentAGI.
- **Token is engine-minted.** `ENGINE_TOKEN` must come from the bootstrap
  tool; hand-crafted values will fail signature/cache checks.
- **Sandbox needs Docker.** The engine spawns pentest tool containers via the
  host Docker socket — the engine container must mount `/var/run/docker.sock`
  (see `docker/`).

## Test files removed
4 upstream `*_test.go` files were removed from this vendored copy because
they contain fake secret-like keys (e.g. `sk-ant-api03-k`) that trip GitHub
push protection (GH013). They are unit tests, not runtime code:
- `backend/cmd/installer/wizard/controller/controller_test.go`
- `backend/pkg/config/config_test.go`
- `backend/pkg/providers/anthropic/anthropic_test.go`
- `backend/pkg/providers/routing_test.go`
