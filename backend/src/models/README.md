# models/ — Data Models

Persistence schemas for MongoDB (Mongoose): users, hunts, findings, reports,
agent state, and billing.

## Key files

- `agentJobModel.js`, `agentStateModel.js`, `agentMemoryModel.js` — agent persistence
- `computerTaskModel.js`, `computerActionModel.js` — Control-mode persistence
- `alertModel.js`, `assessmentModel.js` — alerts and assessments
- `brainProviderModel.js` — brain provider configuration

## Conventions

- One file per model; schema + indexes + statics live together.
- Models never contain business logic — that lives in `services/`.
- Production uses MongoDB Atlas; development falls back to in-memory storage.
