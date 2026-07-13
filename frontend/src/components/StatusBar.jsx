import './StatusBar.css';

export default function StatusBar({ workspaceName, gitBranch, cursorPos, language, onWorkspaceClick, aiModel, tokenUsage, onModelClick }) {
  const formattedCost = tokenUsage ? tokenUsage.total_cost.toFixed(4) : "0.0000";
  const totalTokens = tokenUsage ? (tokenUsage.prompt_tokens + tokenUsage.completion_tokens) : 0;
  
  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <div className="status-item" onClick={onWorkspaceClick} title="Workspace wechseln">
          <span className="status-icon">📁</span> {workspaceName || 'Kein Ordner'}
        </div>
        {gitBranch && (
          <div className="status-item" title="Git Branch">
            <span className="status-icon">ᚠ</span> {gitBranch}
          </div>
        )}
      </div>
      <div className="status-bar-right">
        {tokenUsage && (
          <div className="status-item" title="Token-Verbrauch & Kosten">
            <span className="status-icon">🪙</span> {totalTokens.toLocaleString()} Tokens (${formattedCost})
          </div>
        )}
        {aiModel && (
          <div className="status-item" onClick={onModelClick} title="KI-Modell wechseln" style={{ color: 'var(--accent-cyan)' }}>
            <span className="status-icon">🤖</span> {aiModel}
          </div>
        )}
        <div className="status-item" title="Cursor Position">
          Zeile {cursorPos.line}, Spalte {cursorPos.col}
        </div>
        <div className="status-item" title="Zeichenkodierung">
          UTF-8
        </div>
        <div className="status-item" title="Sprache">
          {language || 'Plain Text'}
        </div>
      </div>
    </div>
  );
}
