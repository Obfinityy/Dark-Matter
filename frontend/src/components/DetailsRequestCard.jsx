// Dynamic details request card (27 Oct 2026, owner order).
//
// The agent asks the owner for details it needs (a login, an OTP, any field)
// instead of creating its own account. This card appears below the chat
// thread, above the composer, with exactly the fields the agent asked for.
// The owner fills them in and the agent continues on the next turn.
//
// SECURITY: the values live in this component's state only until submit,
// are cleared the moment the submit succeeds, and are NEVER rendered back
// after submitting. The backend never returns values (public form only).
import React, { useEffect, useRef, useState } from 'react';
import { getDetailRequests, submitDetailRequest, cancelDetailRequest } from '../lib/api';

const POLL_MS = 10000;

function fieldInputType(field, showPassword) {
  if (field.type === 'password') return showPassword ? 'text' : 'password';
  if (field.type === 'email') return 'email';
  return 'text';
}

export default function DetailsRequestCard({ huntId }) {
  const [request, setRequest] = useState(null);
  const [values, setValues] = useState({});
  const [showPassword, setShowPassword] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // 'filled' | 'cancelled'
  const [error, setError] = useState('');
  const requestIdRef = useRef(null);

  useEffect(() => {
    if (!huntId) return undefined;
    let stopped = false;
    async function load() {
      const res = await getDetailRequests(huntId);
      if (stopped || !res.ok) return;
      const reqs = (res.data && res.data.requests) || [];
      const pending = reqs.find((r) => r.status === 'pending') || null;
      if (pending && pending.id !== requestIdRef.current) {
        requestIdRef.current = pending.id;
        setRequest(pending);
        setValues({});
        setShowPassword({});
        setDone(null);
        setError('');
      } else if (!pending) {
        requestIdRef.current = null;
        setRequest(null);
      }
    }
    load();
    const timer = setInterval(load, POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [huntId]);

  if (!huntId) return null;
  if (!request && !done) return null;

  function setValue(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setError('');
  }

  async function handleSubmit() {
    if (!request) return;
    const missing = (request.fields || []).filter(
      (f) => f.required && !String(values[f.key] || '').trim(),
    );
    if (missing.length) {
      setError(`Please fill in: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }
    setSubmitting(true);
    setError('');
    const res = await submitDetailRequest(huntId, request.id, values);
    setSubmitting(false);
    // Clear the secrets from memory whatever the outcome.
    setValues({});
    setShowPassword({});
    if (!res.ok) {
      if (String(res.error || '').includes('filled') || String(res.error || '').includes('cancelled')) {
        setDone('filled');
        setRequest(null);
      } else {
        setError(res.error || 'Could not send the details. Try again.');
      }
      return;
    }
    setDone('filled');
    setRequest(null);
  }

  async function handleCancel() {
    if (!request) return;
    setSubmitting(true);
    const res = await cancelDetailRequest(huntId, request.id);
    setSubmitting(false);
    setValues({});
    setShowPassword({});
    if (!res.ok) {
      setError(res.error || 'Could not decline. Try again.');
      return;
    }
    setDone('cancelled');
    setRequest(null);
  }

  return (
    <div className="details-request-card" role="region" aria-label="Enter details to go forward">
      {request ? (
        <>
          <div className="details-request-title">Enter details to go forward</div>
          <p className="details-request-sub">
            The agent needs this from you to continue the hunt: <strong>{request.title}</strong>
            {request.site ? ` (${request.site})` : ''}. Your details are sent only to the agent
            for this hunt — they are never shown in the chat.
          </p>
          <div className="details-request-fields">
            {(request.fields || []).map((field) => (
              <label key={field.key} className="field-label">
                {field.label}
                {field.required ? ' *' : ''}
                {field.type === 'textarea' ? (
                  <textarea
                    className="text-input"
                    rows={3}
                    value={values[field.key] || ''}
                    onChange={(e) => setValue(field.key, e.target.value)}
                    disabled={submitting}
                  />
                ) : (
                  <span className="details-request-field-row">
                    <input
                      className="text-input"
                      type={fieldInputType(field, showPassword[field.key])}
                      inputMode={field.type === 'otp' ? 'numeric' : undefined}
                      autoComplete={field.type === 'otp' ? 'one-time-code' : field.type === 'password' ? 'current-password' : field.type === 'email' ? 'email' : 'off'}
                      value={values[field.key] || ''}
                      onChange={(e) => setValue(field.key, e.target.value)}
                      disabled={submitting}
                    />
                    {field.type === 'password' && (
                      <button
                        type="button"
                        className="details-request-show"
                        onClick={() => setShowPassword((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                        disabled={submitting}
                      >
                        {showPassword[field.key] ? 'Hide' : 'Show'}
                      </button>
                    )}
                  </span>
                )}
              </label>
            ))}
          </div>
          {error && <p className="details-request-error">{error}</p>}
          <div className="details-request-actions">
            <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Sending…' : 'Send details'}
            </button>
            <button type="button" className="details-request-cancel" onClick={handleCancel} disabled={submitting}>
              I don&apos;t want to share this
            </button>
          </div>
        </>
      ) : (
        <p className="details-request-done">
          {done === 'filled'
            ? 'Details received — the agent will continue with them.'
            : 'Declined — the agent will find another way forward.'}
        </p>
      )}
    </div>
  );
}
