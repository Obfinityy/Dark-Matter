import React from 'react';
import { Search, Bell, User, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const Topbar = ({ toggleSidebar }) => {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const title = pathParts.length > 0 
    ? pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1)
    : 'Overview';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="btn" onClick={toggleSidebar} style={{ display: 'none' /* Will show on mobile via CSS */ }}>
          <Menu size={20} />
        </button>
        <div style={{ color: 'var(--text-secondary)' }}>
          Home / <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{title}</span>
        </div>
      </div>
      <div className="topbar-right">
        <button className="btn btn-secondary" style={{ padding: '8px' }}>
          <Search size={18} />
          <span style={{ fontSize: '0.8rem', marginLeft: 8, color: 'var(--text-muted)' }}>Ctrl+K</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Wallet Balance</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 600 }}>$150.00</span>
          </div>
          <button className="btn" style={{ position: 'relative' }}>
            <Bell size={20} color="var(--text-secondary)" />
            <span style={{ position: 'absolute', top: 6, right: 8, width: 8, height: 8, backgroundColor: 'var(--danger)', borderRadius: '50%' }}></span>
          </button>
          <button className="btn">
            <User size={20} color="var(--text-secondary)" />
          </button>
        </div>
      </div>
    </header>
  );
};
