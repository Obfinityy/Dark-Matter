// Activate with UPI — replaces the Razorpay top-up page (owner order 25 Oct 2026).
//
// Simplified activation: the user pays Rs 10,000 to the Obfinity UPI ID
// from ANY UPI app (scan the QR or tap the deep link), then submits the
// "I have paid" form (phone, WhatsApp, account details, UTR). NO OTP, NO
// gateway. The claim waits in the admin portal; the admin verifies the
// money arrived in the bank and activates the account for 1 day. The user
// is told on screen: activation within 24 hours after verification.
//
// Logged-out users (pending signups, who cannot log in yet) submit with
// their signup username + password — the password proves ownership of the
// pending account. Logged-in users submit with their session (renewal).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode-generator';
import {
  getUpiDetails, getPaymentStatus, getMyClaims, submitPaymentClaim,
} from '../lib/api';
import { useAuth } from '../lib/auth';

function qrSvg(text, size = 224) {
  const qr = QRCode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const cell = size / (n + 8); // 4-module quiet zone on every side
  const off = cell * 4;
  let rects = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) {
        rects += `<rect x="${(off + c * cell).toFixed(2)}" y="${(off + r * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="UPI QR code"><rect width="${size}" height="${size}" fill="white"/>${rects}</svg>`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function UpiPayPage() {
  const { ready, user } = useAuth();
  const [upi, setUpi] = useState(null);
  const [status, setStatus] = useState(null);
  const [claims, setClaims] = useState([]);
  const [txns, setTxns] = useState([]);
  const [view, setView] = useState('pay'); // 'pay' | 'failed'
  const [form, setForm] = useState({ username: '', password: '', phone: '', whatsapp: '', accountDetails: '', utr: '' });
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const refresh = useCallback(async () => {
    const u = await getUpiDetails();
    if (u.ok && u.data) setUpi(u.data);
    if (getAuthTokenPresent()) {
      const s = await getPaymentStatus();
      if (s.ok && s.data) {
        setStatus(s.data);
        setTxns(s.data.txns || []);
      }
      const c = await getMyClaims();
      if (c.ok && c.data) setClaims(c.data.claims || []);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const qrMarkup = useMemo(() => (upi && upi.deepLink ? qrSvg(upi.deepLink) : ''), [upi]);

  const pendingClaim = claims.find((c) => c.status === 'pending');
  const latestClaim = claims[0] || null;

  function getAuthTokenPresent() {
    try {
      return !!localStorage.getItem('dm_token');
    } catch {
      return false;
    }
  }

  async function copyUpiId() {
    if (!upi) return;
    try {
      await navigator.clipboard.writeText(upi.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (!form.utr.trim() || !form.phone.trim() || !form.whatsapp.trim() || !form.accountDetails.trim()) {
      setMsg({ kind: 'error', text: 'Fill in phone, WhatsApp number, account details and UTR.' });
      return;
    }
    if (!user && (!form.username.trim() || !form.password)) {
      setMsg({ kind: 'error', text: 'Enter your signup username and password so we can match the payment to your account.' });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        accountDetails: form.accountDetails.trim(),
        utr: form.utr.trim(),
        ...(user ? {} : { username: form.username.trim(), password: form.password }),
      };
      const res = await submitPaymentClaim(payload);
      if (res.ok && res.data) {
        setMsg({
          kind: 'ok',
          text: res.data.duplicate
            ? 'This payment was already submitted — it is waiting for verification.'
            : 'Payment claim submitted. Your account will be activated within 24 hours after verification.',
        });
        setForm((f) => ({ ...f, password: '', utr: '' }));
        refresh();
      } else {
        setMsg({ kind: 'error', text: res.error || 'Could not submit the claim. Try again.' });
      }
    } catch (err) {
      setMsg({ kind: 'error', text: err.message || 'Could not submit the claim. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  const accessActive = status && status.accessActive;

  return (
    <div className="page">
      <header className="page-header">
        <h1>Premium</h1>
        <p className="page-sub">
          One day of Dark Matter access. Pay through your UPI app, then submit the payment details for verification.
        </p>
      </header>

      {ready && user && (
        <div className="balance-card">
          <div className="balance-label">Your access</div>
          {accessActive ? (
            <div className="msg-ok">Access active until {fmtDate(status.accessUntil)}</div>
          ) : (
            <div className="muted">No active access{status && status.accessUntil ? ` — last access ended ${fmtDate(status.accessUntil)}` : ''}. Activate below for 1 day.</div>
          )}
          {typeof status?.balanceUsd === 'number' && status.balanceUsd > 0 && (
            <div className="muted pay-credit">Credit balance: ${Number(status.balanceUsd).toFixed(2)}</div>
          )}
        </div>
      )}

      {view === 'failed' ? (
        <div className="pay-fail">
          <h3>Payment failed</h3>
          <p className="page-sub">
            Your payment did not go through — no money was taken. Check your UPI app
            (balance, daily limit, or a mistyped UPI ID) and try again.
          </p>
          <button className="btn btn-primary" onClick={() => { setView('pay'); setMsg(null); }}>
            Retry payment
          </button>
          <p className="muted pay-fail-note">
            If your UPI app actually confirms the payment went through, go back and
            submit the form with the UTR — the UTR is the proof.
          </p>
        </div>
      ) : (
        <div className="pay-grid">
          <div className="qr-box">
            {qrMarkup ? (
              <div dangerouslySetInnerHTML={{ __html: qrMarkup }} />
            ) : (
              <div className="muted">Loading QR…</div>
            )}
            <div className="upi-id-row">
              <code>{upi ? upi.upiId : '…'}</code>
              <button className="btn btn-ghost small" type="button" onClick={copyUpiId} disabled={!upi}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="pay-amount">₹10,000 · 1 day of access</div>
            {upi && (
              <a className="btn btn-primary" href={upi.deepLink}>
                Open in UPI app
              </a>
            )}
            <button className="link-btn" type="button" onClick={() => setView('failed')}>
              My payment failed
            </button>
          </div>

          <form className="pay-form" onSubmit={submit}>
            <h3>I have paid</h3>
            <p className="page-sub">
              Paid from your UPI app? Enter the details so the admin can verify the money
              arrived. Your account will be activated within 24 hours after verification.
            </p>
            {!user && (
              <>
                <input
                  className="text-input"
                  placeholder="Signup username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoComplete="username"
                />
                <input
                  className="text-input"
                  type="password"
                  placeholder="Signup password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                />
              </>
            )}
            <input
              className="text-input"
              placeholder="Phone number"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              autoComplete="tel"
            />
            <input
              className="text-input"
              placeholder="WhatsApp number"
              inputMode="tel"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              autoComplete="tel"
            />
            <input
              className="text-input"
              placeholder="Account details (name / bank)"
              value={form.accountDetails}
              onChange={(e) => setForm({ ...form, accountDetails: e.target.value })}
            />
            <input
              className="text-input"
              placeholder="UTR number (from your UPI app)"
              value={form.utr}
              onChange={(e) => setForm({ ...form, utr: e.target.value.replace(/[^A-Za-z0-9]/g, '') })}
              autoComplete="off"
            />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit payment claim'}
            </button>
            {msg && <p className={msg.kind === 'ok' ? 'msg-ok' : 'msg-error'}>{msg.text}</p>}
            {pendingClaim && (
              <p className="msg-ok">
                Claim waiting for verification — submitted {fmtDate(pendingClaim.createdAt)}.
                Your account will be activated within 24 hours after verification.
              </p>
            )}
            {latestClaim && latestClaim.status === 'rejected' && !pendingClaim && (
              <p className="msg-error">
                Your last payment could not be verified. Check the UTR and submit again with the correct details.
              </p>
            )}
          </form>
        </div>
      )}

      {ready && user && claims.length > 0 && (
        <div className="pay-section">
          <h3>My payment claims</h3>
          <ul className="txn-list">
            {claims.map((c) => (
              <li key={c.id}>
                <span className={c.status === 'verified' ? 'txn-plus' : c.status === 'rejected' ? 'txn-minus' : ''}>
                  {c.status === 'verified' ? 'Activated' : c.status === 'rejected' ? 'Not verified' : 'Pending'}
                </span>
                <span className="muted">₹{c.amountInr.toLocaleString('en-IN')} · UTR {c.utr}</span>
                <span className="muted">
                  {c.status === 'verified' && c.accessUntil ? `Access until ${fmtDate(c.accessUntil)}` : fmtDate(c.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ready && user && txns.length > 0 && (
        <div className="pay-section">
          <h3>Recent activity</h3>
          <ul className="txn-list">
            {txns.map((t, i) => (
              <li key={i}>
                <span className={t.cents >= 0 ? 'txn-plus' : 'txn-minus'}>
                  {t.cents >= 0 ? '+' : '−'}${(Math.abs(t.cents) / 100).toFixed(2)}
                </span>
                <span className="muted">{t.type === 'topup' ? 'Top-up' : 'Hunt spend'}{t.mode ? ` · ${t.mode}` : ''}</span>
                <span className="muted">{new Date(t.ts).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
