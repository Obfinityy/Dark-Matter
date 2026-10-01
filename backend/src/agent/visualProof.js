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
  'vuln_page',      // the vulnerable page itself
  'poc_execution',  // the PoC running (alert box, response, etc.)
  'request',        // the malicious request (DevTools / terminal)
  'response',       // the vulnerable response
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
        data: shot.base64 || shot.data,  // base64 PNG
        proofType,
        findingId: finding.id,
        capturedAt: new Date().toISOString(),
        url: targetUrl || null
      }
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
    label: `Visual proof: ${proof.proofType} — ${finding.title || finding.type}`
  };
}

/**
 * Downscale hint for PDF embedding (the PDF generator handles actual resize).
 * Returns true if the screenshot is usable in a report.
 */
export function isUsableProof(proof) {
  return !!(proof?.screenshot?.data && proof.screenshot.data.length > 1000);
}
