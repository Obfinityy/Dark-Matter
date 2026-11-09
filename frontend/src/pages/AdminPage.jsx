// Admin portal — invite-only user management.
// Only users with role=admin can open this page.

import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import {
  listAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser,
  listAdminHunts, blockAdminUser, unblockAdminUser, changeUserPassword,
  stopHunt, resumeHunt, getAuthToken, listAgentAccounts,
  listPaymentClaims, verifyPaymentClaim, rejectPaymentClaim, rejectAdminUser,
  approveAdminUser,
} from '../lib/api';
import { resolveApiBase } from '../config';
import { toast } from '../lib/toast';
import AdminInviteSection from './admin/AdminInviteSection';
import AdminUsersSection from './admin/AdminUsersSection';
import AdminAccountsSection from './admin/AdminAccountsSection';
import AdminClaimsSection from './admin/AdminClaimsSection';
import AdminHuntsSection from './admin/AdminHuntsSection';
import AdminModals from './admin/AdminModals';
import { ADMIN_STYLES } from './admin/adminStyles';

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [hunts, setHunts] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', control: 'minimal' });
  const [busy, setBusy] = useState(false);
  const [blockModal, setBlockModal] = useState(null); // user to block
  // Shared in-app confirmation modal (replaces native confirm(), which
  // automated browsers auto-dismiss — so Delete/Reject never fired).
  // { kind: 'delete-user' | 'reject-signup' | 'reject-claim', title, message, confirmLabel, user, claim }
  const [confirmModal, setConfirmModal] = useState(null);
  const [blockDuration, setBlockDuration] = useState('24');
  const [customHours, setCustomHours] = useState('');
  const [pwModal, setPwModal] = useState(null); // user to change password
  const [newPassword, setNewPassword] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [accounts, setAccounts] = useState([]);
  const [claims, setClaims] = useState([]);
  const [revealed, setRevealed] = useState({}); // handle -> password (admin reveal-on-click only)
  // Hunter filter for the hunts tab (owner order 4 Nov 2026): separate
  // AI hunts from Autonomous hunts. 'all' | 'ai' | 'scanner' | 'unknown'.
  const [huntFilter, setHuntFilter] = useState('all');

  async function load() {
    setLoading(true);
    const [uRes, hRes, aRes, cRes] = await Promise.all([listAdminUsers(), listAdminHunts(), listAgentAccounts(), listPaymentClaims()]);
    setLoading(false);
    if (uRes.ok) setUsers((uRes.data && uRes.data.users) || []);
    else toast(uRes.error || 'Could not load users.', 'error');
    if (hRes.ok) {
      setHunts((hRes.data && hRes.data.hunts) || []);
      setQueue((hRes.data && hRes.data.queue) || []);
    }
    if (aRes.ok) setAccounts((aRes.data && aRes.data.accounts) || []);
    if (cRes.ok) setClaims((cRes.data && cRes.data.claims) || []);
    else toast(cRes.error || 'Could not load payment claims.', 'error');
  }

  useEffect(() => { load(); }, []);

  if (!user || user.role !== 'admin') {
    return (
      <div className="page"><div className="page-inner">
        <h1>Admin</h1>
        <p className="page-sub">Admin access required.</p>
      </div></div>
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.username.trim() || form.password.length < 8) {
      toast('Username required, password 8+ chars.', 'error');
      return;
    }
    setBusy(true);
    const res = await createAdminUser(form);
    setBusy(false);
    if (res.ok) {
      toast(`User ${res.user.username} created.`, 'success');
      setForm({ username: '', password: '', control: 'minimal' });
      load();
    } else {
      toast(res.error || 'Could not create user.', 'error');
    }
  }

  async function handleControl(u, control) {
    const res = await updateAdminUser(u.id, { control });
    if (res.ok) { toast('Control updated.', 'success'); load(); }
    else toast(res.error || 'Failed.', 'error');
  }

  function handleDelete(u) {
    setConfirmModal({
      kind: 'delete-user',
      title: `Delete user ${u.username}?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      user: u,
    });
  }

  async function handleConfirmModal() {
    if (!confirmModal) return;
    const m = confirmModal;
    setConfirmModal(null);
    if (m.kind === 'delete-user') {
      const res = await deleteAdminUser(m.user.id);
      if (res.ok) { toast('User deleted.', 'success'); load(); }
      else toast(res.error || 'Failed.', 'error');
    } else if (m.kind === 'reject-signup') {
      const res = await rejectAdminUser(m.user.id);
      if (res.ok) { toast(`Rejected ${m.user.username}`, 'success'); load(); }
      else toast(res.error || 'Failed', 'error');
    } else if (m.kind === 'reject-claim') {
      const res = await rejectPaymentClaim(m.claim.id);
      if (res.ok) { toast(`Claim from ${m.claim.username} rejected.`, 'success'); load(); }
      else toast(res.error || 'Failed.', 'error');
    }
  }

  async function handleApproveUser(u) {
    const res = await approveAdminUser(u.id);
    if (res.ok) { toast(`Approved ${u.username}`, 'success'); load(); }
    else toast(res.error || 'Failed', 'error');
  }

  function handleRejectSignup(u) {
    setConfirmModal({
      kind: 'reject-signup',
      title: `Reject signup for ${u.username}?`,
      message: '',
      confirmLabel: 'Reject',
      user: u,
    });
  }

  async function handleBlock() {
    if (!blockModal) return;
    const hours = blockDuration === 'custom' ? parseInt(customHours, 10) : parseInt(blockDuration, 10);
    const permanent = blockDuration === 'permanent';
    if (!permanent && (!hours || hours < 1)) {
      toast('Enter valid hours.', 'error');
      return;
    }
    const res = await blockAdminUser(blockModal.id, { durationHours: hours, permanent });
    if (res.ok) {
      toast(`User ${blockModal.username} blocked.`, 'success');
      setBlockModal(null);
      load();
    } else toast(res.error || 'Failed.', 'error');
  }

  async function handleUnblock(u) {
    const res = await unblockAdminUser(u.id);
    if (res.ok) { toast('User unblocked.', 'success'); load(); }
    else toast(res.error || 'Failed.', 'error');
  }

  async function handlePasswordChange() {
    if (!pwModal || newPassword.length < 8) {
      toast('Password must be 8+ chars.', 'error');
      return;
    }
    const res = await changeUserPassword(pwModal.id, newPassword);
    if (res.ok) {
      toast('Password updated.', 'success');
      setPwModal(null);
      setNewPassword('');
    } else toast(res.error || 'Failed.', 'error');
  }

  async function handleVerifyClaim(c) {
    const res = await verifyPaymentClaim(c.id);
    if (res.ok && res.data) {
      const until = res.data.accessUntil ? new Date(res.data.accessUntil).toLocaleString() : '';
      toast(`Activated ${c.username} — access until ${until}.`, 'success');
      load();
    } else toast(res.error || 'Failed.', 'error');
  }

  function handleRejectClaim(c) {
    setConfirmModal({
      kind: 'reject-claim',
      title: `Reject the payment claim from ${c.username} (UTR ${c.utr})?`,
      message: 'The account will NOT be activated.',
      confirmLabel: 'Reject',
      claim: c,
    });
  }

  async function handleStopHunt(huntId) {
    if (!confirm('Stop this hunt?')) return;
    const res = await stopHunt(huntId);
    if (res.ok) { toast('Hunt stopped.', 'success'); load(); }
    else toast(res.error || 'Failed.', 'error');
  }

  async function handleResumeHunt(huntId) {
    const res = await resumeHunt(huntId);
    if (res.ok) { toast('Hunt resumed.', 'success'); load(); }
    else toast(res.error || 'Failed.', 'error');
  }

  async function handleDownloadMemory(huntId) {
    try {
      const token = getAuthToken();
      const res = await fetch(`${resolveApiBase()}/api/v1/admin/hunts/${huntId}/memory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hunt-${huntId}-memory.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Memory downloaded.', 'success');
    } catch {
      toast('Download failed.', 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-inner admin-page">
        <header className="page-header">
          <h1>Admin portal</h1>
          <p className="page-sub">Manage users, hunts, and system access.</p>
        </header>

        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users ({users.length})
          </button>
          <button
            className={`admin-tab ${activeTab === 'hunts' ? 'active' : ''}`}
            onClick={() => setActiveTab('hunts')}
          >
            Hunts ({hunts.length})
          </button>
          <button
            className={`admin-tab ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            Agent accounts ({accounts.length})
          </button>
          <button
            className={`admin-tab ${activeTab === 'claims' ? 'active' : ''}`}
            onClick={() => setActiveTab('claims')}
          >
            Payment claims ({claims.filter((c) => c.status === 'pending').length})
          </button>
          <button
            className={`admin-tab ${activeTab === 'invite' ? 'active' : ''}`}
            onClick={() => setActiveTab('invite')}
          >
            Invite user
          </button>
        </div>

        {activeTab === 'invite' && (
          <AdminInviteSection form={form} setForm={setForm} busy={busy} onCreate={handleCreate} />
        )}

        {activeTab === 'users' && (
          <AdminUsersSection
            users={users}
            loading={loading}
            onApprove={handleApproveUser}
            onRejectSignup={handleRejectSignup}
            onControl={handleControl}
            onPassword={setPwModal}
            onUnblock={handleUnblock}
            onBlock={setBlockModal}
            onDelete={handleDelete}
          />
        )}

        {activeTab === 'accounts' && (
          <AdminAccountsSection accounts={accounts} loading={loading} revealed={revealed} setRevealed={setRevealed} />
        )}

        {activeTab === 'claims' && (
          <AdminClaimsSection claims={claims} loading={loading} onVerify={handleVerifyClaim} onReject={handleRejectClaim} />
        )}

        {activeTab === 'hunts' && (
          <AdminHuntsSection
            hunts={hunts}
            queue={queue}
            loading={loading}
            huntFilter={huntFilter}
            setHuntFilter={setHuntFilter}
            onStopHunt={handleStopHunt}
            onResumeHunt={handleResumeHunt}
            onDownloadMemory={handleDownloadMemory}
          />
        )}

        <AdminModals
          blockModal={blockModal}
          setBlockModal={setBlockModal}
          blockDuration={blockDuration}
          setBlockDuration={setBlockDuration}
          customHours={customHours}
          setCustomHours={setCustomHours}
          onBlock={handleBlock}
          confirmModal={confirmModal}
          setConfirmModal={setConfirmModal}
          onConfirmModal={handleConfirmModal}
          pwModal={pwModal}
          setPwModal={setPwModal}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          onPasswordChange={handlePasswordChange}
        />
      </div>

      <style>{ADMIN_STYLES}</style>
    </div>
  );
}
