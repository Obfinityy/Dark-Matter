// Agent-accounts tab — accounts the agent created itself under the
// Obfinity persona, extracted from AdminPage.jsx (P6). These never appear
// on the user-facing frontend — only here. Passwords are masked until an
// admin reveals one.
import React from 'react';
import { revealAgentAccount } from '../../lib/api';
import { toast } from '../../lib/toast';

export default function AdminAccountsSection({ accounts, loading, revealed, setRevealed }) {
  return (
    <section className="admin-section">
      <h2>Agent accounts</h2>
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
  );
}
