import { useState, useEffect, useCallback, useRef } from 'react';
import './FileExplorer.css';

const API = 'http://127.0.0.1:8000';

const FILE_ICONS = {
  py: '🐍', js: '📜', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
  html: '🌐', css: '🎨', json: '📋', md: '📝',
  txt: '📄', yaml: '⚙️', yml: '⚙️', sh: '🖥️', bat: '🖥️',
  sql: '🗃️', xml: '📰', go: '🐹', rs: '🦀',
  java: '☕', cpp: '⚡', c: '⚡', h: '⚡',
  rb: '💎', php: '🐘', svg: '🖼️', png: '🖼️', jpg: '🖼️',
  gif: '🖼️', ico: '🖼️', lock: '🔒', env: '🔐',
  gitignore: '🚫', dockerfile: '🐳',
};

function getFileIcon(name, isDir) {
  if (isDir) return '📁';
  const ext = name.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || '📄';
}

function TreeNode({ entry, depth, activeFile, onFileClick, onRefresh, language }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [newInput, setNewInput] = useState(null); // { type: 'file' | 'folder' }
  const isDe = language === 'de';

  const toggleExpand = async () => {
    if (!entry.isDir) {
      onFileClick(entry);
      return;
    }
    if (expanded) {
      setExpanded(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/files?path=${encodeURIComponent(entry.path)}`);
      const data = await res.json();
      setChildren(data.entries || []);
      setExpanded(true);
    } catch (e) {
      console.error('Failed to load directory:', e);
    }
    setLoading(false);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (contextMenu) {
      const handler = () => closeContextMenu();
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [contextMenu, closeContextMenu]);

  const handleDelete = async () => {
    closeContextMenu();
    const confirmMsg = isDe 
      ? `"${entry.name}" wirklich löschen?` 
      : `Are you sure you want to delete "${entry.name}"?`;
    if (!confirm(confirmMsg)) return;
    try {
      await fetch(`${API}/api/file?path=${encodeURIComponent(entry.path)}`, { method: 'DELETE' });
      onRefresh();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handleNewFile = (type) => {
    closeContextMenu();
    setNewInput({ type });
    if (!expanded && entry.isDir) {
      toggleExpand();
    }
  };

  const handleNewInputSubmit = async (name) => {
    if (!name) { setNewInput(null); return; }
    const newPath = entry.isDir
      ? `${entry.path}/${name}`
      : `${entry.path.substring(0, entry.path.lastIndexOf('/'))}/${name}`;
    try {
      await fetch(`${API}/api/file/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newPath, isDir: newInput.type === 'folder' }),
      });
      setNewInput(null);
      if (entry.isDir) {
        const res = await fetch(`${API}/api/files?path=${encodeURIComponent(entry.path)}`);
        const data = await res.json();
        setChildren(data.entries || []);
      } else {
        onRefresh();
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const isActive = activeFile === entry.path;
  const style = { '--depth': depth };

  return (
    <>
      <div
        className={`tree-node ${isActive ? 'active' : ''}`}
        style={style}
        onClick={toggleExpand}
        onContextMenu={handleContextMenu}
        title={entry.path}
      >
        <span className={`tree-node-chevron ${entry.isDir ? (expanded ? 'expanded' : '') : 'placeholder'}`}>
          {entry.isDir ? '▶' : ''}
        </span>
        <span className="tree-node-icon">{getFileIcon(entry.name, entry.isDir)}</span>
        <span className="tree-node-name">{entry.name}</span>
      </div>

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {entry.isDir && (
            <>
              <div className="context-menu-item" onClick={() => handleNewFile('file')}>
                📄 {isDe ? 'Neue Datei' : 'New File'}
              </div>
              <div className="context-menu-item" onClick={() => handleNewFile('folder')}>
                📁 {isDe ? 'Neuer Ordner' : 'New Folder'}
              </div>
              <div className="context-menu-divider" />
            </>
          )}
          <div className="context-menu-item danger" onClick={handleDelete}>
            🗑️ {isDe ? 'Löschen' : 'Delete'}
          </div>
        </div>
      )}

      {expanded && entry.isDir && (
        <>
          {newInput && (
            <NewInputRow
              depth={depth + 1}
              type={newInput.type}
              onSubmit={handleNewInputSubmit}
              onCancel={() => setNewInput(null)}
              language={language}
            />
          )}
          {loading ? (
            <div className="tree-node" style={{ '--depth': depth + 1 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                {isDe ? 'Lade...' : 'Loading...'}
              </span>
            </div>
          ) : (
            children?.map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                activeFile={activeFile}
                onFileClick={onFileClick}
                onRefresh={onRefresh}
                language={language}
              />
            ))
          )}
        </>
      )}
    </>
  );
}

function NewInputRow({ depth, type, onSubmit, onCancel, language }) {
  const inputRef = useRef(null);
  const isDe = language === 'de';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onSubmit(e.target.value);
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="tree-new-input" style={{ '--depth': depth }}>
      <span style={{ fontSize: '14px' }}>{type === 'folder' ? '📁' : '📄'}</span>
      <input
        ref={inputRef}
        type="text"
        placeholder={type === 'folder' 
          ? (isDe ? 'Ordnername...' : 'Folder name...') 
          : (isDe ? 'Dateiname...' : 'File name...')}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

export default function FileExplorer({ activeFile, onFileClick, onOpenFolder, language }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newInput, setNewInput] = useState(null);
  const isDe = language === 'de';

  const loadRoot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/files?path=.`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  const handleNewInputSubmit = async (name) => {
    if (!name) { setNewInput(null); return; }
    try {
      await fetch(`${API}/api/file/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: name, isDir: newInput === 'folder' }),
      });
      setNewInput(null);
      loadRoot();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <span className="file-explorer-title">{isDe ? 'Explorer' : 'Explorer'}</span>
        
        {/* Clear action buttons: text based, highly visible, localized */}
        <div className="file-explorer-actions">
          <button className="fe-action-btn text-btn" onClick={onOpenFolder} title={isDe ? 'Ordner öffnen' : 'Open Folder'}>
            {isDe ? 'Ordner' : 'Folder'}
          </button>
          <button className="fe-action-btn text-btn" onClick={() => setNewInput('file')} title={isDe ? 'Neue Datei' : 'New File'}>
            +📄
          </button>
          <button className="fe-action-btn text-btn" onClick={() => setNewInput('folder')} title={isDe ? 'Neuer Ordner' : 'New Folder'}>
            +📁
          </button>
          <button className="fe-action-btn text-btn" onClick={loadRoot} title={isDe ? 'Aktualisieren' : 'Refresh'}>
            🔄
          </button>
        </div>
      </div>

      <div className="file-explorer-tree">
        {loading ? (
          <div className="file-explorer-loading">{isDe ? 'Lade Dateien...' : 'Loading files...'}</div>
        ) : error ? (
          <div className="file-explorer-error">
            {isDe ? 'Fehler:' : 'Error:'} {error}
            <br />
            <button className="fe-action-btn" onClick={loadRoot} style={{ margin: '8px auto', display: 'block', padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              {isDe ? 'Erneut versuchen' : 'Retry'}
            </button>
          </div>
        ) : (
          <>
            {newInput && (
              <NewInputRow
                depth={0}
                type={newInput}
                onSubmit={handleNewInputSubmit}
                onCancel={() => setNewInput(null)}
                language={language}
              />
            )}
            {entries.map((entry) => (
              <TreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                activeFile={activeFile}
                onFileClick={onFileClick}
                onRefresh={loadRoot}
                language={language}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
