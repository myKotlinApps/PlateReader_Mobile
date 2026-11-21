import React, { useMemo, useState } from 'react';
import {
  formatJalaliDate,
  formatJalaliDateTime,
  formatJalaliTime,
  getJalaliMonthFirstWeekday,
  getTodayJalali,
  JALALI_MONTH_NAMES,
  jalaliDateTimeToMs,
  jalaliMonthLength,
  msToJalaliDateTime,
  parseJalaliString,
  PERSIAN_WEEKDAYS_SHORT,
  type JalaliDateTime,
} from '../utils/jalaliDate';
import { toPersianDigits } from '../utils/persianMoney';

interface Props {
  id?: string;
  label?: string;
  mode?: 'date' | 'datetime';
  /** Formatted Jalali string value (e.g. "۱۴۰۵/۰۸/۳۰" or "۱۴۰۵/۰۸/۳۰ • ساعت ۱۸:۳۰") */
  value?: string;
  /** Optional epoch ms value (useful when mode="datetime") */
  valueMs?: number | null;
  onChange: (formattedJalali: string, epochMs: number) => void;
  placeholder?: string;
  compact?: boolean;
  className?: string;
}

const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export const JalaliDateTimePicker: React.FC<Props> = ({
  id,
  label,
  mode = 'date',
  value,
  valueMs,
  onChange,
  placeholder = 'انتخاب تاریخ شمسی...',
  compact = false,
  className = '',
}) => {
  const initialDt: JalaliDateTime = useMemo(() => {
    if (typeof valueMs === 'number' && Number.isFinite(valueMs) && valueMs > 0) {
      return msToJalaliDateTime(valueMs);
    }
    return parseJalaliString(value);
  }, [value, valueMs]);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initialDt.jy);
  const [viewMonth, setViewMonth] = useState(initialDt.jm);
  const [sel, setSel] = useState<JalaliDateTime>(initialDt);

  const openPicker = () => {
    const cur =
      typeof valueMs === 'number' && Number.isFinite(valueMs) && valueMs > 0
        ? msToJalaliDateTime(valueMs)
        : parseJalaliString(value);
    setSel(cur);
    setViewYear(cur.jy);
    setViewMonth(cur.jm);
    setOpen((prev) => !prev);
  };

  const emitSelection = (next: JalaliDateTime, closeAfter = false) => {
    setSel(next);
    const formatted = mode === 'datetime' ? formatJalaliDateTime(next) : formatJalaliDate(next);
    const ms = jalaliDateTimeToMs(next);
    onChange(formatted, ms);
    if (closeAfter) setOpen(false);
  };

  const daysInMonth = jalaliMonthLength(viewYear, viewMonth);
  const firstWeekday = getJalaliMonthFirstWeekday(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const displayLabel =
    value && value.trim()
      ? value
      : typeof valueMs === 'number' && valueMs > 0
        ? mode === 'datetime'
          ? formatJalaliDateTime(msToJalaliDateTime(valueMs))
          : formatJalaliDate(msToJalaliDateTime(valueMs))
        : '';

  return (
    <div className={`relative ${className}`} dir="rtl">
      {label && (
        <label
          htmlFor={id}
          className="block text-[12px] font-semibold text-on-surface-variant mb-1"
        >
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        onClick={openPicker}
        className={`w-full ${
          compact ? 'h-9 px-2.5 text-[12px]' : 'h-10 px-3 text-[12.5px]'
        } rounded-[var(--ui-btn-radius)] bg-surface-container-low border border-outline-variant/55 hover:border-primary/65 text-right flex items-center justify-between gap-2 transition-colors`}
      >
        <span className={`truncate font-numeric-stat ${displayLabel ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>
          {displayLabel || placeholder}
        </span>
        <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
          {mode === 'datetime' ? 'calendar_clock' : 'calendar_month'}
        </span>
      </button>

      {open && (
        <div
          className="mt-1.5 p-3 rounded-[var(--ui-card-radius)] bg-surface-container-lowest border border-primary/40 shadow-floating space-y-2.5 z-40"
          role="dialog"
          aria-label="تقویم شمسی و انتخاب زمان"
        >
          {/* Month / Year Navigation */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="ماه قبل"
              className="w-8 h-8 rounded-[var(--ui-btn-radius)] bg-surface-container-low hover:bg-primary-container/50 text-on-surface flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
            <div className="text-center">
              <strong className="text-[13px] font-bold text-on-surface">
                {JALALI_MONTH_NAMES[viewMonth - 1]} {toPersianDigits(viewYear)}
              </strong>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="ماه بعد"
              className="w-8 h-8 rounded-[var(--ui-btn-radius)] bg-surface-container-low hover:bg-primary-container/50 text-on-surface flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-on-surface-variant">
            {PERSIAN_WEEKDAYS_SHORT.map((wd) => (
              <span key={wd} className="py-0.5">
                {wd}
              </span>
            ))}
          </div>

          {/* Jalali Month Grid */}
          <div className="grid grid-cols-7 gap-1 text-center font-numeric-stat">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const isSelected =
                sel.jy === viewYear && sel.jm === viewMonth && sel.jd === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    emitSelection(
                      { ...sel, jy: viewYear, jm: viewMonth, jd: day },
                      mode === 'date',
                    )
                  }
                  className={`h-8 rounded-[var(--ui-btn-radius)] text-[12px] font-semibold transition-colors ${
                    isSelected
                      ? 'bg-primary text-on-primary font-bold'
                      : 'hover:bg-primary-container/55 text-on-surface'
                  }`}
                >
                  {toPersianDigits(day)}
                </button>
              );
            })}
          </div>

          {/* Visual Time Picker (when mode="datetime") */}
          {mode === 'datetime' && (
            <div className="pt-2 border-t border-outline-variant/40 space-y-2">
              <div className="flex items-center justify-between text-[11.5px] font-semibold text-on-surface-variant">
                <span className="inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-primary">schedule</span>
                  انتخاب ساعت و دقیقه (Time Picker)
                </span>
                <strong className="text-primary font-numeric-stat text-[13px]">
                  ساعت {formatJalaliTime(sel.hour, sel.minute)}
                </strong>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-0.5">ساعت</label>
                  <select
                    aria-label="ساعت"
                    value={sel.hour}
                    onChange={(e) =>
                      emitSelection({ ...sel, hour: Number(e.target.value) }, false)
                    }
                    className="w-full h-9 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] font-bold font-numeric-stat border border-outline-variant/55"
                  >
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h}>
                        {toPersianDigits(String(h).padStart(2, '0'))}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-0.5">دقیقه</label>
                  <select
                    aria-label="دقیقه"
                    value={MINUTE_STEPS.includes(sel.minute) ? sel.minute : 0}
                    onChange={(e) =>
                      emitSelection({ ...sel, minute: Number(e.target.value) }, false)
                    }
                    className="w-full h-9 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] font-bold font-numeric-stat border border-outline-variant/55"
                  >
                    {MINUTE_STEPS.map((m) => (
                      <option key={m} value={m}>
                        {toPersianDigits(String(m).padStart(2, '0'))}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { label: '۰۸:۰۰ صبح', h: 8, m: 0 },
                  { label: '۱۲:۰۰ ظهر', h: 12, m: 0 },
                  { label: '۱۸:۰۰ عصر', h: 18, m: 0 },
                  { label: '۲۱:۰۰ شب', h: 21, m: 0 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => emitSelection({ ...sel, hour: preset.h, minute: preset.m }, false)}
                    className="px-2 py-1 rounded-[var(--ui-btn-radius)] bg-surface-container-low hover:bg-primary-container/50 text-[11px] font-medium text-on-surface border border-outline-variant/45"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-1.5 border-t border-outline-variant/35 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                const now = getTodayJalali();
                setViewYear(now.jy);
                setViewMonth(now.jm);
                emitSelection(now, mode === 'date');
              }}
              className="text-[11.5px] font-bold text-primary hover:underline"
            >
              امروز ({formatJalaliDate(getTodayJalali())})
            </button>
            <button
              type="button"
              onClick={() => {
                emitSelection(sel, true);
              }}
              className="h-8 px-3 rounded-[var(--ui-btn-radius)] bg-primary text-on-primary text-[12px] font-bold"
            >
              تایید
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
