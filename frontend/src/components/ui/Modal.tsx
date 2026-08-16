import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Full-bleed content modal (e.g. project detail) with floating close button. */
  detail?: boolean;
}

/** Accessible modal: role=dialog, ESC close, click-outside, focus trap, scroll lock. */
export default function Modal({ open, onClose, title, children, footer, wide, detail }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Notify the app shell (e.g. bottom nav) that a full-screen modal is open.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ui:modal', { detail: open }));
    return () => {
      window.dispatchEvent(new CustomEvent('ui:modal', { detail: false }));
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const dialogClass = detail ? 'modal modal-detail' : wide ? 'modal modal-wide' : 'modal';

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className={dialogClass}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Dialog'}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!detail && (
          <div className="modal-header">
            <h3>{title}</h3>
            <button className="modal-close" aria-label="Yopish" onClick={onClose}>
              ×
            </button>
          </div>
        )}
        <div className={detail ? 'modal-detail-body' : 'modal-body'}>{children}</div>
        {footer && !detail && <div className="modal-footer">{footer}</div>}
        {detail && (
          <button className="modal-detail-close" aria-label="Yopish" onClick={onClose}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}
