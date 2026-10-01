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
5. **Status is plain language.** Never render raw backend enums in the
   UI. Use `StatusPill` (from `components/agent/AgentShell.jsx`):
   running → "Hunting", thinking → "Thinking", paused → "Paused",
   completed → "Done".

## Files in this package

```
services/api.js        — full REST client (agents + models + hunts)
auth/AuthContext.jsx   — { user, loading, authError, login, register, logout, setUser }
pages/Auth/Login.jsx   — username-or-email + password, register with optional username
pages/agent/
  AgentConsole.jsx     — self-contained route tree: auth gate + shell + all routes.
                         Mount ONCE at /agent/* (see Wiring). This is the only
                         integration point the host app needs.
  AgentHome.jsx        — paste-to-hunt hero, dedup banner, stats, recent hunts
  HuntView.jsx         — live hunt: terminal + tabs + pause/resume/cancel + AgentChat
  Reports.jsx          — browse past hunt reports
  ReportReader.jsx     — read + download a report (Markdown / PDF)
  ModelLibrary.jsx     — curated uncensored models, live pull progress, custom models
  Queues.jsx           — multi-target queues
  Schedules.jsx        — scheduled hunts
  Alerts.jsx           — alerts inbox
  PayloadLibrary.jsx   — self-learning payload leaderboard
components/agent/
  AgentShell.jsx       — sidebar + top bar chrome (live hunt pill, alerts badge),
                         exports StatusPill (plain-language status)
  AgentChat.jsx        — "agent se baat karo": live chat with the hunting agent
                         (POST /jobs/:id/ask → { reply, reaction, suggestions[] })
  HackerTerminal.jsx   — live SSE terminal, color-coded lines, auto-follow, history catch-up
  FindingsBoard.jsx    — critical-first findings with plain-language explainer mode
  HuntDiary.jsx        — the hunt diary timeline
  AttackSurfaceMap.jsx — enumerated attack surface
  FingerprintCard.jsx  — target fingerprint card
  ReportExport.jsx     — Markdown download + print-to-PDF
  DedupBanner.jsx      — "already hunted" banner with instant open / new hunt
styles/agent.css       — the design system. Import once at the app root.
```

## Wiring (App.jsx) — one mount point

Additive changes only:

```jsx
// 1. Styles — import ONCE (existing app styles keep working; dm-* classes are namespaced)
import './styles/agent.css';            // adjust relative path to where this package lands

// 2. Single mount — AgentConsole brings its own AuthProvider, login gate,
//    sidebar + top bar, and all /agent/* routes. No other wiring needed.
import { AgentConsole } from './pages/agent/AgentConsole';

<Route path="/agent/*" element={<AgentConsole />} />
```

That's it. `AgentConsole` internally renders:

```
<AuthProvider>
  <Gate>            {/* shows <Login/> when signed out */}
    <AgentShell>    {/* sidebar + top bar */}
      <Routes>
        /agent              → AgentHome
        /agent/hunt/:id     → HuntView
        /agent/reports      → Reports
        /agent/reports/:id  → ReportReader
        /agent/models       → ModelLibrary        {/* label it "Plugins" in nav if you prefer */}
        /agent/queues       → Queues
        /agent/schedules    → Schedules
        /agent/alerts       → Alerts
        /agent/libraries    → PayloadLibrary
      </Routes>
    </AgentShell>
  </Gate>
</AuthProvider>
```

If you prefer to wire routes manually instead of using `AgentConsole`,
wrap every page in `<div className="dm-page">` for consistent padding
(HuntView additionally needs `dm-huntview`), wrap everything in
`<AuthProvider>` + `<AgentShell>`, and gate signed-out users with `<Login/>`.

## Sidebar (built into AgentShell)

The shell renders its own nav — no host-app sidebar changes needed:

```
Hunt            -> /agent
Reports         -> /agent/reports
Models          -> /agent/models        (label it "Plugins" if you prefer)
Queues          -> /agent/queues
Schedules       -> /agent/schedules
Alerts          -> /agent/alerts        (badge: unread count, polled every 30s)
Payloads        -> /agent/libraries
```

Top bar: live hunt pill (`N hunts live` / `Agent idle`, polled every 30s
via `listJobs({ status: 'running' })`) + alerts bell with unread badge.
Keep the Infinity Chat entry exactly where it is.

## "Agent se baat karo" chat (HuntView)

`AgentChat` posts to `POST /jobs/:id/ask` via `askJob(jobId, message)` and
expects:

```json
{ "reply": "…", "reaction": "🎯", "suggestions": ["Kya kar raha hai?", "…"] }
```

`reply` may also arrive as `answer` or `message`. The panel shows the
reaction as an emoji tap-back on the reply bubble and renders suggestions
as tappable chips. If the endpoint is unreachable or errors, the panel
shows a clear error bubble — it never invents an agent reply. With no
active hunt it shows a graceful empty state.

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
POST /jobs/:id/ask { message }  →  { reply, reaction, suggestions[] }
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
- Never render raw job status enums — use `StatusPill`.
- `AgentChat` must never fake a reply when the ask endpoint fails.
