// Split out of osControl.js by the P3 professionalization lane (split-only, no behaviour change).
// Dispatch branches of executeOsAction, moved verbatim except that
// dispatcher locals are read through the c context object.

import {
  TOOL_IDS,
  resolveTool,
  launchGuiTool,
  checkCliTool,
  downloadTool,
  listToolControls,
  recordToolState,
  burpFirstUseDone,
  burpFirstUse,
} from '../toolLaunch.js';

export async function handleLaunchTool(huntId, action, c) {
  // Launch a NAMED tool from the registry and wait for it to be
  // ready. GUI tools open on the desktop; CLI tools are verified
  // present with their version. A repeat launch just reports
  // "already running" — never a second copy. The first Burp launch
  // in a hunt also runs the first-use path (wizard, proxy, target
  // in Burp's browser) and records it in the hunt memory.
  const toolId = String(action.tool || '').trim().toLowerCase().slice(0, 80);
  const resolved = resolveTool(toolId);
  if (!resolved.ok) return { ok: false, observation: `${resolved.error} (available: ${TOOL_IDS.join(', ')})` };
  if (resolved.tool.kind === 'gui') {
    try {
      let firstUse = null;
      if (toolId === 'burp') {
        try { firstUse = burpFirstUseDone(c.readMeta ? c.readMeta(huntId) : {}); } catch { firstUse = false; }
      }
      if (toolId === 'burp' && firstUse === false) {
        const res = await burpFirstUse(huntId, c.target, { execRaw: c.execRaw, sleep: c.sleep, readMeta: c.readMeta, writeMeta: c.writeMeta });
        if (!res.ok) return { ok: false, observation: `Burp first-use did not complete: ${res.error || res.observation}` };
        try { await recordToolState(huntId, 'burp', { ...res.state }, { readMeta: c.readMeta, writeMeta: c.writeMeta }); } catch { /* best-effort */ }
        return { ok: true, observation: res.observation };
      }
      const res = await launchGuiTool(huntId, toolId, { execRaw: c.execRaw, sleep: c.sleep });
      if (res.ok) {
        try { await recordToolState(huntId, toolId, { running: true, via: res.via, window: res.window || '' }, { readMeta: c.readMeta, writeMeta: c.writeMeta }); } catch { /* best-effort */ }
        return { ok: true, observation: res.observation };
      }
      return { ok: false, observation: res.error };
    } catch (err) {
      return { ok: false, observation: `Tool launch failed: ${err.message || err}` };
    }
  }
  try {
    const res = await checkCliTool(huntId, toolId, { execRaw: c.execRaw });
    if (res.ok) {
      try { await recordToolState(huntId, toolId, { running: true, version: String(res.version || '').slice(0, 120) }, { readMeta: c.readMeta, writeMeta: c.writeMeta }); } catch { /* best-effort */ }
      return { ok: true, observation: res.observation };
    }
    return { ok: false, observation: res.error };
  } catch (err) {
    return { ok: false, observation: `Tool check failed: ${err.message || err}` };
  }
}

export async function handleDownloadTool(huntId, action, c) {
  // Install a MISSING tool from the allow-list. Anything not listed
  // is refused BEFORE any exec — the refusal names the installable
  // tools, so the brain can pick a real one instead of guessing.
  const toolId = String(action.tool || '').trim().toLowerCase().slice(0, 80);
  try {
    const res = await downloadTool(huntId, toolId, { execRaw: c.execRaw });
    if (res.ok) {
      try { await recordToolState(huntId, toolId, { running: true, installedVia: 'download_tool' }, { readMeta: c.readMeta, writeMeta: c.writeMeta }); } catch { /* best-effort */ }
      return { ok: true, observation: res.observation };
    }
    return { ok: false, observation: res.error };
  } catch (err) {
    return { ok: false, observation: `Tool install failed: ${err.message || err}` };
  }
}
