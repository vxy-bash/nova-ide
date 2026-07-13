import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useWebSocket from '../hooks/useWebSocket';
import './Terminal.css';

// ─── Terminal Tab ────────────────────────────────────────────
function TerminalTab({ pendingCommand, onCommandExecuted }) {
  const [lines, setLines] = useState([
    { type: 'system', content: '🖥️  Terminal — Ready.' }
  ]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const wsRef = useRef(null);
  const outputRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [lines]);

  const connect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (err) {
        console.error('Error closing old socket:', err);
      }
    }
    const ws = new WebSocket('ws://127.0.0.1:8000/ws/terminal');
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'exit') {
          const cls = data.code === 0 ? 'exit-success' : 'exit-error';
          setLines((prev) => [...prev, { type: cls, content: `\n[Prozess beendet mit Code ${data.code}]` }]);
          setRunning(false);
        } else {
          setLines((prev) => [...prev, { type: data.type, content: data.content }]);
        }
      } catch {
        setLines((prev) => [...prev, { type: 'stdout', content: event.data }]);
      }
    };

    ws.onclose = () => {
      setRunning(false);
    };

    return ws;
  }, []);

  useEffect(() => {
    if (pendingCommand) {
      if (pendingCommand === '__CLEAR__') {
        setLines([{ type: 'system', content: 'Terminal cleared.' }]);
        onCommandExecuted();
      } else {
        setLines((prev) => [...prev, { type: 'system', content: `❯ ${pendingCommand}` }]);
        setRunning(true);
        const ws = connect();
        ws.onopen = () => {
          ws.send(pendingCommand);
        };
        onCommandExecuted();
      }
    }
  }, [pendingCommand, connect, onCommandExecuted]);

  const handleSubmit = () => {
    const cmd = input;
    if (running) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(cmd);
        setLines((prev) => [...prev, { type: 'stdout', content: cmd }]);
        setInput('');
      }
      return;
    }

    const trimmed = cmd.trim();
    if (!trimmed) return;

    setLines((prev) => [...prev, { type: 'system', content: `❯ ${trimmed}` }]);
    setInput('');
    setRunning(true);

    const ws = connect();
    ws.onopen = () => {
      ws.send(trimmed);
    };
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClear = () => {
    setLines([{ type: 'system', content: 'Terminal cleared.' }]);
  };

  return (
    <>
      <div className="terminal-output" ref={outputRef} onClick={() => inputRef.current?.focus()}>
        {lines.map((line, i) => (
          <div key={i} className={`terminal-line ${line.type}`}>
            {line.content}
          </div>
        ))}
      </div>
      <div className="terminal-input-row">
        <span className="terminal-prompt">❯</span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={running ? 'Eingabe an Prozess senden...' : 'Befehl eingeben...'}
          autoFocus
        />
      </div>
    </>
  );
}


// ─── Chat Tab (compact version for bottom panel) ─────────────
function ChatTab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const outputRef = useRef(null);

  const scrollToBottom = () => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinking]);

  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'status':
        if (data.content === 'Bereit') setThinking(false);
        break;
      case 'message':
        setThinking(false);
        setMessages((prev) => [...prev, { role: 'agent', content: data.content }]);
        break;
      case 'tool':
        setMessages((prev) => [...prev, { role: 'tool', content: data.content }]);
        break;
      case 'tool_result':
        setMessages((prev) => [...prev, { role: 'tool_result', content: data.content }]);
        break;
      case 'error':
        setThinking(false);
        setMessages((prev) => [...prev, { role: 'error', content: data.content }]);
        break;
    }
  }, []);

  const { sendMessage, status } = useWebSocket(handleMessage);

  const handleSend = () => {
    const val = input.trim();
    if (!val || status !== 'connected') return;
    setMessages((prev) => [...prev, { role: 'user', content: val }]);
    setInput('');
    setThinking(true);
    sendMessage(val);
  };

  return (
    <>
      <div className="bottom-chat-messages" ref={outputRef}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
            🤖 FableOS AI Chat — Frag mich etwas!
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`terminal-line ${msg.role === 'user' ? 'system' : msg.role === 'error' ? 'stderr' : 'stdout'}`}>
            {msg.role === 'user' && <strong style={{ color: 'var(--accent-cyan)' }}>Du: </strong>}
            {msg.role === 'agent' && <strong style={{ color: 'var(--accent-purple)' }}>FableOS: </strong>}
            {msg.role === 'tool' && <span style={{ color: 'var(--warning)' }}>⚙️ </span>}
            {msg.role === 'tool_result' && <span style={{ color: 'var(--success)' }}>📋 </span>}
            {msg.role === 'error' && <span>⚠️ </span>}
            <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
          </div>
        ))}
        {thinking && (
          <div className="terminal-line system" style={{ opacity: 0.6 }}>
            ● ● ● Denkt nach...
          </div>
        )}
      </div>
      <div className="bottom-chat-input-row">
        <input
          className="bottom-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={status === 'connected' ? 'Nachricht an FableOS...' : 'Verbindung wird hergestellt...'}
          disabled={status !== 'connected'}
        />
        <button
          className="bottom-chat-send"
          onClick={handleSend}
          disabled={status !== 'connected' || !input.trim()}
        >
          ➤
        </button>
      </div>
    </>
  );
}


// ─── Bottom Panel (Terminal + Chat Tabs) ─────────────────────
export default function BottomPanel({ height, onResize, pendingCommand, onCommandExecuted }) {
  const [activeTab, setActiveTab] = useState('terminal');
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  useEffect(() => {
    if (pendingCommand) {
      setActiveTab('terminal');
    }
  }, [pendingCommand]);

  // Drag to resize
  const handleMouseDown = (e) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.max(120, Math.min(600, startHeight.current + delta));
      onResize(newHeight);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="terminal-panel" style={{ height }}>
      <div className="resize-handle" onMouseDown={handleMouseDown} />
      <div className="terminal-header">
        <div className="terminal-header-tabs">
          <div
            className={`terminal-header-tab ${activeTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminal')}
          >
            🖥️ Terminal
          </div>
          <div
            className={`terminal-header-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            🤖 AI Chat
          </div>
        </div>
        <div className="terminal-header-actions">
          {activeTab === 'terminal' && (
            <button className="terminal-action-btn" title="Terminal löschen" onClick={() => {}}>
              🗑️
            </button>
          )}
        </div>
      </div>

      {activeTab === 'terminal' ? (
        <TerminalTab 
          pendingCommand={pendingCommand} 
          onCommandExecuted={onCommandExecuted} 
        />
      ) : (
        <ChatTab />
      )}
    </div>
  );
}
