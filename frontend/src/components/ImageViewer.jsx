export default function ImageViewer({ filePath }) {
  const fileUrl = `http://127.0.0.1:8000/api/file/raw?path=${encodeURIComponent(filePath)}`;
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      background: 'var(--bg-primary)',
      padding: '24px',
      overflow: 'auto',
      color: 'var(--text-secondary)'
    }}>
      <div style={{
        padding: '16px',
        background: 'var(--surface-glass)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      }}>
        <img 
          src={fileUrl} 
          alt={filePath} 
          style={{ 
            maxWidth: '100%', 
            maxHeight: '65vh', 
            objectFit: 'contain', 
            borderRadius: '4px',
            boxShadow: 'var(--shadow-md)' 
          }} 
        />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', marginTop: '8px' }}>
          {filePath}
        </div>
      </div>
    </div>
  );
}
