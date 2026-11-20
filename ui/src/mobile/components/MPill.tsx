import React from 'react';

export type MPillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

interface MPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: MPillTone;
  icon?: React.ReactNode;
}

/** Rounded status badge / chip. Container tones keep dark text on light fills. */
export const MPill: React.FC<MPillProps> = ({ tone = 'neutral', icon, children, className = '', ...rest }) => {
  const cls = ['m-pill', tone !== 'neutral' ? `m-pill--${tone}` : '', className].filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      {icon}
      {children}
    </span>
  );
};