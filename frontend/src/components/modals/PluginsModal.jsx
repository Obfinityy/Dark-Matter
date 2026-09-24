import React, { useState } from 'react';
import { X, Search, Lock } from 'lucide-react';
import { mockPlugins } from '../../mock/plugins';

export const PluginsModal = ({ onClose }) => {
  const [search, setSearch] = useState('');
  
  // By default all are selected (simulate state)
  const [selectedPlugins, setSelectedPlugins] = useState(
    mockPlugins.reduce((acc, plugin) => ({ ...acc, [plugin.id]: true }), {})
  );

  const togglePlugin = (id, disabled) => {
    if (disabled) return;
    setSelectedPlugins(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  const filteredPlugins = mockPlugins.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const renderPluginList = (tier, title, description, lock) => {
    const allPlugins = filteredPlugins.filter(p => p.tier === tier);
    if (allPlugins.length === 0) return null;

    const plugins = allPlugins.slice(0, 50);

    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            {title} {lock && <Lock size={16} color="var(--warning)" />}
            <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
              {allPlugins.length} tools available
            </span>
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{description}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {plugins.map(plugin => {
            const isLocked = lock && plugin.status === 'Restricted';
            const isSelected = selectedPlugins[plugin.id] && !isLocked;
            return (
              <div 
                key={plugin.id} 
                onClick={() => togglePlugin(plugin.id, isLocked)}
                style={{ 
                  padding: 16, 
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`, 
                  borderRadius: 'var(--radius-md)', 
                  backgroundColor: isSelected ? 'var(--accent-transparent)' : 'var(--surface)',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.6 : 1,
                  display: 'flex',
                  gap: 12
                }}
              >
                <div style={{ paddingTop: 4 }}>
                  <div style={{ 
                    width: 20, height: 20, borderRadius: 4, 
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-light)'}`,
                    backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {isSelected && <span style={{ color: '#fff', fontSize: '0.8rem' }}>✓</span>}
                    {isLocked && <Lock size={12} color="var(--text-muted)" />}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{plugin.name}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{plugin.category}</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {plugin.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {allPlugins.length > 50 && (
          <div style={{ marginTop: 16, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', padding: 8, backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-md)' }}>
            + {allPlugins.length - 50} more {tier} tier tools loaded in background (showing top 50 for performance).
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, height: '80vh', display: 'flex', flexDirection: 'column', margin: '20px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Active Tools & Plugins</h2>
          <button className="btn" onClick={onClose}><X size={20} color="var(--text-secondary)" /></button>
        </div>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
            <Search size={18} color="var(--text-secondary)" style={{ marginRight: 8 }} />
            <input 
              type="text" 
              placeholder="Search plugins..." 
              style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none' }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
          {renderPluginList('Normal', 'Standard Tools', 'Included with DarkMatter Free. Used in Normal and Medium modes.', false)}
          {renderPluginList('Pro', 'Professional Tools', 'Requires DarkMatter Pro subscription. Used in High mode.', true)}
          {renderPluginList('Elite', 'Elite Tools', 'Requires DarkMatter Elite subscription. Used in Ultra High mode.', true)}
          {renderPluginList('Infinity', 'Advanced & Experimental Tools', 'Requires Infinity subscription. Used in Infinity mode.', true)}
        </div>
      </div>
    </div>
  );
};
