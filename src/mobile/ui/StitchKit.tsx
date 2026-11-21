import React from 'react';

export interface SubMenuTabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
}

/**
 * Unified soft-tonal horizontal segmented sub-menu.
 * Uses calm neutral track + crisp white active pill (Material 3 / modern mobile aesthetic).
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
      className={`bg-surface-container-low rounded-2xl p-1 border border-outline-variant/45 flex items-center gap-1 overflow-x-auto no-scrollbar ${className}`}
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
            className={`shrink-0 h-9 px-3 rounded-xl text-[13px] flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              isActive
                ? 'bg-surface-container-lowest text-on-primary-container font-bold shadow-card border border-outline-variant/35'
                : 'text-on-surface-variant font-medium hover:text-on-surface'
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

/** Unified clean white surface card with subtle hairline border. */
export const SurfaceCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <section
    className={`bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/45 shadow-card ${className}`}
  >
    {children}
  </section>
);

/**
 * Unified Soft Pastel Hero Summary Card.
 * Replaces harsh heavy navy blocks with calm tinted Material 3 surface & balanced Persian type.
 */
export const HeroSummaryCard: React.FC<{
  title: string;
  subtitle?: string;
  badge?: string;
  stats: Array<{ label: string; value: string; accent?: 'default' | 'positive' | 'danger' }>;
}> = ({ title, subtitle, badge, stats }) => (
  <section className="bg-gradient-to-l from-primary-container/65 via-surface-container-low to-surface-container-lowest rounded-2xl p-4 border border-outline-variant/50 shadow-card">
    <div className="flex items-center justify-between gap-2 mb-3">
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
        <span className="shrink-0 px-2.5 py-1 rounded-lg bg-surface-container-lowest/90 border border-outline-variant/45 text-[12px] font-semibold text-on-primary-container whitespace-nowrap">
          {badge}
        </span>
      )}
    </div>
    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-outline-variant/40">
      {stats.map((st, idx) => (
        <div
          key={idx}
          className="bg-surface-container-lowest/85 rounded-xl px-1.5 py-2.5 text-center border border-outline-variant/30 min-w-0"
        >
          <span
            className={`block text-[14px] font-bold font-numeric-stat leading-snug truncate ${
              st.accent === 'positive'
                ? 'text-secondary'
                : st.accent === 'danger'
                  ? 'text-error'
                  : 'text-on-primary-container'
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

/** Unified soft pastel notice / alert banner — 13px legible Persian body. */
export const NoticeBanner: React.FC<{
  message: string;
  tone?: 'info' | 'success' | 'danger';
  onClose?: () => void;
}> = ({ message, tone = 'info', onClose }) => (
  <div
    role="alert"
    className={`rounded-xl px-3.5 py-2.5 text-[13px] font-medium flex items-center justify-between gap-2 border ${
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
        className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center shrink-0"
      >
        <span className="material-symbols-outlined text-[17px]">close</span>
      </button>
    )}
  </div>
);

/** Unified soft-palette button with identical height, radius, and Persian typography. */
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
          : 'bg-surface-container-low text-on-surface border border-outline-variant/45 hover:bg-surface-container';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 font-semibold transition-colors disabled:opacity-50 whitespace-nowrap ${sizeCls} ${variantCls} ${className}`}
      {...rest}
    >
      {icon && <span className="material-symbols-outlined text-[17px]">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

/** Unified quiet status indicator — readable 12px Persian, soft pastel tint. */
export const StatusPill: React.FC<{
  label: string;
  tone?: 'neutral' | 'primary' | 'positive' | 'danger';
}> = ({ label, tone = 'neutral' }) => {
  const cls =
    tone === 'positive'
      ? 'bg-secondary-container/80 text-on-secondary-container'
      : tone === 'danger'
        ? 'bg-error-container text-on-error-container'
        : tone === 'primary'
          ? 'bg-primary-container/75 text-on-primary-container'
          : 'bg-surface-container-low text-on-surface-variant';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[12px] font-medium whitespace-nowrap ${cls}`}
    >
      {label}
    </span>
  );
};
