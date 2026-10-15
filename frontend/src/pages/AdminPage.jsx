// Admin portal — invite-only user management.
// Only users with role=admin can open this page.

import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import {
  listAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser,
  listAdminHunts, blockAdminUser, unblockAdminUser, changeUserPassword,
  stopHunt, resumeHunt, getAuthToken,
} from '../lib/api';
import { resolveApiBase } from '../config';
import { toast } from '../lib/toast';

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [hunts, setHunts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', control: 'minimal' });
  const [busy, setBusy] = useState(false);
  const [blockModal, setBlockModal] = useState(null); // user to block
  const [blockDuration, setBlockDuration] = useState('24');
  const [customHours, setCustomHours] = useState('');
  const [pwModal, setPwModal] = useState(null); // user to change password
  const [newPassword, setNewPassword] = useState('');
  const [activeTab, setActiveTab] = useState('users');

  async function load() {
    setLoading(true);
    const [uRes, hRes] = await Promise.all([listAdminUsers(), listAdminHunts()]);
    setLoading(false);
    if (uRes.ok) setUsers(uRes.users || []);
    else toast(uRes.error || 'Could not load users.', 'error');
    if (hRes.ok) setHunts(hRes.hunts || []);
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
              <div className="admin-grid">
                {users.map((u) => (
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
            )}
          </section>
        )}

        {activeTab === 'hunts' && (
          <section className="admin-section">
            <h2>All Hunts</h2>
            <p className="page-sub">Monitor and control hunts across all users.</p>
            {loading ? <p className="page-sub">Loading…</p> : (
              <div className="admin-grid">
                {hunts.length === 0 && <p className="page-sub">No hunts yet.</p>}
                {hunts.map((h) => (
                  <div key={h.huntId} className="admin-card">
                    <div className="admin-card-header">
                      <div>
                        <div className="admin-username">
                          {h.state === 'running' ? '🟢 ' : h.state === 'paused' ? '⏸️ ' : '⚪ '}
                          {h.target}
                        </div>
                        <div className="admin-meta">
                          {h.huntId?.slice(0, 12)}… · {h.state} · {h.mode} · iter {h.iteration || 0}
                        </div>
                        {h.username && (
                          <div className="admin-meta">by {h.username}</div>
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
                              ⏹️ Stop
                            </button>
                          ) : (
                            <button
                              className="btn btn-ghost small"
                              onClick={() => handleResumeHunt(h.huntId)}
                            >
                              ▶️ Resume
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
                ))}
              </div>
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
