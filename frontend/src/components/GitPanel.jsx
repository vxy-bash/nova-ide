import { useState, useEffect } from 'react';
import './GitPanel.css';

const API = 'http://127.0.0.1:8000';

export default function GitPanel({ onFileOpen, language }) {
  const isDe = language === 'de';
  
  // Local Git States
  const [status, setStatus] = useState({ isRepo: false, branch: '', changes: [] });
  const [loading, setLoading] = useState(true);
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [initLoading, setInitLoading] = useState(false);

  // GitHub States
  const [ghUser, setGhUser] = useState({ loggedIn: false, username: '', avatar: '' });
  const [ghRepos, setGhRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [patToken, setPatToken] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [repoActionLoading, setRepoActionLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [createError, setCreateError] = useState('');

  // Fetch status on mount
  useEffect(() => {
    fetchStatus();
    checkGitHubAuth();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/git/status`);
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Error fetching git status:', err);
    }
    setLoading(false);
  };

  const handleInit = async () => {
    setInitLoading(true);
    try {
      const res = await fetch(`${API}/api/git/init`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchStatus();
      } else {
        alert(isDe ? 'Git Initialisierung fehlgeschlagen: ' : 'Git initialization failed: ' + data.output);
      }
    } catch (err) {
      console.error(err);
    }
    setInitLoading(false);
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    setCommitting(true);
    try {
      const res = await fetch(`${API}/api/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage }),
      });
      const data = await res.json();
      if (data.success) {
        setCommitMessage('');
        fetchStatus();
      } else {
        alert(isDe ? 'Commit fehlgeschlagen: ' : 'Commit failed: ' + data.output);
      }
    } catch (err) {
      console.error(err);
    }
    setCommitting(false);
  };

  const [pushing, setPushing] = useState(false);
  const [gitProgress, setGitProgress] = useState('');

  const handlePush = async () => {
    setPushing(true);
    setGitProgress('');
    
    const progressInterval = setInterval(async () => {
      try {
        const pRes = await fetch(`${API}/api/git/progress`);
        if (pRes.ok) {
          const pData = await pRes.json();
          setGitProgress(pData.progress);
        }
      } catch (err) {}
    }, 300);
    
    try {
      const res = await fetch(`${API}/api/git/push`, { method: 'POST' });
      clearInterval(progressInterval);
      setGitProgress('');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          alert(isDe ? 'Änderungen erfolgreich gepusht!' : 'Changes successfully pushed!');
          fetchStatus();
        } else {
          alert((isDe ? 'Push fehlgeschlagen: ' : 'Push failed: ') + data.output);
        }
      } else {
        alert(isDe ? 'Fehler beim Push.' : 'Error during push.');
      }
    } catch (err) {
      clearInterval(progressInterval);
      setGitProgress('');
      alert(isDe ? 'Verbindungsfehler zum Backend.' : 'Connection error to backend.');
    }
    setPushing(false);
  };

  // GitHub Auth APIs
  const checkGitHubAuth = async () => {
    try {
      const res = await fetch(`${API}/api/github/user`);
      const data = await res.json();
      setGhUser(data);
      if (data.loggedIn) {
        fetchGitHubRepos();
      }
    } catch (err) {
      console.error('GitHub auth check failed:', err);
    }
  };

  const fetchGitHubRepos = async () => {
    setReposLoading(true);
    try {
      const res = await fetch(`${API}/api/github/repos`);
      if (res.ok) {
        const data = await res.json();
        setGhRepos(data.repos || []);
      }
    } catch (err) {
      console.error('Error fetching repos:', err);
    }
    setReposLoading(false);
  };

  const handleGitHubLogin = async () => {
    const trimmedToken = patToken.trim();
    if (!trimmedToken) return;
    setRepoActionLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API}/api/github/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: trimmedToken }),
      });
      if (res.ok) {
        const data = await res.json();
        setGhUser({ loggedIn: true, username: data.username, avatar: data.avatar });
        setShowLoginModal(false);
        setPatToken('');
        fetchGitHubRepos();
      } else {
        let errMsg = 'Authentication failed.';
        try {
          const err = await res.json();
          errMsg = err.detail || errMsg;
        } catch (e) {
          try {
            errMsg = await res.text();
          } catch (t_err) {}
        }
        setAuthError(errMsg);
      }
    } catch (err) {
      setAuthError(isDe ? 'Verbindungsfehler zum Backend.' : 'Connection error to backend.');
    }
    setRepoActionLoading(false);
  };

  const handleGitHubLogout = async () => {
    try {
      await fetch(`${API}/api/github/logout`, { method: 'POST' });
      setGhUser({ loggedIn: false, username: '', avatar: '' });
      setGhRepos([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateGitHubRepo = async () => {
    if (!newRepoName.trim()) return;
    setRepoActionLoading(true);
    setCreateError('');
    setGitProgress('');
    
    const progressInterval = setInterval(async () => {
      try {
        const pRes = await fetch(`${API}/api/git/progress`);
        if (pRes.ok) {
          const pData = await pRes.json();
          setGitProgress(pData.progress);
        }
      } catch (err) {}
    }, 300);
    
    try {
      const res = await fetch(`${API}/api/github/repos/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRepoName, private: newRepoPrivate }),
      });
      clearInterval(progressInterval);
      setGitProgress('');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setShowCreateModal(false);
          setNewRepoName('');
          fetchGitHubRepos();
          fetchStatus();
          alert(isDe ? 'GitHub Repository erfolgreich erstellt und synchronisiert!' : 'GitHub Repository successfully created and synced!');
        } else {
          setCreateError(data.output || (isDe ? 'Push fehlgeschlagen.' : 'Push failed.'));
        }
      } else {
        let errMsg = 'Creation failed.';
        try {
          const err = await res.json();
          errMsg = err.detail || errMsg;
        } catch (e) {
          try {
            errMsg = await res.text();
          } catch (t_err) {}
        }
        setCreateError(errMsg);
      }
    } catch (err) {
      clearInterval(progressInterval);
      setGitProgress('');
      setCreateError(isDe ? 'Verbindungsfehler zum Backend.' : 'Connection error to backend.');
    }
    setRepoActionLoading(false);
  };

  return (
    <div className="git-panel">
      {/* Header */}
      <div className="git-header">
        <span>{isDe ? 'Quellcodeverwaltung' : 'Source Control'}</span>
        <button className="git-refresh" onClick={() => { fetchStatus(); if (ghUser.loggedIn) fetchGitHubRepos(); }} title={isDe ? 'Aktualisieren' : 'Refresh'}>🔄</button>
      </div>

      {/* Main Git Repository Area */}
      <div className="git-section-body">
        {loading ? (
          <div className="git-empty">{isDe ? 'Lade Git Status...' : 'Loading Git Status...'}</div>
        ) : !status.isRepo ? (
          <div className="git-empty-notice">
            <p>{isDe ? 'Kein lokales Git-Repository initialisiert.' : 'No local git repository initialized.'}</p>
            <button className="git-action-btn primary" onClick={handleInit} disabled={initLoading}>
              {initLoading ? (isDe ? 'Initialisiere...' : 'Initializing...') : (isDe ? 'Git initialisieren' : 'Initialize Git')}
            </button>
          </div>
        ) : (
          <div className="git-repo-active">
            {/* Branch */}
            <div className="git-branch">
              ᚠ {status.branch || 'main'}
            </div>

            {/* Commit Message Box */}
            <div className="git-commit-box">
              <input
                type="text"
                className="git-commit-input"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder={isDe ? 'Commit-Nachricht...' : 'Commit message...'}
              />
              <button
                className="git-action-btn success full-width"
                onClick={handleCommit}
                disabled={committing || !commitMessage.trim()}
              >
                {committing ? (isDe ? 'Commite...' : 'Committing...') : (isDe ? 'Änderungen committen' : 'Commit Changes')}
              </button>
              {status.hasRemote && (
                <button
                  className="git-action-btn primary full-width"
                  style={{ marginTop: '8px' }}
                  onClick={handlePush}
                  disabled={pushing}
                >
                  {pushing ? (isDe ? 'Pushe...' : 'Pushing...') : (isDe ? 'Änderungen pushen' : 'Push Changes')}
                </button>
              )}
              {gitProgress && pushing && (
                <div className="git-progress-box" style={{ marginTop: '8px' }}>
                  <span className="git-progress-spinner">⏳</span>
                  <span className="git-progress-text">{gitProgress}</span>
                </div>
              )}
            </div>

            {/* File Changes List */}
            <div className="git-file-list-header">
              {isDe ? 'Änderungen' : 'Changes'} ({status.changes.length})
            </div>
            <div className="git-file-list">
              {status.changes.map((change, i) => (
                <div key={i} className="git-file-item" onClick={() => onFileOpen(change.file)}>
                  <span className={`git-status-badge git-status-${change.status.trim()}`}>
                    {change.status.trim() || 'U'}
                  </span>
                  <span className="git-file-name">{change.file}</span>
                </div>
              ))}
              {status.changes.length === 0 && (
                <div className="git-empty-small">{isDe ? 'Keine ungesicherten Änderungen.' : 'No uncommitted changes.'}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* GitHub Integration Section */}
      <div className="github-integration-panel">
        <div className="github-panel-header">
          <span>🐱 GitHub Connection</span>
        </div>

        {!ghUser.loggedIn ? (
          <div className="github-panel-logged-out">
            <p>{isDe ? 'Verknüpfe dein GitHub-Konto, um Repositories direkt zu erstellen und zu verwalten.' : 'Link your GitHub account to create and manage repositories.'}</p>
            <button className="git-action-btn secondary full-width" onClick={() => setShowLoginModal(true)}>
              🔑 {isDe ? 'Mit GitHub verbinden' : 'Connect to GitHub'}
            </button>
          </div>
        ) : (
          <div className="github-panel-logged-in">
            {/* User Profile */}
            <div className="github-user-bar">
              <div className="github-user-info">
                {ghUser.avatar && <img src={ghUser.avatar} className="github-user-avatar" alt="Avatar" />}
                <span className="github-user-name">{ghUser.username}</span>
              </div>
              <button className="github-logout-btn" onClick={handleGitHubLogout} title={isDe ? 'Abmelden' : 'Logout'}>
                {isDe ? 'Abmelden' : 'Logout'}
              </button>
            </div>

            {/* Actions */}
            <div className="github-actions-bar">
              <button className="git-action-btn cyan full-width" onClick={() => setShowCreateModal(true)}>
                📁 {isDe ? 'Neues GitHub Repo erstellen' : 'Create GitHub Repo'}
              </button>
            </div>

            {/* Repositories list */}
            <div className="github-repos-header">
              {isDe ? 'Deine Repositories' : 'Your Repositories'}
            </div>
            <div className="github-repos-list">
              {reposLoading ? (
                <div className="github-repos-status">{isDe ? 'Lade Repos...' : 'Loading repos...'}</div>
              ) : ghRepos.length === 0 ? (
                <div className="github-repos-status">{isDe ? 'Keine Repos gefunden.' : 'No repos found.'}</div>
              ) : (
                ghRepos.map((repo) => (
                  <a key={repo.full_name} href={repo.html_url} target="_blank" rel="noopener noreferrer" className="github-repo-item">
                    <span className="github-repo-name">📁 {repo.name}</span>
                    <span className="github-repo-privacy">{repo.private ? 'Private' : 'Public'}</span>
                  </a>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: GitHub Login */}
      {showLoginModal && (
        <div className="git-modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="git-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="git-modal-header">
              <h3>{isDe ? 'Mit GitHub verbinden' : 'Connect to GitHub'}</h3>
              <button className="git-modal-close" onClick={() => setShowLoginModal(false)}>×</button>
            </div>
            <div className="git-modal-body">
              <p className="git-modal-desc">
                {isDe 
                  ? 'Erstelle einen Personal Access Token (classic) mit den Scopes "repo" und "user" auf GitHub, um fortzufahren.'
                  : 'Create a Personal Access Token (classic) with "repo" and "user" scopes on GitHub to continue.'}
              </p>
              <a 
                href="https://github.com/settings/tokens/new?scopes=repo,user&description=NovaIDE" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="github-token-link"
              >
                👉 {isDe ? 'Token auf GitHub erstellen' : 'Create Token on GitHub'}
              </a>
              <input
                type="password"
                className="git-modal-input"
                placeholder={isDe ? 'Personal Access Token einfügen...' : 'Paste Personal Access Token...'}
                value={patToken}
                onChange={(e) => setPatToken(e.target.value)}
              />
              {authError && <div className="git-modal-error">{authError}</div>}
            </div>
            <div className="git-modal-footer">
              <button className="git-action-btn primary" onClick={handleGitHubLogin} disabled={repoActionLoading || !patToken.trim()}>
                {repoActionLoading ? (isDe ? 'Verbinde...' : 'Connecting...') : (isDe ? 'Verbinden' : 'Connect')}
              </button>
              <button className="git-action-btn secondary" onClick={() => setShowLoginModal(false)}>
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Repository */}
      {showCreateModal && (
        <div className="git-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="git-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="git-modal-header">
              <h3>{isDe ? 'Neues Repository erstellen' : 'Create New Repository'}</h3>
              <button className="git-modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="git-modal-body">
              <p className="git-modal-desc">
                {isDe
                  ? 'Erstellt ein neues Repository auf GitHub, initialisiert Git im Projektordner (falls nicht vorhanden) und führt einen initialen Push aus.'
                  : 'Creates a new GitHub repository, initializes Git in the project folder (if needed), and pushes the project.'}
              </p>
              <div className="git-modal-field">
                <label className="git-modal-label">{isDe ? 'Repository-Name' : 'Repository Name'}</label>
                <input
                  type="text"
                  className="git-modal-input"
                  placeholder={isDe ? 'z.B. mein-cooles-projekt' : 'e.g. my-cool-project'}
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, '-'))}
                />
              </div>
              <div className="git-modal-checkbox-row">
                <input
                  type="checkbox"
                  id="repo-private-chk"
                  checked={newRepoPrivate}
                  onChange={(e) => setNewRepoPrivate(e.target.checked)}
                />
                <label htmlFor="repo-private-chk">{isDe ? 'Privates Repository' : 'Private Repository'}</label>
              </div>
              {gitProgress && repoActionLoading && (
                <div className="git-progress-box" style={{ marginBottom: '8px' }}>
                  <span className="git-progress-spinner">⏳</span>
                  <span className="git-progress-text">{gitProgress}</span>
                </div>
              )}
              {createError && <div className="git-modal-error">{createError}</div>}
            </div>
            <div className="git-modal-footer">
              <button className="git-action-btn primary" onClick={handleCreateGitHubRepo} disabled={repoActionLoading || !newRepoName.trim()}>
                {repoActionLoading ? (isDe ? 'Erstelle & Pushe...' : 'Creating & Pushing...') : (isDe ? 'Erstellen & Pushen' : 'Create & Push')}
              </button>
              <button className="git-action-btn secondary" onClick={() => setShowCreateModal(false)}>
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
