import React, { useState } from 'react';
import { toast } from '../lib/toast';

const VOICES = [
  { id: 'aria', label: 'Aria — balanced' },
  { id: 'aria-soft', label: 'Aria Soft — calm' },
  { id: 'kai', label: 'Kai — deep' },
  { id: 'kai-deep', label: 'Kai Deep — deeper' },
];

function getVoice() {
  try {
    return localStorage.getItem('dm.voice') || 'aria';
  } catch {
    return 'aria';
  }
}

export default function SettingsPage() {
  const [voice, setVoice] = useState(getVoice());

  function chooseVoice(id) {
    setVoice(id);
    try {
      localStorage.setItem('dm.voice', id);
    } catch { /* ignore */ }
    toast('Voice preference saved.', 'success');
  }

  return (
    <div className="page">
      <div className="page-inner">
      <header className="page-header">
        <h1>Settings</h1>
        <p className="page-sub">How the app talks back.</p>
      </header>

      <h2 className="section-title">Voice</h2>
      <label className="field-label" style={{ maxWidth: 360 }}>
        Spoken-reply voice
        <select className="text-input" value={voice} onChange={(e) => chooseVoice(e.target.value)}>
          {VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <p className="page-sub">
        Toggle the speaker button in the chat input to hear replies read aloud in this voice.
      </p>
      </div>
    </div>
  );
}
