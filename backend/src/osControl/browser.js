// Split out of osControl.js by the P3 professionalization lane (split-only, no behaviour change).
// Dispatch branches of executeOsAction, moved verbatim except that
// dispatcher locals are read through the c context object.

export async function handleBrowserSnapshot(huntId, action, c) {
  if (typeof c.gui.snapshot !== 'function') return { ok: false, observation: 'browser_snapshot is unavailable — no GUI binding.' };
  const res = await c.gui.snapshot(huntId);
  return { ok: res.ok !== false, observation: (res && res.observation) || '(no observation)' };
}

export async function handleScreenshot(huntId, action, c) {
  if (typeof c.gui.screenshot !== 'function') return { ok: false, observation: 'screenshot is unavailable — no GUI binding.' };
  const res = await c.gui.screenshot(huntId);
  return { ok: res.ok !== false, observation: (res && res.observation) || '(no observation)', artifact: res && res.artifact };
}
