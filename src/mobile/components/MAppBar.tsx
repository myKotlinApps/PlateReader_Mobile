import React from 'react';

interface MAppBarProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional compact status/back element inline-start (right in RTL). */
  leading?: React.ReactNode;
  /** Minimal Material 3 icon buttons inline-end (left in RTL). */
  trailing?: React.ReactNode;
}

/** Clean frosted Material 3 Top App Bar — single-row, zero overlap on mobile. */
export const MAppBar: React.FC<MAppBarProps> = ({ title, leading, trailing }) => (
  <header className="alpr-mobile-topbar">
    <div className="m-appbar__inner">
      <div className="m-appbar__main">
        {leading}
        <h1 className="m-appbar__title mb-0">{title}</h1>
      </div>
      {trailing && <div className="m-appbar__actions">{trailing}</div>}
    </div>
  </header>
);