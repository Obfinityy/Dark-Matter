// Admin portal — invite-only user management.
// Only users with role=admin can open this page.

import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { listAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser, listAdminHunts, getAuthToken } from '../lib/api';
import { resolveApiBase } from '../config';
import { toast } from '../lib/toast';

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [hunts, setHunts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', control: 'minimal' });
  const [busy, setBusy] = useState(false);

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
    if (res.ok) { toast('Updated.', 'success'); load(); }
    else toast(res.error || 'Failed.', 'error');
  }

  async function handleDelete(u) {
    if (!window.confirm(`Delete user ${u.username}?`)) return;
    const res = await deleteAdminUser(u.id);
    if (res.ok) { toast('Deleted.', 'info'); load(); }
    else toast(res.error || 'Failed.', 'error');
  }

  async function handleDownloadMemory(huntId) {
    try {
      const res = await fetch(`${resolveApiBase()}/api/v1/hunts/${encodeURIComponent(huntId)}/memory`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hunt-${huntId}-memory.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Memory downloaded.', 'success');
    } catch {
      toast('Could not download hunt memory.', 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <h1>Admin Portal</h1>
          <p className="page-sub">Invite-only access. Create accounts and set control levels.</p>
        </header>

        <section className="admin-section">
          <h2>Invite user</h2>
          <form className="admin-form" onSubmit={handleCreate}>
            <input
              className="text-input"
              placeholder="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <input
              className="text-input"
              type="password"
              placeholder="password (8+ chars)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <select
              className="text-input"
              value={form.control}
              onChange={(e) => setForm({ ...form, control: e.target.value })}
            >
              <option value="minimal">Minimal — Normal/Medium modes, 1 hunt</option>
              <option value="maximum">Maximum — all modes, 5 hunts</option>
            </select>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create user'}
            </button>
          </form>
        </section>

        <section className="admin-section">
          <h2>Users ({users.length})</h2>
          {loading ? <p className="page-sub">Loading…</p> : (
            <div className="admin-users">
              {users.map((u) => (
                <div key={u.id} className="admin-user-row">
                  <div>
                    <div className="admin-username">{u.username}</div>
                    <div className="admin-meta">{u.role} · created {u.createdAt?.slice(0, 10)}</div>
                  </div>
                  {u.role !== 'admin' && (
                    <div className="admin-actions">
                      <select
                        className="text-input"
                        value={u.control}
                        onChange={(e) => handleControl(u, e.target.value)}
                      >
                        <option value="minimal">Minimal</option>
                        <option value="maximum">Maximum</option>
                      </select>
                      <button className="btn btn-ghost" onClick={() => handleDelete(u)}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-section">
          <h2>Hunts on this backend ({hunts.length})</h2>
          <p className="page-sub">Only one hunt runs at a time. Download any hunt's full memory (meta + events) as JSON.</p>
          {loading ? <p className="page-sub">Loading…</p> : (
            <div className="admin-users">
              {hunts.length === 0 && <p className="page-sub">No hunts yet.</p>}
              {hunts.map((h) => (
                <div key={h.huntId} className="admin-user-row">
                  <div>
                    <div className="admin-username">
                      {h.state === 'running' ? '🟢 ' : h.state === 'paused' ? '⏸️ ' : '⚪ '}
                      {h.target}
                    </div>
                    <div className="admin-meta">
                      {h.huntId} · {h.state} · {h.mode} · iter {h.iteration}
                    </div>
                  </div>
                  <div className="admin-actions">
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleDownloadMemory(h.huntId)}
                    >
                      ⬇ Memory
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
