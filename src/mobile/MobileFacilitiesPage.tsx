import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mobileApi } from './mobileApi';
import { compressImageFileToBase64 } from './nativeBridge';
import {
  EmptyState,
  HeroSummaryCard,
  NoticeBanner,
  SectionHeader,
  StatusPill,
  StitchButton,
  StitchModal,
  SubMenuTabs,
  SurfaceCard,
} from './ui/StitchKit';
import { ComplexPageLoader } from './ui/ComplexSpinner';

interface Props {
  onNavigate: (route: string) => void;
  onSyncChanged: () => void;
}

type FacilityTab = 'leaks' | 'report' | 'blueprints';

interface BlueprintDoc {
  id: string;
  title: string;
  category: string;
  format: string;
  riserCode: string;
  details: string[];
}

const BLUEPRINTS: BlueprintDoc[] = [
  {
    id: 'bp_mech',
    title: 'پلان تاسیسات مکانیک و آبرسانی',
    category: 'آبرسانی',
    format: 'PDF • ۸.۴ MB',
    riserCode: 'R1 / R2 • کلکتور منفی ۲',
    details: [
      'بوسترپمپ شماره ۲ (پنتاکس ۵.۵ اسب) به کلکتور منفی ۲',
      'رایزر ۱ (V-B-101): واحدهای شرقی ۱۰۱ تا ۸۰۱',
      'رایزر ۲ (V-B2-03-W): واحدهای غربی ۱۰۲ تا ۸۰۲',
      'فشار مدار سرد: ۴.۲ بار • آبگرم: ۵۸ درجه',
    ],
  },
  {
    id: 'bp_sewage',
    title: 'پلان فاضلاب، ونت و درین کندانس',
    category: 'آبرسانی',
    format: 'DWG / PDF • ۴.۱ MB',
    riserCode: 'پوش‌فیت ۱۱۰ و ۶۳ میلی‌متر',
    details: [
      'لوله اصلی فاضلاب ۱۱۰ با دریچه بازدید پاگرد هر طبقه',
      'خط درین اسپلیت ۲۵ میلی‌متر متصل به سیفون آشپزخانه',
      'لوله ونت ۶۳ میلی‌متر تا ۱.۵ متر بالای بام',
    ],
  },
  {
    id: 'bp_elec',
    title: 'رایزر برق اضطراری و چاه ارت',
    category: 'برق',
    format: 'PDF • ۶.۲ MB',
    riserCode: 'تابلو MDP-B • ارت ۱.۴ اهم',
    details: [
      'تابلو کنتور ۲۴ واحد در پارکینگ منفی ۱',
      'برق اضطراری ژنراتور برای آسانسور، بوسترپمپ و پله',
      'مقاومت چاه ارت تست‌شده: ۱.۴ اهم',
    ],
  },
  {
    id: 'bp_gas',
    title: 'تاسیسات گازرسانی و شیر زلزله',
    category: 'گاز',
    format: 'PDF • ۳.۲ MB',
    riserCode: 'شات‌آف حیاط • رله ۵ ریشتر',
    details: [
      'کلکتور علمک و کنتورهای گاز در حیاط شمالی',
      'شیر قطع‌کن زلزله با ریست دستی',
      'لوله مانیسمان رده ۴۰ موتورخانه مرکزی',
    ],
  },
];

const ZONES = [
  'سقف سرویس بهداشتی مستر',
  'داکت رایزر اصلی',
  'آشپزخانه و لوله لباسشویی',
  'سقف کاذب راهرو داخلی',
  'کف لابی و پاگرد',
];

const FLOORS = [
  'طبقه سوم (۳۰۱ تا ۳۰۴)',
  'طبقه دوم (۲۰۱ تا ۲۰۴)',
  'طبقه چهارم (۴۰۱ تا ۴۰۴)',
  'طبقه اول (۱۰۱ تا ۱۰۴)',
  'پارکینگ منفی یک (-۱)',
];

