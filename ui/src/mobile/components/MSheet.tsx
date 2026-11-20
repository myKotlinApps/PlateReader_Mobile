import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface MSheetProps {
  open: boolean;
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Bottom sheet modal: scrim dismiss, Escape close, body scroll lock. */
export const MSheet: React.FC<MSheetProps> = ({ open, title, onClose, children, footer }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="m-sheet-scrim" onClick={onClose}>
      <div className="m-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="m-sheet__handle" />
        <div className="m-sheet__header">
          <div className="m-sheet__title">{title}</div>
          <button type="button" className="m-sheet__close" onClick={onClose} aria-label="بستن">
            <X size={18} />
          </button>
        </div>
        <div className="m-sheet__body">{children}</div>
        {footer && <div className="m-sheet__header">{footer}</div>}
      </div>
    </div>
  );
};