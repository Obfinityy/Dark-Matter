// Invite-user tab — extracted from AdminPage.jsx (P6).
import React from 'react';

export default function AdminInviteSection({ form, setForm, busy, onCreate }) {
  return (
    <section className="admin-section">
      <h2>Invite New User</h2>
      <form className="admin-form" onSubmit={onCreate}>
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
  );
}
