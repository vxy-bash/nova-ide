import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './ChatMessage.css';

const AVATARS = {
  user: '👤',
  agent: 'F',
  tool: '⚙️',
  tool_result: '📋',
  error: '⚠️',
};

const LABELS = {
  tool: 'Tool Ausführung',
  tool_result: 'Ergebnis',
  error: 'Fehler',
};

export default function ChatMessage({ message }) {
  const { role, content, toolName, toolArgs } = message;

  // Custom code block renderer with syntax highlighting
  const codeRenderer = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    if (!inline && match) {
      return (
        <SyntaxHighlighter
          style={atomDark}
          language={match[1]}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: '14px 16px',
            background: 'rgba(0, 0, 0, 0.4)',
            fontSize: '13px',
            borderRadius: 0,
          }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  };

  return (
    <div className={`message-wrapper ${role}`}>
      <div className="message-avatar">{AVATARS[role] || '💬'}</div>
      <div className="message-bubble">
        {LABELS[role] && <div className="message-label">{LABELS[role]}</div>}

        <div className="message-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{ code: codeRenderer }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {role === 'tool' && toolArgs && Object.keys(toolArgs).length > 0 && (
          <div className="tool-details">
            {JSON.stringify(toolArgs, null, 2)}
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="message-wrapper agent">
      <div className="message-avatar">F</div>
      <div className="message-bubble">
        <div className="typing-indicator">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}
