import React from 'react';

export interface MBottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface MBottomNavProps {
  items: MBottomNavItem[];
  active: string;
  onChange: (id: string) => void;
}

/** M3-style bottom navigation with active-pill indicator and optional badges. */
export const MBottomNav: React.FC<MBottomNavProps> = ({ items, active, onChange }) => (
  <nav className="alpr-mobile-bottom-nav" aria-label="منوی موبایل">
    {items.map((item) => {
      const isActive = item.id === active;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`alpr-mobile-nav-btn ${isActive ? 'is-active' : ''}`}
          aria-current={isActive ? 'page' : undefined}
        >
          <span className="m-nav-btn__icon">
            {item.icon}
            {typeof item.badge === 'number' && item.badge > 0 && (
              <span className="m-nav-btn__badge">{item.badge > 99 ? '99+' : item.badge.toLocaleString('fa-IR')}</span>
            )}
          </span>
          <span>{item.label}</span>
        </button>
      );
    })}
  </nav>
);