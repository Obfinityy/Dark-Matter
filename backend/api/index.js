/**
 * Vercel serverless entry for the Dark-Matter backend.
 *
 * Reuses the same Express app as the local server (`npm start`).
 *
 * IMPORTANT — what works on Vercel and what does not:
 *   ✅  Stateless API: auth, jobs CRUD, reports, settings, model library listing
 *   ❌  Long-running hunt agent loops (serverless functions die after 10-60s)
 *   ❌  Model runner / llama-server (needs a persistent process on YOUR machine)
 *   ❌  In-memory DB persistence (resets on every cold start — set MONGO_URL)
 *   ❌  Computer control (needs a real desktop, not a serverless sandbox)
 *
 * The product is local-first by design: the full experience (Hunt + local
 * model) runs on the user's own machine via `npm start`. This entry exists so
 * the frontend's "Vercel" backend-mode option has a live API to talk to for
 * the stateless parts. Switch back to "Localhost" in Settings for hunts.
 */
import { createApp } from '../src/app.js';

let appPromise = null;

function getApp() {
  if (!appPromise) {
    // createApp() wires routes, CORS, auth — but on Vercel we skip the
    // long-lived workers by disabling the schedulers via env (see vercel.json).
    appPromise = createApp().catch((error) => {
      appPromise = null;
      throw error;
    });
  }
  return appPromise;
}

export default async function handler(request, response) {
  try {
    const app = await getApp();
    return app(request, response);
  } catch (error) {
    console.error('[vercel] app boot failed:', error?.message || error);
    response.status(500).json({ error: 'Backend failed to start', code: 'BOOT_FAILED' });
  }
}
