# Frontend integration guide — agent console (issues #1 + #3)

The agent console is a self-contained feature tree under
`frontend/src/` (this package). It talks to the backend's
orchestration REST API through `services/api.js`.

## Principles

1. **Infinity Chat is functionally untouched.** Do not change its
   components, reducers, stores, or websocket handlers. The agent
   console is a *parallel* surface: its own pages, its own API
   client, its own state. The only changes to existing files are the
   additive ones listed in "Wiring" below.
2. **One API client.** Everything agent-related goes through
   `services/api.js`. Do not sprinkle `fetch` calls in components.
   New backend endpoint? Add a client function there first.
3. **JWT auth.** `login`/`register` store `{ user, token }` in
   `localStorage` under `darkmatter_auth`. `api.js` attaches
   `Authorization: Bearer <token>` automatically. On a `401`, the
   user is signed out. SSE streams (`EventSource`) cannot set
   headers, so terminal/pull streams use the session cookie —
   make sure the backend keeps issuing that cookie at login.
4. **Humans own the state.** New state: pages use `useState` +
   `useEffect` against `api.js`. Share nothing with chat state.

## Files in this package

```
services/api.js        — full REST client (agents + models + hunts)
auth/AuthContext.jsx   — { user, token, login, register, logout }
pages/Auth/Login.jsx   — username-or-email + password, register with optional username
pages/agent/
  AgentHome.jsx        — paste-to-hunt, dedup banner, queues, alerts badge, recent hunts
  HuntView.jsx         — live hunt: terminal + tabs + pause/resume/cancel + ask-the-agent
  Reports.jsx          — browse past hunt reports
  ReportReader.jsx     — read + download a report (Markdown / PDF)
  ModelLibrary.jsx     — curated uncensored models, live pull progress, custom models
  Queues.jsx           — multi-target queues
  Schedules.jsx        — scheduled hunts
  Alerts.jsx           — alerts inbox
  PayloadLibrary.jsx   — self-learning payload leaderboard
components/agent/
  HackerTerminal.jsx   — live SSE terminal, color-coded lines, auto-follow, history catch-up
  FindingsBoard.jsx    — critical-first findings with plain-language explainer mode
  HuntDiary.jsx        — the hunt diary timeline
  AttackSurfaceMap.jsx — enumerated attack surface
  FingerprintCard.jsx  — target fingerprint card
  ReportExport.jsx     — Markdown download + print-to-PDF
  DedupBanner.jsx      — "already hunted" banner with instant open / new hunt
styles/agent.css       — the design system. Import once at the app root.
```

## Wiring (App.jsx)

Additive changes only:

```jsx
// 1. Styles — import ONCE (existing app styles keep working; dm-* classes are namespaced)
import './styles/agent.css';            // adjust relative path to where this package lands

// 2. Providers — wrap the app (outside <Routes>)
import { AuthProvider } from './auth/AuthContext';
<AuthProvider> ... </AuthProvider>

// 3. Gate — show <Login/> when signed out (or your own gate using the context)
import { useAuth } from './auth/AuthContext';
const { user, initializing } = useAuth();
if (!initializing && !user) return <Login />;

// 4. Routes — under your router
import { AgentHome } from './pages/agent/AgentHome';
import { HuntView } from './pages/agent/HuntView';
import { Reports } from './pages/agent/Reports';
import { ReportReader } from './pages/agent/ReportReader';
import { ModelLibrary } from './pages/agent/ModelLibrary';
import { Queues } from './pages/agent/Queues';
import { Schedules } from './pages/agent/Schedules';
import { Alerts } from './pages/agent/Alerts';
import { PayloadLibrary } from './pages/agent/PayloadLibrary';

<Route path="/agent" element={<AgentHome />} />
<Route path="/agent/hunt/:id" element={<HuntView />} />
<Route path="/agent/reports" element={<Reports />} />
<Route path="/agent/reports/:id" element={<ReportReader />} />
<Route path="/agent/models" element={<ModelLibrary />} />     {/* also reachable as "Plugins" */}
<Route path="/agent/queues" element={<Queues />} />
<Route path="/agent/schedules" element={<Schedules />} />
<Route path="/agent/alerts" element={<Alerts />} />
<Route path="/agent/libraries" element={<PayloadLibrary />} />
```

## Sidebar (additive)

Add a nav section, e.g.:

```
Agent console        -> /agent
Past reports         -> /agent/reports
Model library        -> /agent/models     (label it "Plugins" if you prefer)
Queues               -> /agent/queues
Schedules            -> /agent/schedules
Alerts               -> /agent/alerts     (badge: use listAlerts(true) unread count)
Libraries            -> /agent/libraries
```

Keep the Infinity Chat entry exactly where it is.

## API base URL

`services/api.js` derives the base from `window.location` by default
(same origin) and honors `window.__DARKMATTER_API__` when set — use
that in dev when the frontend is served separately from the backend.
Never hard-code hosts.

## Backend endpoint map (for reference)

```
POST /auth/login | /auth/register | /auth/logout | GET /auth/me
POST /jobs { target, objective, forceNew?, authorizationConfirmed }
GET  /jobs/:id  PATCH /jobs/:id {action: pause|resume|cancel}
GET  /jobs/:id/stream                (SSE terminal — session cookie)
GET  /jobs/:id/activity | /jobs/:id/status
GET  /jobs/:id/findings | /vulnerability-report | /attack-surface | /diary
POST /jobs/:id/ask { question }
GET  /hunt-records | /hunt-records/:id | /hunt-records/:id/report.md
GET  /queues (CRUD)   GET /schedules (CRUD)
GET  /alerts[?unreadOnly]  PATCH /alerts/:id/read  POST /alerts/read-all
GET  /payload-library | /payload-library/stats
GET  /local-models/library | /local-models/status | /local-models/install-guide
POST /local-models/pull { modelId } | DELETE /local-models/pull
GET  /local-models/pull-stream        (SSE — session cookie)
DELETE /local-models/:modelId | POST /local-models/custom (custom models)
POST /local-models/activate | POST /local-models/deactivate
```

## Do-not rules

- Don't restyle chat components with agent.css (namespaced, but don't).
- Don't put the JWT in URLs or EventSource query strings.
- Don't re-implement `api.js` helpers in pages.
- Every launch path must carry `authorizationConfirmed` (the checkbox).
- `forceNew: true` only when the user explicitly chose "Start new hunt".
