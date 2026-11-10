// Admin page styles — extracted from AdminPage.jsx (P6). Rendered as
// `<style>{ADMIN_STYLES}</style>` by the page; unchanged rules.
export const ADMIN_STYLES = `
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
        .hunter-filter {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 4px 0 4px 0;
        }
        .hunter-pill {
          padding: 7px 14px;
          border: 1px solid #e0e0e0;
          background: white;
          border-radius: 999px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          color: #405a60;
          transition: all 0.2s;
        }
        .hunter-pill:hover { background: #f5f5f5; }
        .hunter-pill.active {
          background: #1a1a1a;
          color: white;
          border-color: #1a1a1a;
        }
        .hunter-badge {
          display: inline-block;
          vertical-align: middle;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border: 1px solid currentColor;
          border-radius: 999px;
          padding: 2px 8px;
          margin-left: 6px;
          opacity: 0.75;
        }
        .hunter-badge.hunter-scanner { color: #0f766e; background: #f0fdfa; }
        .hunter-badge.hunter-ai { color: #1d4ed8; background: #eff6ff; }
        .hunter-badge.hunter-unknown { color: #78716c; background: #fafaf9; }
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
      `;
