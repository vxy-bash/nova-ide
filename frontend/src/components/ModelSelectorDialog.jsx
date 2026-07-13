import './ModelSelectorDialog.css';

const MODELS = [
  { id: 'claude-fable-5', name: 'Claude Fable 5', provider: 'Anthropic', badge: 'Flagship', type: 'premium' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', badge: 'Smart & Fast', type: 'premium' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', badge: 'High Quality', type: 'premium' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', badge: 'Large Context', type: 'premium' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google', badge: 'Ultra Fast', type: 'fast' }
];

export default function ModelSelectorDialog({ open, onClose, activeModel, onSelect }) {
  if (!open) return null;

  return (
    <div className="model-dialog-overlay" onClick={onClose}>
      <div className="model-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="model-dialog-header">
          <div className="model-dialog-title">KI-Modell auswählen</div>
          <button className="model-dialog-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="model-list">
          {MODELS.map((m) => (
            <div 
              key={m.id} 
              className={`model-item ${activeModel === m.id ? 'active' : ''}`}
              onClick={() => {
                onSelect(m.id);
                onClose();
              }}
            >
              <div className="model-info">
                <span className="model-name">{m.name}</span>
                <span className="model-provider">{m.provider}</span>
              </div>
              <span className={`model-badge ${m.type}`}>
                {m.badge}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
