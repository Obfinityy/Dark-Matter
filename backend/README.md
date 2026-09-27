# DarkMatter Backend

Node.js + Express backend in MVC structure for the first authorized reconnaissance workflow. The current release intentionally exposes one tool: passive subdomain enumeration through Certificate Transparency data.

## Run

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

The API starts on `http://127.0.0.1:4000` by default. All users, sessions, provider settings, targets, scans, and events are persisted in MongoDB through `MONGO_URL`; the backend has no JSON or local-data fallback. API keys are encrypted before they are written.

## Main flow

1. Register with `POST /api/v1/auth/register` or sign in with `POST /api/v1/auth/login`; the backend returns an HttpOnly session cookie.
2. Configure an AI provider with `PUT /api/v1/settings/providers/:provider`.
3. Start a scan by sending a message with `POST /api/v1/agent/messages`.
4. Watch `GET /api/v1/scans/:scanId/events` for live events.
5. Read the structured agent state from `GET /api/v1/scans/:scanId`.

Protected routes require the HttpOnly `darkmatter_session` cookie. Logout deletes the server-side session from MongoDB.

## Provider settings

The Settings API stores keys for OpenAI, Google Gemini, Grok, DeepSeek, OpenRouter, and Anthropic encrypted at rest. The current subdomain tool does not need an AI key yet; this API is ready for the next agent phase without exposing raw keys back to the browser.

## Tool boundary

The only enabled tool is `subdomain-enumerator`. It reads public Certificate Transparency records for the authorized hostname and never executes arbitrary shell commands, exploit code, or local plugins.
