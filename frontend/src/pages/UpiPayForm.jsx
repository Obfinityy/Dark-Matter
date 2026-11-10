// "I have paid" claim form — extracted from UpiPayPage.jsx (P6). Owns the
// form state and the submit; the page owns the UPI details, claim lists
// and refresh. Logged-out users (pending signups) submit with their signup
// username + password — the password proves ownership of the pending
// account. Logged-in users submit with their session (renewal).
import React, { useState } from 'react';
import { submitPaymentClaim } from '../lib/api';

export default function UpiPayForm({ user, pendingClaim, latestClaim, fmtDate, onClaimSubmitted }) {
  const [form, setForm] = useState({ username: '', password: '', phone: '', whatsapp: '', accountDetails: '', utr: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

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
        if (onClaimSubmitted) onClaimSubmitted();
      } else {
        setMsg({ kind: 'error', text: res.error || 'Could not submit the claim. Try again.' });
      }
    } catch (err) {
      setMsg({ kind: 'error', text: err.message || 'Could not submit the claim. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
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
          ⏳ Claim waiting for verification — submitted {fmtDate(pendingClaim.createdAt)}.
          Your account will be activated within 24 hours after verification.
        </p>
      )}
      {latestClaim && latestClaim.status === 'rejected' && !pendingClaim && (
        <p className="msg-error">
          Your last payment could not be verified. Check the UTR and submit again with the correct details.
        </p>
      )}
    </form>
  );
}
