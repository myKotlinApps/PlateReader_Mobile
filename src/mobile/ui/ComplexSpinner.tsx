import React, { useEffect, useRef, useState } from 'react';

/* ---------------------------------------------------------------------------
 * Global real-world network fetch tracker (used by remoteTransport + MobileShell)
 * Tracks active async API calls so slow fetches automatically display the
 * residential complex loader without flickering on instant local responses.
 * --------------------------------------------------------------------------- */
type Listener = (count: number) => void;
let activeFetchCount = 0;
const listeners = new Set<Listener>();

function emitFetchCount() {
  for (const listener of listeners) {
    listener(activeFetchCount);
  }
}

export function beginNetworkFetch(): void {
  activeFetchCount += 1;
  emitFetchCount();
}

export function endNetworkFetch(): void {
  activeFetchCount = Math.max(0, activeFetchCount - 1);
  emitFetchCount();
}

export function useGlobalFetchCount(): number {
  const [count, setCount] = useState(activeFetchCount);
  useEffect(() => {
    const onUpdate: Listener = (next) => setCount(next);
    listeners.add(onUpdate);
    setCount(activeFetchCount);
    return () => {
      listeners.delete(onUpdate);
    };
  }, []);
  return count;
}

/**
 * Smart anti-flicker delayed loader hook:
 * - Waits `delayMs` before showing so ultra-fast responses (<150ms) never flash.
 * - Once shown, stays visible at least `minVisibleMs` so the animation completes smoothly.
 */
export function useDelayedLoading(
  isLoading: boolean,
  delayMs = 150,
  minVisibleMs = 360,
): boolean {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    let showTimer: number | undefined;
    let hideTimer: number | undefined;

    if (isLoading) {
      if (!visible) {
        if (delayMs <= 0) {
          shownAtRef.current = Date.now();
          setVisible(true);
        } else {
          showTimer = window.setTimeout(() => {
            shownAtRef.current = Date.now();
            setVisible(true);
          }, delayMs);
        }
      }
    } else if (visible) {
      const elapsed = shownAtRef.current ? Date.now() - shownAtRef.current : minVisibleMs;
      const remaining = Math.max(0, minVisibleMs - elapsed);
      hideTimer = window.setTimeout(() => {
        shownAtRef.current = null;
        setVisible(false);
      }, remaining);
    }

    return () => {
      if (showTimer) window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [isLoading, visible, delayMs, minVisibleMs]);

  return visible;
}

/* ---------------------------------------------------------------------------
 * Bespoke Architectural Residential Complex / Block SVG Spinner
 * Features 3 blocks (A, B, C) of مجتمع مسکونی نیلوفر with sequentially
 * illuminated apartment windows and a calm orbital progress ring.
 * --------------------------------------------------------------------------- */
export interface ComplexSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
  className?: string;
}

