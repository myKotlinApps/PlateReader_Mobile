import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface SubMenuTabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
}

/**
 * Unified soft-tonal horizontal segmented sub-menu.
 * Incorporates tactile press feedback (Emil Design Engineering) & strict focus-visible rings (Vercel).
 */
export const SubMenuTabs: React.FC<{
  items: SubMenuTabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}> = ({ items, active, onChange, className = '' }) => {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const activeBtn = listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    activeBtn?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
  }, [active]);

  return (
    <div
      ref={listRef}
      role="tablist"
      className={`bg-surface-container-low rounded-2xl p-1 shadow-[inset_0_0_0_1px_rgba(27,37,51,0.06)] flex items-center gap-1 overflow-x-auto no-scrollbar ${className}`}
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={`shrink-0 h-9 px-3 rounded-xl text-[13px] flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-[0.97] transition-[transform,background-color,color,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              isActive
                ? 'bg-surface-container-lowest text-on-primary-container font-bold shadow-[var(--shadow-surface-ring)]'
                : 'text-on-surface-variant font-medium hover:text-on-surface hover:bg-surface-container-lowest/50'
            }`}
          >
            {item.icon && (
              <span
                className={`material-symbols-outlined text-[17px] ${
                  isActive ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
            {typeof item.badge === 'number' && item.badge > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold font-numeric-stat leading-none ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {item.badge.toLocaleString('fa-IR')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/** Unified section heading — balanced 14px Persian SemiBold. */
export const SectionHeader: React.FC<{
  title: string;
  icon?: string;
  action?: React.ReactNode;
}> = ({ title, icon, action }) => (
  <div className="flex items-center justify-between gap-2 px-0.5">
    <div className="flex items-center gap-2 min-w-0">
      {icon && (
        <span className="material-symbols-outlined text-[18px] text-primary/80 shrink-0">
          {icon}
        </span>
      )}
      <h2 className="text-[14px] font-bold text-on-surface mb-0 truncate leading-snug">{title}</h2>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/**
 * Unified clean white surface card.
 * Uses layered hairline shadow instead of harsh border+shadow (Emil Design Engineering).
 */
export const SurfaceCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <section
    className={`bg-surface-container-lowest rounded-2xl p-4 shadow-[var(--shadow-surface-ring)] ${className}`}
  >
    {children}
  </section>
);

/**
 * Architectural Hero Summary Card (Anti UI Slop + Anthropic + Taste Skill):
 * - Eliminates generic AI gradients and "cards-within-cards" boxed inner tiles.
 * - Uses a calm solid tonal header band + unified hairline-divided 3-column tabular KPI strip.
 */
export const HeroSummaryCard: React.FC<{
  title: string;
  subtitle?: string;
  badge?: string;
  stats: Array<{ label: string; value: string; accent?: 'default' | 'positive' | 'danger' }>;
}> = ({ title, subtitle, badge, stats }) => (
  <section className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[var(--shadow-surface-ring)]">
    <div className="bg-primary-container/35 px-4 py-3.5 flex items-center justify-between gap-2.5 border-b border-outline-variant/35">
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-bold text-on-surface mb-0 truncate leading-snug">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[12.5px] text-on-surface-variant mb-0 mt-0.5 truncate leading-normal">
            {subtitle}
          </p>
        )}
      </div>
      {badge && (
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold text-on-primary-container whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/75 shrink-0" aria-hidden="true" />
          <span>{badge}</span>
        </span>
      )}
    </div>

    <div className="grid grid-cols-3 divide-x divide-x-reverse divide-outline-variant/40 bg-surface-container-lowest">
      {stats.map((st, idx) => (
        <div key={idx} className="px-2 py-3 text-center min-w-0">
          <span
            className={`block text-[14.5px] font-bold font-numeric-stat leading-snug truncate ${
              st.accent === 'positive'
                ? 'text-secondary'
                : st.accent === 'danger'
                  ? 'text-error'
                  : 'text-on-surface'
            }`}
          >
            {st.value}
          </span>
          <span className="text-[11.5px] text-on-surface-variant block mt-0.5 truncate leading-snug">
            {st.label}
          </span>
        </div>
      ))}
    </div>
  </section>
);

/** Unified soft pastel notice / alert banner with aria-live politeness & entrance motion. */
export const NoticeBanner: React.FC<{
  message: string;
  tone?: 'info' | 'success' | 'danger';
  onClose?: () => void;
}> = ({ message, tone = 'info', onClose }) => (
  <div
    role="status"
    aria-live="polite"
    aria-atomic="true"
    className={`m-panel-in rounded-xl px-3.5 py-2.5 text-[13px] font-medium flex items-center justify-between gap-2 border ${
      tone === 'danger'
        ? 'bg-error-container border-error/20 text-on-error-container'
        : tone === 'success'
          ? 'bg-secondary-container border-secondary/20 text-on-secondary-container'
          : 'bg-primary-container/60 border-primary/15 text-on-primary-container'
    }`}
  >
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={`material-symbols-outlined text-[19px] shrink-0 ${
          tone === 'danger' ? 'text-error' : tone === 'success' ? 'text-secondary' : 'text-primary'
        }`}
      >
        {tone === 'danger' ? 'error' : tone === 'success' ? 'check_circle' : 'info'}
      </span>
      <span className="leading-relaxed line-clamp-2">{message}</span>
    </div>
    {onClose && (
      <button
        type="button"
        aria-label="بستن پیام"
        onClick={onClose}
        className="w-9 h-9 rounded-full hover:bg-black/5 active:scale-[0.94] transition-transform flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="material-symbols-outlined text-[17px]">close</span>
      </button>
    )}
  </div>
);

/**
 * Unified soft-palette button with tactile press feedback (scale 0.97)
 * and strict keyboard focus-visible rings.
 */
export const StitchButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md';
    icon?: string;
  }
> = ({ variant = 'primary', size = 'md', icon, children, className = '', ...rest }) => {
  const sizeCls =
    size === 'sm' ? 'h-9 px-3 text-[12.5px] rounded-xl' : 'h-10 px-4 text-[13px] rounded-xl';
  const variantCls =
    variant === 'primary'
      ? 'bg-primary text-on-primary hover:bg-primary/90 shadow-xs'
      : variant === 'danger'
        ? 'bg-error-container text-on-error-container hover:bg-error-container/80 border border-error/15'
        : variant === 'ghost'
          ? 'bg-transparent text-primary hover:bg-primary-container/50'
          : 'bg-surface-container-low text-on-surface shadow-[inset_0_0_0_1px_rgba(27,37,51,0.08)] hover:bg-surface-container';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap active:scale-[0.97] transition-[transform,background-color,color,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-1 disabled:opacity-50 disabled:active:scale-100 ${sizeCls} ${variantCls} ${className}`}
      {...rest}
    >
      {icon && <span className="material-symbols-outlined text-[17px]">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

/**
 * Ultra-quiet semantic status indicator (Anthropic Zero-Pill + Taste Skill):
 * Restrained status dot + crisp 12px Persian label — zero loud badge clutter.
 */
export const StatusPill: React.FC<{
  label: string;
  tone?: 'neutral' | 'primary' | 'positive' | 'danger';
}> = ({ label, tone = 'neutral' }) => {
  const textCls =
    tone === 'positive'
      ? 'text-on-secondary-container bg-secondary-container/55'
      : tone === 'danger'
        ? 'text-on-error-container bg-error-container/75'
        : tone === 'primary'
          ? 'text-on-primary-container bg-primary-container/55'
          : 'text-on-surface-variant bg-surface-container-low';
  const dotCls =
    tone === 'positive'
      ? 'bg-secondary'
      : tone === 'danger'
        ? 'bg-error'
        : tone === 'primary'
          ? 'bg-primary'
          : 'bg-outline';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[12px] font-medium whitespace-nowrap ${textCls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

/**
 * Reusable calm Empty State (Anti UI Slop + Vercel Web Design Guidelines).
 * Always gives users a clear explanation and a direct recovery action.
 */
export const EmptyState: React.FC<{
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon, title, description, actionLabel, onAction }) => (
  <SurfaceCard className="py-8 px-5 text-center flex flex-col items-center gap-2 m-panel-in">
    <span className="w-11 h-11 rounded-2xl bg-surface-container-low text-on-surface-variant flex items-center justify-center">
      <span className="material-symbols-outlined text-[22px]">{icon}</span>
    </span>
    <h3 className="text-[14px] font-bold text-on-surface mb-0 mt-1">{title}</h3>
    {description && (
      <p className="text-[13px] text-on-surface-variant mb-0 max-w-xs leading-relaxed">
        {description}
      </p>
    )}
    {actionLabel && onAction && (
      <div className="pt-2">
        <StitchButton variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </StitchButton>
      </div>
    )}
  </SurfaceCard>
);

/**
 * Animated Dialog / Bottom Sheet (Emil Design Engineering + Vercel):
 * - Enters from translateY(10px) scale(0.97) over 200ms ease-out-quart (never scale(0)).
 * - Supports Escape key dismissal, backdrop tap-to-close, and 44px accessible close button.
 */
export const StitchModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  titleTone?: 'default' | 'danger';
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, titleTone = 'default', children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const modalNode = (
    <div
      dir="rtl"
      className="fixed inset-0 z-[1100] bg-slate-900/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center px-3 pt-16 pb-[calc(94px+env(safe-area-inset-bottom,0px))] m-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md p-4 shadow-floating space-y-3 max-h-[calc(100dvh-134px)] overflow-y-auto m-sheet-in">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3
              className={`text-[14.5px] font-bold mb-0 leading-snug ${
                titleTone === 'danger' ? 'text-error' : 'text-on-surface'
              }`}
            >
              {title}
            </h3>
            {subtitle && (
              <span className="text-[12.5px] text-on-surface-variant block mt-0.5 truncate">
                {subtitle}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="بستن"
            onClick={onClose}
            className="w-10 h-10 -mt-1 -ml-1 rounded-full hover:bg-surface-container-low active:scale-[0.93] transition-transform flex items-center justify-center shrink-0 text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span className="material-symbols-outlined text-[19px]">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};
