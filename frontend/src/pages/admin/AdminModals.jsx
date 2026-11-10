// Admin modals — block-user, shared confirm, and change-password,
// extracted from AdminPage.jsx (P6). The confirm modal is in-app (never
// native confirm()): automated browsers auto-dismiss native confirm(),
// so those buttons silently did nothing.
import React from 'react';

export default function AdminModals({
  blockModal,
  setBlockModal,
  blockDuration,
  setBlockDuration,
  customHours,
  setCustomHours,
  onBlock,
  confirmModal,
  setConfirmModal,
  onConfirmModal,
  pwModal,
  setPwModal,
  newPassword,
  setNewPassword,
  onPasswordChange,
}) {
  return (
    <>
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
              <button className="btn btn-primary danger" onClick={onBlock}>
                Block User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal — Delete user / Reject signup / Reject payment claim.
          In-app (never native confirm()): automated browsers auto-dismiss
          native confirm(), so those buttons silently did nothing. */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmModal.title}</h3>
            {confirmModal.message && <p className="page-sub">{confirmModal.message}</p>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary danger" onClick={onConfirmModal}>
                {confirmModal.confirmLabel}
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
              <button className="btn btn-primary" onClick={onPasswordChange}>
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
