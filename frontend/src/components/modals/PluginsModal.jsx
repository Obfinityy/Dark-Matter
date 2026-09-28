import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { apiClient } from '../../services/api';

export const PluginsModal = ({ onClose }) => {
  const [tools, setTools] = useState([]);
  const [selectedTools, setSelectedTools] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiClient.getTools()
      .then((response) => {
        if (cancelled) return;
        const availableTools = Array.isArray(response?.tools) ? response.tools : [];
        setTools(availableTools);
        setSelectedTools(Object.fromEntries(availableTools.map((tool) => [tool.id, true])));
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || 'Tool catalog is unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTool = (toolId) => {
    setSelectedTools((current) => ({ ...current, [toolId]: !current[toolId] }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content plugins-modal animate-slide-up" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Tools</h2>
            <p className="modal-subtitle">Available tools are provided by the backend.</p>
          </div>
          <button className="btn icon-button" onClick={onClose} aria-label="Close tools" title="Close tools"><X size={20} /></button>
        </div>
        <div className="modal-body plugins-modal-body">
          {loading && <div className="modal-empty"><Loader2 size={18} className="animate-spin" /> Loading tools</div>}
          {!loading && error && <div className="modal-empty modal-error"><AlertCircle size={18} /> {error}</div>}
          {!loading && !error && tools.length === 0 && <div className="modal-empty">No tools are available.</div>}
          {!loading && !error && tools.map((tool) => {
            const isSelected = selectedTools[tool.id];
            return (
              <button key={tool.id} type="button" className={`tool-row ${isSelected ? 'selected' : ''}`} onClick={() => toggleTool(tool.id)}>
                <span className={`tool-check ${isSelected ? 'checked' : ''}`} aria-hidden="true">{isSelected && <Check size={14} />}</span>
                <span className="tool-copy">
                  <span className="tool-name">{tool.name}</span>
                  <span className="tool-meta">{tool.category || 'tool'} · {tool.execution || 'managed'} · {tool.source || 'backend'}</span>
                  <span className="tool-description">{tool.description}</span>
                </span>
                <span className="tool-status">{tool.status || 'available'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
