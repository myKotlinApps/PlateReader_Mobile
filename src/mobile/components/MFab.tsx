import React from 'react';

interface MFabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

/** Floating action button anchored above the bottom nav (thumb zone). */
export const MFab: React.FC<MFabProps> = ({ icon, children, className = '', type = 'button', ...rest }) => (
  <button type={type} className={['m-fab', className].filter(Boolean).join(' ')} {...rest}>
    {icon}
    {children}
  </button>
);