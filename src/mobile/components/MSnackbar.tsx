import React from 'react';
import { X } from 'lucide-react';

export type MSnackbarTone = 'neutral' | 'success' | 'danger';

interface MSnackbarProps {
  message: string;
  tone?: MSnackbarTone;
  icon?: React.ReactNode;
  onDismiss?: () => void;
}

/** Transient bottom toast above the nav. */
export const MSnackbar: React.FC<MSnackbarProps> = ({ message, tone = 'neutral', icon, onDismiss }) => (
  <div
    className={['m-snackbar', tone !== 'neutral' ? `m-snackbar--${tone}` : ''].filter(Boolean).join(' ')}
    role="status"
  >
    {icon}
    <span className="flex-grow-1">{message}</span>
    {onDismiss && (
      <button type="button" className="m-sheet__close" onClick={onDismiss} aria-label="بستن">
        <X size={16} />
      </button>
    )}
  </div>
);