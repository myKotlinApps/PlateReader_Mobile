import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';

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
  tone?: 'danger' | 'warning' | 'primary' | 'success';
  icon: React.ReactNode;
  durationMs?: number;
  onAction?: () => void;
  onDismiss?: () => void;
}

interface MBottomNavProps {
  items: MBottomNavItem[];
  active: string;
  onChange: (id: string) => void;
  /** Detached Digikala-style circular 56px Floating Action Button next to the capsule dock */
  fabItem?: MBottomNavItem | null;
  /** Stacked Digikala-style floating alarm pills above the dock (newest on top, independent 5s auto-dismiss) */
  alarms?: MDockAlarm[];
  /** Legacy single-alarm prop (merged automatically if provided) */
  alarm?: MDockAlarm | null;
  /** Honors user's accessibility Reduce Motion preference */
  reduceMotion?: boolean;
  /** True only on /m/chat so alarm pill matches chat positioning */
  isChatRoute?: boolean;
  /** Completely hides the bottom floating dock capsule + FAB (used in full-screen Chat mode) */
  hideDock?: boolean;
}

/**
 * Digikala Mobile Floating Dock Stack:
 * 1. Optional Stacked Floating Alarm Capsules above the dock (newest on top, independent 5s auto-dismiss):
 *    - Tap anywhere on an alarm pill to open/navigate directly (no "بررسی >" CTA button clutter)
 *    - Subtle translucent frosted glass matching the dock equally
 * 2. Floating 56px Full-Pill Navigation Dock + Detached 56px Violet-Blue Circular FAB
 */
export const MBottomNav: React.FC<MBottomNavProps> = ({
  items,
  active,
  onChange,
  fabItem,
  alarms,
  alarm,
  reduceMotion = false,
  isChatRoute = false,
  hideDock = false,
}) => {
  const stackedAlarms: MDockAlarm[] =
    alarms && alarms.length > 0 ? alarms : alarm ? [alarm] : [];

  const alarmStackNode = (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <div
        className={`dk-alarm-wrap ${isChatRoute ? 'dk-alarm-wrap--chat' : ''}`}
        dir="rtl"
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="dk-alarm-stack">
          <AnimatePresence mode="popLayout" initial={false}>
            {stackedAlarms.map((item, idx) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.91 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: idx === 0 ? 1 : Math.max(0.96, 1 - idx * 0.018),
                  transition: {
                    type: 'spring',
                    stiffness: 430,
                    damping: 30,
                    mass: 0.82,
                  },
                }}
                exit={{
                  opacity: 0,
                  y: -10,
                  scale: 0.93,
                  transition: {
                    duration: 0.2,
                    ease: [0.32, 0, 0.67, 0],
                  },
                }}
                className="dk-alarm-pill relative overflow-hidden"
                role={item.tone === 'danger' ? 'alert' : 'status'}
                aria-label={item.title}
              >
                <button
                  type="button"
                  onClick={() => (item.onAction ? item.onAction() : item.onDismiss?.())}
                  className="dk-alarm-pill__main"
                >
                  <span
                    className={`dk-alarm-pill__avatar ${
                      item.tone === 'danger'
                        ? 'dk-alarm-pill__avatar--danger'
                        : item.tone === 'warning'
                          ? 'dk-alarm-pill__avatar--warning'
                          : item.tone === 'success'
                            ? 'dk-alarm-pill__avatar--success'
                            : 'dk-alarm-pill__avatar--primary'
                    }`}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>

                  <span className="dk-alarm-pill__copy">
                    <strong className="dk-alarm-pill__title">{item.title}</strong>
                    <span className="dk-alarm-pill__sub">{item.subtitle}</span>
                  </span>
                </button>

                {item.onDismiss && (
                  <button
                    type="button"
                    onClick={item.onDismiss}
                    className="dk-alarm-pill__close"
                    aria-label="بستن اعلان"
                    title="بستن"
                  >
                    <X size={14} strokeWidth={2.2} />
                  </button>
                )}

                {typeof item.durationMs === 'number' && item.durationMs > 0 && (
                  <motion.span
                    key={`${item.id}-bar`}
                    aria-hidden="true"
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: 0 }}
                    transition={{
                      duration: item.durationMs / 1000,
                      ease: 'linear',
                    }}
                    style={{ transformOrigin: 'right center' }}
                    className={`dk-alarm-pill__progress ${
                      item.tone === 'danger'
                        ? 'dk-alarm-pill__progress--danger'
                        : item.tone === 'warning'
                          ? 'dk-alarm-pill__progress--warning'
                          : item.tone === 'success'
                            ? 'dk-alarm-pill__progress--success'
                            : 'dk-alarm-pill__progress--primary'
                    }`}
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );

  return (
    <>
      {typeof document !== 'undefined' ? createPortal(alarmStackNode, document.body) : alarmStackNode}
      {!hideDock && (
        <div className="dk-dock-wrap">
          <div className="dk-dock-stack">
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
      )}
    </>
  );
};