import React from 'react';
import {
  amountToPersianWords,
  formatAmountFa,
  parsePersianAmount,
} from '../utils/persianMoney';

interface Props {
  id?: string;
  label?: string;
  value: number;
  onChange: (nextAmount: number) => void;
  unitLabel?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  hint?: string;
}

/**
 * Persian currency input with zero HTML5 number-range errors:
 * - Accepts Persian, Arabic, and English digits seamlessly
 * - Displays live Persian numerals with 3-digit comma separators (e.g. ۱,۴۵۰,۰۰۰)
 * - Shows live Persian Toman wording underneath the input box
 */
export const PersianAmountInput: React.FC<Props> = ({
  id,
  label,
  value,
  onChange,
  unitLabel = 'تومان',
  placeholder = 'مثلاً: ۱,۴۵۰,۰۰۰',
  required = false,
  disabled = false,
  compact = false,
  className = '',
  hint,
}) => {
  const safeVal = Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  const displayStr = safeVal > 0 ? formatAmountFa(safeVal) : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw.trim()) {
      onChange(0);
      return;
    }
    onChange(parsePersianAmount(raw));
  };

  return (
    <div className={className} dir="rtl">
      {label && (
        <label
          htmlFor={id}
          className="block text-[12px] font-semibold text-on-surface-variant mb-1"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required={required}
          disabled={disabled}
          value={displayStr}
          onChange={handleChange}
          placeholder={placeholder}
          dir="ltr"
          className={`w-full ${
            compact ? 'h-9 text-[12.5px] pl-14 pr-2.5' : 'h-10 text-[13.5px] pl-16 pr-3'
          } text-right rounded-[var(--ui-btn-radius)] bg-surface-container-low font-bold font-numeric-stat text-on-surface border border-outline-variant/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35`}
        />
        <span className="absolute left-2.5 text-[11px] font-bold text-primary pointer-events-none select-none">
          {unitLabel}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] leading-snug">
        <span className="text-primary font-medium truncate">
          {safeVal > 0
            ? amountToPersianWords(safeVal, unitLabel)
            : hint || `مبلغ را به ${unitLabel} وارد کنید`}
        </span>
        {safeVal > 0 && (
          <span className="text-on-surface-variant font-numeric-stat shrink-0">
            {formatAmountFa(safeVal)} {unitLabel}
          </span>
        )}
      </div>
    </div>
  );
};
