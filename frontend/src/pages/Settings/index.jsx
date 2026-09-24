import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Basic';

export const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    { id: 'ai-providers', label: 'AI Providers' },
    { id: 'preferences', label: 'Preferences' }
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage your account and platform configurations.</p>
      </div>

      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border)', marginBottom: 32 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 16px',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent)' : 'transparent'}`,
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 500,
              background: 'none',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <Card className="animate-fade-in">
          <CardHeader title="Personal Information" />
          <CardContent>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input type="text" className="form-control" defaultValue="Security Researcher" />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-control" defaultValue="researcher@example.com" />
            </div>
            <div style={{ marginTop: 24 }}>
              <Button variant="primary">Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'ai-providers' && (
        <Card className="animate-fade-in">
          <CardHeader title="AI Provider Configuration" />
          <CardContent>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 24 }}>
              Configure API keys for external intelligence providers. Keys are securely stored and never exposed to the frontend after configuration.
            </p>
            
            <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: 16, backgroundColor: 'var(--surface-hover)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 600 }}>OpenAI</div>
                <label className="checkbox-container">
                  <input type="checkbox" defaultChecked />
                  <span className="checkmark"></span>
                  <span className="checkbox-text" style={{ marginLeft: 8 }}>Enabled</span>
                </label>
              </div>
              <input type="password" className="form-control" defaultValue="sk-********************************" />
            </div>

            <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 600 }}>Google Gemini</div>
                <label className="checkbox-container">
                  <input type="checkbox" />
                  <span className="checkmark"></span>
                  <span className="checkbox-text" style={{ marginLeft: 8 }}>Enabled</span>
                </label>
              </div>
              <input type="password" className="form-control" placeholder="Enter API Key" />
            </div>

            <div style={{ marginTop: 24 }}>
              <Button variant="primary">Update Providers</Button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};
