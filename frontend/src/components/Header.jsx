import { useState, useEffect, useRef } from 'react';
import './Header.css';

const TRANSLATIONS = {
  de: {
    file: 'Datei',
    openFolder: 'Ordner öffnen...',
    save: 'Speichern (Ctrl+S)',
    exit: 'Beenden',
    terminal: 'Terminal',
    clear: 'Terminal leeren',
    view: 'Ansicht',
    zen: 'Zen-Modus umschalten (Alt+Z)',
    sidebar: 'Sidebar umschalten',
    language: 'Sprache',
    help: 'Hilfe',
    about: 'Über Nova IDE',
    aboutText: 'Nova IDE — AI-gestützte Desktop-Entwicklerumgebung.\nVersion 1.2.0 (Stable)\nEntwickelt auf Basis von Electron & Monaco Editor.',
    connected: 'Lokal',
    connectionError: 'Verbindungsfehler',
    run: 'Start',
    runTitle: 'Aktive Datei ausführen'
  },
  en: {
    file: 'File',
    openFolder: 'Open Folder...',
    save: 'Save (Ctrl+S)',
    exit: 'Exit',
    terminal: 'Terminal',
    clear: 'Clear Terminal',
    view: 'View',
    zen: 'Toggle Zen Mode (Alt+Z)',
    sidebar: 'Toggle Sidebar',
    language: 'Language',
    help: 'Help',
    about: 'About Nova IDE',
    aboutText: 'Nova IDE — AI-powered desktop developer environment.\nVersion 1.2.0 (Stable)\nBuilt on Electron & Monaco Editor.',
    connected: 'Local',
    connectionError: 'Connection Error',
    run: 'Run',
    runTitle: 'Execute active file'
  }
};

export default function Header({ 
  currentLanguage, 
  onLanguageChange, 
  onOpenFolder, 
  onToggleZen, 
  onToggleSidebar, 
  onSaveFile,
  onClearTerminal,
  activeTab,
  onRunCode
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const headerRef = useRef(null);
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.de;

  const toggleMenu = (menu, e) => {
    e.stopPropagation();
    setActiveMenu(prev => prev === menu ? null : menu);
  };

  useEffect(() => {
    const handleClose = () => setActiveMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const handleAction = (callback) => {
    setActiveMenu(null);
    callback?.();
  };

  return (
    <header className="header" ref={headerRef}>
      <div className="header-brand">
        <div className="header-logo">
          <div className="header-logo-icon">N</div>
        </div>
        <div className="header-title">Nova IDE</div>
        
        {/* Menu Bar / Topbar Menu */}
        <nav className="header-menubar">
          {/* File Menu */}
          <div className="menu-container">
            <button className={`menu-trigger ${activeMenu === 'file' ? 'active' : ''}`} onClick={(e) => toggleMenu('file', e)}>
              {t.file}
            </button>
            {activeMenu === 'file' && (
              <div className="menu-dropdown">
                <div className="menu-item" onClick={() => handleAction(onOpenFolder)}>{t.openFolder}</div>
                {activeTab && (
                  <div className="menu-item" onClick={() => handleAction(onSaveFile)}>{t.save}</div>
                )}
                <div className="menu-divider" />
                <div className="menu-item" onClick={() => window.close()}>{t.exit}</div>
              </div>
            )}
          </div>

          {/* Terminal Menu */}
          <div className="menu-container">
            <button className={`menu-trigger ${activeMenu === 'terminal' ? 'active' : ''}`} onClick={(e) => toggleMenu('terminal', e)}>
              {t.terminal}
            </button>
            {activeMenu === 'terminal' && (
              <div className="menu-dropdown">
                <div className="menu-item" onClick={() => handleAction(onClearTerminal)}>{t.clear}</div>
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="menu-container">
            <button className={`menu-trigger ${activeMenu === 'view' ? 'active' : ''}`} onClick={(e) => toggleMenu('view', e)}>
              {t.view}
            </button>
            {activeMenu === 'view' && (
              <div className="menu-dropdown">
                <div className="menu-item" onClick={() => handleAction(onToggleZen)}>{t.zen}</div>
                <div className="menu-item" onClick={() => handleAction(onToggleSidebar)}>{t.sidebar}</div>
              </div>
            )}
          </div>

          {/* Language Menu */}
          <div className="menu-container">
            <button className={`menu-trigger ${activeMenu === 'language' ? 'active' : ''}`} onClick={(e) => toggleMenu('language', e)}>
              {t.language}
            </button>
            {activeMenu === 'language' && (
              <div className="menu-dropdown">
                <div className="menu-item" onClick={() => handleAction(() => onLanguageChange('de'))}>Deutsch</div>
                <div className="menu-item" onClick={() => handleAction(() => onLanguageChange('en'))}>English</div>
              </div>
            )}
          </div>

          {/* Help Menu */}
          <div className="menu-container">
            <button className={`menu-trigger ${activeMenu === 'help' ? 'active' : ''}`} onClick={(e) => toggleMenu('help', e)}>
              {t.help}
            </button>
            {activeMenu === 'help' && (
              <div className="menu-dropdown">
                <div className="menu-item" onClick={() => handleAction(() => alert(t.aboutText))}>{t.about}</div>
              </div>
            )}
          </div>
        </nav>

        {/* Global Task Runner Start/Play Button */}
        {activeTab && (
          <button 
            onClick={onRunCode}
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--success)',
              borderRadius: 'var(--radius-sm)',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '16px',
              outline: 'none'
            }}
            title={t.runTitle}
          >
            ▶ {t.run}
          </button>
        )}
      </div>

      <div className="header-right">
        <div className="header-status">
          <span className="status-dot connected" />
          <span>{t.connected}</span>
        </div>
      </div>
    </header>
  );
}
