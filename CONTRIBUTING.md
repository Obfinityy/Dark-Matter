# Contributing to Dark Matter

Thanks for wanting to contribute. This is a small, owner-operated project: the workflow below keeps the codebase reviewable and the live product safe.

## Ground rules

- **Issues first.** Find an existing issue or open one before writing code. The issue is where scope, acceptance criteria, and the owner decision get recorded.
- **Branches + pull requests.** Work on a branch (`<area>/<issue-number>-short-name`, e.g. `frontend/493-docs-index`), open a pull request, and get a review. **Never push directly to `main`**, and never merge your own pull request without review.
- **One concern per pull request.** A PR that fixes a bug does not also refactor a module or redesign a page. If you find something else while working, open a separate issue for it.
- **No behaviour change without a test** where tests already exist for the area you touch (the backend has a large colocated `*.test.js` suite — see below).
- **Never commit secrets.** No API keys, tokens, passwords, `.env` files, or private keys. GitHub push protection will block the push, and the secret will have to be rotated.
- **Professional English only** in commits, pull requests, and issues.

## Setup

Prerequisites: Node.js 20+ and npm. Docker only if you need the hunt engine.

```bash
git clone https://github.com/Obfinityy/Dark-Matter.git
cd Dark-Matter

# Backend
cd backend
npm install
cp .env.example .env   # set JWT_SECRET at minimum
npm start              # → http://localhost:4000
curl http://localhost:4000/api/v1/health   # → {"ok":true}

# Frontend (new terminal)
cd frontend
npm install
npm run dev            # → http://localhost:5173
```

Full environment-variable reference: `backend/.env.example` and `frontend/.env.example`. The complete technical reference is [`DEVELOPERS.md`](DEVELOPERS.md); the documentation index is [`docs/README.md`](docs/README.md).

## Code style

- **Prettier** (`.prettierrc`): 2-space indent, single quotes, semicolons, `printWidth: 100`, LF line endings. **EditorConfig** (`.editorconfig`) enforces the same basics in any editor. Match the existing style; Prettier is not currently a devDependency, so run it from your editor or via `npx prettier --check` if you have it.
- **Backend:** Node.js ESM (`"type": "module"`), Express 4. Colocate tests next to the code they cover (`foo.js` + `foo.test.js`). Keep modules focused — the codebase already has files that are too large to review comfortably (see `backend/src/humanLoop.js`); do not make them larger without a good reason, and prefer a small new module over appending to a giant one.
- **Frontend:** React 18 + Vite 6. Components in `frontend/src/components/`, pages in `frontend/src/pages/`, API helpers in `frontend/src/lib/`. Styles live in `frontend/src/design-system.css` (tokens) and `frontend/src/index.css` (component rules) — use the tokens, do not hardcode colors.
- **No mock UI.** No simulate buttons, no fake data in the product. If a feature is not wired to a real backend call, it does not ship.
- **Safety invariants (do not break these):** hunts require an explicitly named target + `confirmedAuthorized: true` + an `ALLOWED_TARGETS` match; testing is non-destructive; findings shown as "Confirmed" must have passed independent verification.

## Testing

```bash
cd backend && npm test     # node --test; ~2,980 tests (Nov 2026)
cd frontend && npm run build   # frontend has no test suite yet — the build is the check
```

- Run the backend suite before opening a PR. If a test fails, say so in the PR — do not skip it silently.
- One test boots a real backend (~20s); run sequentially or at most 2-way parallel.
- Verify in the real product where it matters: backend health endpoint, and the frontend in a browser for UI changes. Never claim a change is done until it is verified.

## Pull requests

A good PR description has:

1. **What** changed and **why** (link the issue).
2. **Test evidence** — exact commands run and results (e.g. `npm test: 2,976 pass, 0 fail, 11 skipped`, `vite build` green), not vague "it works".
3. **What is deliberately left out** or still untested, if anything.
4. Screenshots for UI changes (desktop + mobile where the change affects layout).

## What not to do

- Do not push to `main`, do not force-push, do not rewrite history on shared branches.
- Do not commit `data/`, `.env`, logs, or generated files.
- Do not add dependencies without saying why in the PR (and prefer the smallest dependency that does the job).
- Do not change deployment configuration (EC2 workflow, `render.yaml`, Cloudflare Pages) without an issue and owner approval — a wrong deploy change takes the live product down.
- Do not hunt unauthorized targets, ever — including "just to test". Lab targets only (see `DEVELOPERS.md` §15).

## License

By contributing, you agree that your contribution will be covered by whatever license the owner attaches to this repository. The repository is currently unlicensed (all rights reserved) — see `README.md` and issue [#493](https://github.com/Obfinityy/Dark-Matter/issues/493).
