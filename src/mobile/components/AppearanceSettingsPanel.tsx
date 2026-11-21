import React, { useState } from 'react';
import {
  applyAppearancePrefs,
  DEFAULT_APPEARANCE_PREFS,
  THEME_PALETTES,
  type CornerStyle,
  type ThemePaletteId,
  type UserAppearancePrefs,
} from '../theme/palettes';
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

  const currentCorner: CornerStyle = prefs?.cornerStyle === 'curved' ? 'curved' : 'sharp';
  const currentPalette: ThemePaletteId = prefs?.paletteId || DEFAULT_APPEARANCE_PREFS.paletteId;

  const commitPrefs = async (next: UserAppearancePrefs, label: string) => {
    // Immediate optimistic theme & corner application
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

  return (
    <div className="space-y-3.5" dir="rtl">
      {statusMsg && (
        <NoticeBanner message={statusMsg} tone="success" onClose={() => setStatusMsg('')} />
      )}

      {/* 1. Corner Style Selector (Sharp vs Curved for Cards & Buttons; Dock stays untouched!) */}
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
                { cornerStyle: 'sharp', paletteId: currentPalette },
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
                تیز و گوشه‌دار (پیش‌فرض)
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
                { cornerStyle: 'curved', paletteId: currentPalette },
                'حالت منحنی (Curve) کارت‌ها و دکمه‌ها',
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
                منحنی (Curve)
              </strong>
              <span className="text-[11px] text-on-surface-variant block mt-0.5">
                کارت‌ها و دکمه‌های نرم با گوشه گرد
              </span>
            </div>
          </button>
        </div>
      </SurfaceCard>

      {/* 2. 6 Modern Trend Color Palettes (Default Niloofar Slate is #1) */}
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
                    { cornerStyle: currentCorner, paletteId: pal.id },
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
