/**
 * Account — who you are, your tier, and the way out.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { UserRound, Crown, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { getReservedTier } from './Premium';
import { getPermissionMode, PERMISSION_LABELS } from '../../services/permissions';

export function Account() {
  const { user, logout } = useAuth();
  const reservedTier = getReservedTier();
  const permissionMode = getPermissionMode();
  const initial = (user?.username || user?.name || user?.email || '?').charAt(0).toUpperCase();

  const rows = [
    { label: 'Username', value: user?.username || '—' },
    { label: 'Email', value: user?.email || '—' },
    { label: 'User ID', value: user?.id || '—' },
  ];

  return (
    <div className="sg-account">
      <h2 className="sg-h1" style={{ margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <UserRound size={26} /> Account
      </h2>

      <section className="sg-card sg-card-pad" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <span
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--sg-gradient)', color: '#06080d',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '1.4rem', flex: '0 0 auto',
            }}
          >
            {initial}
          </span>
          <div>
            <div style={{ fontWeight: 750, fontSize: '1.1rem' }}>{user?.username || user?.name || 'Agent'}</div>
            <div className="sg-small">{user?.email || ''}</div>
          </div>
        </div>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: '1px solid var(--sg-line-soft)' }}>
            <span className="sg-small">{r.label}</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, wordBreak: 'break-all', textAlign: 'right' }}>{r.value}</span>
          </div>
        ))}
      </section>

      <section className="sg-card sg-card-pad" style={{ marginBottom: 18 }}>
        <h3 className="sg-h2" style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Crown size={18} style={{ color: '#fbbf24' }} /> Plan
        </h3>
        <p className="sg-body" style={{ margin: '0 0 12px' }}>
          {reservedTier
            ? <>Your <strong style={{ textTransform: 'capitalize' }}>{reservedTier}</strong> tier is reserved — billing goes live soon.</>
            : <>You're on the <strong>Free</strong> tier.</>}
        </p>
        <Link to="/agent/premium" className="sg-btn sg-btn-ghost">View Premium tiers →</Link>
      </section>

      <section className="sg-card sg-card-pad" style={{ marginBottom: 18 }}>
        <h3 className="sg-h2" style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={18} /> Agent permissions
        </h3>
        <p className="sg-body" style={{ margin: '0 0 12px' }}>
          Current mode: <strong>{PERMISSION_LABELS[permissionMode]}</strong>
        </p>
        <Link to="/agent/settings" className="sg-btn sg-btn-ghost">Change in Settings →</Link>
      </section>

      <button className="sg-btn sg-btn-ghost" onClick={logout} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <LogOut size={15} /> Sign out
      </button>
    </div>
  );
}
