import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mobileApi, type MobileBootstrap } from './mobileApi';
import { captureNativePhotoBase64, compressImageFileToBase64 } from './nativeBridge';
import {
  HeroSummaryCard,
  NoticeBanner,
  SectionHeader,
  StatusPill,
  StitchButton,
  SubMenuTabs,
  SurfaceCard,
} from './ui/StitchKit';

type GuardTab = 'gate' | 'directives' | 'incident';
const VALID_TABS: GuardTab[] = ['gate', 'directives', 'incident'];

interface Props {
  bootstrap: MobileBootstrap;
  onSyncChanged: () => void;
  onNavigate?: (route: string) => void;
}

export const MobileGuardPage: React.FC<Props> = ({
  bootstrap,
  onSyncChanged,
  onNavigate,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as GuardTab) || 'gate';
  const [tab, setTab] = useState<GuardTab>(
    VALID_TABS.includes(initialTab) ? initialTab : 'gate',
  );
  const [summary, setSummary] = useState<{
    directives: Array<Record<string, any>>;
    recent_events: Array<Record<string, any>>;
    guest_permits: Array<Record<string, any>>;
    incidents: Array<Record<string, any>>;
  } | null>(null);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'info' | 'danger';
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // Entry/Exit state (pre-filled if ?plate=... passed from Unit Dossier!)
  const [direction, setDirection] = useState<'entry' | 'exit'>('entry');
  const [plateText, setPlateText] = useState(() => searchParams.get('plate') || '');
  const [guestName, setGuestName] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  const [gatePhotoB64, setGatePhotoB64] = useState('');

  // Manager directive compose state
  const [dirSubject, setDirSubject] = useState('');
  const [dirBody, setDirBody] = useState('');
  const [dirPlate, setDirPlate] = useState('');
  const [dirPriority, setDirPriority] = useState<'normal' | 'urgent' | 'immediate'>('urgent');

  // Incident state
  const [incTitle, setIncTitle] = useState('');
  const [incDesc, setIncDesc] = useState('');
  const [incLocation, setIncLocation] = useState('');

  useEffect(() => {
    const qTab = searchParams.get('tab') as GuardTab | null;
    if (qTab && VALID_TABS.includes(qTab) && qTab !== tab) {
      setTab(qTab);
    }
    const qPlate = searchParams.get('plate');
    if (qPlate) setPlateText(qPlate);
  }, [searchParams, tab]);

  const switchTab = (next: GuardTab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
    setNotice(null);
  };

  const loadSummary = useCallback(async () => {
    if (!bootstrap.license.guard_enabled) return;
    try {
      const res = await mobileApi.guardSummary();
      if (res.data) setSummary(res.data);
    } catch {
      /* offline */
    }
  }, [bootstrap.license.guard_enabled]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const pickPhoto = async (setter: (b64: string) => void, file?: File | null) => {
    try {
      if (file) {
        setter(await compressImageFileToBase64(file));
        return;
      }
      const cap = await captureNativePhotoBase64();
      if (cap) setter(cap);
    } catch (err) {
      setNotice({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'آماده‌سازی عکس ناموفق بود.',
      });
    }
  };

  const submitEntryExit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setBusy(true);
    try {
      const res = await mobileApi.recordGuardEntryExit({
        direction,
        plate_text: plateText,
        guest_name: guestName,
        unit_label: unitLabel,
        photo_base64: gatePhotoB64,
      });
      setPlateText('');
      setGuestName('');
      setGatePhotoB64('');
      onSyncChanged();
      void loadSummary();
      setNotice({
        tone: res.queuedOffline ? 'info' : 'success',
        text: res.queuedOffline ? 'تردد در صف آفلاین ثبت شد.' : 'تردد در دفتر گیت ثبت شد.',
      });
    } catch (err) {
      setNotice({ tone: 'danger', text: err instanceof Error ? err.message : 'خطا در ثبت تردد.' });
    } finally {
      setBusy(false);
    }
  };

  const handleAck = async (id: string, status: 'acknowledged' | 'completed') => {
    setBusy(true);
    try {
      await mobileApi.ackGuardDirective(id, status);
      void loadSummary();
      onSyncChanged();
      setNotice({
        tone: 'success',
        text: status === 'completed' ? 'اجرای دستور ثبت شد.' : 'دریافت دستور تایید شد.',
      });
    } catch (err) {
      setNotice({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت وضعیت ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  const submitDirective = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await mobileApi.sendGuardDirective({
        directiveType: 'gate_order',
        subject: dirSubject,
        body: dirBody,
        plateText: dirPlate,
        priority: dirPriority,
      });
      setDirSubject('');
      setDirBody('');
      setDirPlate('');
      void loadSummary();
      onSyncChanged();
      setNotice({
        tone: res.queuedOffline ? 'info' : 'success',
        text: res.queuedOffline ? 'دستور در صف آفلاین قرار گرفت.' : 'دستور به گیت ارسال شد.',
      });
    } catch (err) {
      setNotice({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ارسال دستور ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  const submitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await mobileApi.reportGuardIncident({
        title: incTitle,
        description: incDesc,
        location: incLocation,
        severity: 'high',
      });
      setIncTitle('');
      setIncDesc('');
      setIncLocation('');
      void loadSummary();
      onSyncChanged();
      setNotice({
        tone: res.queuedOffline ? 'info' : 'success',
        text: res.queuedOffline ? 'حادثه در صف ارسال ثبت شد.' : 'گزارش حادثه ثبت شد.',
      });
    } catch (err) {
      setNotice({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت حادثه ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  const sentDirectives = summary?.directives.filter((d) => d.status === 'sent').length ?? 0;
  const eventsCount = summary?.recent_events.length ?? 0;

  return (
    <div className="flex flex-col gap-3.5 pb-4" dir="rtl">
      {/* Stitch _5 Hero Summary */}
      <HeroSummaryCard
        title="شیفت صبح • رحمان حسینی"
        subtitle="گیت ورودی شمالی • پلاک‌خوان ALPR فعال"
        badge="شیفت فعال"
        stats={[
          { label: 'حاضرین شیفت', value: '۳ نفر' },
          { label: 'تردد ثبت‌شده', value: eventsCount.toLocaleString('fa-IR'), accent: 'positive' },
          { label: 'دستور جدید', value: sentDirectives.toLocaleString('fa-IR'), accent: 'danger' },
        ]}
      />

      {/* Unified Sub-Menu */}
      <SubMenuTabs
        active={tab}
        onChange={(id) => switchTab(id as GuardTab)}
        items={[
          { id: 'gate', label: 'تردد و پلاک‌خوان', icon: 'directions_car' },
          { id: 'directives', label: 'دستورها', icon: 'assignment_late', badge: sentDirectives },
          { id: 'incident', label: 'گزارش حادثه', icon: 'report_problem' },
        ]}
      />

      {notice && (
        <NoticeBanner
          message={notice.text}
          tone={notice.tone}
          onClose={() => setNotice(null)}
        />
      )}

      {tab === 'gate' && (
        <div className="space-y-3.5">
          <SurfaceCard className="space-y-3">
            <SectionHeader
              title="ثبت تردد خودرو و مهمان"
              icon="photo_camera_front"
              action={
                <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded-xl border border-outline-variant/35">
                  <button
                    type="button"
                    onClick={() => setDirection('entry')}
                    className={`px-3 py-1 rounded-lg text-[12.5px] font-medium ${
                      direction === 'entry'
                        ? 'bg-surface-container-lowest text-on-primary-container font-semibold shadow-xs'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    ورود
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('exit')}
                    className={`px-3 py-1 rounded-lg text-[12.5px] font-medium ${
                      direction === 'exit'
                        ? 'bg-surface-container-lowest text-on-primary-container font-semibold shadow-xs'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    خروج
                  </button>
                </div>
              }
            />

            <form onSubmit={submitEntryExit} className="space-y-2.5">
              <input
                type="text"
                value={plateText}
                onChange={(e) => setPlateText(e.target.value)}
                placeholder="پلاک خودرو (مثلاً ۱۲ب۳۴۵-۴۴)"
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] font-numeric-stat border border-outline-variant/30"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="نام مهمان / راننده"
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
                />
                <input
                  type="text"
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  placeholder="واحد مقصد"
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
                />
              </div>

              <label className="w-full h-9 rounded-xl bg-surface-container-low text-primary text-[11.5px] font-semibold flex items-center justify-center gap-1.5 border border-dashed border-outline-variant cursor-pointer">
                <span className="material-symbols-outlined text-[17px]">add_a_photo</span>
                <span>{gatePhotoB64 ? 'عکس پلاک پیوست شد' : 'پیوست عکس پلاک (اختیاری)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => void pickPhoto(setGatePhotoB64, e.target.files?.[0])}
                />
              </label>

              <StitchButton type="submit" disabled={busy} icon="how_to_reg" className="w-full">
                {busy ? 'در حال ثبت...' : direction === 'entry' ? 'ثبت ورود' : 'ثبت خروج'}
              </StitchButton>
            </form>
          </SurfaceCard>

          <SurfaceCard className="space-y-2.5">
            <SectionHeader title="دفتر تردد اخیر گیت" icon="history" />
            <div className="divide-y divide-surface-container-high">
              {(summary?.recent_events ?? []).slice(0, 8).map((ev) => {
                const isExit = ev.direction === 'exit';
                return (
                  <div
                    key={ev.id}
                    className="py-2.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <strong className="text-[14px] font-semibold text-on-surface font-numeric-stat block truncate">
                        {ev.plate_text || ev.guest_name || 'بدون پلاک'}
                      </strong>
                      <span className="text-[13px] text-on-surface-variant block truncate mt-0.5">
                        {ev.unit_label || 'گیت اصلی'} {ev.guest_name ? `• ${ev.guest_name}` : ''}
                      </span>
                    </div>
                    <StatusPill
                      label={isExit ? 'خروج' : 'ورود'}
                      tone={isExit ? 'neutral' : 'positive'}
                    />
                  </div>
                );
              })}
            </div>
          </SurfaceCard>
        </div>
      )}

      {tab === 'directives' && (
        <div className="space-y-3.5">
          <SurfaceCard className="space-y-3">
            <SectionHeader title="ابلاغ دستور به گیت" icon="campaign" />
            <form onSubmit={submitDirective} className="space-y-2.5">
              <input
                type="text"
                required
                value={dirSubject}
                onChange={(e) => setDirSubject(e.target.value)}
                placeholder="موضوع دستور..."
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={dirPlate}
                  onChange={(e) => setDirPlate(e.target.value)}
                  placeholder="پلاک مرتبط (اختیاری)"
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
                />
                <select
                  value={dirPriority}
                  onChange={(e) => setDirPriority(e.target.value as typeof dirPriority)}
                  className="w-full h-10 px-2.5 rounded-xl bg-surface-container-low text-[12px] border border-outline-variant/30"
                >
                  <option value="normal">عادی</option>
                  <option value="urgent">فوری</option>
                  <option value="immediate">آنی</option>
                </select>
              </div>
              <textarea
                rows={2}
                required
                value={dirBody}
                onChange={(e) => setDirBody(e.target.value)}
                placeholder="شرح دستور..."
                className="w-full p-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
              />
              <StitchButton type="submit" disabled={busy} icon="send" className="w-full">
                ارسال به کارتابل انتظامات
              </StitchButton>
            </form>
          </SurfaceCard>

          <div className="space-y-2.5">
            {(summary?.directives ?? []).map((dir) => (
              <SurfaceCard key={dir.id} className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-[14px] font-semibold text-on-surface mb-0 truncate">
                    {dir.subject}
                  </h4>
                  <StatusPill
                    label={
                      dir.status === 'completed'
                        ? 'انجام شد'
                        : dir.status === 'acknowledged'
                          ? 'دریافت شد'
                          : 'جدید'
                    }
                    tone={
                      dir.status === 'completed'
                        ? 'positive'
                        : dir.status === 'acknowledged'
                          ? 'primary'
                          : 'danger'
                    }
                  />
                </div>
                <p className="text-[13px] text-on-surface-variant mb-0 truncate">{dir.body}</p>
                <div className="flex items-center justify-between pt-2 border-t border-surface-container-high text-[12.5px]">
                  <span className="text-on-surface-variant truncate">{dir.sender_name}</span>
                  <div className="flex items-center gap-1.5">
                    {dir.directiveType === 'valve_shutoff' && onNavigate && (
                      <StitchButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigate('facilities?tab=leaks')}
                      >
                        تاسیسات
                      </StitchButton>
                    )}
                    {dir.status !== 'completed' && (
                      <>
                        {dir.status === 'sent' && (
                          <StitchButton
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleAck(dir.id, 'acknowledged')}
                          >
                            دریافت شد
                          </StitchButton>
                        )}
                        <StitchButton
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleAck(dir.id, 'completed')}
                        >
                          انجام شد
                        </StitchButton>
                      </>
                    )}
                  </div>
                </div>
              </SurfaceCard>
            ))}
          </div>
        </div>
      )}

      {tab === 'incident' && (
        <SurfaceCard className="space-y-3">
          <SectionHeader title="ثبت گزارش حادثه امنیتی" icon="emergency_home" />
          <form onSubmit={submitIncident} className="space-y-2.5">
            <input
              type="text"
              required
              value={incTitle}
              onChange={(e) => setIncTitle(e.target.value)}
              placeholder="عنوان حادثه یا تخلف..."
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
            />
            <input
              type="text"
              value={incLocation}
              onChange={(e) => setIncLocation(e.target.value)}
              placeholder="مکان / بلوک / گیت"
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
            />
            <textarea
              rows={3}
              required
              value={incDesc}
              onChange={(e) => setIncDesc(e.target.value)}
              placeholder="شرح مشاهدات..."
              className="w-full p-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
            />
            <StitchButton variant="danger" type="submit" disabled={busy} icon="notification_important" className="w-full">
              {busy ? 'در حال ثبت...' : 'ثبت و ارسال فوری گزارش'}
            </StitchButton>
          </form>
        </SurfaceCard>
      )}
    </div>
  );
};