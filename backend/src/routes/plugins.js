// Plugin provider API keys.
//   GET  /api/v1/plugins/providers          -> [{id, name, configured}]  (never returns keys)
//   PUT  /api/v1/plugins/providers/:id      {apiKey, baseUrl?, model?, extra?} -> stores ENCRYPTED
// Keys are AES-256-GCM encrypted at rest via src/crypto.js, never logged, and
// never returned to the frontend after save.

import { Router } from 'express';
import { encryptSecret, decryptSecret } from '../crypto.js';
import { readPluginKeys, writePluginKeys } from '../store.js';

export const PROVIDERS = [
  { id: 'aws', name: 'AWS (Bedrock)', keyHint: 'AKIA… / IAM' },
];

const router = Router();

function catalog() {
  const stored = readPluginKeys();
  return PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    configured: Boolean(stored[p.id]),
  }));
}

router.get('/providers', (req, res) => {
  res.json({ ok: true, providers: catalog() });
});

router.put('/providers/:id', (req, res) => {
  const { id } = req.params;
  const provider = PROVIDERS.find((p) => p.id === id);
  if (!provider) {
    return res.status(404).json({
      ok: false,
      error: 'unknown_provider',
      message: `Unknown provider "${id}". Valid ids: ${PROVIDERS.map((p) => p.id).join(', ')}`,
    });
  }
  const { apiKey, baseUrl, model, extra } = req.body || {};
  // AWS requires its credentials (empty string clears).
  if (apiKey !== '' && (typeof apiKey !== 'string' || !apiKey.trim())) {
    return res.status(400).json({
      ok: false,
      error: 'missing_api_key',
      message: `An API key is required to configure provider "${id}".`,
    });
  }
  const stored = readPluginKeys();
  if (apiKey === '' || apiKey === null) {
    delete stored[id];
    writePluginKeys(stored);
    return res.json({ ok: true, provider: { id, name: provider.name, configured: false }, cleared: true });
  }
  const record = {
    encrypted: encryptSecret(String(apiKey)),
    meta: {
      // Store ONLY non-secret metadata; the raw key is never kept in cleartext.
      baseUrl: typeof baseUrl === 'string' ? baseUrl.slice(0, 200) : undefined,
      model: typeof model === 'string' ? model.slice(0, 100) : undefined,
      extra: extra && typeof extra === 'object' ? sanitizeExtra(extra) : undefined,
    },
    updatedAt: new Date().toISOString(),
  };
  stored[id] = record;
  writePluginKeys(stored);
  // Intentionally: no key material anywhere in the response or logs.
  res.json({ ok: true, provider: { id, name: provider.name, configured: true } });
});

function sanitizeExtra(extra) {
  const out = {};
  for (const [k, v] of Object.entries(extra).slice(0, 20)) {
    if (/key|secret|token|password/i.test(k)) continue; // never persist secret-ish fields in cleartext
    out[String(k).slice(0, 60)] = typeof v === 'string' ? v.slice(0, 300) : v;
  }
  return out;
}

// Internal helper (NOT exposed over HTTP): decrypt a provider key for the
// engine/bridge when it needs to call the provider on the server side.
export function getProviderKey(id) {
  const stored = readPluginKeys();
  const record = stored[id];
  if (!record) return null;
  try {
    return { key: decryptSecret(record.encrypted), meta: record.meta };
  } catch {
    return null;
  }
}

export default router;
