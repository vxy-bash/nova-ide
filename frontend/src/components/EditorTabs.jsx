import './EditorTabs.css';

const FILE_ICONS = {
  py: '🐍', js: '📜', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
  html: '🌐', css: '🎨', json: '📋', md: '📝',
  txt: '📄', yaml: '⚙️', yml: '⚙️', sh: '🖥️', bat: '🖥️',
};

function getIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || '📄';
}

export default function EditorTabs({ tabs, activeTab, onTabClick, onTabClose }) {
  if (tabs.length === 0) {
    return (
      <div className="editor-tabs">
        <div className="editor-tabs-empty">Keine Dateien geöffnet</div>
      </div>
    );
  }

  return (
    <div className="editor-tabs">
      {tabs.map((tab) => {
        const fileName = tab.path.split('/').pop();
        return (
          <div
            key={tab.path}
            className={`editor-tab ${tab.path === activeTab ? 'active' : ''} ${tab.modified ? 'modified' : ''}`}
            onClick={() => onTabClick(tab.path)}
            title={tab.path}
          >
            <span className="tab-icon">{getIcon(fileName)}</span>
            <span className="tab-name">{fileName}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.path);
              }}
              title="Schließen"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
