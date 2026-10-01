/**
 * Vercel serverless entry for the Dark-Matter backend (minimal).
 *
 * NOTE: The full Express app is too heavy for serverless bundling.
 * This lightweight handler provides the essential stateless endpoints.
 * For full functionality (hunts, computer control, local models),
 * use the local backend via `npm start`.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' };

function send(res, status, data) {
  for (const [k, v] of Object.entries(JSON_HEADERS)) res.setHeader(k, v);
  res.status(status).json(data);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    for (const [k, v] of Object.entries(JSON_HEADERS)) res.setHeader(k, v);
    return res.status(200).end();
  }

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  // Health check
  if (path === '/health' || path === '/api/v1/health') {
    return send(res, 200, { status: 'ok', service: 'darkmatter-backend', mode: 'vercel-serverless', timestamp: new Date().toISOString() });
  }

  // Agent info
  if (path === '/api/v1/agent') {
    return send(res, 200, {
      name: 'Elite Bug Bounty Expert',
      role: 'authorized-security-research-agent',
      capabilities: ['authorized target intake', 'passive subdomain enumeration'],
      restrictions: ['explicit authorization required', 'only declared scope is used'],
      mode: 'vercel-serverless-limited',
      note: 'Full agent capabilities require the local backend (npm start).'
    });
  }

  // Everything else: explain the limitation
  return send(res, 404, {
    error: 'Not available on serverless',
    message: 'This endpoint requires the persistent local backend. Switch to Localhost mode in Settings.',
    path
  });
}
