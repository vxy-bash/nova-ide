import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownPreview({ content }) {
  return (
    <div style={{
      flex: 1,
      padding: '24px',
      overflowY: 'auto',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      borderLeft: '1px solid var(--border-subtle)',
      fontSize: '14px',
      lineHeight: '1.6',
      fontFamily: 'var(--font-sans)'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
