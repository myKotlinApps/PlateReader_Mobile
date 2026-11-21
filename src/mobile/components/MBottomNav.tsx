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

/** Modern floating translucent Material 3 dock with soft tonal active indicator. */
export const MBottomNav: React.FC<MBottomNavProps> = ({ items, active, onChange }) => (
  <div className="m-dock-wrap">
    <nav className="alpr-mobile-bottom-nav" aria-label="منوی اصلی">
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
            <span className="m-nav-btn__pill">
              {item.icon}
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="m-nav-btn__badge">
                  {item.badge > 99 ? '۹۹+' : item.badge.toLocaleString('fa-IR')}
                </span>
              )}
            </span>
            <span className="alpr-mobile-nav-btn__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  </div>
);