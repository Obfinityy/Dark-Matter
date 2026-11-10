// Dark Matter rule-based scanner — shared helpers for the OAuth-family
// probes (scout rows #487-#493, #497, #502).
//
// These probes all drive state-changing identity flows (magic links,
// registration, authorization codes, dynamic client registration,
// refresh tokens, WebAuthn) against a lab IdP / relying party, so they
// share one small toolkit: a JSON request wrapper over the injected
// fetchFn, lab-gate and depth handling, deterministic fixture naming,
// JWT payload decoding (read-only, never verification), and the
// finding builder every probe uses. Nothing here performs a scan
// step on its own; each probe file owns its oracle and its verdict.
//
// GATES (enforced by every probe through labGated()): all
// state-changing calls run ONLY when the target host is a lab host
// (isLabTargetHost, opts.labTargets). Read-only discovery may run
// anywhere, but these probes have no read-only leg worth running
// off-lab, so a non-lab target returns no findings at all.

import { randomBytes } from 'node:crypto';
import { isLabTargetHost } from '../../labCreds.js';

export const OAUTH_UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
export const OAUTH_TIMEOUT_MS = 15000;

// The seeded lab login (labs/oauth-lab/data/seed.json). Probes use it
// only as the known-good identity for control legs — never as a
// credential to disclose: it is a documented lab fixture.
export const LAB_SEED_EMAIL = 'lab-user@example.com';
export const LAB_SEED_PASSWORD = 'lab-pass';
export const LAB_CLIENT_ID = 'lab-client';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * A unique, obviously-synthetic probe address. Every probe run
 * registers its own victim/attacker addresses so runs never collide
 * with each other or with the seeded lab login. Pure.
 */
export function uniqueEmail(tag) {
  const hex = randomBytes(4).toString('hex');
  return `dm-${tag}-${hex}@example.com`;
}

/** Short random suffix for client-generated values (states, credential ids). Pure. */
export function randSuffix() {
  return randomBytes(4).toString('hex');
}

/**
 * Origin (scheme + host) of a target URL, or null when unparseable.
 * Pure.
 */
export function originOf(url) {
  try {
    const u = new URL(String(url));
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/**
 * Decode the payload of a JWT WITHOUT verifying it. The probes use
 * this only to read claims the lab itself issued to the probe
 * (email_verified, iss) — a defensive read of our own canary
 * response, never an authentication decision. Returns null when the
 * token is not a parseable JWT. Pure.
 */
export function decodeJwtPayload(token) {
  try {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * True when a URL points at the EC2 instance-metadata address.
 * The dynamic-registration probe must never hand that address to a
 * server-side fetch (the lab blocks it, and the probe refuses first).
 * Pure.
 */
export function isMetadataUrl(raw) {
  try {
    return new URL(String(raw)).hostname === '169.254.169.254';
  } catch {
    return false;
  }
}

/**
 * Lab gate shared by every OAuth-family probe: true only when the
 * target host is listed in opts.labTargets. Fail-closed — a missing
 * or empty labTargets list gates everything off. Pure.
 */
export function labGated(url, opts = {}) {
  return isLabTargetHost(url, opts.labTargets);
}

/**
 * Diagnostics object from opts (null when the caller did not supply
 * one). Probes write into it; callers that do not care pass nothing.
 */
export function getDiag(opts = {}) {
  return opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
}

// ---------------------------------------------------------------------------
// Network helper
// ---------------------------------------------------------------------------

/**
 * One JSON request through the injected fetchFn (global fetch by
 * default). Returns { status, json, text } on any HTTP answer, or
 * null when the request itself failed (network error / timeout).
 * A non-JSON body yields json: null with the raw text preserved.
 */
export async function jsonRequest(fetchFn, url, { method = 'GET', body = null, headers = {}, timeoutMs = OAUTH_TIMEOUT_MS } = {}) {
  const fn = typeof fetchFn === 'function' ? fetchFn : globalThis.fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fn(url, {
      method,
      headers: { 'User-Agent': OAUTH_UA, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: ctrl.signal,
    });
    const text = await res.text().catch(() => '');
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json, text: String(text).slice(0, 200000) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Finding builder
// ---------------------------------------------------------------------------

/**
 * Finding shape every OAuth-family probe uses: class/id/title/
 * severity plus url/param/parameter and evidence with
 * signalCorrelated: true — the default confirmation protocol
 * judges findings on that flag (see hunt-intel/differential.js),
 * and each probe only builds a finding after its own differential
 * oracle has already held. Token material is never copied into
 * evidence: only kinds, counts and short prefixes are quoted.
 * `extraEvidence` carries protocol-specific flags a class needs
 * for its confirmation protocol — e.g. oobHit for the SSRF
 * protocol, which judges on the collaborator hit rather than on
 * signalCorrelated (the class name routes the finding there).
 */
export function oauthFinding({ findingClass, id, title, severity, url, parameter, request, response, impact, extraEvidence = {} }) {
  return {
    class: findingClass,
    id,
    title,
    severity,
    url,
    param: parameter,
    parameter,
    evidence: {
      request,
      response,
      impact_demo: impact,
      signalCorrelated: true,
      ...extraEvidence,
    },
  };
}

/**
 * Short, non-sensitive token descriptor for evidence strings:
 * kind + first 12 characters only. Full token values never appear
 * in findings.
 */
export function tokenRef(token) {
  if (typeof token !== 'string' || !token) return '<none>';
  return `${token.slice(0, 12)}…`;
}
