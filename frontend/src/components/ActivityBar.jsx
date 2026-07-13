import './ActivityBar.css';

export default function ActivityBar({ activePanel, onPanelChange }) {
  return (
    <div className="activity-bar">
      <div className="activity-bar-top">
        <div
          className={`activity-item ${activePanel === 'explorer' ? 'active' : ''}`}
          title="Explorer"
          onClick={() => onPanelChange('explorer')}
        >
          📄
        </div>
        <div
          className={`activity-item ${activePanel === 'search' ? 'active' : ''}`}
          title="Suchen"
          onClick={() => onPanelChange('search')}
        >
          🔍
        </div>
        <div
          className={`activity-item ${activePanel === 'git' ? 'active' : ''}`}
          title="Git"
          onClick={() => onPanelChange('git')}
        >
          ᚠ
        </div>
      </div>
      <div className="activity-bar-bottom">
        <div
          className={`activity-item ${activePanel === 'account' ? 'active' : ''}`}
          title="Account"
          onClick={() => onPanelChange('account')}
          style={{ fontSize: '15px' }}
        >
          👤
        </div>
        <div
          className={`activity-item ${activePanel === 'settings' ? 'active' : ''}`}
          title="Einstellungen"
          onClick={() => onPanelChange('settings')}
        >
          ⚙️
        </div>
      </div>
    </div>
  );
}