export const ComplexSpinner: React.FC<ComplexSpinnerProps> = ({
  size = 'md',
  label,
  sublabel,
  className = '',
}) => {
  const dim = size === 'sm' ? 46 : size === 'lg' ? 84 : 68;

  return (
    <div
      className={`inline-flex flex-col items-center justify-center gap-2.5 text-center select-none ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label || 'در حال دریافت اطلاعات'}
    >
      <div
        className="relative flex items-center justify-center rounded-full bg-surface-container-lowest shadow-[var(--shadow-surface-ring)]"
        style={{ width: dim, height: dim }}
      >
        {/* Outer architectural rotating progress ring */}
        <svg
          width={dim}
          height={dim}
          viewBox="0 0 80 80"
          fill="none"
          className="absolute inset-0 complex-ring-spin"
          aria-hidden="true"
        >
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-primary/12"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeDasharray="68 164"
            className="text-primary"
          />
        </svg>

        {/* Residential 3-Block Architectural Complex Icon */}
        <svg
          width={Math.round(dim * 0.64)}
          height={Math.round(dim * 0.64)}
          viewBox="0 0 56 56"
          fill="none"
          aria-hidden="true"
        >
          {/* Ground courtyard shadow */}
          <rect
            x="6"
            y="45"
            width="44"
            height="2.6"
            rx="1.3"
            className="fill-primary/25"
          />

          {/* Left Block (بلوک C) */}
          <rect
            x="8.5"
            y="24"
            width="12"
            height="21"
            rx="2"
            className="fill-primary/20 stroke-primary"
            strokeWidth="1.4"
          />
          <rect x="11.2" y="27.5" width="2.5" height="2.6" rx="0.6" className="fill-primary complex-win-1" />
          <rect x="15.3" y="27.5" width="2.5" height="2.6" rx="0.6" className="fill-primary complex-win-2" />
          <rect x="11.2" y="32.5" width="2.5" height="2.6" rx="0.6" className="fill-primary complex-win-3" />
          <rect x="15.3" y="32.5" width="2.5" height="2.6" rx="0.6" className="fill-primary complex-win-1" />
          <rect x="12.5" y="38.5" width="4" height="6.5" rx="0.8" className="fill-primary/35" />

          {/* Right Block (بلوک A) */}
          <rect
            x="35.5"
            y="21"
            width="12"
            height="24"
            rx="2"
            className="fill-primary/20 stroke-primary"
            strokeWidth="1.4"
          />
          <rect x="38.2" y="24.5" width="2.5" height="2.6" rx="0.6" className="fill-primary complex-win-2" />
          <rect x="42.3" y="24.5" width="2.5" height="2.6" rx="0.6" className="fill-primary complex-win-3" />
          <rect x="38.2" y="29.5" width="2.5" height="2.6" rx="0.6" className="fill-primary complex-win-1" />
          <rect x="42.3" y="29.5" width="2.5" height="2.6" rx="0.6" className="fill-primary complex-win-2" />
          <rect x="38.2" y="34.5" width="2.5" height="2.6" rx="0.6" className="fill-primary complex-win-3" />
          <rect x="42.3" y="34.5" width="2.5" height="2.6" rx="0.6" className="fill-primary complex-win-1" />

          {/* Central Main Tower (بلوک B) */}
          <path
            d="M23 11.5h10v2.5H23z"
            className="fill-primary/70"
          />
          <rect
            x="19.5"
            y="14"
            width="17"
            height="31"
            rx="2.2"
            className="fill-surface-container-lowest stroke-primary"
            strokeWidth="1.65"
          />
          {/* Central tower living windows */}
          <rect x="22.5" y="18" width="3" height="2.8" rx="0.6" className="fill-primary complex-win-1" />
          <rect x="26.5" y="18" width="3" height="2.8" rx="0.6" className="fill-primary complex-win-2" />
          <rect x="30.5" y="18" width="3" height="2.8" rx="0.6" className="fill-primary complex-win-3" />

          <rect x="22.5" y="23.2" width="3" height="2.8" rx="0.6" className="fill-primary complex-win-3" />
          <rect x="26.5" y="23.2" width="3" height="2.8" rx="0.6" className="fill-primary complex-win-1" />
          <rect x="30.5" y="23.2" width="3" height="2.8" rx="0.6" className="fill-primary complex-win-2" />

          <rect x="22.5" y="28.4" width="3" height="2.8" rx="0.6" className="fill-primary complex-win-2" />
          <rect x="26.5" y="28.4" width="3" height="2.8" rx="0.6" className="fill-primary complex-win-3" />
          <rect x="30.5" y="28.4" width="3" height="2.8" rx="0.6" className="fill-primary complex-win-1" />

          <rect x="22.5" y="33.6" width="3" height="2.8" rx="0.6" className="fill-primary complex-win-1" />
          <rect x="26.5" y="33.6" width="3" height="2.8" rx="0.6" className="fill-primary complex-win-2" />
          <rect x="30.5" y="33.6" width="3" height="2.8" rx="0.6" className="fill-primary complex-win-3" />

          {/* Lobby entrance arch */}
          <path
            d="M25.5 45v-5.2a2.5 2.5 0 0 1 5 0V45z"
            className="fill-primary/80"
          />

          {/* Subtle landscaped courtyard trees */}
          <circle cx="7" cy="43" r="1.8" className="fill-secondary/70" />
          <circle cx="49" cy="43" r="1.8" className="fill-secondary/70" />
        </svg>
      </div>

      {label && (
        <div className="space-y-0.5">
          <div className="text-[13px] font-semibold text-on-surface">{label}</div>
          {sublabel && <div className="text-[11.5px] text-on-surface-variant">{sublabel}</div>}
        </div>
      )}
    </div>
  );
};

/**
 * Full-panel residential complex loader card — cleanly framed inside content areas
 * or as a non-intrusive page hydration state above the bottom dock.
 */
export const ComplexPageLoader: React.FC<{
  label?: string;
  sublabel?: string;
  compact?: boolean;
}> = ({
  label = 'در حال دریافت اطلاعات...',
  sublabel = 'مجتمع مسکونی نیلوفر',
  compact = false,
}) => (
  <div
    className={`w-full flex items-center justify-center m-panel-in ${
      compact ? 'py-8 px-4' : 'min-h-[46vh] py-12 px-4'
    }`}
  >
    <div className="bg-surface-container-lowest rounded-2xl px-7 py-6 shadow-[var(--shadow-surface-ring)] flex flex-col items-center">
      <ComplexSpinner size={compact ? 'md' : 'lg'} label={label} sublabel={sublabel} />
    </div>
  </div>
);
