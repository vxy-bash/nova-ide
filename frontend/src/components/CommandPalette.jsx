import { useState, useEffect, useRef } from 'react';
import './CommandPalette.css';

export default function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Filter commands
  const filtered = commands.filter(c => 
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(filtered.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    }
  };

  if (!open) return null;

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette-container" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-wrapper">
          <span className="palette-input-prefix">{'>'}</span>
          <input
            ref={inputRef}
            className="palette-input"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Befehl suchen..."
          />
        </div>
        <div className="palette-list">
          {filtered.map((cmd, i) => (
            <div 
              key={cmd.id} 
              className={`palette-item ${i === selectedIndex ? 'selected' : ''}`}
              onClick={() => { cmd.action(); onClose(); }}
            >
              <span>{cmd.label}</span>
              {cmd.keybinding && (
                <span className="palette-item-keybinding">{cmd.keybinding}</span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="palette-empty">Keine Befehle gefunden.</div>
          )}
        </div>
      </div>
    </div>
  );
}
