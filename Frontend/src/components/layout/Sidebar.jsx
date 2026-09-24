import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderGit2, 
  Target, 
  Radar, 
  Activity, 
  ShieldAlert, 
  FileText, 
  Wrench, 
  CreditCard, 
  Settings 
} from 'lucide-react';

export const Sidebar = ({ isOpen }) => {
  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/projects', label: 'Projects', icon: FolderGit2 },
    { to: '/targets', label: 'Targets', icon: Target },
    { to: '/scans/new', label: 'New Scan', icon: Radar },
    { to: '/scans/live', label: 'Live Scans', icon: Activity },
    { to: '/findings', label: 'Findings', icon: ShieldAlert },
    { to: '/reports', label: 'Reports', icon: FileText },
    { to: '/plugins', label: 'Plugins', icon: Wrench },
    { to: '/billing', label: 'Billing', icon: CreditCard },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <span style={{ color: 'var(--accent)', marginRight: '8px' }}>▲</span>
        AUTONOMOUS_AI
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
