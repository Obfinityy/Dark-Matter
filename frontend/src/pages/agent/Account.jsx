/**
 * Account — who you are, your credits, and the way out.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, ShieldCheck, LogOut, ArrowRight } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { getCreditBalance } from '../../services/api.js';
import { getPermissionMode, PERMISSION_LABELS } from '../../services/permissions';
import './Account.css';

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
    <div className="dm-container dm-account">
      <header className="dm-page-head">
        <h1 className="dm-page-title">Account</h1>
        <p className="dm-page-sub">Your identity, your plan, and the way out.</p>
      </header>

      {/* ── Profile ── */}
      <section className="dm-card dm-polish-in" aria-label="Profile">
        <div className="dm-account-profile">
          <span className="dm-account-avatar" aria-hidden="true">
            {initial}
          </span>
          <div className="dm-account-identity">
            <div className="dm-account-name">{user?.username || user?.name || 'Agent'}</div>
            <div className="dm-muted dm-account-email">{user?.email || ''}</div>
          </div>
        </div>
        {rows.map(r => (
          <div key={r.label} className="dm-account-row">
            <span className="dm-muted dm-account-row-label">{r.label}</span>
            <span className="dm-account-row-value">{r.value}</span>
          </div>
        ))}
      </section>

      {/* ── Credits ── */}
      <section
        className="dm-card dm-polish-in"
        aria-label="Infinity Credits"
        style={{ animationDelay: '70ms' }}
      >
        <h2 className="dm-card-title">
          <span className="dm-account-section-head">
            <Wallet size={18} style={{ color: 'var(--dm-gold-soft)' }} aria-hidden="true" /> Infinity
            Credits
          </span>
        </h2>
        <p className="dm-card-sub">
          {credits === null ? (
            <>Your balance is unavailable right now.</>
          ) : (
            <>
              You have{' '}
              <strong className="dm-account-strong">
                ₹{Number(credits).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </strong>{' '}
              in Infinity Credits.
            </>
          )}
        </p>
        <Link to="/agent/premium" className="dm-btn dm-btn-secondary">
          Top up credits <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </section>

      {/* ── Agent permissions ── */}
      <section
        className="dm-card dm-polish-in"
        aria-label="Agent permissions"
        style={{ animationDelay: '140ms' }}
      >
        <h2 className="dm-card-title">
          <span className="dm-account-section-head">
            <ShieldCheck size={18} aria-hidden="true" /> Agent permissions
          </span>
        </h2>
        <p className="dm-card-sub">
          Current mode: <strong className="dm-account-strong">{PERMISSION_LABELS[permissionMode]}</strong>
        </p>
        <Link to="/agent/settings" className="dm-btn dm-btn-secondary">
          Change in Settings <ArrowRight size={14} aria-hidden="true" />
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
