import { useState, useEffect } from 'react';
import './WorkspaceDialog.css';

const API = 'http://127.0.0.1:8000';

export default function WorkspaceDialog({ open, onClose, onSelect }) {
  const [currentPath, setCurrentPath] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [dirs, setDirs] = useState([]);
  const [parent, setParent] = useState('');

  const loadDir = async (path = '') => {
    try {
      const res = await fetch(`${API}/api/workspace/browse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      const data = await res.json();
      setCurrentPath(data.current);
      setInputValue(data.current);
      setParent(data.parent);
      setDirs(data.dirs || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (open) {
      loadDir();
    }
  }, [open]);

  const handleInputSubmit = (e) => {
    if (e.key === 'Enter') {
      loadDir(inputValue);
    }
  };

  if (!open) return null;

  return (
    <div className="workspace-dialog-overlay">
      <div className="workspace-dialog">
        <div className="workspace-dialog-header">
          <div className="workspace-dialog-title">Ordner auswählen</div>
          <button className="workspace-dialog-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="workspace-dialog-path" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="workspace-dialog-up" 
            onClick={() => loadDir(parent)}
            disabled={!parent}
            style={{ opacity: parent ? 1 : 0.5, cursor: parent ? 'pointer' : 'not-allowed' }}
          >
            ↑ Hoch
          </button>
          <button 
            className="workspace-dialog-up" 
            onClick={() => loadDir('drives')}
            title="Computer anzeigen"
          >
            💻 Computer
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputSubmit}
            style={{
              flex: 1,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent-cyan)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              outline: 'none'
            }}
            placeholder="Absoluten Pfad eingeben..."
          />
        </div>

        <div className="workspace-dialog-list">
          {dirs.map((d) => (
            <div key={d.path} className="workspace-dialog-item" onClick={() => loadDir(d.path)}>
              <span className="workspace-dialog-item-icon">
                {d.path.endsWith(':\\') ? '💽' : '📁'}
              </span>
              {d.name}
            </div>
          ))}
          {dirs.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Keine Unterordner vorhanden.
            </div>
          )}
        </div>

        <div className="workspace-dialog-footer">
          <button className="workspace-btn workspace-btn-cancel" onClick={onClose}>
            Abbrechen
          </button>
          <button 
            className="workspace-btn workspace-btn-confirm" 
            onClick={() => onSelect(currentPath)}
            disabled={currentPath === 'Computer'}
            style={{ 
              opacity: currentPath === 'Computer' ? 0.5 : 1,
              cursor: currentPath === 'Computer' ? 'not-allowed' : 'pointer'
            }}
          >
            Ordner öffnen
          </button>
        </div>
      </div>
    </div>
  );
}
