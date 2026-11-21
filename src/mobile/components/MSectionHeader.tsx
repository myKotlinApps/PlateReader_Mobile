import React from 'react';

interface MSectionHeaderProps {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}

/** Section title row with optional subtitle and trailing action. */
export const MSectionHeader: React.FC<MSectionHeaderProps> = ({ title, sub, action }) => (
  <div className="m-section-header">
    <div>
      <div className="m-section-header__title">{title}</div>
      {sub && <div className="m-section-header__sub">{sub}</div>}
    </div>
    {action}
  </div>
);