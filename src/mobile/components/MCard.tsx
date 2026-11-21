import React from 'react';

interface MCardProps extends React.HTMLAttributes<HTMLDivElement> {
  flat?: boolean;
  interactive?: boolean;
}

/** Surface card. When `interactive` + onClick, behaves as an accessible button. */
export const MCard: React.FC<MCardProps> = ({
  flat = false,
  interactive = false,
  className = '',
  children,
  onClick,
  ...rest
}) => {
  const cls = ['m-card', flat ? 'm-card--flat' : '', interactive ? 'm-card--interactive' : '', className]
    .filter(Boolean)
    .join(' ');
  const isButton = interactive && Boolean(onClick);
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isButton) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.currentTarget.click();
    }
  };
  return (
    <div
      className={cls}
      onClick={onClick}
      role={isButton ? 'button' : undefined}
      tabIndex={isButton ? 0 : undefined}
      onKeyDown={handleKey}
      {...rest}
    >
      {children}
    </div>
  );
};