export const MobileFacilitiesPage: React.FC<Props> = ({ onNavigate, onSyncChanged }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as FacilityTab) || 'leaks';
  const [tab, setTab] = useState<FacilityTab>(
    ['leaks', 'report', 'blueprints'].includes(initialTab) ? initialTab : 'leaks',
  );

  // Sub-menu inside Blueprints (_16) to keep screen crisp and uncluttered
  const [bpSub, setBpSub] = useState<'docs' | 'risers' | 'equipment'>('docs');

  useEffect(() => {
    const qTab = searchParams.get('tab') as FacilityTab | null;
    if (qTab && ['leaks', 'report', 'blueprints'].includes(qTab) && qTab !== tab) {
      setTab(qTab);
    }
  }, [searchParams, tab]);

  const switchTab = (next: FacilityTab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
    setFeedback('');
  };

  const [leaks, setLeaks] = useState<Array<Record<string, any>>>([]);
  const [loadingLeaks, setLoadingLeaks] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  // _18 Leaks filters & modal
  const [leakSearch, setLeakSearch] = useState('');
  const [leakFilter, setLeakFilter] = useState<'all' | 'critical' | 'repairing' | 'resolved'>('all');
  const [selectedLeak, setSelectedLeak] = useState<Record<string, any> | null>(null);
  const [statusNote, setStatusNote] = useState('');

  // _17 Report Leak Form
  const [severity, setSeverity] = useState<'critical' | 'moderate' | 'low'>('moderate');
  const [floor, setFloor] = useState(FLOORS[0]);
  const [zone, setZone] = useState(ZONES[0]);
  const [originUnit, setOriginUnit] = useState('واحد ۴۰۲ (دکتر فرزاد رادمنش)');
  const [description, setDescription] = useState(
    'رطوبت و چکه از سقف کاذب سرویس مستر واحد ۳۰۲ — مشکوک به کف‌شور واحد ۴۰۲.',
  );
  const [photos, setPhotos] = useState<string[]>([]);
  const [notifyOriginSms, setNotifyOriginSms] = useState(true);
  const [requestGuardValve, setRequestGuardValve] = useState(true);

  // _16 Blueprints Modals
  const [bpSearch, setBpSearch] = useState('');
  const [showShutoffModal, setShowShutoffModal] = useState(false);
  const [viewingBlueprint, setViewingBlueprint] = useState<BlueprintDoc | null>(null);
  const [bpZoom, setBpZoom] = useState(1);

  const loadLeaks = useCallback(async () => {
    setLoadingLeaks(true);
    try {
      const res = await mobileApi.listLeaks();
      setLeaks(res.data?.items ?? []);
    } catch {
      /* offline */
    } finally {
      setLoadingLeaks(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaks();
  }, [loadLeaks]);

  const autoRiser = useMemo(() => {
    if (zone.includes('آشپزخانه')) {
      return { riser: 'رایزر ۱ (جناح شرقی)', valveCode: 'V-B-101' };
    }
    if (zone.includes('پاگرد') || zone.includes('لابی')) {
      return { riser: 'رایزر آتش‌نشانی F', valveCode: 'V-F-00' };
    }
    return { riser: 'رایزر ۲ (جناح غربی)', valveCode: 'V-B2-03-W' };
  }, [zone]);

  const filteredLeaks = useMemo(() => {
    return leaks.filter((item) => {
      if (leakFilter === 'critical' && item.status !== 'active') return false;
      if (leakFilter === 'repairing' && item.status !== 'repairing') return false;
      if (leakFilter === 'resolved' && item.status !== 'resolved') return false;
      if (leakSearch.trim()) {
        const hay = `${item.code} ${item.zone} ${item.riser} ${item.originUnit}`;
        if (!hay.includes(leakSearch.trim())) return false;
      }
      return true;
    });
  }, [leaks, leakFilter, leakSearch]);

  const filteredBlueprints = useMemo(() => {
    return BLUEPRINTS.filter((bp) =>
      !bpSearch.trim() ? true : `${bp.title} ${bp.riserCode} ${bp.category}`.includes(bpSearch.trim()),
    );
  }, [bpSearch]);

  const activeCount = leaks.filter((l) => l.status !== 'resolved').length;
  const criticalCount = leaks.filter((l) => l.status === 'active').length;
  const resolvedCount = leaks.filter((l) => l.status === 'resolved').length;

  const handleSubmitLeak = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await mobileApi.createLeak({
        severity,
        floor,
        zone,
        riser: autoRiser.riser,
        valveCode: autoRiser.valveCode,
        originUnit,
        description,
        photos,
        notifyOriginSms,
        requestGuardValve,
      });
      onSyncChanged();
      await loadLeaks();
      const createdCode = res.data?.leak?.code || '#TR-NEW';
      setFeedback(
        requestGuardValve
          ? `پرونده ${createdCode} ثبت و دستور بستن فلکه ${autoRiser.valveCode} به گیت انتظامات ارسال شد.`
          : `پرونده نشتی ${createdCode} ثبت شد.`,
      );
      switchTab('leaks');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'ثبت گزارش انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    status: 'active' | 'repairing' | 'resolved',
  ) => {
    setBusy(true);
    try {
      const res = await mobileApi.updateLeakStatus(id, {
        status,
        note: statusNote || undefined,
      });
      if (res.data?.leak) setSelectedLeak(res.data.leak);
      setStatusNote('');
      await loadLeaks();
      onSyncChanged();
      setFeedback(`وضعیت پرونده #${id} به‌روزرسانی شد.`);
    } catch {
      setFeedback('تغییر وضعیت انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const handleDispatchValveToGuard = async (valveCode: string, riserLabel: string) => {
    setBusy(true);
    try {
      await mobileApi.sendGuardDirective({
        directiveType: 'valve_shutoff',
        subject: `بستن فوری فلکه ${valveCode}`,
        body: `دستور قطع اضطراری شیر فلکه ${valveCode} (${riserLabel}) از بخش تاسیسات بلوک B.`,
        priority: 'immediate',
      });
      onSyncChanged();
      setShowShutoffModal(false);
      setFeedback(`دستور بستن شیر فلکه ${valveCode} به کارتابل نگهبانی ارسال شد.`);
    } catch {
      setFeedback('ارسال دستور به نگهبانی انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const handlePhotoUpload = async (file?: File | null) => {
    if (!file) return;
    try {
      const b64 = await compressImageFileToBase64(file);
      setPhotos((prev) => [...prev.slice(0, 3), b64]);
    } catch {
      setFeedback('بارگذاری تصویر انجام نشد.');
    }
  };

  return (
    <div className="flex flex-col gap-3.5 pb-4" dir="rtl">
      {/* Unified Sub-Menu: Stitch _18 Leaks, _17 Report, _16 Blueprints */}
      <SubMenuTabs
        active={tab}
        onChange={(id) => switchTab(id as FacilityTab)}
        items={[
          { id: 'leaks', label: 'کارتابل نشتی', icon: 'water_damage', badge: activeCount },
          { id: 'report', label: 'ثبت گزارش نشتی', icon: 'add_alert' },
          { id: 'blueprints', label: 'نقشه‌ها و رایزر', icon: 'architecture' },
        ]}
      />

      {feedback && (
        <NoticeBanner message={feedback} tone="success" onClose={() => setFeedback('')} />
      )}

      {/* TAB 1: Stitch _18 — Water Leaks Cartable */}
      {tab === 'leaks' && (
        <div className="space-y-3.5 m-panel-in">
          <HeroSummaryCard
            title="کارتابل حوادث و نشتی آب"
            subtitle="بلوک B پردیس نیلوفر"
            badge="نظارت فنی فعال"
            stats={[
              { label: 'بحرانی / فعال', value: criticalCount.toLocaleString('fa-IR'), accent: 'danger' },
              { label: 'در حال بررسی', value: activeCount.toLocaleString('fa-IR') },
              { label: 'رفع‌شده', value: resolvedCount.toLocaleString('fa-IR'), accent: 'positive' },
            ]}
          />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  aria-label="جستجوی پرونده یا رایزر"
                  value={leakSearch}
                  onChange={(e) => setLeakSearch(e.target.value)}
                  placeholder="جستجوی پرونده یا رایزر..."
                  className="w-full h-11 pr-9 pl-3 rounded-xl bg-surface-container-lowest text-[13px] border border-outline-variant/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:border-primary"
                />
              </div>
              <StitchButton size="md" icon="add" onClick={() => switchTab('report')}>
                گزارش
              </StitchButton>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'همه' },
                { id: 'critical', label: 'بحرانی' },
                { id: 'repairing', label: 'در حال تعمیر' },
                { id: 'resolved', label: 'رفع‌شده' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setLeakFilter(f.id as typeof leakFilter)}
                  className={`h-8 px-3 rounded-xl text-[12px] font-medium whitespace-nowrap active:scale-[0.96] transition-[transform,background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    leakFilter === f.id
                      ? 'bg-primary-container text-on-primary-container font-semibold'
                      : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/45'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loadingLeaks ? (
            <ComplexPageLoader compact label="در حال دریافت پرونده‌های نشتی..." />
          ) : filteredLeaks.length === 0 ? (
            <EmptyState
              icon="water_drop"
              title="پرونده‌ای با این فیلتر وجود ندارد"
              description="می‌توانید فیلترها را پاک کنید یا گزارش نشتی جدید ثبت نمایید."
              actionLabel="پاک کردن فیلترها"
              onAction={() => {
                setLeakFilter('all');
                setLeakSearch('');
              }}
            />
          ) : (
            <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
              {filteredLeaks.map((item) => {
                const isCritical = item.status === 'active';
                const isResolved = item.status === 'resolved';
                return (
                  <SurfaceCard key={item.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[14px] font-semibold text-on-surface mb-0 truncate">
                          {item.zone}
                        </h3>
                        <p className="text-[13px] text-on-surface-variant mt-0.5 mb-0 truncate">
                          {item.code} • {item.riser} • فلکه {item.valveCode}
                        </p>
                      </div>
                      <StatusPill
                        label={isCritical ? 'بحرانی' : isResolved ? 'رفع‌شده' : 'در حال تعمیر'}
                        tone={isCritical ? 'danger' : isResolved ? 'positive' : 'primary'}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-surface-container-high gap-2">
                      <span className="text-[12.5px] text-on-surface-variant truncate">
                        منشأ: <strong className="text-on-surface font-medium">{item.originUnit}</strong>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.voucherRef && (
                          <StitchButton
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigate('finance?tab=voucher')}
                          >
                            سند مالی
                          </StitchButton>
                        )}
                        <StitchButton
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedLeak(item)}
                        >
                          جزئیات
                        </StitchButton>
                      </div>
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Stitch _17 — Water Leak & Moisture Report Form */}
      {tab === 'report' && (
        <form onSubmit={handleSubmitLeak} className="space-y-3.5">
          <SurfaceCard className="space-y-3">
            <SectionHeader title="ثبت گزارش نشتی و رطوبت" icon="add_alert" />

            <div>
              <label className="block text-[11.5px] font-semibold text-on-surface-variant mb-1.5">
                شدت حادثه
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'low', label: 'نم و رطوبت' },
                  { id: 'moderate', label: 'چکه مداوم' },
                  { id: 'critical', label: 'ترکیدگی فوری' },
                ].map((lv) => (
                  <button
                    key={lv.id}
                    type="button"
                    onClick={() => setSeverity(lv.id as typeof severity)}
                    className={`h-9 rounded-lg text-[11.5px] font-semibold border transition-colors ${
                      severity === lv.id
                        ? lv.id === 'critical'
                          ? 'bg-error text-on-error border-error'
                          : 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container-low text-on-surface border-outline-variant/30'
                    }`}
                  >
                    {lv.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                  طبقه
                </label>
                <select
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-xl bg-surface-container-low text-[12px] border border-outline-variant/30"
                >
                  {FLOORS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                  محدوده نشت
                </label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-xl bg-surface-container-low text-[12px] border border-outline-variant/30"
                >
                  {ZONES.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Auto-Detected Riser Chip */}
            <div className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/25 flex items-center justify-between text-[11.5px]">
              <span className="text-on-surface-variant">
                رایزر شناسایی‌شده: <strong className="text-primary">{autoRiser.riser}</strong>
              </span>
              <StatusPill label={`فلکه ${autoRiser.valveCode}`} tone="primary" />
            </div>

            <div>
              <label className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                واحد منشأ احتمالی
              </label>
              <input
                type="text"
                value={originUnit}
                onChange={(e) => setOriginUnit(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
              />
            </div>

            <div>
              <label className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                شرح کوتاه حادثه
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
              />
            </div>

            <label className="w-full h-10 rounded-xl bg-surface-container-low text-primary text-[12px] font-semibold flex items-center justify-center gap-1.5 border border-dashed border-outline-variant cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
              <span>
                {photos.length > 0
                  ? `${photos.length.toLocaleString('fa-IR')} عکس پیوست شد`
                  : 'پیوست عکس محل نشتی (اختیاری)'}
              </span>
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => void handlePhotoUpload(e.target.files?.[0])}
              />
            </label>

            <div className="space-y-2 pt-1 text-[12px]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOriginSms}
                  onChange={(e) => setNotifyOriginSms(e.target.checked)}
                />
                <span>ارسال پیامک هشدار به مالک واحد منشأ</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requestGuardValve}
                  onChange={(e) => setRequestGuardValve(e.target.checked)}
                />
                <span>ارسال دستور بستن فلکه {autoRiser.valveCode} به گیت نگهبانی</span>
              </label>
            </div>

            <StitchButton type="submit" disabled={busy} icon="send" className="w-full">
              {busy ? 'در حال ثبت...' : 'ثبت پرونده و اعزام ناظر'}
            </StitchButton>
          </SurfaceCard>
        </form>
      )}

      {/* TAB 3: Stitch _16 — Blueprints, Risers & Specs (Split into Sub-Menus!) */}
      {tab === 'blueprints' && (
        <div className="space-y-3.5">
          <HeroSummaryCard
            title="آرشیو نقشه‌های As-Built و رایزر"
            subtitle="شناسنامه فنی بلوک B پردیس نیلوفر"
            badge="نسخه تاییدشده"
            stats={[
              { label: 'نقشه مهندسی', value: '۴ فایل' },
              { label: 'رایزر اصلی', value: '۳ مسیر' },
              { label: 'فشار مدار آب', value: '۴.۲ بار', accent: 'positive' },
            ]}
          />

          <SubMenuTabs
            active={bpSub}
            onChange={(id) => setBpSub(id as typeof bpSub)}
            items={[
              { id: 'docs', label: 'نقشه‌های As-Built', icon: 'description' },
              { id: 'risers', label: 'ماتریس رایزرها', icon: 'valve' },
              { id: 'equipment', label: 'تجهیزات موتورخانه', icon: 'precision_manufacturing' },
            ]}
          />

          {bpSub === 'docs' && (
            <div className="space-y-2.5 m-panel-in">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label="جستجو در نقشه‌ها"
                  value={bpSearch}
                  onChange={(e) => setBpSearch(e.target.value)}
                  placeholder="جستجو در نقشه‌ها..."
                  className="flex-1 h-11 px-3 rounded-xl bg-surface-container-lowest text-[13px] border border-outline-variant/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                />
                <StitchButton
                  variant="danger"
                  icon="emergency"
                  onClick={() => setShowShutoffModal(true)}
                >
                  قطع اضطراری
                </StitchButton>
              </div>

              {filteredBlueprints.length === 0 ? (
                <EmptyState
                  icon="architecture"
                  title="نقشه‌ای با این عنوان یافت نشد"
                  actionLabel="نمایش همه نقشه‌ها"
                  onAction={() => setBpSearch('')}
                />
              ) : (
                <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                  {filteredBlueprints.map((bp) => (
                    <SurfaceCard key={bp.id} className="p-3.5 flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[14px] font-semibold text-on-surface mb-0 truncate">
                          {bp.title}
                        </h3>
                        <p className="text-[13px] text-on-surface-variant mt-0.5 mb-0 truncate">
                          {bp.category} • {bp.riserCode}
                        </p>
                      </div>
                      <StitchButton
                        variant="secondary"
                        size="sm"
                        icon="zoom_in"
                        onClick={() => {
                          setBpZoom(1);
                          setViewingBlueprint(bp);
                        }}
                      >
                        مشاهده
                      </StitchButton>
                    </SurfaceCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {bpSub === 'risers' && (
            <SurfaceCard className="space-y-2.5">
              <SectionHeader
                title="نقشه فلکه‌ها و رایزرهای بلوک B"
                icon="valve"
                action={
                  <StitchButton
                    variant="danger"
                    size="sm"
                    onClick={() => setShowShutoffModal(true)}
                  >
                    قطع اضطراری
                  </StitchButton>
                }
              />
              {[
                { code: 'V-B-101', name: 'رایزر ۱ (جناح شرقی)', units: '۱۰۱ تا ۸۰۱ — آشپزخانه و سرویس', loc: 'موتورخانه منفی ۲' },
                { code: 'V-B2-03-W', name: 'رایزر ۲ (جناح غربی)', units: '۱۰۲ تا ۸۰۲ — حمام مستر و فن‌کویل', loc: 'پاگرد غربی طبقه ۳' },
                { code: 'V-F-00', name: 'رایزر آتش‌نشانی F', units: 'جعبه F طبقات و کلکتور بام', loc: 'ورودی موتورخانه' },
              ].map((r) => (
                <div
                  key={r.code}
                  className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <strong className="text-[14px] font-semibold text-on-surface block truncate">
                      {r.name} ({r.code})
                    </strong>
                    <span className="text-[13px] text-on-surface-variant block truncate mt-0.5">
                      {r.units} • {r.loc}
                    </span>
                  </div>
                  <StitchButton
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleDispatchValveToGuard(r.code, r.name)}
                  >
                    ابلاغ به گیت
                  </StitchButton>
                </div>
              ))}
            </SurfaceCard>
          )}

          {bpSub === 'equipment' && (
            <SurfaceCard className="space-y-2.5">
              <SectionHeader title="شناسنامه تجهیزات اصلی" icon="precision_manufacturing" />
              {[
                { name: 'بوسترپمپ آبرسانی پنتاکس ۵.۵ اسب', spec: '۲ پمپ موازی + اینورتر • فشار ۴.۲ بار', route: 'finance?tab=voucher', action: 'سند اورهال' },
                { name: 'آسانسور ۱۰ نفره گیرلس البرز', spec: 'ظرفیت ۷۵۰ کیلوگرم • سرویس ماهانه', route: 'finance?tab=petty', action: 'بودجه سرویس' },
                { name: 'دیزل ژنراتور اضطراری ۱۰۰ کاوا', spec: 'تست هفتگی فعال • برق آسانسور و گیت', route: 'letters?view=detail', action: 'گزارش فنی' },
              ].map((eq) => (
                <div
                  key={eq.name}
                  className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <strong className="text-[14px] font-semibold text-on-surface block truncate">
                      {eq.name}
                    </strong>
                    <span className="text-[13px] text-on-surface-variant block truncate mt-0.5">
                      {eq.spec}
                    </span>
                  </div>
                  <StitchButton
                    variant="secondary"
                    size="sm"
                    onClick={() => onNavigate(eq.route)}
                  >
                    {eq.action}
                  </StitchButton>
                </div>
              ))}
            </SurfaceCard>
          )}
        </div>
      )}

      {/* Modal 1: Incident Detail & Status Update */}
      <StitchModal
        open={Boolean(selectedLeak)}
        onClose={() => setSelectedLeak(null)}
        title={selectedLeak ? `پرونده ${selectedLeak.code} — ${selectedLeak.zone}` : ''}
        subtitle={
          selectedLeak ? `${selectedLeak.riser} • فلکه ${selectedLeak.valveCode}` : undefined
        }
      >
        {selectedLeak && (
          <>
            <p className="text-[13px] text-on-surface-variant bg-surface-container-low rounded-xl p-3 mb-0 leading-relaxed">
              {selectedLeak.description}
            </p>

            <input
              type="text"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="یادداشت اقدام ناظر (اختیاری)..."
              className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-[13px] border border-outline-variant/45"
            />

            <div className="grid grid-cols-3 gap-1.5">
              <StitchButton
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => void handleUpdateStatus(selectedLeak.id, 'active')}
              >
                بحرانی
              </StitchButton>
              <StitchButton
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void handleUpdateStatus(selectedLeak.id, 'repairing')}
              >
                در حال تعمیر
              </StitchButton>
              <StitchButton
                size="sm"
                disabled={busy}
                onClick={() => void handleUpdateStatus(selectedLeak.id, 'resolved')}
              >
                رفع‌شده
              </StitchButton>
            </div>

            <StitchButton
              variant="secondary"
              size="sm"
              className="w-full"
              icon="shield"
              onClick={() =>
                void handleDispatchValveToGuard(
                  String(selectedLeak.valveCode || 'V-B2-03-W'),
                  String(selectedLeak.riser || 'رایزر ۲'),
                )
              }
            >
              ابلاغ بستن فلکه به گیت نگهبانی
            </StitchButton>
          </>
        )}
      </StitchModal>

      {/* Modal 2: Emergency Valve Shut-Off Protocol */}
      <StitchModal
        open={showShutoffModal}
        onClose={() => setShowShutoffModal(false)}
        title="دستورالعمل قطع اضطراری فلکه‌ها"
        titleTone="danger"
      >
        <div className="space-y-2 text-[13px]">
          <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between gap-2">
            <span className="truncate">شیر اصلی آب سرد بلوک B (V-B-MAIN)</span>
            <StitchButton
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => void handleDispatchValveToGuard('V-B-MAIN', 'کلکتور اصلی بلوک B')}
            >
              ارسال به گیت
            </StitchButton>
          </div>
          <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between gap-2">
            <span className="truncate">شیر رایزر غربی طبقه ۳ (V-B2-03-W)</span>
            <StitchButton
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => void handleDispatchValveToGuard('V-B2-03-W', 'رایزر ۲ جناح غربی')}
            >
              ارسال به گیت
            </StitchButton>
          </div>
        </div>
      </StitchModal>

      {/* Modal 3: Zoomable As-Built Blueprint Viewer */}
      <StitchModal
        open={Boolean(viewingBlueprint)}
        onClose={() => setViewingBlueprint(null)}
        title={viewingBlueprint?.title ?? ''}
        subtitle={viewingBlueprint ? `${viewingBlueprint.category} • ${viewingBlueprint.format}` : undefined}
      >
        {viewingBlueprint && (
          <>
            <div className="bg-[#1b2533] text-white rounded-xl p-3 overflow-hidden">
              <div
                className="transition-transform duration-150 origin-center"
                style={{ transform: `scale(${bpZoom})` }}
              >
                <svg viewBox="0 0 320 140" className="w-full h-32">
                  <rect x="8" y="8" width="304" height="124" fill="none" stroke="#90a8ff" strokeDasharray="4 4" strokeWidth="1" />
                  <line x1="30" y1="70" x2="290" y2="70" stroke="#85f8c4" strokeWidth="3" />
                  <circle cx="95" cy="70" r="8" fill="#b84448" />
                  <circle cx="225" cy="70" r="8" fill="#3b5998" stroke="#fff" strokeWidth="2" />
                  <text x="160" y="34" fill="#eaf1ff" fontSize="11" textAnchor="middle">
                    {viewingBlueprint.riserCode}
                  </text>
                </svg>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <StitchButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setBpZoom((z) => Math.max(0.8, Number((z - 0.2).toFixed(1))))}
                >
                  −
                </StitchButton>
                <span className="text-[12px] font-numeric-stat">
                  {Math.round(bpZoom * 100).toLocaleString('fa-IR')}٪
                </span>
                <StitchButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setBpZoom((z) => Math.min(1.6, Number((z + 0.2).toFixed(1))))}
                >
                  +
                </StitchButton>
              </div>
            </div>

            <ul className="space-y-1.5 text-[13px] text-on-surface-variant pr-4 mb-0">
              {viewingBlueprint.details.map((d, idx) => (
                <li key={idx}>{d}</li>
              ))}
            </ul>
          </>
        )}
      </StitchModal>
    </div>
  );
};
