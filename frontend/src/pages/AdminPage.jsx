// Admin portal — invite-only user management.
// Only users with role=admin can open this page.

import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import {
  listAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser,
  listAdminHunts, blockAdminUser, unblockAdminUser, changeUserPassword,
  stopHunt, resumeHunt, getAuthToken, listAgentAccounts, revealAgentAccount,
} from '../lib/api';
import { resolveApiBase } from '../config';
import { toast } from '../lib/toast';

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [hunts, setHunts] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', control: 'minimal' });
  const [busy, setBusy] = useState(false);
  const [blockModal, setBlockModal] = useState(null); // user to block
  const [blockDuration, setBlockDuration] = useState('24');
  const [customHours, setCustomHours] = useState('');
  const [pwModal, setPwModal] = useState(null); // user to change password
  const [newPassword, setNewPassword] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [accounts, setAccounts] = useState([]);
  const [revealed, setRevealed] = useState({}); // handle -> password (admin reveal-on-click only)

  async function load() {
    setLoading(true);
    const [uRes, hRes, aRes] = await Promise.all([listAdminUsers(), listAdminHunts(), listAgentAccounts()]);
    setLoading(false);
    if (uRes.ok) setUsers((uRes.data && uRes.data.users) || []);
    else toast(uRes.error || 'Could not load users.', 'error');
    if (hRes.ok) {
      setHunts((hRes.data && hRes.data.hunts) || []);
      setQueue((hRes.data && hRes.data.queue) || []);
    }
    if (aRes.ok) setAccounts((aRes.data && aRes.data.accounts) || []);
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

  async function handleDelete(u) {
    if (!confirm(`Delete user ${u.username}? This cannot be undone.`)) return;
    const res = await deleteAdminUser(u.id);
    if (res.ok) { toast('User deleted.', 'success'); load(); }
    else toast(res.error || 'Failed.', 'error');
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

  const formatBlockStatus = (u) => {
    if (!u.blocked) return null;
    if (!u.blockedUntil) return '🔴 Blocked permanently';
    const until = new Date(u.blockedUntil);
    if (until <= new Date()) return null;
    return `🔴 Blocked until ${until.toLocaleString()}`;
  };

  return (
    <div className="page">
      <div className="page-inner admin-page">
        <header className="page-header">
          <h1>🛡️ Admin Portal</h1>
          <p className="page-sub">Manage users, hunts, and system access.</p>
        </header>

        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Users ({users.length})
          </button>
          <button
            className={`admin-tab ${activeTab === 'hunts' ? 'active' : ''}`}
            onClick={() => setActiveTab('hunts')}
          >
            🎯 Hunts ({hunts.length})
          </button>
          <button
            className={`admin-tab ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            🤖 Agent accounts ({accounts.length})
          </button>
          <button
            className={`admin-tab ${activeTab === 'invite' ? 'active' : ''}`}
            onClick={() => setActiveTab('invite')}
          >
            ➕ Invite User
          </button>
        </div>

        {activeTab === 'invite' && (
          <section className="admin-section">
            <h2>Invite New User</h2>
            <form className="admin-form" onSubmit={handleCreate}>
              <input
                className="text-input"
                placeholder="Username (3-32 chars, lowercase)"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
              <input
                className="text-input"
                type="password"
                placeholder="Password (8+ characters)"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <select
                className="text-input"
                value={form.control}
                onChange={(e) => setForm({ ...form, control: e.target.value })}
              >
                <option value="minimal">Minimal — Normal/Medium modes</option>
                <option value="maximum">Maximum — All modes</option>
              </select>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Creating…' : '✨ Create User'}
              </button>
            </form>
          </section>
        )}

        {activeTab === 'users' && (
          <section className="admin-section">
            <h2>All Users</h2>
            {loading ? <p className="page-sub">Loading…</p> : (
              <>
                {/* Pending approvals section */}
                {users.filter(u => u.approved === false).length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h3>⏳ Pending Approvals ({users.filter(u => u.approved === false).length})</h3>
                    <div className="admin-grid">
                      {users.filter(u => u.approved === false).map((u) => (
                        <div key={u.id} className="admin-card pending-approval">
                          <div className="admin-card-header">
                            <div>
                              <div className="admin-username">⏳ {u.username}</div>
                              <div className="admin-meta">
                                Signed up: {u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}
                              </div>
                            </div>
                          </div>
                          <div className="admin-card-actions">
                            <button
                              className="btn btn-primary small"
                              onClick={async () => {
                                const { approveAdminUser } = await import('../lib/api');
                                const res = await approveAdminUser(u.id);
                                if (res.ok) { toast(`Approved ${u.username}`, 'success'); load(); }
                                else toast(res.error || 'Failed', 'error');
                              }}
                            >
                              ✅ Approve
                            </button>
                            <button
                              className="btn btn-ghost small danger"
                              onClick={async () => {
                                if (!confirm(`Reject signup for ${u.username}?`)) return;
                                const { rejectAdminUser } = await import('../lib/api');
                                const res = await rejectAdminUser(u.id);
                                if (res.ok) { toast(`Rejected ${u.username}`, 'success'); load(); }
                                else toast(res.error || 'Failed', 'error');
                              }}
                            >
                              ❌ Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <h3>Approved Users ({users.filter(u => u.approved !== false).length})</h3>
                <div className="admin-grid">
                {users.filter(u => u.approved !== false).map((u) => (
                  <div key={u.id} className={`admin-card ${u.blocked ? 'blocked' : ''}`}>
                    <div className="admin-card-header">
                      <div>
                        <div className="admin-username">
                          {u.role === 'admin' ? '👑 ' : '👤 '}{u.username}
                        </div>
                        <div className="admin-meta">
                          {u.role} · {u.control} control
                        </div>
                        {formatBlockStatus(u) && (
                          <div className="admin-block-status">{formatBlockStatus(u)}</div>
                        )}
                      </div>
                    </div>
                    {u.role !== 'admin' && (
                      <div className="admin-card-actions">
                        <select
                          className="text-input small"
                          value={u.control}
                          onChange={(e) => handleControl(u, e.target.value)}
                          title="Control level"
                        >
                          <option value="minimal">Minimal</option>
                          <option value="maximum">Maximum</option>
                        </select>
                        <button
                          className="btn btn-ghost small"
                          onClick={() => setPwModal(u)}
                          title="Change password"
                        >
                          🔑 Password
                        </button>
                        {u.blocked ? (
                          <button
                            className="btn btn-ghost small"
                            onClick={() => handleUnblock(u)}
                            title="Unblock user"
                          >
                            ✅ Unblock
                          </button>
                        ) : (
                          <button
                            className="btn btn-ghost small danger"
                            onClick={() => setBlockModal(u)}
                            title="Block user"
                          >
                            🚫 Block
                          </button>
                        )}
                        <button
                          className="btn btn-ghost small danger"
                          onClick={() => handleDelete(u)}
                          title="Delete user"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </>
            )}
          </section>
        )}

        {activeTab === 'accounts' && (
          <section className="admin-section">
            <h2>🤖 Agent Accounts</h2>
            <p className="page-sub">Accounts the agent created itself under the Obfinity persona. These never appear on the user-facing frontend — only here. Passwords are masked until you reveal one.</p>
            {loading ? <p className="page-sub">Loading…</p> : accounts.length === 0 ? (
              <p className="page-sub">No agent-created accounts yet.</p>
            ) : (
              <table className="admin-table">
                <thead><tr><th>Site</th><th>Username</th><th>Temp-mail inbox</th><th>Created</th><th>Verified</th><th>Last used</th><th>Password</th></tr></thead>
                <tbody>
                  {accounts.map((acc) => (
                    <tr key={acc.handle}>
                      <td>{acc.site}</td>
                      <td>{acc.username}</td>
                      <td>{acc.inboxAddress || '—'}</td>
                      <td>{acc.createdAt ? new Date(acc.createdAt).toLocaleString() : '—'}</td>
                      <td>{acc.verified ? '✅' : '—'}</td>
                      <td>{acc.lastUsedAt ? new Date(acc.lastUsedAt).toLocaleString() : '—'}</td>
                      <td>
                        {revealed[acc.handle] ? (
                          <span>
                            <code>{revealed[acc.handle]}</code>
                            {' '}
                            <button className="btn-small" onClick={() => setRevealed((r) => { const n = { ...r }; delete n[acc.handle]; return n; })}>Hide</button>
                          </span>
                        ) : (
                          <button
                            className="btn-small"
                            onClick={async () => {
                              const res = await revealAgentAccount(acc.handle);
                              if (res.ok && res.data && res.data.account) setRevealed((r) => ({ ...r, [acc.handle]: res.data.account.password }));
                              else toast(res.error || 'Could not reveal.', 'error');
                            }}
                          >Reveal</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {activeTab === 'hunts' && (
          <section className="admin-section">
            <h2>🎯 All Hunts</h2>
            <p className="page-sub">Monitor and control hunts across all users. Running hunts appear first.</p>
            {loading ? <p className="page-sub">Loading…</p> : (
              <>
                {/* Live status summary */}
                <div className="hunt-stats">
                  <div className="stat-card">
                    <div className="stat-num">{hunts.filter(h => h.state === 'running').length}</div>
                    <div className="stat-label">🟢 Running</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-num">{hunts.filter(h => h.state === 'paused').length}</div>
                    <div className="stat-label">⏸️ Paused</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-num">{hunts.filter(h => !['running','paused'].includes(h.state)).length}</div>
                    <div className="stat-label">⚪ Finished</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-num">{queue.length}</div>
                    <div className="stat-label">📋 Queued</div>
                  </div>
                </div>
                <div className="admin-grid">
                  {hunts.length === 0 && <p className="page-sub">No hunts yet.</p>}
                  {hunts.map((h) => {
                    const elapsed = h.elapsedSec != null
                      ? `${Math.floor(h.elapsedSec/3600)}h ${Math.floor((h.elapsedSec%3600)/60)}m`
                      : '—';
                    return (
                      <div key={h.huntId} className={`admin-card hunt-card ${h.state}`}>
                        <div className="admin-card-header">
                          <div>
                            <div className="admin-username">
                              {h.state === 'running' ? '🟢 ' : h.state === 'paused' ? '⏸️ ' : '⚪ '}
                              {h.target || '(unknown target)'}
                            </div>
                            <div className="admin-meta">
                              👤 {h.username || 'unknown'} · {h.mode || 'normal'} mode
                            </div>
                            <div className="admin-meta">
                              🆔 {h.huntId?.slice(0, 16)}… · 🔄 iter {h.iteration || 0} · ⏱️ {elapsed}
                            </div>
                            <div className="admin-meta">
                              📅 {h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}
                            </div>
                            {h.state === 'running' && (
                              <div className="hunt-live-badge">● LIVE</div>
                            )}
                          </div>
                        </div>
                        <div className="admin-card-actions">
                          {(h.state === 'running' || h.state === 'paused') && (
                            <>
                              {h.state === 'running' ? (
                                <button
                                  className="btn btn-ghost small danger"
                                  onClick={() => handleStopHunt(h.huntId)}
                                >
                                  ⏹️ Stop Hunt
                                </button>
                              ) : (
                                <button
                                  className="btn btn-ghost small"
                                  onClick={() => handleResumeHunt(h.huntId)}
                                >
                                  ▶️ Resume Hunt
                                </button>
                              )}
                            </>
                          )}
                          <button
                            className="btn btn-ghost small"
                            onClick={() => handleDownloadMemory(h.huntId)}
                          >
                            ⬇️ Memory
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Queue section */}
                {queue.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <h3>📋 Hunt Queue ({queue.length})</h3>
                    <div className="admin-grid">
                      {queue.map((q, i) => (
                        <div key={q.queueId || i} className="admin-card">
                          <div className="admin-username">#{i+1} {q.target}</div>
                          <div className="admin-meta">👤 {q.username || 'unknown'} · {q.mode}</div>
                          <div className="admin-meta">Priority: {q.priority || 'normal'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Block User Modal */}
        {blockModal && (
          <div className="modal-overlay" onClick={() => setBlockModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>🚫 Block {blockModal.username}</h3>
              <p className="page-sub">Select block duration:</p>
              <div className="block-options">
                {[
                  { value: '24', label: '1 Day' },
                  { value: '48', label: '2 Days' },
                  { value: '72', label: '3 Days' },
                  { value: 'custom', label: 'Custom' },
                  { value: 'permanent', label: 'Permanent' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    className={`btn ${blockDuration === opt.value ? 'btn-primary' : 'btn-ghost'} small`}
                    onClick={() => setBlockDuration(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {blockDuration === 'custom' && (
                <input
                  className="text-input"
                  type="number"
                  placeholder="Hours (1-8760)"
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                  min="1"
                  max="8760"
                />
              )}
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setBlockModal(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary danger" onClick={handleBlock}>
                  Block User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {pwModal && (
          <div className="modal-overlay" onClick={() => setPwModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>🔑 Change Password for {pwModal.username}</h3>
              <input
                className="text-input"
                type="password"
                placeholder="New password (8+ characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setPwModal(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handlePasswordChange}>
                  Update Password
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .admin-page { max-width: 1200px; }
        .admin-tabs {
          display: flex;
          gap: 8px;
          margin: 20px 0;
          flex-wrap: wrap;
        }
        .admin-tab {
          padding: 10px 20px;
          border: 1px solid #e0e0e0;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        .admin-tab:hover { background: #f5f5f5; }
        .admin-tab.active {
          background: #1a1a1a;
          color: white;
          border-color: #1a1a1a;
        }
        .admin-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }
        .admin-card {
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          padding: 16px;
          background: white;
          transition: box-shadow 0.2s;
        }
        .admin-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .admin-card.blocked {
          border-color: #ff4444;
          background: #fff5f5;
        }
        .admin-card.pending-approval {
          border-color: #ffaa00;
          border-width: 2px;
          background: #fffdf5;
        }
        .hunt-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin: 16px 0 20px 0;
        }
        .stat-card {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          padding: 14px;
          text-align: center;
        }
        .stat-num {
          font-size: 28px;
          font-weight: 700;
        }
        .stat-label {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }
        .hunt-card.running {
          border-color: #22cc66;
          border-width: 2px;
        }
        .hunt-card.paused {
          border-color: #ffaa00;
          border-width: 2px;
        }
        .hunt-live-badge {
          display: inline-block;
          background: #22cc66;
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 12px;
          margin-top: 8px;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .admin-card-header { margin-bottom: 12px; }
        .admin-username {
          font-weight: 600;
          font-size: 16px;
          margin-bottom: 4px;
        }
        .admin-meta {
          font-size: 12px;
          color: #666;
        }
        .admin-block-status {
          font-size: 12px;
          color: #cc0000;
          margin-top: 4px;
          font-weight: 600;
        }
        .admin-card-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .btn.small, .text-input.small {
          padding: 6px 12px;
          font-size: 12px;
        }
        .btn.danger { color: #cc0000; }
        .btn.danger:hover { background: #ffeeee; }
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
        }
        .modal h3 { margin: 0 0 16px 0; }
        .modal .text-input { width: 100%; margin: 12px 0; }
        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 20px;
        }
        .block-options {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 12px 0;
        }
        @media (max-width: 768px) {
          .admin-grid { grid-template-columns: 1fr; }
          .admin-tabs { flex-direction: column; }
          .admin-tab { width: 100%; text-align: left; }
        }
      `}</style>
    </div>
  );
}
