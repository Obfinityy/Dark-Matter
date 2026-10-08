# jobs/ — Background Workers

Async job processing for long-running work: hunt execution, Control-mode
tasks, and crew coordination.

## Key files

- `jobManager.js` — job queue, scheduling, and status tracking
- `agentWorker.js` — executes autonomous agent jobs
- `computerTaskWorker.js` — executes Control-mode tasks (drives `control/agentLoop.js`)
- `crewWorker.js` — coordinates multi-agent crew jobs

## Conventions

- Jobs are resumable and report progress via SSE event streams.
- Workers are the only place long-running loops live — never block request handlers.
