// Payment-claims tab — extracted from AdminPage.jsx (P6). Verify ONLY if
// the money arrived in the bank — verification activates the account for
// 1 day from now. If the money did not arrive, do nothing (or Reject).
// A claim never auto-activates.
import React from 'react';

export default function AdminClaimsSection({ claims, loading, onVerify, onReject }) {
  return (
    <section className="admin-section">
      <h2>Payment claims</h2>
      <p className="page-sub">
        Users who paid ₹10,000 via UPI to Obfinity (6376411796@ibl). Verify ONLY if the
        money arrived in the bank — verification activates the account for 1 day from now.
        If the money did not arrive, do nothing (or Reject). A claim never auto-activates.
      </p>
      {loading ? <p className="page-sub">Loading…</p> : claims.length === 0 ? (
        <p className="page-sub">No payment claims yet.</p>
      ) : (
        <table className="admin-table">
          <thead><tr><th>User</th><th>UTR</th><th>Amount</th><th>Phone</th><th>WhatsApp</th><th>Account details</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id}>
                <td>{c.username}</td>
                <td><code>{c.utr}</code></td>
                <td>₹{Number(c.amountInr || 0).toLocaleString('en-IN')}</td>
                <td>{c.phone}</td>
                <td>{c.whatsapp}</td>
                <td>{c.accountDetails}</td>
                <td>{c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</td>
                <td>
                  {c.status === 'pending' ? '⏳ Pending'
                    : c.status === 'verified' ? `✅ Verified${c.accessUntil ? ` till ${new Date(c.accessUntil).toLocaleString()}` : ''}`
                    : '❌ Rejected'}
                </td>
                <td>
                  {c.status === 'pending' && (
                    <>
                      <button className="btn-small" onClick={() => onVerify(c)}>✅ Verify &amp; activate</button>
                      {' '}
                      <button className="btn-small" onClick={() => onReject(c)}>❌ Reject</button>
                    </>
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
