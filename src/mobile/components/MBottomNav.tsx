import React from 'react';
import { ChevronLeft, X } from 'lucide-react';

export interface MBottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  /** Shows a subtle Digikala-style crimson status dot without a number */
  dot?: boolean;
}

export interface MDockAlarm {
  id: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  tone?: 'danger' | 'warning' | 'primary';
  icon: React.ReactNode;
  onAction: () => void;
  onDismiss?: () => void;
}

interface MBottomNavProps {
  items: MBottomNavItem[];
  active: string;
  onChange: (id: string) => void;
  /** Detached Digikala-style circular 56px Floating Action Button next to the capsule dock */
  fabItem?: MBottomNavItem | null;
  /** Digikala-style floating white alarm/banner pill stacked directly above the dock */
  alarm?: MDockAlarm | null;
}

/**
 * Exact Digikala Mobile Floating Dock Stack:
 * 1. Optional Floating Alarm Capsule stacked directly above the dock (10px gap):
 *    - Circular soft-tinted icon badge on right, 2-line title/subtitle, action + chevron on left
 * 2. Floating 56px White Full-Pill Navigation Dock + Detached 56px Violet-Blue Circular FAB:
 *    - 48x48px circular icon buttons, active gets soft #f1f2f5 halo + high-contrast #1f1f1f icon
 *    - Inactive icons in #848484 with Digikala crimson count badge / dot
 */
export const MBottomNav: React.FC<MBottomNavProps> = ({
  items,
  active,
  onChange,
  fabItem,
  alarm,
}) => (
  <div className="dk-dock-wrap">
    <div className="dk-dock-stack">
      {alarm && (
        <div
          className="dk-alarm-pill m-panel-in"
          role="region"
          aria-label="هشدار فوری مجتمع"
        >
          <button
            type="button"
            onClick={alarm.onAction}
            className="dk-alarm-pill__main"
          >
            <span
              className={`dk-alarm-pill__avatar ${
                alarm.tone === 'danger'
                  ? 'dk-alarm-pill__avatar--danger'
                  : alarm.tone === 'warning'
                    ? 'dk-alarm-pill__avatar--warning'
                    : 'dk-alarm-pill__avatar--primary'
              }`}
              aria-hidden="true"
            >
              {alarm.icon}
            </span>

            <span className="dk-alarm-pill__copy">
              <strong className="dk-alarm-pill__title">{alarm.title}</strong>
              <span className="dk-alarm-pill__sub">{alarm.subtitle}</span>
            </span>

            <span className="dk-alarm-pill__cta">
              <span>{alarm.actionLabel}</span>
              <ChevronLeft size={16} strokeWidth={2.2} />
            </span>
          </button>

          {alarm.onDismiss && (
            <button
              type="button"
              onClick={alarm.onDismiss}
              className="dk-alarm-pill__close"
              aria-label="بستن هشدار"
              title="بستن"
            >
              <X size={14} strokeWidth={2.2} />
            </button>
          )}
        </div>
      )}

      <div className="dk-dock-row">
        <nav className="dk-dock-pill" aria-label="منوی اصلی">
          {items.map((item) => {
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={`dk-dock-item ${isActive ? 'is-active' : ''}`}
                aria-label={item.label}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="dk-dock-item__icon">
                  {item.icon}
                  {typeof item.badge === 'number' && item.badge > 0 ? (
                    <span className="dk-dock-badge">
                      {item.badge > 99 ? '۹۹+' : item.badge.toLocaleString('fa-IR')}
                    </span>
                  ) : item.dot ? (
                    <span className="dk-dock-dot" aria-hidden="true" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>

        {fabItem && (
          <button
            type="button"
            onClick={() => onChange(fabItem.id)}
            className={`dk-dock-fab ${fabItem.id === active ? 'is-active' : ''}`}
            aria-label={fabItem.label}
            title={fabItem.label}
            aria-current={fabItem.id === active ? 'page' : undefined}
          >
            <span className="dk-dock-fab__icon">
              {fabItem.icon}
              {typeof fabItem.badge === 'number' && fabItem.badge > 0 && (
                <span className="dk-dock-badge dk-dock-badge--fab">
                  {fabItem.badge > 99 ? '۹۹+' : fabItem.badge.toLocaleString('fa-IR')}
                </span>
              )}
            </span>
          </button>
        )}
      </div>
    </div>
  </div>
);