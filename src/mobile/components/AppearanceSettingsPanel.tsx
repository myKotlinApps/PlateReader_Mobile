import React, { useState } from 'react';
import { BellRing, Contrast, Eye, PauseCircle, RotateCcw, Type } from 'lucide-react';
import {
  applyAppearancePrefs,
  DEFAULT_APPEARANCE_PREFS,
  THEME_PALETTES,
  type CornerStyle,
  type FontScaleMode,
  type ThemePaletteId,
  type UserAppearancePrefs,
} from '../theme/palettes';
import {
  FONT_SCALE_OPTIONS,
  normalizeUserAppearancePrefs,
  summarizeAccessibilityPrefs,
} from '../theme/accessibilityPrefs';
import { pushDockAlarm } from '../ui/dockAlarmBus';
import { rbacApi } from '../rbac/rbacApi';
import { NoticeBanner, SectionHeader, StatusPill, SurfaceCard } from '../ui/StitchKit';

interface Props {
  prefs: UserAppearancePrefs;
  onChangePrefs: (next: UserAppearancePrefs) => void;
  userDisplayName?: string;
  compact?: boolean;
}

export const AppearanceSettingsPanel: React.FC<Props> = ({
  prefs,
  onChangePrefs,
  userDisplayName,
  compact = false,
}) => {
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const normalized = normalizeUserAppearancePrefs(prefs, DEFAULT_APPEARANCE_PREFS);
  const currentCorner: CornerStyle = normalized.cornerStyle;
  const currentPalette: ThemePaletteId = normalized.paletteId;
  const currentScale: FontScaleMode = normalized.fontScale;
  const isCustomA11y =
    normalized.fontScale !== 'normal' ||
    normalized.highContrast ||
    normalized.boldText ||
    normalized.reduceMotion;

  const commitPrefs = async (patch: Partial<UserAppearancePrefs>, label: string) => {
    const next = normalizeUserAppearancePrefs(patch, normalized);
    applyAppearancePrefs(next);
    onChangePrefs(next);
    setSaving(true);
    setStatusMsg('');
    try {
      await rbacApi.updatePreferences(next);
      setStatusMsg(`${label} برای حساب ${userDisplayName || 'شما'} در دیتابیس ذخیره شد.`);
    } catch {
      setStatusMsg(`${label} اعمال شد.`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestAlarmAnimation = () => {
    pushDockAlarm({
      tone: 'success',
      title: 'پیش‌نمایش انیمیشن هشدار',
      message: 'نمایش روان و هماهنگ آلارم بالای داک شناور سامانه',
      durationMs: 4200,
    });
  };

  return (
    <div className="space-y-3.5" dir="rtl">
      {statusMsg && (
        <NoticeBanner message={statusMsg} tone="success" onClose={() => setStatusMsg('')} />
      )}

      {/* 1. Accessibility & Presbyopia (پیرچشمی، درشت‌نمایی متون، کنتراست و خوانایی) */}
      <SurfaceCard className={compact ? 'p-3.5 space-y-3' : 'space-y-3.5'}>
        <SectionHeader
          title="دسترس‌پذیری، پیرچشمی و خوانایی"
          icon="accessibility_new"
          action={
            <StatusPill
              label={summarizeAccessibilityPrefs(normalized)}
              tone={isCustomA11y ? 'positive' : 'neutral'}
            />
          }
        />
        <p className="text-[12.5px] text-on-surface-variant mb-0 leading-relaxed">
          اگر مطالعه متون کوچک برایتان دشوار است یا از مشکل پیرچشمی رنج می‌برید، اندازه نوشته‌ها،
          ضخامت حروف و کنتراست کل سامانه را متناسب با دید خود تنظیم کنید.
        </p>

        {/* Font / UI Size Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-bold text-on-surface flex items-center gap-1.5">
              <Eye size={16} className="text-primary shrink-0" />
              <span>اندازه نوشته‌ها و دکمه‌ها (حالت پیرچشمی)</span>
            </span>
          </div>

          <div
            role="radiogroup"
            aria-label="اندازه نوشته‌ها و حالت پیرچشمی"
            className={compact ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 md:grid-cols-3 gap-2'}
          >
            {FONT_SCALE_OPTIONS.map((opt) => {
              const isSelected = currentScale === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={saving}
                  onClick={() =>
                    void commitPrefs(
                      { fontScale: opt.id },
                      `اندازه متن «${opt.label}»`,
                    )
                  }
                  className={`p-2.5 rounded-[var(--ui-card-radius)] border text-right transition-colors ${
                    compact
                      ? 'flex items-center justify-between gap-3 min-h-[52px]'
                      : 'flex flex-col gap-1 min-h-[56px]'
                  } ${
                    isSelected
                      ? 'bg-primary-container/60 border-primary ring-2 ring-primary/30'
                      : 'bg-surface-container-low/80 border-outline-variant/55 hover:border-primary/50'
                  }`}
                >
                  {compact ? (
                    <>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <strong className="block text-[13px] font-bold text-on-surface leading-snug">
                          {opt.label}
                        </strong>
                        <span className="block text-[11px] text-on-surface-variant leading-snug">
                          {opt.description}
                        </span>
                      </div>
                      <span className="text-[12px] font-extrabold font-numeric-stat text-primary shrink-0 px-2 py-0.5 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest/80 border border-primary/20">
                        {opt.percentLabel}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-1.5 w-full">
                        <strong className="text-[13px] font-bold text-on-surface">
                          {opt.shortLabel}
                        </strong>
                        <span className="text-[11.5px] font-extrabold font-numeric-stat text-primary">
                          {opt.percentLabel}
                        </span>
                      </div>
                      <span className="text-[11px] text-on-surface-variant leading-snug">
                        {opt.description}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contrast, Bold Text & Reduce Motion Accessibility Switches */}
        <div className={compact ? 'grid grid-cols-1 gap-2 pt-1' : 'grid grid-cols-1 md:grid-cols-3 gap-2 pt-1'}>
          <button
            type="button"
            role="switch"
            aria-checked={normalized.highContrast}
            disabled={saving}
            onClick={() =>
              void commitPrefs(
                { highContrast: !normalized.highContrast },
                !normalized.highContrast ? 'فعال‌سازی کنتراست بالا' : 'غیرفعال‌سازی کنتراست بالا',
              )
            }
            className={`p-2.5 rounded-[var(--ui-btn-radius)] border text-right flex items-center justify-between gap-2.5 transition-colors min-h-[48px] ${
              normalized.highContrast
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-low/80 text-on-surface border-outline-variant/55 hover:border-primary/50'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Contrast size={17} className="shrink-0" />
              <span className="min-w-0">
                <strong className="block text-[12.5px] font-bold leading-snug">کنتراست بالا</strong>
                {compact && (
                  <span
                    className={`block text-[10.5px] leading-snug ${
                      normalized.highContrast ? 'text-on-primary/85' : 'text-on-surface-variant'
                    }`}
                  >
                    تیره‌تر شدن متون و پررنگ‌تر شدن کادرها
                  </span>
                )}
              </span>
            </span>
            <span
              className={`text-[11px] font-bold shrink-0 px-2 py-0.5 rounded-[var(--ui-btn-radius)] ${
                normalized.highContrast
                  ? 'bg-white/20 text-on-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {normalized.highContrast ? 'روشن' : 'خاموش'}
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={normalized.boldText}
            disabled={saving}
            onClick={() =>
              void commitPrefs(
                { boldText: !normalized.boldText },
                !normalized.boldText ? 'فعال‌سازی متن ضخیم‌تر' : 'حالت عادی ضخامت متن',
              )
            }
            className={`p-2.5 rounded-[var(--ui-btn-radius)] border text-right flex items-center justify-between gap-2.5 transition-colors min-h-[48px] ${
              normalized.boldText
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-low/80 text-on-surface border-outline-variant/55 hover:border-primary/50'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Type size={17} className="shrink-0" />
              <span className="min-w-0">
                <strong className="block text-[12.5px] font-bold leading-snug">متن ضخیم‌تر</strong>
                {compact && (
                  <span
                    className={`block text-[10.5px] leading-snug ${
                      normalized.boldText ? 'text-on-primary/85' : 'text-on-surface-variant'
                    }`}
                  >
                    افزایش وزن قلم برای خوانایی بیشتر حروف
                  </span>
                )}
              </span>
            </span>
            <span
              className={`text-[11px] font-bold shrink-0 px-2 py-0.5 rounded-[var(--ui-btn-radius)] ${
                normalized.boldText
                  ? 'bg-white/20 text-on-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {normalized.boldText ? 'روشن' : 'خاموش'}
            </span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={normalized.reduceMotion}
            disabled={saving}
            onClick={() =>
              void commitPrefs(
                { reduceMotion: !normalized.reduceMotion },
                !normalized.reduceMotion ? 'فعال‌سازی کاهش انیمیشن' : 'پخش کامل انیمیشن‌ها',
              )
            }
            className={`p-2.5 rounded-[var(--ui-btn-radius)] border text-right flex items-center justify-between gap-2.5 transition-colors min-h-[48px] ${
              normalized.reduceMotion
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-low/80 text-on-surface border-outline-variant/55 hover:border-primary/50'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <PauseCircle size={17} className="shrink-0" />
              <span className="min-w-0">
                <strong className="block text-[12.5px] font-bold leading-snug">کاهش حرکت</strong>
                {compact && (
                  <span
                    className={`block text-[10.5px] leading-snug ${
                      normalized.reduceMotion ? 'text-on-primary/85' : 'text-on-surface-variant'
                    }`}
                  >
                    ساده‌سازی انیمیشن‌های جابه‌جایی و آلارم
                  </span>
                )}
              </span>
            </span>
            <span
              className={`text-[11px] font-bold shrink-0 px-2 py-0.5 rounded-[var(--ui-btn-radius)] ${
                normalized.reduceMotion
                  ? 'bg-white/20 text-on-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {normalized.reduceMotion ? 'روشن' : 'خاموش'}
            </span>
          </button>
        </div>

        {/* Live Readability Preview + Alarm Animation Tester */}
        <div className="p-3 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/60 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <strong className="text-[13px] font-bold text-on-surface">
              پیش‌نمایش خوانایی قبض و اعلان
            </strong>
            <span className="text-[12px] font-bold text-primary font-numeric-stat">
              ۱٬۸۵۰٬۰۰۰ تومان
            </span>
          </div>
          <p className="text-[12px] text-on-surface-variant mb-0 leading-relaxed">
            واحد ۲۰۴ بلوک B · سررسید شارژ ماه جاری تا پایان هفته است. با تغییر گزینه‌های بالا،
            بزرگ‌نمایی متون بلافاصله در کل صفحات اعمال می‌شود.
          </p>
          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
            <button
              type="button"
              onClick={handleTestAlarmAnimation}
              className="h-9 px-3 rounded-[var(--ui-btn-radius)] bg-primary-container/75 hover:bg-primary-container text-on-primary-container text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <BellRing size={15} />
              <span>پیش‌نمایش انیمیشن آلارم</span>
            </button>

            {isCustomA11y && (
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void commitPrefs(
                    {
                      fontScale: 'normal',
                      highContrast: false,
                      boldText: false,
                      reduceMotion: false,
                    },
                    'بازنشانی تنظیمات دسترس‌پذیری به حالت استاندارد',
                  )
                }
                className="h-9 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/60 text-on-surface-variant text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={14} />
                <span>بازنشانی استاندارد</span>
              </button>
            )}
          </div>
        </div>
      </SurfaceCard>

      {/* 2. Corner Style Selector (Sharp vs Curved for Cards & Buttons; Dock stays untouched!) */}
      <SurfaceCard className={compact ? 'p-3 space-y-2.5' : 'space-y-3'}>
        <SectionHeader
          title="فرم گوشه کارت‌ها و دکمه‌ها"
          icon="rounded_corner"
          action={
            <StatusPill
              label={currentCorner === 'sharp' ? 'تیز و گوشه‌دار' : 'منحنی / Curve'}
              tone="primary"
            />
          }
        />
        <p className="text-[12px] text-on-surface-variant mb-0 leading-relaxed">
          این تنظیم فقط برای حساب شخصی شما ذخیره می‌شود و فرم کلیه کارت‌ها و دکمه‌ها را تغییر می‌دهد
          (داک شناور پایین بدون تغییر باقی می‌ماند).
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void commitPrefs(
                { cornerStyle: 'sharp' },
                'حالت تیز و گوشه‌دار کارت‌ها و دکمه‌ها',
              )
            }
            className={`p-3 border text-right transition-colors rounded-[2px] flex flex-col gap-2 ${
              currentCorner === 'sharp'
                ? 'bg-primary-container/50 border-primary ring-1 ring-primary/30'
                : 'bg-surface-container-low/75 border-outline-variant/55 hover:border-primary/50'
            }`}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="w-8 h-6 border-2 border-primary bg-surface-container-lowest rounded-[2px] inline-block" />
              {currentCorner === 'sharp' && (
                <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
              )}
            </div>
            <div>
              <strong className="text-[13px] font-bold text-on-surface block">
                تیز و گوشه‌دار
              </strong>
              <span className="text-[11px] text-on-surface-variant block mt-0.5">
                کارت‌ها و دکمه‌های مدرن زاویه‌دار
              </span>
            </div>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void commitPrefs(
                { cornerStyle: 'curved' },
                'حالت منحنی نرم (Curve) کارت‌ها و دکمه‌ها',
              )
            }
            className={`p-3 border text-right transition-colors rounded-[14px] flex flex-col gap-2 ${
              currentCorner === 'curved'
                ? 'bg-primary-container/50 border-primary ring-1 ring-primary/30'
                : 'bg-surface-container-low/75 border-outline-variant/55 hover:border-primary/50'
            }`}
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="w-8 h-6 border-2 border-primary bg-surface-container-lowest rounded-[10px] inline-block" />
              {currentCorner === 'curved' && (
                <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
              )}
            </div>
            <div>
              <strong className="text-[13px] font-bold text-on-surface block">
                منحنی نرم (Curve — پیش‌فرض)
              </strong>
              <span className="text-[11px] text-on-surface-variant block mt-0.5">
                کارت‌ها و دکمه‌های نرم با گوشه گرد متعادل
              </span>
            </div>
          </button>
        </div>
      </SurfaceCard>

      {/* 3. 6 Modern Trend Color Palettes (Default Niloofar Slate is #1) */}
      <SurfaceCard className={compact ? 'p-3 space-y-2.5' : 'space-y-3'}>
        <SectionHeader
          title="۶ پالت رنگی ترند روز سامانه"
          icon="palette"
          action={<StatusPill label="۶ تم فعال" tone="neutral" />}
        />
        <p className="text-[12px] text-on-surface-variant mb-0 leading-relaxed">
          با انتخاب هر پالت، رنگ کل المان‌ها، دکمه‌ها، سطوح و کارت‌های سامانه متناسب با آن پالت
          به‌صورت آنی تغییر می‌کند.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {THEME_PALETTES.map((pal) => {
            const active = pal.id === currentPalette;
            return (
              <button
                key={pal.id}
                type="button"
                disabled={saving}
                onClick={() =>
                  void commitPrefs(
                    { paletteId: pal.id },
                    `پالت رنگی «${pal.name}»`,
                  )
                }
                className={`p-3 rounded-[var(--ui-card-radius)] border text-right transition-colors flex flex-col gap-2 ${
                  active
                    ? 'bg-primary-container/50 border-primary ring-1 ring-primary/35'
                    : 'bg-surface-container-low/70 border-outline-variant/55 hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-1.5">
                    {pal.swatches.map((hex, i) => (
                      <span
                        key={i}
                        className="w-5 h-5 rounded-[var(--ui-btn-radius)] border border-black/15 inline-block shrink-0"
                        style={{ backgroundColor: hex }}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  {active ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      فعال
                    </span>
                  ) : (
                    <span className="text-[11px] text-on-surface-variant">انتخاب</span>
                  )}
                </div>
                <div className="min-w-0">
                  <strong className="text-[13px] font-bold text-on-surface block truncate">
                    {pal.name}
                  </strong>
                  <span className="text-[11px] text-on-surface-variant block truncate mt-0.5">
                    {pal.tagline}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
};
