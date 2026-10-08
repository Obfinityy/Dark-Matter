/**
 * Account — who you are, your credits, and the way out.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { getCreditBalance } from '../../services/api.js';
import { getPermissionMode, PERMISSION_LABELS } from '../../services/permissions';

export function Account() {
  const { user, logout } = useAuth();
  const [credits, setCredits] = useState(null);
  useEffect(() => {
    getCreditBalance()
      .then((r) => setCredits(typeof r?.creditBalanceInr === 'number' ? r.creditBalanceInr : 0))
      .catch(() => setCredits(null));
  }, []);
  const permissionMode = getPermissionMode();
  const initial = (user?.username || user?.name || user?.email || '?').charAt(0).toUpperCase();

  const rows = [
    { label: 'Username', value: user?.username || '—' },
    { label: 'Email', value: user?.email || '—' },
    { label: 'User ID', value: user?.id || '—' },
  ];

  return (
    <div className="dm-container">
      <header className="dm-page-head">
        <h1 className="dm-page-title">Account</h1>
        <p className="dm-page-sub">Your identity, your plan, and the way out.</p>
      </header>

      {/* ── Profile ── */}
      <section className="dm-card" aria-label="Profile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <span
            aria-hidden="true"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              fontWeight: 700,
              background: 'var(--dm-gold-glow)',
              border: '1px solid var(--dm-gold-border)',
              color: 'var(--dm-gold-soft)',
              flexShrink: 0,
            }}
          >
            {initial}
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.username || user?.name || 'Agent'}
            </div>
            <div
              className="dm-muted"
              style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {user?.email || ''}
            </div>
          </div>
        </div>
        {rows.map(r => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 16,
              padding: '12px 0',
              borderTop: '1px solid var(--dm-border-soft)',
            }}
          >
            <span className="dm-muted" style={{ fontSize: '0.875rem', flexShrink: 0 }}>
              {r.label}
            </span>
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                wordBreak: 'break-all',
                textAlign: 'right',
              }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </section>

      {/* ── Credits ── */}
      <section className="dm-card" aria-label="Infinity Credits">
        <h2 className="dm-card-title">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={18} style={{ color: 'var(--dm-gold-soft)' }} aria-hidden="true" /> Infinity Credits
          </span>
        </h2>
        <p className="dm-card-sub">
          {credits === null
            ? <>Your balance is unavailable right now.</>
            : <>You have <strong style={{ color: 'var(--dm-text)' }}>₹{Number(credits).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong> in Infinity Credits.</>}
        </p>
        <Link to="/agent/premium" className="dm-btn dm-btn-secondary">Top up credits →</Link>

      </section>

      {/* ── Agent permissions ── */}
      <section className="dm-card" aria-label="Agent permissions">
        <h2 className="dm-card-title">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} aria-hidden="true" /> Agent permissions
          </span>
        </h2>
        <p className="dm-card-sub">
          Current mode:{' '}
          <strong style={{ color: 'var(--dm-text)' }}>{PERMISSION_LABELS[permissionMode]}</strong>
        </p>
        <Link to="/agent/settings" className="dm-btn dm-btn-secondary">
          Change in Settings →
        </Link>
      </section>

      <div className="dm-mt-6">
        <button className="dm-btn dm-btn-danger" onClick={logout}>
          <LogOut size={15} aria-hidden="true" /> Sign out
        </button>
      </div>
    </div>
  );
}
