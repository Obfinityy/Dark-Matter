import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  MessageSquare, Plus, PanelLeftClose, PanelLeft, 
  Settings, CreditCard, Box, User, MoreHorizontal, Sparkles
} from 'lucide-react';
import { SubscriptionModal } from '../modals/SubscriptionModal';
import { PluginsModal } from '../modals/PluginsModal';

export const ChatLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const navigate = useNavigate();

  const history = [
    { title: 'Today', items: [{ id: '1', label: 'Analyze api.acmecorp.com scope' }, { id: '2', label: 'Review Nginx vulnerability' }] },
    { title: 'Previous 7 Days', items: [{ id: '3', label: 'Setup Stark Ind project' }, { id: '4', label: 'Recon on Wayne Ent' }] }
  ];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`chat-sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-new-chat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              className="btn" 
              style={{ flex: 1, justifyContent: 'flex-start', padding: '10px 12px', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-md)' }}
              onClick={() => navigate('/')}
            >
              <Plus size={18} />
              <span style={{ fontWeight: 500 }}>New Chat</span>
            </button>
            <button className="btn" style={{ padding: 10, marginLeft: 8 }} onClick={() => setSidebarOpen(false)}>
              <PanelLeftClose size={20} color="var(--text-secondary)" />
            </button>
          </div>
        </div>

        <div className="sidebar-history">
          {history.map((group, i) => (
            <div key={i}>
              <div className="history-group-title">{group.title}</div>
              {group.items.map(item => (
                <NavLink key={item.id} to={`/c/${item.id}`} className={({ isActive }) => `history-item ${isActive ? 'active' : ''}`}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="btn" style={{ justifyContent: 'flex-start', padding: '10px 12px', color: 'var(--warning)' }} onClick={() => setShowSubscription(true)}>
            <Sparkles size={18} />
            Upgrade to Pro
          </button>
          <button className="btn" style={{ justifyContent: 'flex-start', padding: '10px 12px', color: 'var(--text-secondary)' }} onClick={() => setShowPlugins(true)}>
            <Box size={18} />
            Plugins
          </button>
          
          <div style={{ position: 'relative', marginTop: 8 }}>
            <button 
              className="btn" 
              style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', color: 'var(--text-primary)', backgroundColor: showUserMenu ? 'var(--surface)' : 'transparent' }}
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <User size={14} />
              </div>
              <span style={{ flex: 1, textAlign: 'left' }}>Researcher</span>
              <MoreHorizontal size={16} color="var(--text-secondary)" />
            </button>

            {showUserMenu && (
              <div style={{ 
                position: 'absolute', bottom: '100%', left: 0, width: '100%', 
                backgroundColor: 'var(--surface)', border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-md)', padding: 8, marginBottom: 8, zIndex: 100 
              }}>
                <button className="btn" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px' }}>
                  <Settings size={16} style={{ marginRight: 12 }} /> Settings
                </button>
                <button className="btn" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px' }}>
                  <CreditCard size={16} style={{ marginRight: 12 }} /> Billing
                </button>
                <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '4px 0' }}></div>
                <button className="btn" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', color: 'var(--danger)' }}>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="chat-main">
        <header className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {!sidebarOpen && (
              <button className="btn" style={{ padding: '8px', marginRight: 12 }} onClick={() => setSidebarOpen(true)}>
                <PanelLeft size={20} color="var(--text-secondary)" />
              </button>
            )}
            <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '1.1rem' }}>
              DarkMatter <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 400 }}>▼</span>
            </button>
          </div>
          <button className="btn" style={{ padding: '6px 12px', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-full)', fontSize: '0.85rem' }}>
            Share
          </button>
        </header>

        <Outlet />
      </main>

      {showSubscription && <SubscriptionModal onClose={() => setShowSubscription(false)} />}
      {showPlugins && <PluginsModal onClose={() => setShowPlugins(false)} />}
    </div>
  );
};
