import React, { useRef, useState } from 'react';

interface MPullToRefreshProps {
  onRefresh: () => unknown | Promise<unknown>;
  children: React.ReactNode;
  disabled?: boolean;
}

const THRESHOLD = 64;

/**
 * Touch pull-to-refresh wrapper. Only engages at scrollTop === 0.
 * Shows a slim indicator while pulling / refreshing.
 */
export const MPullToRefresh: React.FC<MPullToRefreshProps> = ({ onRefresh, children, disabled = false }) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  const handleStart = (e: React.TouchEvent) => {
    if (disabled || window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
  };

  const handleMove = (e: React.TouchEvent) => {
    if (disabled || startY.current == null) return;
    if (window.scrollY > 0) {
      setPull(0);
      return;
    }
    const dy = e.touches[0].clientY - startY.current;
    setPull(dy > 0 ? Math.min(dy * 0.5, 120) : 0);
  };

  const handleEnd = async () => {
    if (disabled) return;
    const shouldRefresh = pull >= THRESHOLD;
    startY.current = null;
    setPull(0);
    if (!shouldRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="m-ptr d-flex flex-column flex-grow-1" onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}>
      <div
        className="m-ptr__indicator d-flex align-items-center justify-content-center gap-2"
        style={{
          height: refreshing ? 48 : pull,
          opacity: refreshing || pull >= THRESHOLD ? 1 : pull > 0 ? 0.6 : 0,
        }}
        aria-hidden="true"
      >
        {refreshing ? (
          <span className="spinner-border spinner-border-sm" role="status" />
        ) : (
          <span className="m-ptr__hint">{pull >= THRESHOLD ? 'رها کنید' : pull > 0 ? 'بکشید' : ''}</span>
        )}
      </div>
      {children}
    </div>
  );
};