import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
      .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  };

  const modalMarkup = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="modal-overlay" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={handleKeyDown} className="modal-content w-full sm:max-w-lg relative z-10 flex flex-col max-h-[90vh]">
        <div className="modal-header">
          <h2 id={titleId} className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}
