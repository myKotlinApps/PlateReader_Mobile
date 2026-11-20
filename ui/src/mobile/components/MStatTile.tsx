import React from 'react';

interface MStatTileProps {
  value: React.ReactNode;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
}

/** KPI tile with tabular numerals (fa-IR formatted by the caller). */
export const MStatTile: React.FC<MStatTileProps> = ({ value, label, icon, onClick }) => {
  const interactive = Boolean(onClick);
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.currentTarget.click();
    }
  };
  return (
    <div
      className={['m-stat-tile', interactive ? 'm-card--interactive' : ''].filter(Boolean).join(' ')}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={handleKey}
    >
      {icon && <span className="m-stat-tile__icon">{icon}</span>}
      <span className="m-stat-tile__value">{value}</span>
      <span className="m-stat-tile__label">{label}</span>
    </div>
  );
};