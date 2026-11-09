// Users tab — pending approvals + approved users, extracted from
// AdminPage.jsx (P6). All actions (approve / reject / control / password /
// block / unblock / delete) are callbacks owned by the page.
import React from 'react';

function formatBlockStatus(u) {
  if (!u.blocked) return null;
  if (!u.blockedUntil) return '🔴 Blocked permanently';
  const until = new Date(u.blockedUntil);
  if (until <= new Date()) return null;
  return `🔴 Blocked until ${until.toLocaleString()}`;
}

export default function AdminUsersSection({
  users,
  loading,
  onApprove,
  onRejectSignup,
  onControl,
  onPassword,
  onUnblock,
  onBlock,
  onDelete,
}) {
  const pending = users.filter((u) => u.approved === false);
  const approved = users.filter((u) => u.approved !== false);
  return (
    <section className="admin-section">
      <h2>All Users</h2>
      {loading ? <p className="page-sub">Loading…</p> : (
        <>
          {/* Pending approvals section */}
          {pending.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3>⏳ Pending Approvals ({pending.length})</h3>
              <div className="admin-grid">
                {pending.map((u) => (
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
                        onClick={() => onApprove(u)}
                      >
                        ✅ Approve
                      </button>
                      <button
                        className="btn btn-ghost small danger"
                        onClick={() => onRejectSignup(u)}
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <h3>Approved Users ({approved.length})</h3>
          <div className="admin-grid">
          {approved.map((u) => (
            <div key={u.id} className={`admin-card ${u.blocked ? 'blocked' : ''}`}>
              <div className="admin-card-header">
                <div>
                  <div className="admin-username">
                    {u.role === 'admin' ? '👑 ' : '👤 '}{u.username}
                  </div>
                  <div className="admin-meta">
                    {u.role} · {u.control} control
                  </div>
                  {u.accessUntil && new Date(u.accessUntil) > new Date() && (
                    <div className="admin-meta">💳 Access until {new Date(u.accessUntil).toLocaleString()}</div>
                  )}
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
                    onChange={(e) => onControl(u, e.target.value)}
                    title="Control level"
                  >
                    <option value="minimal">Minimal</option>
                    <option value="maximum">Maximum</option>
                  </select>
                  <button
                    className="btn btn-ghost small"
                    onClick={() => onPassword(u)}
                    title="Change password"
                  >
                    🔑 Password
                  </button>
                  {u.blocked ? (
                    <button
                      className="btn btn-ghost small"
                      onClick={() => onUnblock(u)}
                      title="Unblock user"
                    >
                      ✅ Unblock
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost small danger"
                      onClick={() => onBlock(u)}
                      title="Block user"
                    >
                      🚫 Block
                    </button>
                  )}
                  <button
                    className="btn btn-ghost small danger"
                    onClick={() => onDelete(u)}
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
  );
}
