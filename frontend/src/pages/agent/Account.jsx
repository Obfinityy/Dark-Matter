/**
 * Account — who you are, your credits, and the way out.
 *
 * Kinetic redesign (issue #292): kinetic page title, staggered card entrances,
 * calm rows. Logic (auth, balance fetch, permission-mode read) is untouched.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, ShieldCheck, LogOut, ArrowRight } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { getCreditBalance } from '../../services/api.js';
import { getPermissionMode, PERMISSION_LABELS } from '../../services/permissions';
import '../../styles/kinetic-acct.css';

/** Kinetic letter spans for a title string. Parent must carry aria-label. */
function kineticLetters(text) {
  let i = 0;
  return text.split(' ').map((word, wi, words) => (
    <span key={wi} className="kac-word" aria-hidden="true">
      {word.split('').map(ch => {
        const idx = i++;
        return (
          <span key={idx} className="kac-ch" style={{ '--kac-i': idx }} aria-hidden="true">
            {ch}
          </span>
        );
      })}
      {wi < words.length - 1 ? ' ' : null}
    </span>
  ));
}

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
    <div className="kac-page">
      <header className="kac-head">
        <h1 className="kac-title" aria-label="Account">
          {kineticLetters('Account')}
        </h1>
        <p className="kac-sub">Your identity, your plan, and the way out.</p>
      </header>

      {/* ── Profile ── */}
      <section className="kac-card kac-in" style={{ '--kac-i': 1 }} aria-label="Profile">
        <div className="kac-profile">
          <span className="kac-avatar" aria-hidden="true">
            {initial}
          </span>
          <div className="kac-profile-id">
            <div className="kac-profile-name">{user?.username || user?.name || 'Agent'}</div>
            <div className="kac-muted kac-profile-email">{user?.email || ''}</div>
          </div>
        </div>
        {rows.map(r => (
          <div key={r.label} className="kac-row">
            <span className="kac-muted kac-row-label">{r.label}</span>
            <span className="kac-row-value">{r.value}</span>
          </div>
        ))}
      </section>

      {/* ── Credits ── */}
      <section className="kac-card kac-in" style={{ '--kac-i': 2 }} aria-label="Infinity Credits">
        <h2 className="kac-h" style={{ '--kac-i': 2 }}>
          <Wallet size={18} aria-hidden="true" /> Infinity Credits
        </h2>
        <p className="kac-body">
          {credits === null ? (
            <>Your balance is unavailable right now.</>
          ) : (
            <>
              You have{' '}
              <strong className="kac-strong">
                ₹{Number(credits).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </strong>{' '}
              in Infinity Credits.
            </>
          )}
        </p>
        <Link to="/agent/premium" className="kac-btn kac-btn-secondary">
          Top up credits <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </section>

      {/* ── Agent permissions ── */}
      <section className="kac-card kac-in" style={{ '--kac-i': 3 }} aria-label="Agent permissions">
        <h2 className="kac-h" style={{ '--kac-i': 3 }}>
          <ShieldCheck size={18} aria-hidden="true" /> Agent permissions
        </h2>
        <p className="kac-body">
          Current mode: <strong className="kac-strong">{PERMISSION_LABELS[permissionMode]}</strong>
        </p>
        <Link to="/agent/settings" className="kac-btn kac-btn-secondary">
          Change in Settings <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </section>

      <div className="kac-signout kac-in" style={{ '--kac-i': 4 }}>
        <button className="kac-btn kac-btn-danger-quiet" onClick={logout}>
          <LogOut size={15} aria-hidden="true" /> Sign out
        </button>
      </div>
    </div>
  );
}
