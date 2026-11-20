import React from 'react';

interface MAppBarProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Inline-start slot (right in RTL): typically status/sync pills. */
  leading?: React.ReactNode;
  /** Inline-end slot (left in RTL): icon action buttons. */
  trailing?: React.ReactNode;
}

/** Sticky top bar with dynamic title, subtitle and action slots. */
export const MAppBar: React.FC<MAppBarProps> = ({ title, subtitle, leading, trailing }) => (
  <header className="m-appbar alpr-mobile-topbar">
    {leading && <div className="m-appbar__leading">{leading}</div>}
    <div className="m-appbar__main">
      <div className="m-appbar__title">{title}</div>
      {subtitle && <div className="m-appbar__subtitle">{subtitle}</div>}
    </div>
    {trailing && <div className="m-appbar__actions">{trailing}</div>}
  </header>
);