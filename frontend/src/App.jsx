import { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import ActivityBar from './components/ActivityBar';
import StatusBar from './components/StatusBar';
import FileExplorer from './components/FileExplorer';
import SearchPanel from './components/SearchPanel';
import GitPanel from './components/GitPanel';
import AccountPanel from './components/AccountPanel';
import SettingsPanel from './components/SettingsPanel';
import EditorTabs from './components/EditorTabs';
import CodeEditor from './components/CodeEditor';
import ImageViewer from './components/ImageViewer';
import MarkdownPreview from './components/MarkdownPreview';
import BottomPanel from './components/BottomPanel';
import CommandPalette from './components/CommandPalette';
import QuickOpen from './components/QuickOpen';
import NotificationContainer from './components/Notifications';
import { useNotifications } from './hooks/useNotifications';
import './App.css';

const API = 'http://127.0.0.1:8000';
const MODELS = ['claude-fable-5', 'gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro', 'gemini-1.5-flash'];

export default function App() {
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [bottomHeight, setBottomHeight] = useState(250);
  const [activePanel, setActivePanel] = useState('explorer'); // explorer, search, git, account
  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [gitBranch, setGitBranch] = useState(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  
  // Modals & Panels
  const [cmdOpen, setCmdOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);

  // States for dynamic features
  const [activeModel, setActiveModel] = useState('claude-fable-5');
  const [usage, setUsage] = useState({ prompt_tokens: 0, completion_tokens: 0, total_cost: 0.0 });
  const [activeFileContent, setActiveFileContent] = useState('');
  
  // Advanced Features
  const [splitPreview, setSplitPreview] = useState(false);
  const [splitDiff, setSplitDiff] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [pendingCommand, setPendingCommand] = useState(null);
  
  // Settings & Localization
  const [language, setLanguage] = useState('de');
  const [settings, setSettings] = useState({});
  const [showSplash, setShowSplash] = useState(true);

  const { notifications, addNotification, removeNotification } = useNotifications();

  // Load configuration, workspace name and git branch
  const loadConfiguration = useCallback(() => {
    fetch(`${API}/api/workspace`)
      .then(res => res.json())
      .then(data => setWorkspaceName(data.name || 'Workspace'))
      .catch(() => {});
      
    fetch(`${API}/api/git/status`)
      .then(res => res.json())
      .then(data => { if (data.isRepo) setGitBranch(data.branch); })
      .catch(() => {});

    // Load active settings (model, language, font, minimap)
    fetch(`${API}/api/settings`)
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        if (data['ai.model']) setActiveModel(data['ai.model']);
        if (data['general.language']) setLanguage(data['general.language']);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadConfiguration();
    
    // Hide splash screen loader after 2 seconds
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [loadConfiguration]);

  // Poll usage statistics
  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/usage`);
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, 4000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        setQuickOpenOpen(true);
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        setCmdOpen(true);
      } else if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        setZenMode(p => !p);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Open file helper
  const handleFileOpen = useCallback(async (path, line = 1) => {
    if (tabs.some((t) => t.path === path)) {
      setActiveTab(path);
      return;
    }

    let language = 'plaintext';
    try {
      const res = await fetch(`${API}/api/file?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        language = data.language || 'plaintext';
      }
    } catch {}

    setTabs((prev) => [...prev, { path, language, modified: false }]);
    setActiveTab(path);
    setSplitDiff(false);
  }, [tabs]);

  const handleTabClose = useCallback((path) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.path !== path);
      if (activeTab === path) {
        const idx = prev.findIndex((t) => t.path === path);
        const next = newTabs[Math.min(idx, newTabs.length - 1)];
        setActiveTab(next?.path || null);
      }
      return newTabs;
    });
  }, [activeTab]);

  const handleContentChange = useCallback((path, modified, currentContent) => {
    setTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, modified } : t))
    );
    if (currentContent !== undefined) {
      setActiveFileContent(currentContent);
    }
  }, []);

  // Open native OS folder selector
  const handleOpenFolderNative = async () => {
    try {
      const res = await fetch(`${API}/api/workspace/select-native`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setWorkspaceName(data.name);
        setTabs([]);
        setActiveTab(null);
        addNotification('success', language === 'de' ? `Projekt geöffnet: ${data.name}` : `Project opened: ${data.name}`);
        
        fetch(`${API}/api/git/status`)
          .then(r => r.json())
          .then(d => setGitBranch(d.isRepo ? d.branch : null));
      }
    } catch {
      addNotification('error', language === 'de' ? 'Fehler beim Öffnen des Ordners' : 'Error opening folder');
    }
  };

  const handleSaveActiveFile = async () => {
    if (!activeTab || activeFileContent === undefined) return;
    try {
      const res = await fetch(`${API}/api/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeTab, content: activeFileContent }),
      });
      if (res.ok) {
        addNotification('success', language === 'de' ? 'Datei gespeichert!' : 'File saved!');
        setTabs(prev => prev.map(t => t.path === activeTab ? { ...t, modified: false } : t));
      }
    } catch {
      addNotification('error', language === 'de' ? 'Fehler beim Speichern' : 'Error saving file');
    }
  };

  const handleClearTerminal = () => {
    setPendingCommand('__CLEAR__');
  };

  const handleLanguageChange = async (langId) => {
    setLanguage(langId);
    try {
      await fetch(`${API}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { ...settings, 'general.language': langId } })
      });
      loadConfiguration(); // Reload setting state
      addNotification('success', langId === 'de' ? 'Sprache geändert auf Deutsch' : 'Language changed to English');
    } catch {
      addNotification('error', 'Error saving language settings.');
    }
  };

  const handleModelChange = async (modelId) => {
    setActiveModel(modelId);
    try {
      await fetch(`${API}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { ...settings, 'ai.model': modelId } })
      });
      loadConfiguration();
      addNotification('success', `Copilot Modell: ${modelId}`);
    } catch {
      addNotification('error', 'Error saving model settings.');
    }
  };

  const handleModelCycle = () => {
    const currentIdx = MODELS.indexOf(activeModel);
    const nextIdx = (currentIdx + 1) % MODELS.length;
    handleModelChange(MODELS[nextIdx]);
  };

  // Run File Task Runner (Supports Python, Node, Go, Rust, C++, C, Shell, Batch, Powershell)
  const handleRunCode = () => {
    if (!activeTab) return;
    let cmd = '';
    const lowTab = activeTab.toLowerCase();
    
    if (lowTab.endsWith('.py')) {
      cmd = `python -u "${activeTab}"`;
    } else if (lowTab.endsWith('.js') || lowTab.endsWith('.mjs')) {
      cmd = `node "${activeTab}"`;
    } else if (lowTab.endsWith('.go')) {
      cmd = `go run "${activeTab}"`;
    } else if (lowTab.endsWith('.rs')) {
      const exeName = activeTab.substring(0, activeTab.lastIndexOf('.'));
      cmd = `rustc "${activeTab}" && .\\"${exeName}.exe"`;
    } else if (lowTab.endsWith('.cpp') || lowTab.endsWith('.cc')) {
      cmd = `g++ "${activeTab}" -o out.exe && .\\out.exe`;
    } else if (lowTab.endsWith('.c')) {
      cmd = `gcc "${activeTab}" -o out.exe && .\\out.exe`;
    } else if (lowTab.endsWith('.bat') || lowTab.endsWith('.cmd')) {
      cmd = `.\\"${activeTab}"`;
    } else if (lowTab.endsWith('.ps1')) {
      cmd = `powershell -ExecutionPolicy Bypass -File "${activeTab}"`;
    } else if (lowTab.endsWith('.sh') || lowTab.endsWith('.bash') || lowTab.endsWith('.zsh')) {
      cmd = `bash "${activeTab}"`;
    } else if (lowTab.endsWith('.cs')) {
      const exeName = activeTab.substring(0, activeTab.lastIndexOf('.'));
      cmd = `csc "${activeTab}" && .\\"${exeName}.exe"`;
    } else if (lowTab.endsWith('.java')) {
      const className = activeTab.substring(activeTab.lastIndexOf('/') + 1, activeTab.lastIndexOf('.'));
      cmd = `javac "${activeTab}" && java "${className}"`;
    } else {
      addNotification('info', language === 'de' ? 'Keine Standard-Ausführung für diesen Dateityp.' : 'No execution defined for this file type.');
      return;
    }
    setPendingCommand(cmd);
    addNotification('info', `${language === 'de' ? 'Führe aus' : 'Executing'}: ${cmd}`);
  };

  const activeTabInfo = tabs.find((t) => t.path === activeTab);
  const isImageFile = activeTab && /\.(png|jpg|jpeg|gif|svg)$/i.test(activeTab);
  const isMarkdownFile = activeTab && /\.md$/i.test(activeTab);
  const isDe = language === 'de';

  const commands = [
    { id: 'open_file', label: isDe ? 'Datei suchen (Quick Open)' : 'Find File (Quick Open)', keybinding: 'Ctrl+P', action: () => setQuickOpenOpen(true) },
    { id: 'open_folder', label: isDe ? 'Projektordner öffnen...' : 'Open Project Folder...', action: handleOpenFolderNative },
    { id: 'cycle_model', label: isDe ? 'KI-Modell wechseln' : 'Cycle AI Model', action: handleModelCycle },
    { id: 'toggle_zen', label: isDe ? 'Zen-Modus umschalten' : 'Toggle Zen Mode', keybinding: 'Alt+Z', action: () => setZenMode(p => !p) },
    { id: 'run_file', label: isDe ? 'Aktive Datei ausführen' : 'Run Active File', action: handleRunCode },
    { id: 'settings', label: isDe ? 'Einstellungen öffnen' : 'Open Settings', action: () => setActivePanel('settings') },
    { id: 'reload', label: isDe ? 'Fenster neu laden' : 'Reload Window', action: () => window.location.reload() },
  ];

  // Render Splash screen loading animation at startup
  if (showSplash) {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <div className="splash-logo">N</div>
          <h1 className="splash-title">Nova IDE</h1>
          <p className="splash-subtitle">Preparing Workspace...</p>
          <div className="splash-loader-bar">
            <div className="splash-loader-progress" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {!zenMode && (
        <Header 
          currentLanguage={language}
          onLanguageChange={handleLanguageChange}
          onOpenFolder={handleOpenFolderNative}
          onToggleZen={() => setZenMode(p => !p)}
          onToggleSidebar={() => {
            setActivePanel(p => p === 'explorer' ? null : 'explorer');
          }}
          onSaveFile={handleSaveActiveFile}
          onClearTerminal={handleClearTerminal}
          activeTab={activeTab}
          onRunCode={handleRunCode}
        />
      )}

      <div className="ide-body" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {!zenMode && activePanel && (
          <ActivityBar 
            activePanel={activePanel} 
            onPanelChange={setActivePanel} 
          />
        )}

        {/* Side Panel Area */}
        {!zenMode && activePanel && activePanel !== 'settings' && (
          <div style={{ width: '250px', display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {activePanel === 'explorer' && (
                <FileExplorer 
                  activeFile={activeTab} 
                  onFileClick={(entry) => !entry.isDir && handleFileOpen(entry.path)} 
                  onOpenFolder={handleOpenFolderNative}
                  language={language}
                />
              )}
              {activePanel === 'search' && (
                <SearchPanel onFileOpen={handleFileOpen} />
              )}
              {activePanel === 'git' && (
                <GitPanel onFileOpen={handleFileOpen} language={language} />
              )}
              {activePanel === 'account' && (
                <AccountPanel 
                  language={language}
                  apiKey={settings['ai.apiKey'] || ''}
                  onSyncKey={(syncedKey) => {
                    addNotification('success', language === 'de' ? 'API-Key erfolgreich mit Cloud synchronisiert!' : 'API Key successfully synced with Cloud!');
                  }}
                />
              )}
            </div>

            {/* Sidebar Details Panel */}
            {activeTab && !isImageFile && (
              <div style={{ padding: '12px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                <div style={{ fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                  {isDe ? 'Details' : 'Details'}
                </div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }} title={activeTab}>
                  <strong>{isDe ? 'Pfad:' : 'Path:'}</strong> {activeTab}
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <strong>{isDe ? 'Zeilen:' : 'Lines:'}</strong> {activeFileContent ? activeFileContent.split('\n').length : 0}
                </div>
                <div>
                  <strong>{isDe ? 'Größe:' : 'Size:'}</strong> {activeFileContent ? (activeFileContent.length / 1024).toFixed(2) : 0} KB
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Editor Area */}
        <div className="editor-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {activePanel === 'settings' ? (
            <div className="editor-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '12px' }}>
                {isDe ? 'Einstellungen (Wechsle den Tab oder schließe das Panel, um zu beenden)' : 'Settings (Change tab or close panel to exit)'}
              </div>
              <SettingsPanel onSettingsChange={(s) => {
                setSettings(s);
                if (s['ai.model']) setActiveModel(s['ai.model']);
                if (s['general.language']) setLanguage(s['general.language']);
                if (s.theme) addNotification('info', `Theme: ${s.theme}`);
              }} />
            </div>
          ) : (
            <div className="editor-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                <EditorTabs
                  tabs={tabs}
                  activeTab={activeTab}
                  onTabClick={setActiveTab}
                  onTabClose={handleTabClose}
                />
                
                <div style={{ display: 'flex', gap: '6px', marginRight: '12px' }}>
                  {/* Diff Button */}
                  {activeTabInfo?.modified && (
                    <button 
                      onClick={() => setSplitDiff(p => !p)}
                      style={{
                        background: splitDiff ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        border: '1px solid var(--border-subtle)',
                        color: splitDiff ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 10px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title={isDe ? 'Änderungen vergleichen' : 'Compare modifications'}
                    >
                      ⇅ Diff {splitDiff ? (isDe ? 'aus' : 'off') : (isDe ? 'an' : 'on')}
                    </button>
                  )}

                  {/* Markdown Preview Button */}
                  {isMarkdownFile && (
                    <button 
                      onClick={() => setSplitPreview(p => !p)}
                      style={{
                        background: splitPreview ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        border: '1px solid var(--border-subtle)',
                        color: splitPreview ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 10px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      📖 {isDe ? 'Vorschau' : 'Preview'} {splitPreview ? (isDe ? 'aus' : 'off') : (isDe ? 'an' : 'on')}
                    </button>
                  )}
                  {zenMode && (
                    <button 
                      onClick={() => setZenMode(false)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 10px',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      {isDe ? 'Zen beenden' : 'Exit Zen'}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {isImageFile ? (
                  <ImageViewer filePath={activeTab} />
                ) : (
                  <>
                    <CodeEditor
                      key={activeTab}
                      filePath={activeTab}
                      language={activeTabInfo?.language}
                      onContentChange={handleContentChange}
                      onCursorChange={(pos) => setCursorPos(pos)}
                      diffMode={splitDiff}
                      settings={settings}
                    />
                    {isMarkdownFile && splitPreview && (
                      <MarkdownPreview content={activeFileContent} />
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {!zenMode && (
            <BottomPanel
              height={bottomHeight}
              onResize={setBottomHeight}
              pendingCommand={pendingCommand}
              onCommandExecuted={() => setPendingCommand(null)}
            />
          )}
        </div>
      </div>

      {!zenMode && (
        <StatusBar 
          workspaceName={workspaceName}
          gitBranch={gitBranch}
          cursorPos={cursorPos}
          language={activeTabInfo?.language}
          onWorkspaceClick={handleOpenFolderNative}
          aiModel={activeModel}
          tokenUsage={usage}
          onModelClick={handleModelCycle}
        />
      )}

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} commands={commands} />
      <QuickOpen open={quickOpenOpen} onClose={() => setQuickOpenOpen(false)} onFileSelect={handleFileOpen} />
      <NotificationContainer notifications={notifications} removeNotification={removeNotification} />
    </div>
  );
}
