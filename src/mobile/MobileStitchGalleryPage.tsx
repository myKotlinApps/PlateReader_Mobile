import React, { useEffect, useMemo, useState } from 'react';
import { mobileApi } from './mobileApi';
import {
  HeroSummaryCard,
  SectionHeader,
  StatusPill,
  StitchButton,
  SubMenuTabs,
  SurfaceCard,
} from './ui/StitchKit';

interface StitchScreenMeta {
  id: string;
  num: number;
  title: string;
  category: string;
  badge: string;
  tab: string;
  hasImage?: boolean;
}

interface Props {
  onNavigateTab: (tab: string) => void;
}

export const MobileStitchGalleryPage: React.FC<Props> = ({ onNavigateTab }) => {
  const [screens, setScreens] = useState<StitchScreenMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string>('_3');
  const [catFilter, setCatFilter] = useState<'all' | 'finance' | 'facilities' | 'letters' | 'mgmt'>('all');
  const [previewMode, setPreviewMode] = useState<'live' | 'screenshot'>('live');

  useEffect(() => {
    void mobileApi
      .listStitchScreens()
      .then((res) => {
        if (res.data?.screens?.length) {
          setScreens(res.data.screens as StitchScreenMeta[]);
        }
      })
      .catch(() => undefined);
  }, []);

  const filteredScreens = useMemo(() => {
    return screens.filter((s) => {
      if (catFilter === 'all') return true;
      if (catFilter === 'finance') return s.tab.startsWith('finance');
      if (catFilter === 'facilities') return s.tab.startsWith('facilities');
      if (catFilter === 'letters') return s.tab.startsWith('letters');
      return s.tab.startsWith('dashboard') || s.tab.startsWith('forms') || s.tab.startsWith('guard');
    });
  }, [screens, catFilter]);

  const currentScreen =
    screens.find((s) => s.id === selectedId) ||
    filteredScreens[0] || {
      id: '_3',
      num: 3,
      title: 'داشبورد موبایل مدیر مجتمع نیلوفر',
      category: 'mobile',
      badge: 'Mobile Home',
      tab: 'dashboard',
      hasImage: true,
    };

  const canShowImage = currentScreen.hasImage !== false;
  const activeMode = canShowImage ? previewMode : 'live';

  return (
    <div className="flex flex-col gap-3.5 pb-4" dir="rtl">
      <HeroSummaryCard
        title="آرشیو ۲۰ صفحه طراحی مرجع"
        subtitle="یکپارچه‌شده در ۶ ماژول فعال سامانه"
        badge={`${(screens.length || 20).toLocaleString('fa-IR')} صفحه`}
        stats={[
          { label: 'مالی و شارژ', value: '۷ صفحه' },
          { label: 'تاسیسات و نشتی', value: '۳ صفحه', accent: 'positive' },
          { label: 'دبیرخانه و مدیریت', value: '۱۰ صفحه' },
        ]}
      />

      <SubMenuTabs
        active={catFilter}
        onChange={(id) => setCatFilter(id as typeof catFilter)}
        items={[
          { id: 'all', label: 'همه (۲۰)' },
          { id: 'finance', label: 'مالی (۷)' },
          { id: 'facilities', label: 'تاسیسات (۳)' },
          { id: 'letters', label: 'دبیرخانه (۴)' },
          { id: 'mgmt', label: 'مدیریت و گیت (۶)' },
        ]}
      />

      <SurfaceCard className="space-y-3">
        <SectionHeader
          title={`انتخاب صفحه (${filteredScreens.length.toLocaleString('fa-IR')} مورد)`}
          icon="grid_view"
          action={
            <StitchButton size="sm" icon="arrow_back" onClick={() => onNavigateTab(currentScreen.tab)}>
              باز کردن در برنامه
            </StitchButton>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-0.5">
          {filteredScreens.map((scr) => {
            const active = selectedId === scr.id;
            return (
              <button
                key={scr.id}
                type="button"
                onClick={() => {
                  setSelectedId(scr.id);
                  if (scr.hasImage === false) setPreviewMode('live');
                }}
                className={`p-2.5 rounded-xl text-right border transition-colors flex items-center gap-2.5 ${
                  active
                    ? 'bg-primary-container/75 text-on-primary-container border-primary/35 font-semibold'
                    : 'bg-surface-container-low/65 text-on-surface border-outline-variant/30 hover:bg-surface-container-low'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg text-[12px] font-bold font-numeric-stat flex items-center justify-center shrink-0 ${
                    active
                      ? 'bg-surface-container-lowest text-primary'
                      : 'bg-surface-container-lowest text-on-surface-variant'
                  }`}
                >
                  {scr.num.toLocaleString('fa-IR')}
                </span>
                <span className="text-[13px] truncate flex-1">{scr.title}</span>
              </button>
            );
          })}
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-0 overflow-hidden">
        <div className="bg-surface-container-low px-3.5 py-2.5 border-b border-outline-variant/35 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <StatusPill label={`#${currentScreen.num.toLocaleString('fa-IR')}`} tone="primary" />
            <strong className="text-[13.5px] font-semibold text-on-surface truncate">
              {currentScreen.title}
            </strong>
          </div>
          {canShowImage && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewMode('live')}
                className={`h-8 px-2.5 rounded-lg text-[12px] font-medium ${
                  activeMode === 'live'
                    ? 'bg-surface-container-lowest text-on-primary-container shadow-xs'
                    : 'text-on-surface-variant'
                }`}
              >
                زنده
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('screenshot')}
                className={`h-8 px-2.5 rounded-lg text-[12px] font-medium ${
                  activeMode === 'screenshot'
                    ? 'bg-surface-container-lowest text-on-primary-container shadow-xs'
                    : 'text-on-surface-variant'
                }`}
              >
                تصویر
              </button>
            </div>
          )}
        </div>

        {activeMode === 'live' ? (
          <iframe
            key={currentScreen.id}
            title={currentScreen.title}
            src={`/api/v1/stitch/screen/${currentScreen.id}`}
            className="w-full border-0 bg-surface"
            style={{ height: 640 }}
          />
        ) : (
          <div className="p-3 bg-surface-container-low flex justify-center">
            <img
              src={`/api/v1/stitch/image/${currentScreen.id}`}
              alt={currentScreen.title}
              className="max-w-full rounded-xl border border-outline-variant/35"
            />
          </div>
        )}
      </SurfaceCard>
    </div>
  );
};
