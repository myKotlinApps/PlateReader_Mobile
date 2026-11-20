import React from 'react';

interface MListItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  lead?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  trail?: React.ReactNode;
}

/** Tappable list row with leading icon slot, title/subtitle and trailing slot. */
export const MListItem: React.FC<MListItemProps> = ({
  lead,
  title,
  sub,
  trail,
  className = '',
  type = 'button',
  ...rest
}) => (
  <button type={type} className={['m-list-item', className].filter(Boolean).join(' ')} {...rest}>
    {lead && <span className="m-list-item__lead">{lead}</span>}
    <span className="m-list-item__body">
      <span className="m-list-item__title d-block">{title}</span>
      {sub && <span className="m-list-item__sub d-block">{sub}</span>}
    </span>
    {trail && <span className="m-list-item__trail">{trail}</span>}
  </button>
);