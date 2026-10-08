/**
 * Visual Proof — screenshots attached to findings.
 *
 * Elite reports don't just DESCRIBE vulnerabilities — they SHOW them:
 *   - Screenshot of the XSS alert firing
 *   - Screenshot of the IDOR response with another user's data
 *   - Screenshot of the price manipulation in the cart
 *
 * This module:
 * 1. Captures a screenshot via computer control when a finding is validated
 * 2. Optionally navigates to the vulnerable URL first (browser automation)
 * 3. Stores the screenshot with the finding's evidence
 * 4. Embeds thumbnails in PDF reports
 *
 * Screenshots are taken on the LOCAL machine (localhost backend).
 * Sensitive data in screenshots is the user's own test — never another
 * real user's data (IDOR PoCs use the hunter's own test accounts).
 */

export const PROOF_TYPES = Object.freeze([
  'vuln_page', // the vulnerable page itself
  'poc_execution', // the PoC running (alert box, response, etc.)
  'request', // the malicious request (DevTools / terminal)
  'response', // the vulnerable response
]);

/**
 * Capture visual proof for a finding.
 *
 * @param {object} deps
 * @param {object} deps.computer - computer control adapter (screenshot, navigate)
 * @param {object} deps.finding - the validated finding
 * @param {string} deps.proofType - one of PROOF_TYPES
 * @returns {Promise<{ok, screenshot?, error?}>}
 */
export async function captureVisualProof({ computer, finding, proofType = 'vuln_page' }) {
  if (!computer) {
    return { ok: false, error: 'Computer control unavailable — cannot capture screenshot' };
  }

  try {
    // Navigate to the vulnerable URL if we have one (browser automation)
    const targetUrl = finding.url || finding.location;
    if (targetUrl && /^https?:\/\//.test(targetUrl)) {
      try {
        await computer.navigate(targetUrl);
        // Let the page load
        await computer.sleep(2000);
      } catch (navErr) {
        // Navigation failed — still try a screenshot of current state
      }
    }

    const shot = await computer.screenshot();
    if (!shot?.ok) {
      return { ok: false, error: shot?.error || 'Screenshot failed' };
    }

    return {
      ok: true,
      screenshot: {
        data: shot.base64 || shot.data, // base64 PNG
        proofType,
        findingId: finding.id,
        capturedAt: new Date().toISOString(),
        url: targetUrl || null,
        // Pass-throughs from headless adapters (null for desktop adapters)
        dialogFired: shot.dialogFired ?? null,
        dialogMessage: shot.dialogMessage ?? null,
        mimeType: shot.mimeType ?? null,
        outPath: shot.outPath ?? null,
      },
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Build the evidence record for a visual proof (for reportService).
 */
export function proofToEvidence(proof, finding) {
  return {
    findingId: finding.id,
    type: 'screenshot',
    proofType: proof.proofType,
    data: proof.screenshot.data,
    capturedAt: proof.screenshot.capturedAt,
    url: proof.screenshot.url,
    label: `Visual proof: ${proof.proofType} — ${finding.title || finding.type}`,
  };
}

/**
 * Downscale hint for PDF embedding (the PDF generator handles actual resize).
 * Returns true if the screenshot is usable in a report.
 */
export function isUsableProof(proof) {
  return !!(proof?.screenshot?.data && proof.screenshot.data.length > 1000);
}

import { spawn } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * HeadlessProofAdapter — a `computer`-compatible screenshot adapter backed by
 * real headless Chromium (Playwright). Lets captureVisualProof() run WITHOUT
 * a live desktop: it navigates to the vulnerable URL, lets injected scripts
 * execute (JS dialogs are observed AND dismissed), and returns a JPEG
 * screenshot as base64 — the same shape as the desktop adapter.
 *
 * The capture script lives at backend/scripts/capture_proof_shot.py and only
 * ever talks to the URL it is given (the agent's own scope-checked fixture).
 */
export class HeadlessProofAdapter {
  constructor({ scriptPath, outDir = null, timeoutMs = 45000 } = {}) {
    if (!scriptPath)
      throw new Error('HeadlessProofAdapter needs scriptPath (capture_proof_shot.py)');
    this.scriptPath = scriptPath;
    this.outDir = outDir || tmpdir();
    this.timeoutMs = timeoutMs;
    this.currentUrl = null;
  }

  async navigate(url) {
    this.currentUrl = url;
  }

  async sleep(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  async screenshot() {
    if (!this.currentUrl) return { ok: false, error: 'No URL navigated to' };
    await mkdir(this.outDir, { recursive: true });
    const outPath = join(this.outDir, `proof-${Date.now()}.jpg`);
    const result = await this._runCapture(this.currentUrl, outPath);
    if (!result.ok) return { ok: false, error: result.error };
    const bytes = await readFile(outPath);
    return {
      ok: true,
      base64: bytes.toString('base64'),
      mimeType: 'image/jpeg',
      dialogFired: result.dialogFired === true,
      dialogMessage: result.dialogMessage || null,
      outPath,
    };
  }

  _runCapture(url, outPath) {
    return new Promise(resolve => {
      const child = spawn('python3', [this.scriptPath, url, outPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({ ok: false, error: `capture timed out after ${this.timeoutMs}ms` });
      }, this.timeoutMs);
      child.stdout.on('data', d => {
        stdout += d;
      });
      child.stderr.on('data', d => {
        stderr += d;
      });
      child.on('error', err => {
        clearTimeout(timer);
        resolve({ ok: false, error: `capture spawn failed: ${err.message}` });
      });
      child.on('close', code => {
        clearTimeout(timer);
        if (code !== 0) {
          resolve({ ok: false, error: `capture exited ${code}: ${stderr.slice(0, 300)}` });
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim().split('\n').pop());
          resolve(
            parsed.ok ? parsed : { ok: false, error: parsed.error || 'unknown capture error' }
          );
        } catch {
          resolve({ ok: false, error: `could not parse capture output: ${stdout.slice(0, 200)}` });
        }
      });
    });
  }
}

/**
 * One-shot helper: navigate the finding's URL headlessly and attach a real
 * screenshot to the finding's evidence shape.
 *
 * @param {object} opts
 * @param {string} opts.url — the vulnerable URL (with proof payload)
 * @param {object} opts.finding
 * @param {string} [opts.proofType='poc_execution']
 * @param {string} opts.scriptPath — path to capture_proof_shot.py
 * @param {string} [opts.outDir]
 * @returns {Promise<{ok, proof?, error?}>}
 */
export async function captureHeadlessProof({
  url,
  finding,
  proofType = 'poc_execution',
  scriptPath,
  outDir,
}) {
  const adapter = new HeadlessProofAdapter({ scriptPath, outDir });
  const target = url || finding?.url || finding?.location || finding?.pocUrl;
  if (!target) return { ok: false, error: 'No URL to capture' };
  const result = await captureVisualProof({
    computer: adapter,
    finding: { ...finding, url: target },
    proofType,
  });
  if (!result.ok) return result;
  const shot = result.screenshot;
  return {
    ok: true,
    proof: {
      ...proofToEvidence({ screenshot: shot, proofType }, finding || {}),
      dialogFired: shot.dialogFired,
      dialogMessage: shot.dialogMessage,
      mimeType: shot.mimeType,
      outPath: shot.outPath,
    },
  };
}
