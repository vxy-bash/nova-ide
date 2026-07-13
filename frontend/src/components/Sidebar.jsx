import './Sidebar.css';

export default function Sidebar({ open, onClose, toolHistory }) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-header">
        <span className="sidebar-title">⚙️ Tool-Verlauf</span>
        <button className="sidebar-close" onClick={onClose} title="Schließen">
          ✕
        </button>
      </div>

      <div className="sidebar-content">
        {toolHistory.length === 0 ? (
          <div className="sidebar-empty">
            <div className="sidebar-empty-icon">🔧</div>
            <div>Noch keine Tools ausgeführt</div>
          </div>
        ) : (
          toolHistory.map((entry, i) => (
            <div className="tool-entry" key={i}>
              <div className="tool-entry-header">
                <span className="tool-entry-icon">⚙️</span>
                <span className="tool-entry-name">{entry.name}</span>
                <span className="tool-entry-time">{entry.time}</span>
              </div>
              {entry.args && Object.keys(entry.args).length > 0 && (
                <div className="tool-entry-args">
                  {JSON.stringify(entry.args, null, 2)}
                </div>
              )}
              {entry.result && (
                <div className="tool-entry-result">{entry.result}</div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
