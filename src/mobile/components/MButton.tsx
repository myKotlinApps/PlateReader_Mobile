import React from 'react';

export type MButtonVariant = 'primary' | 'tonal' | 'secondary' | 'text' | 'danger';

interface MButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: MButtonVariant;
  block?: boolean;
  small?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

/** Primary action button. Brand navy fill, lighter hover (theme rule 2/9). */
export const MButton: React.FC<MButtonProps> = ({
  variant = 'primary',
  block = false,
  small = false,
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}) => {
  const cls = ['m-btn', `m-btn--${variant}`, block ? 'm-btn--block' : '', small ? 'm-btn--sm' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
};