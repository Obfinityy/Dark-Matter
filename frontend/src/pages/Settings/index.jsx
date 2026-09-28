import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, RefreshCw, Save } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge, Button } from '../../components/ui/Basic';
import { apiClient } from '../../services/api';
import { useAuth } from '../../auth/AuthContext';

const toEditableProvider = (provider) => ({ ...provider, apiKey: '' });

export const Settings = () => {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('ai-providers');
  const [profileName, setProfileName] = useState('');
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    { id: 'ai-providers', label: 'AI Providers' },
    { id: 'preferences', label: 'Preferences' }
  ];

  useEffect(() => {
    setProfileName(user?.name || '');
  }, [user]);

  const loadProviders = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.getProviders();
      setProviders((response.providers || []).map(toEditableProvider));
    } catch (loadError) {
      setError(loadError.message || 'Could not load AI provider configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    apiClient.getProviders()
      .then((response) => {
        if (!cancelled) setProviders((response.providers || []).map(toEditableProvider));
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || 'Could not load AI provider configuration.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateProvider = (providerId, field, value) => {
    setProviders((current) => current.map((provider) => (
      provider.id === providerId ? { ...provider, [field]: value } : provider
    )));
    setNotice('');
    setError('');
  };

  const handleSaveProviders = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    setError('');

    try {
      const payload = providers.map(({ id, enabled, priority, model, baseUrl, apiKey }) => ({
        id,
        enabled,
        priority: Number(priority),
        model,
        baseUrl,
        ...(apiKey ? { apiKey } : {})
      }));
      const response = await apiClient.updateProviders(payload);
      setProviders((response.providers || []).map(toEditableProvider));
      setNotice('Provider configuration saved. Keys remain encrypted in the backend.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save provider configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setNotice('');
    setError('');

    try {
      await updateProfile({ name: profileName });
      setNotice('Profile saved to your account.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save your profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="animate-fade-in settings-page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage your account and platform configurations.</p>
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? 'settings-tab active' : 'settings-tab'}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <Card className="animate-fade-in">
          <CardHeader title="Personal Information" />
          <CardContent>
            <form onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label className="form-label" htmlFor="profile-name">Name</label>
                <input id="profile-name" type="text" className="form-control" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Your name" minLength="2" maxLength="80" required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="profile-email">Email Address</label>
                <input id="profile-email" type="email" className="form-control" value={user?.email || ''} readOnly />
              </div>
              {error && <div className="settings-feedback error"><AlertCircle size={15} /> {error}</div>}
              {notice && <div className="settings-feedback success"><CheckCircle2 size={15} /> {notice}</div>}
              <div style={{ marginTop: 24 }}>
                <Button type="submit" variant="primary" disabled={profileSaving}>{profileSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {profileSaving ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'ai-providers' && (
        <Card className="animate-fade-in">
          <CardHeader title="AI Provider Configuration" />
          <CardContent>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 24 }}>
              Configure encrypted provider credentials for the next agent phase. The current subdomain tool runs without an AI key.
            </p>

            {loading && (
              <div className="settings-loading"><Loader2 size={18} className="animate-spin" /> Loading provider configuration...</div>
            )}

            {!loading && providers.length === 0 && (
              <div className="settings-loading">No provider catalog was returned by the backend.</div>
            )}

            {!loading && providers.length > 0 && (
              <form onSubmit={handleSaveProviders}>
                <div className="provider-list">
                  {providers.map((provider) => (
                    <div key={provider.id} className="provider-row">
                      <div className="provider-row-header">
                        <div>
                          <div className="provider-name"><KeyRound size={16} /> {provider.name}</div>
                          <div className="provider-id">{provider.id}</div>
                        </div>
                        <label className="checkbox-container provider-enabled">
                          <input
                            type="checkbox"
                            checked={provider.enabled}
                            onChange={(event) => updateProvider(provider.id, 'enabled', event.target.checked)}
                          />
                          <span className="checkmark" />
                          <span className="checkbox-text">Enabled</span>
                        </label>
                      </div>

                      <div className="provider-controls">
                        <div className="form-group">
                          <label className="form-label" htmlFor={`${provider.id}-key`}>API key</label>
                          <input
                            id={`${provider.id}-key`}
                            type="password"
                            className="form-control"
                            value={provider.apiKey}
                            onChange={(event) => updateProvider(provider.id, 'apiKey', event.target.value)}
                            placeholder={provider.hasApiKey ? '******** (configured)' : 'Enter API key'}
                            autoComplete="new-password"
                          />
                          {provider.hasApiKey && <div className="provider-key-state"><CheckCircle2 size={13} /> Key configured; leave blank to keep it</div>}
                        </div>
                        <div className="form-group provider-priority">
                          <label className="form-label" htmlFor={`${provider.id}-priority`}>Priority</label>
                          <input
                            id={`${provider.id}-priority`}
                            type="number"
                            min="1"
                            max="999"
                            className="form-control"
                            value={provider.priority}
                            onChange={(event) => updateProvider(provider.id, 'priority', event.target.value)}
                          />
                        </div>
                      </div>

                      <div className="provider-controls provider-advanced">
                        <div className="form-group">
                          <label className="form-label" htmlFor={`${provider.id}-model`}>Model</label>
                          <input id={`${provider.id}-model`} className="form-control" value={provider.model} onChange={(event) => updateProvider(provider.id, 'model', event.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor={`${provider.id}-base-url`}>Base URL</label>
                          <input id={`${provider.id}-base-url`} className="form-control" value={provider.baseUrl} onChange={(event) => updateProvider(provider.id, 'baseUrl', event.target.value)} />
                        </div>
                      </div>

                      {provider.lastError && <div className="provider-last-error"><AlertCircle size={14} /> Last provider error: {provider.lastError}</div>}
                      <div className="provider-footer">
                        {provider.enabled && provider.hasApiKey ? <Badge variant="success">Ready</Badge> : <Badge variant="neutral">Not active</Badge>}
                        <span>Priority is saved for the next agent phase.</span>
                      </div>
                    </div>
                  ))}
                </div>

                {error && <div className="settings-feedback error"><AlertCircle size={15} /> {error}</div>}
                {notice && <div className="settings-feedback success"><CheckCircle2 size={15} /> {notice}</div>}
                <div className="settings-actions">
                  <Button type="button" variant="secondary" onClick={loadProviders} disabled={saving}><RefreshCw size={16} /> Reload</Button>
                  <Button type="submit" variant="primary" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving...' : 'Save providers'}</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'security' && <Card><CardHeader title="Security" /><CardContent><p style={{ color: 'var(--text-secondary)' }}>Authorization confirmation is required before every new target investigation.</p></CardContent></Card>}
      {activeTab === 'preferences' && <Card><CardHeader title="Preferences" /><CardContent><p style={{ color: 'var(--text-secondary)' }}>Execution preferences are currently controlled from the reconnaissance composer.</p></CardContent></Card>}
    </div>
  );
};
