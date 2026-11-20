import React from 'react';

interface MStateProps {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}

/** Centered empty-state with optional icon and action. */
export const MEmptyState: React.FC<MStateProps> = ({ icon, title, desc, action }) => (
  <div className="m-state">
    {icon && <span className="m-state__icon">{icon}</span>}
    <div className="m-state__title">{title}</div>
    {desc && <div className="m-state__desc">{desc}</div>}
    {action}
  </div>
);

/** Error-state variant (caller supplies a danger icon + retry action). */
export const MErrorState: React.FC<MStateProps> = (props) => <MEmptyState {...props} />;