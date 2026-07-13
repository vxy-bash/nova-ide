import { useState, useEffect } from 'react';
import './SettingsPanel.css';

const API = 'http://127.0.0.1:8000';

export default function SettingsPanel({ onSettingsChange }) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`${API}/api/settings`);
        const data = await res.json();
        setSettings(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    loadSettings();
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      await fetch(`${API}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      if (onSettingsChange) onSettingsChange(settings);
      const isDe = (settings['general.language'] || 'de') === 'de';
      alert(isDe ? 'Einstellungen gespeichert!' : 'Settings saved!');
    } catch (err) {
      console.error(err);
      alert('Error saving settings.');
    }
  };

  const lang = settings['general.language'] || 'de';
  const isDe = lang === 'de';

  if (loading) {
    return <div className="settings-panel">{isDe ? 'Lade Einstellungen...' : 'Loading Settings...'}</div>;
  }

  return (
    <div className="settings-panel">
      <div className="settings-container">
        <div className="settings-title">{isDe ? 'Einstellungen' : 'Settings'}</div>

        {/* Global Settings */}
        <div className="settings-section">
          <div className="settings-section-title">{isDe ? 'Allgemein' : 'General'}</div>
          
          <div className="settings-row">
            <div className="settings-label">
              <div className="settings-label-title">{isDe ? 'Anzeigesprache' : 'Language'}</div>
              <div className="settings-label-desc">{isDe ? 'Sprache der Benutzeroberfläche.' : 'Interface display language.'}</div>
            </div>
            <div className="settings-control">
              <select 
                className="settings-select"
                value={settings['general.language'] || 'de'}
                onChange={e => handleChange('general.language', e.target.value)}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>

        {/* Editor Settings */}
        <div className="settings-section">
          <div className="settings-section-title">Editor</div>
          
          <div className="settings-row">
            <div className="settings-label">
              <div className="settings-label-title">{isDe ? 'Schriftgröße' : 'Font Size'}</div>
              <div className="settings-label-desc">{isDe ? 'Steuert die Schriftgröße im Editor in Pixeln.' : 'Controls the editor font size in pixels.'}</div>
            </div>
            <div className="settings-control">
              <input 
                type="number" 
                className="settings-input" 
                value={settings['editor.fontSize'] || 14} 
                onChange={e => handleChange('editor.fontSize', parseInt(e.target.value))}
                style={{ width: '60px' }}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">
              <div className="settings-label-title">{isDe ? 'Zeilenumbruch (Word Wrap)' : 'Word Wrap'}</div>
              <div className="settings-label-desc">{isDe ? 'Steuert, wie lange Zeilen umgebrochen werden.' : 'Controls how long lines wrap.'}</div>
            </div>
            <div className="settings-control">
              <select 
                className="settings-select"
                value={settings['editor.wordWrap'] || 'on'}
                onChange={e => handleChange('editor.wordWrap', e.target.value)}
              >
                <option value="off">{isDe ? 'Aus' : 'Off'}</option>
                <option value="on">{isDe ? 'An' : 'On'}</option>
                <option value="wordWrapColumn">{isDe ? 'Spalte' : 'Column'}</option>
                <option value="bounded">{isDe ? 'Begrenzt' : 'Bounded'}</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">
              <div className="settings-label-title">{isDe ? 'Minimap anzeigen' : 'Show Minimap'}</div>
              <div className="settings-label-desc">{isDe ? 'Aktiviert die Minimap auf der rechten Seite.' : 'Enables the minimap on the right.'}</div>
            </div>
            <div className="settings-control">
              <div 
                className={`settings-switch ${settings['editor.minimap'] ? 'on' : ''}`}
                onClick={() => handleChange('editor.minimap', !settings['editor.minimap'])}
              >
                <div className="settings-switch-thumb" />
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">
              <div className="settings-label-title">{isDe ? 'Automatisches Speichern' : 'Auto Save'}</div>
              <div className="settings-label-desc">{isDe ? 'Dateien automatisch nach Änderung speichern.' : 'Automatically save files after editing.'}</div>
            </div>
            <div className="settings-control">
              <div 
                className={`settings-switch ${settings.autoSave ? 'on' : ''}`}
                onClick={() => handleChange('autoSave', !settings.autoSave)}
              >
                <div className="settings-switch-thumb" />
              </div>
            </div>
          </div>
        </div>

        {/* AI Key Settings */}
        <div className="settings-section">
          <div className="settings-section-title">Künstliche Intelligenz (AI)</div>

          <div className="settings-row">
            <div className="settings-label">
              <div className="settings-label-title">{isDe ? 'API-Schlüssel (API Key)' : 'API Key'}</div>
              <div className="settings-label-desc">{isDe ? 'Dein persönlicher Autorisierungsschlüssel für den Copiloten.' : 'Your personal key to authorize AI completion request.'}</div>
            </div>
            <div className="settings-control">
              <input 
                type="password" 
                className="settings-input" 
                value={settings['ai.apiKey'] || ''} 
                onChange={e => handleChange('ai.apiKey', e.target.value)}
                style={{ width: '250px' }}
                placeholder="fe_oa_..."
              />
            </div>
          </div>
        </div>

        <button className="settings-save-btn" onClick={handleSave}>
          {isDe ? 'Speichern' : 'Save'}
        </button>
      </div>
    </div>
  );
}
