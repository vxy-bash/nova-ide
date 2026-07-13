import { useState, useEffect, useRef } from 'react';
import './QuickOpen.css';

const API = 'http://127.0.0.1:8000';

export default function QuickOpen({ open, onClose, onFileSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !query) {
      if (!query) setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/file/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.files || []);
        setSelectedIndex(0);
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, open]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(results.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(results.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        onFileSelect(results[selectedIndex].path);
        onClose();
      }
    }
  };

  if (!open) return null;

  return (
    <div className="quick-open-overlay" onClick={onClose}>
      <div className="quick-open-container" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="quick-open-input"
          placeholder="Datei suchen (Dateiname eingeben)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="quick-open-list">
          {results.map((file, i) => (
            <div
              key={file.path}
              className={`quick-open-item ${i === selectedIndex ? 'selected' : ''}`}
              onClick={() => {
                onFileSelect(file.path);
                onClose();
              }}
            >
              <div className="quick-open-item-name">📄 {file.name}</div>
              <div className="quick-open-item-path">{file.path}</div>
            </div>
          ))}
          {query && results.length === 0 && (
            <div style={{ padding: '16px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Keine Dateien gefunden
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
