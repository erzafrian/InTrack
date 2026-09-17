import { useRef } from 'react';
import { Upload } from 'lucide-react';

export default function FileUpload({ onFileSelect, accept = 'image/jpeg,image/png,image/webp,application/pdf' }) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border-2 border-dashed transition-all text-sm cursor-pointer group"
      style={{
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-secondary)',
        boxShadow: 'var(--shadow-inset)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary-200)'; e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = ''; }}
    >
      <Upload size={16} style={{ color: 'var(--color-text-muted)' }} />
      <span>Upload file</span>
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
    </button>
  );
}
