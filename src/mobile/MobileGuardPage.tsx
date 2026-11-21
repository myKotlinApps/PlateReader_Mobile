import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mobileApi, type MobileBootstrap } from './mobileApi';
import { captureNativePhotoBase64, compressImageFileToBase64 } from './nativeBridge';
import {
  EmptyState,
  HeroSummaryCard,
  NoticeBanner,
  SectionHeader,
  StatusPill,
  StitchButton,
  SubMenuTabs,
  SurfaceCard,
} from './ui/StitchKit';
import { IranPlateBadge, IranPlateInput } from './ui/IranPlate';
import { rbacApi } from './rbac/rbacApi';
import type { GuestPermitDoc } from '../server/nosqlStore';
import {
  findApprovedVehicleByPlate,
  type ApprovedVehicleDoc,
} from './utils/residentOnboarding';

type GuardTab = 'gate' | 'vehicles' | 'permits' | 'directives' | 'incident';
const VALID_TABS: GuardTab[] = ['gate', 'vehicles', 'permits', 'directives', 'incident'];

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
  const [livePermits, setLivePermits] = useState<GuestPermitDoc[]>([]);
  const [approvedVehicles, setApprovedVehicles] = useState<ApprovedVehicleDoc[]>([]);
  const [vehicleQuery, setVehicleQuery] = useState('');
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
    try {
      if (bootstrap.license.guard_enabled) {
        const res = await mobileApi.guardSummary();
        if (res.data) setSummary(res.data);
      }
    } catch {
      /* offline */
    }
    try {
      const [pRes, vRes] = await Promise.all([
        rbacApi.listGuestPermits(),
        rbacApi.listApprovedVehicles(),
      ]);
      setLivePermits(pRes.items);
      setApprovedVehicles(vRes.items);
    } catch {
      /* ignore when no rbac token */
    }
  }, [bootstrap.license.guard_enabled]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const handleUpdatePermit = async (permit: GuestPermitDoc, status: 'entered' | 'exited') => {
    setBusy(true);
    try {
      await rbacApi.updateGuestPermit(permit.id, status);
      await loadSummary();
      onSyncChanged();
      setNotice({
        tone: 'success',
        text:
          status === 'entered'
            ? `ورود مهمان «${permit.guestName}» (واحد ${permit.unitCode}) تایید و در دفتر گیت ثبت شد.`
            : `خروج مهمان «${permit.guestName}» ثبت گردید.`,
      });
    } catch (err) {
      setNotice({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'تغییر وضعیت مجوز انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

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
  const pendingPermitsCount = livePermits.filter((p) => p.status === 'pending_gate').length;
  const enabledVehiclesCount = approvedVehicles.filter((v) => v.gateAccessEnabled).length;

  const matchedResidentVehicle = useMemo(
    () => findApprovedVehicleByPlate(plateText, approvedVehicles),
    [plateText, approvedVehicles],
  );

  const filteredVehicles = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    if (!q) return approvedVehicles;
    return approvedVehicles.filter(
      (v) =>
        v.plateText.toLowerCase().includes(q) ||
        v.unitCode.toLowerCase().includes(q) ||
        v.residentName.toLowerCase().includes(q) ||
        v.parkingNumber.toLowerCase().includes(q) ||
        v.blockId.toLowerCase().includes(q),
    );
  }, [approvedVehicles, vehicleQuery]);

  const handleQuickResidentGateEntry = async (v: ApprovedVehicleDoc) => {
    setBusy(true);
    setNotice(null);
    try {
      await mobileApi.recordGuardEntryExit({
        direction: 'entry',
        plate_text: v.plateText,
        guest_name: `${v.residentName} (ساکن مجاز)`,
        unit_label: `واحد ${v.unitCode} • پارکینگ ${v.parkingNumber}`,
        photo_base64: '',
      });
      onSyncChanged();
      void loadSummary();
      setNotice({
        tone: 'success',
        text: `ورود خودروی مجاز واحد ${v.unitCode} (${v.residentName}) در گیت ثبت شد و فرمان بازشدن راهبند ارسال گردید.`,
      });
    } catch (err) {
      setNotice({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت ورود خودرو ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 pb-4" dir="rtl">
      {/* Stitch _5 Hero Summary */}
      <HeroSummaryCard
        title="شیفت فعال گیت ورودی • انتظامات نیلوفر"
        subtitle="گیت ورودی شمالی • پلاک‌خوان ALPR، لیست خودروهای مجاز ساکنین و مجوز مهمان"
        badge="شیفت فعال"
        stats={[
          { label: 'پلاک مجاز ساکنین', value: enabledVehiclesCount.toLocaleString('fa-IR'), accent: 'positive' },
          { label: 'مجوز مهمان باز', value: pendingPermitsCount.toLocaleString('fa-IR'), accent: pendingPermitsCount > 0 ? 'danger' : 'positive' },
          { label: 'دستور جدید', value: sentDirectives.toLocaleString('fa-IR'), accent: 'danger' },
        ]}
      />

      {/* Unified Sub-Menu */}
      <SubMenuTabs
        active={tab}
        onChange={(id) => switchTab(id as GuardTab)}
        items={[
          { id: 'gate', label: 'تردد و پلاک‌خوان', icon: 'directions_car' },
          { id: 'vehicles', label: 'خودروهای مجاز ساکنین', icon: 'verified_user', badge: enabledVehiclesCount },
          { id: 'permits', label: 'مجوز مهمان', icon: 'badge', badge: pendingPermitsCount },
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
        <div className="space-y-3.5 m-panel-in lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
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

            <form onSubmit={submitEntryExit} className="space-y-3">
              <IranPlateInput
                label="پلاک خودرو یا وسیله نقلیه"
                value={plateText}
                onChange={setPlateText}
              />
              {matchedResidentVehicle && (
                <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-secondary-container/60 border border-secondary/45 flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <strong className="text-[12.5px] font-bold text-on-secondary-container block">
                      ✓ پلاک مجاز ساکن تاییدشده — واحد {matchedResidentVehicle.unitCode} ({matchedResidentVehicle.residentName})
                    </strong>
                    <span className="text-[11.5px] text-on-secondary-container/85 block">
                      {matchedResidentVehicle.modelAndColor} • پارکینگ {matchedResidentVehicle.parkingNumber} ({matchedResidentVehicle.parkingType})
                    </span>
                  </div>
                  <StitchButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setGuestName(matchedResidentVehicle.residentName);
                      setUnitLabel(`واحد ${matchedResidentVehicle.unitCode}`);
                    }}
                  >
                    پرکردن خودکار
                  </StitchButton>
                </div>
              )}
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
            {(summary?.recent_events ?? []).length === 0 ? (
              <p className="text-[13px] text-on-surface-variant text-center py-6 mb-0">
                هنوز ترددی در این شیفت ثبت نشده است.
              </p>
            ) : (
              <div className="divide-y divide-surface-container-high">
                {(summary?.recent_events ?? []).slice(0, 8).map((ev) => {
                  const isExit = ev.direction === 'exit';
                  return (
                    <div
                      key={ev.id}
                      className="py-2.5 flex items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        {ev.plate_text ? (
                          <IranPlateBadge value={ev.plate_text} size="sm" showTypeLabel />
                        ) : (
                          <strong className="text-[14px] font-semibold text-on-surface block truncate">
                            {ev.guest_name || 'بدون پلاک'}
                          </strong>
                        )}
                        <span className="text-[12.5px] text-on-surface-variant block truncate">
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
            )}
          </SurfaceCard>
        </div>
      )}

      {tab === 'vehicles' && (
        <div className="space-y-3 m-panel-in">
          <SurfaceCard className="space-y-3">
            <SectionHeader
              title="فهرست رسمی پلاک‌های مجاز ساکنین (تاییدشده توسط مدیر بلوک)"
              icon="verified_user"
              action={
                <StatusPill
                  label={`${enabledVehiclesCount.toLocaleString('fa-IR')} پلاک فعال گیت`}
                  tone="positive"
                />
              }
            />
            <input
              type="search"
              value={vehicleQuery}
              onChange={(e) => setVehicleQuery(e.target.value)}
              placeholder="جستجو بر اساس پلاک، واحد (مثلاً B-15)، نام ساکن یا شماره پارکینگ..."
              className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
            />
          </SurfaceCard>

          {filteredVehicles.length === 0 ? (
            <EmptyState
              icon="directions_car"
              title="خودروی مجازی با این مشخصات یافت نشد"
              description="پس از تایید پرونده ثبت‌نام QR ساکنین توسط مدیر بلوک، پلاک‌ها به‌صورت خودکار اینجا ثبت می‌شوند."
            />
          ) : (
            <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
              {filteredVehicles.map((v) => (
                <SurfaceCard key={v.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-[14px] font-bold text-on-surface">
                          واحد {v.unitCode} — {v.residentName}
                        </strong>
                        <span className="px-1.5 py-0.5 rounded-[2px] bg-surface-container-low border border-outline-variant/45 text-[11px] text-on-surface-variant">
                          بلوک {v.blockId}
                        </span>
                      </div>
                      <span className="text-[12px] text-on-surface-variant block">
                        {v.vehicleType} • {v.modelAndColor} • {v.occupancyType}
                      </span>
                    </div>
                    <StatusPill
                      label={v.gateAccessEnabled ? 'گیت باز (مجاز)' : 'مسدود'}
                      tone={v.gateAccessEnabled ? 'positive' : 'danger'}
                    />
                  </div>

                  <IranPlateBadge value={v.plateText} size="sm" showTypeLabel />

                  <div className="p-2 rounded-[var(--ui-card-radius)] bg-surface-container-low/80 border border-outline-variant/40 text-[11.5px] text-on-surface-variant flex items-center justify-between gap-2 flex-wrap">
                    <span>
                      پارکینگ <strong className="text-on-surface">{v.parkingNumber}</strong> ({v.parkingType}
                      {v.parkingFloorOrZone ? ` — ${v.parkingFloorOrZone}` : ''})
                    </span>
                    <span
                      className={`font-semibold ${
                        v.hasParkingProof ? 'text-secondary' : 'text-error'
                      }`}
                    >
                      {v.hasParkingProof ? '✓ مدرک پارکینگ تاییدشده' : 'بدون مدرک پارکینگ'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-outline-variant/35 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-on-surface-variant">
                      تایید مدیر: {v.approvedByName}
                    </span>
                    {v.gateAccessEnabled && (
                      <StitchButton
                        size="sm"
                        icon="login"
                        disabled={busy}
                        onClick={() => void handleQuickResidentGateEntry(v)}
                      >
                        ثبت ورود خودرو ساکن
                      </StitchButton>
                    )}
                  </div>
                </SurfaceCard>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'permits' && (
        <div className="space-y-3 m-panel-in">
          <SectionHeader
            title="مجوزهای مهمان ثبت‌شده توسط ساکنین (اتصال زنده به گیت)"
            icon="badge"
          />
          {livePermits.length === 0 ? (
            <EmptyState
              icon="badge"
              title="مجوز مهمانی ثبت نشده است"
              description="به محض ثبت مهمان توسط ساکنین، پلاک و نام مهمان اینجا نمایش داده می‌شود."
            />
          ) : (
            <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
              {livePermits.map((p) => (
                <SurfaceCard key={p.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <strong className="text-[14px] font-bold text-on-surface block truncate">
                        {p.guestName} — واحد {p.unitCode}
                      </strong>
                      <span className="text-[12px] text-on-surface-variant block">
                        میزبان: {p.residentName} • {p.visitDateLabel}
                      </span>
                      {p.plateText && <IranPlateBadge value={p.plateText} size="sm" showTypeLabel />}
                    </div>
                    <StatusPill
                      label={
                        p.status === 'entered'
                          ? 'داخل مجتمع'
                          : p.status === 'exited'
                            ? 'خارج شد'
                            : p.status === 'cancelled'
                              ? 'لغو شده'
                              : 'منتظر ورود'
                      }
                      tone={
                        p.status === 'entered'
                          ? 'positive'
                          : p.status === 'pending_gate'
                            ? 'danger'
                            : 'neutral'
                      }
                    />
                  </div>
                  {p.note && (
                    <p className="text-[12px] text-on-surface-variant mb-0">{p.note}</p>
                  )}
                  {(p.status === 'pending_gate' || p.status === 'entered') && (
                    <div className="pt-2 border-t border-outline-variant/35 flex items-center justify-end gap-2">
                      {p.status === 'pending_gate' && (
                        <StitchButton
                          size="sm"
                          icon="login"
                          disabled={busy}
                          onClick={() => void handleUpdatePermit(p, 'entered')}
                          className="rounded-[var(--ui-btn-radius)]"
                        >
                          ثبت ورود مهمان
                        </StitchButton>
                      )}
                      {p.status === 'entered' && (
                        <StitchButton
                          variant="secondary"
                          size="sm"
                          icon="logout"
                          disabled={busy}
                          onClick={() => void handleUpdatePermit(p, 'exited')}
                          className="rounded-[var(--ui-btn-radius)]"
                        >
                          ثبت خروج
                        </StitchButton>
                      )}
                    </div>
                  )}
                </SurfaceCard>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'directives' && (
        <div className="space-y-3.5 m-panel-in">
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
              <IranPlateInput
                label="پلاک مرتبط با دستور (اختیاری)"
                value={dirPlate}
                onChange={setDirPlate}
                compact
              />
              <select
                aria-label="فوریت دستور"
                value={dirPriority}
                onChange={(e) => setDirPriority(e.target.value as typeof dirPriority)}
                className="w-full h-10 px-2.5 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/45"
              >
                <option value="normal">فوریت: عادی</option>
                <option value="urgent">فوریت: فوری</option>
                <option value="immediate">فوریت: آنی</option>
              </select>
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

          {(summary?.directives ?? []).length === 0 ? (
            <EmptyState
              icon="verified"
              title="دستور جدیدی در کارتابل انتظامات نیست"
              description="همه ابلاغیه‌ها انجام شده‌اند یا از فرم بالا می‌توانید دستور جدید ثبت کنید."
            />
          ) : (
          <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
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
          )}
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