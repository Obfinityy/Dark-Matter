# Third-Party Notices — backend/src/control/

This directory (`backend/src/control/`) contains **original code** written for
Infinity AI. No third-party source code was copied into it. The files here were
informed by the published architectures of the following open-source projects
(concept/blueprint inspiration only):

## Midscene.js

- Project: Midscene.js — AI-powered UI automation SDK
- Repository: https://github.com/web-infra-dev/midscene
- License: MIT
- Inspiration: the `aiAct` / `aiQuery` / `aiAssert` interaction loop —
  screenshot → vision model → coordinates → action → re-observe → replan —
  informed the see → think → act loop structure in `agentLoop.js`. No Midscene
  code, prompts, or assets are included or reproduced here.

## Agent S

- Project: Agent S — open agentic framework for computer use
- Repository: https://github.com/simular-ai/Agent-S
- License: MIT
- Inspiration: the two-model split between a planner (manager) that reasons
  over screenshots and a grounder (worker) that resolves element coordinates
  informed the planner/grounder separation in `agentLoop.js`. No Agent S code
  is included or reproduced here.

## UI-TARS-desktop

- Project: UI-TARS-desktop — open-source AI agent for GUI automation
- Repository: https://github.com/bytedance/UI-TARS-desktop
- License: Apache-2.0
- Inspiration: the perceive → reason → act → verify architecture and the
  normalized 0–1000 coordinate convention informed `actions.js` and the
  verification step of the loop. No UI-TARS-desktop code is included or
  reproduced here.

## Branding note

In the Infinity AI product and UI, these concepts are presented under Infinity
AI names only. Original project names never appear in user-visible strings;
they are referenced here solely for license attribution and engineering
transparency, as their licenses require.
