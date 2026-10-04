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
      <h2 className="sg-h1 sg-account-head">
        <UserRound size={26} /> Account
      </h2>

      <section className="sg-card sg-card-pad sg-account-section" aria-label="Profile">
        <div className="sg-account-profile">
          <span className="sg-account-avatar" aria-hidden="true">{initial}</span>
          <div>
            <div className="sg-account-name">{user?.username || user?.name || 'Agent'}</div>
            <div className="sg-small">{user?.email || ''}</div>
          </div>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="sg-account-row">
            <span className="sg-small">{r.label}</span>
            <span className="sg-account-value">{r.value}</span>
          </div>
        ))}
      </section>

      <section className="sg-card sg-card-pad sg-account-section" aria-label="Plan">
        <h3 className="sg-h2">
          <Crown size={18} style={{ color: '#fbbf24' }} /> Plan
        </h3>
        <p className="sg-body sg-account-plan">
          {reservedTier
            ? <>Your <strong style={{ textTransform: 'capitalize' }}>{reservedTier}</strong> tier is reserved — billing goes live soon.</>
            : <>You're on the <strong>Free</strong> tier.</>}
        </p>
        <Link to="/agent/premium" className="sg-btn sg-btn-ghost">View Premium tiers →</Link>
      </section>

      <section className="sg-card sg-card-pad sg-account-section" aria-label="Agent permissions">
        <h3 className="sg-h2">
          <ShieldCheck size={18} /> Agent permissions
        </h3>
        <p className="sg-body sg-account-plan">
          Current mode: <strong>{PERMISSION_LABELS[permissionMode]}</strong>
        </p>
        <Link to="/agent/settings" className="sg-btn sg-btn-ghost">Change in Settings →</Link>
      </section>

      <button className="sg-btn sg-btn-ghost sg-account-signout" onClick={logout}>
        <LogOut size={15} /> Sign out
      </button>
    </div>
  );
}
