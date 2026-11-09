# Dark Matter frontend

React 18 + Vite 6 single-page app — the operator UI for Dark Matter: hunts, live hunt view, mid-hunt chat, reports, plugins, admin, and payments.

## Quickstart

```bash
npm install
npm run dev      # → http://localhost:5173
npm run build    # production build (vite build)
npm run preview  # serve the production build locally
```

Prerequisites: Node.js 20+ and npm. No test suite yet — the build is the check.

## Environment

| Variable | Purpose |
|---|---|
| `VITE_BACKEND_URL` | Backend API base. Unset = local default; production sets it to the live backend URL |

Copy `.env.example` to `.env` for local overrides. Never commit `.env`.

The backend base URL resolves in `src/config.js` — the hosted default is `https://api.thebhavesh.online`. There is no local-backend switcher in the UI; the app always talks to the hosted backend unless `VITE_BACKEND_URL` is set.

## Structure

```
src/
├── main.jsx            # Entry — mounts <App />, imports styles
├── App.jsx             # App shell: sidebar, top bar, pages, auth provider
├── config.js           # Backend endpoint configuration
├── design-system.css   # Design tokens (colors, radii, type scale)
├── index.css           # Component styles
├── components/         # HuntCard, BrainConsole, LiveMachine, Sidebar,
│                       #   TopBar, ChatThread, AuthModal, NewHuntModal, …
├── pages/              # ChatPage, AdminPage, PluginsPage, ReportsPage,
│                       #   LiveMachinesPage, SettingsPage, UpiPayPage,
│                       #   LegalPage, AuthPage
├── lib/                # api.js (all backend calls), auth.jsx, huntMode.js,
│                       #   huntStream.js, brainActions.js, …
└── hooks/              # useHuntTerminal.js
```

## Notes

- **Auth required for hunts.** Login first; a pending-hunt intent survives login and opens hunt setup afterwards.
- **Styles:** use the tokens in `design-system.css` — do not hardcode colors in components.
- **No mock UI.** No simulate buttons, no fake data. If a feature is not wired to a real backend call, it does not ship.
- **Safety:** the UI never exposes the underlying engine's name (see the rebrand rule in `AGENTS.md`).

## Deploy

Production deploys automatically to Cloudflare Pages on push to `main`. An emergency GitHub Pages workflow (`.github/workflows/deploy-gh-pages.yml`) also exists.
