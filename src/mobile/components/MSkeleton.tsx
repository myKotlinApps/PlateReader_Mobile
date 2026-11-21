import React from 'react';

interface MSkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}

/** Shimmering placeholder block for loading lists/cards. */
export const MSkeleton: React.FC<MSkeletonProps> = ({ width = '100%', height = 16, radius, className = '' }) => (
  <span
    className={['m-skeleton', className].filter(Boolean).join(' ')}
    style={{ width, height, borderRadius: radius }}
    aria-hidden="true"
  />
);