import { useState, useRef } from 'react';
import './SearchPanel.css';

const API = 'http://127.0.0.1:8000';

export default function SearchPanel({ onFileOpen }) {
  const [query, setQuery] = useState('');
  const [includes, setIncludes] = useState('*');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query) return;
    setSearching(true);
    setError('');
    
    try {
      const url = new URL(`${API}/api/search`);
      url.searchParams.append('q', query);
      url.searchParams.append('includes', includes);
      if (caseSensitive) url.searchParams.append('caseSensitive', 'true');
      if (useRegex) url.searchParams.append('regex', 'true');
      
      const res = await fetch(url.toString());
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail || 'Fehler bei der Suche');
      
      setResults(data);
    } catch (err) {
      setError(err.message);
      setResults(null);
    }
    setSearching(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="search-panel">
      <div className="search-header">
        Suchen & Ersetzen
      </div>
      
      <div className="search-inputs">
        <div className="search-input-wrapper">
          <input 
            className="search-input"
            placeholder="Suchen nach..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="search-options">
            <button 
              className={`search-option-btn ${caseSensitive ? 'active' : ''}`}
              title="Groß-/Kleinschreibung beachten (Alt+C)"
              onClick={() => setCaseSensitive(!caseSensitive)}
            >Aa</button>
            <button 
              className={`search-option-btn ${useRegex ? 'active' : ''}`}
              title="Reguläre Ausdrücke (Alt+R)"
              onClick={() => setUseRegex(!useRegex)}
            >.*</button>
          </div>
        </div>
        
        <div className="search-input-wrapper" style={{ marginTop: '4px' }}>
          <input 
            className="search-input"
            placeholder="Dateien einschließen (z.B. *.js)"
            value={includes}
            onChange={e => setIncludes(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div className="search-results">
        {searching && <div className="search-message">Suche läuft...</div>}
        {error && <div className="search-message" style={{ color: 'var(--error)' }}>{error}</div>}
        
        {results && results.results.length === 0 && (
          <div className="search-message">Keine Ergebnisse gefunden.</div>
        )}
        
        {results && results.results.map((fileResult, i) => (
          <div key={i} className="search-file-group">
            <div className="search-file-header" onClick={() => onFileOpen(fileResult.file)}>
              📝 {fileResult.file}
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {fileResult.matches.length}
              </span>
            </div>
            
            {fileResult.matches.map((match, j) => (
              <div 
                key={j} 
                className="search-match"
                onClick={() => onFileOpen(fileResult.file, match.line)}
                title={`Zeile ${match.line}`}
              >
                <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>{match.line}:</span>
                {match.content.length > 80 ? match.content.substring(0, 80) + '...' : match.content}
              </div>
            ))}
          </div>
        ))}
        
        {results && results.totalMatches >= 100 && (
          <div className="search-message">Es werden nur die ersten 100 Ergebnisse angezeigt.</div>
        )}
      </div>
    </div>
  );
}
