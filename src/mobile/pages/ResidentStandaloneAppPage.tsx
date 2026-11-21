import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Car,
  CheckCircle2,
  Download,
  FileUp,
  Home,
  KeyRound,
  Moon,
  Plus,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { rbacApi, readFileAsDataUrl } from '../rbac/rbacApi';
import {
  applyAppearancePrefs,
  DEFAULT_APPEARANCE_PREFS,
  reapplyAppearanceForTheme,
} from '../theme/palettes';
import {
  validateResidentOnboarding,
  type OccupancyKind,
  type ParkingAllocationType,
  type ResidentVehicleEntry,
} from '../utils/residentOnboarding';
import { IranPlateBadge, IranPlateInput } from '../ui/IranPlate';
import { JalaliDateTimePicker } from '../components/JalaliDateTimePicker';
import { NoticeBanner, StatusPill, StitchButton, SurfaceCard } from '../ui/StitchKit';

type WizardView = 'download' | 'step1_code' | 'step2_resident' | 'step3_vehicles' | 'step4_done';

interface VerifiedUnitInfo {
  code: string;
  blockId: string;
  blockName: string;
  managerName: string;
  unitCode: string;
  existingParkingCode: string;
  existingStorageCode: string;
}

function makeEmptyVehicle(defaultParking = ''): ResidentVehicleEntry {
  return {
    id: `veh_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    vehicleType: 'سواری',
    modelAndColor: '',
    plateText: '',
    parkingType: 'اختصاصی سنددار',
    parkingNumber: defaultParking,
    parkingFloorOrZone: '',
  };
}

export const ResidentStandaloneAppPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const blockParam = searchParams.get('block') || '';
  const codeParam = searchParams.get('code') || '';

  const [dark, setDark] = useState(() => {
    const isD =
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      window.localStorage.getItem('plate_reader_theme') === 'dark';
    if (isD) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('app-skin-dark');
    }
    return isD;
  });

  const [view, setView] = useState<WizardView>(codeParam ? 'step1_code' : 'download');
  const [blockTitle, setBlockTitle] = useState(blockParam ? `بلوک ${blockParam}` : 'تمامی بلوک‌ها');
  const [managerTitle, setManagerTitle] = useState('مدیریت مجتمع نیلوفر');
  const [installGuideOpen, setInstallGuideOpen] = useState(false);

  // Step 1: Manager-Issued Unit Code
  const [inviteCode, setInviteCode] = useState(codeParam);
  const [verifiedUnit, setVerifiedUnit] = useState<VerifiedUnitInfo | null>(null);

  // Step 2: Resident & Tenant / Landlord Info
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [householdCount, setHouseholdCount] = useState(2);
  const [occupancyType, setOccupancyType] = useState<OccupancyKind>('مالک ساکن');
  const [landlordName, setLandlordName] = useState('');
  const [landlordPhone, setLandlordPhone] = useState('');
  const [leaseStartJalali, setLeaseStartJalali] = useState('۱۴۰۵/۰۷/۰۱');
  const [leaseEndJalali, setLeaseEndJalali] = useState('۱۴۰۶/۰۷/۰۱');
  const [leaseContractDataUrl, setLeaseContractDataUrl] = useState<string | undefined>(undefined);
  const [leaseContractName, setLeaseContractName] = useState('');
  const [storageCode, setStorageCode] = useState('');
  const [hasPets, setHasPets] = useState(false);
  const [specialNeedsNote, setSpecialNeedsNote] = useState('');
  const [desiredUsername, setDesiredUsername] = useState('');
  const [desiredPassword, setDesiredPassword] = useState('');

  // Step 3: Vehicles & Parking Proof
  const [vehicles, setVehicles] = useState<ResidentVehicleEntry[]>([makeEmptyVehicle()]);

  // Step 4: Submission Result
  const [trackingCode, setTrackingCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'info' | 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    applyAppearancePrefs(DEFAULT_APPEARANCE_PREFS, dark);
  }, [dark]);

  useEffect(() => {
    void rbacApi
      .getResidentOnboardingInfo(blockParam || undefined)
      .then((info) => {
        if (info.selectedBlock) {
          setBlockTitle(info.selectedBlock.name);
          setManagerTitle(info.selectedBlock.managerName);
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, [blockParam]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('app-skin-dark', next);
    reapplyAppearanceForTheme(next);
    try {
      window.localStorage.setItem('plate_reader_theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  };

  /** Downloads a standalone one-tap launcher package for the Resident App */
  const handleDownloadStandaloneApp = () => {
    const appUrl = window.location.href;
    const launcherHtml = `<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>اپلیکیشن ساکنین مجتمع نیلوفر</title>
<meta http-equiv="refresh" content="0; url=${appUrl}" />
</head><body style="font-family:Tahoma,sans-serif;text-align:center;padding:40px;">
<h2>در حال باز کردن اپلیکیشن ساکنین مجتمع نیلوفر...</h2>
<p><a href="${appUrl}">اگر به‌صورت خودکار باز نشد اینجا کلیک کنید</a></p>
</body></html>`;
    const blob = new Blob([launcherHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Niloofar-Resident-App.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setInstallGuideOpen(true);
    setFeedback({
      tone: 'success',
      text: 'نسخه اختصاصی اپلیکیشن ساکنین دانلود شد! می‌توانید همین الان ثبت‌نام را در همین صفحه تکمیل کنید.',
    });
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      const res = await rbacApi.verifyUnitInviteCode(inviteCode.trim());
      setVerifiedUnit(res.invite);
      if (res.invite.existingStorageCode && !storageCode) {
        setStorageCode(res.invite.existingStorageCode);
      }
      if (res.invite.existingParkingCode && vehicles.length === 1 && !vehicles[0].parkingNumber) {
        setVehicles([{ ...vehicles[0], parkingNumber: res.invite.existingParkingCode }]);
      }
      setFeedback({
        tone: 'success',
        text: `کد واحد ${res.invite.unitCode} (${res.invite.blockName}) با موفقیت احراز شد.`,
      });
      setView('step2_resident');
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'کد اختصاصی واحد معتبر نیست.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleVehicleCountChange = (count: number) => {
    const safe = Math.max(0, Math.min(4, count));
    setVehicles((prev) => {
      if (safe === prev.length) return prev;
      if (safe < prev.length) return prev.slice(0, safe);
      const next = [...prev];
      while (next.length < safe) {
        next.push(makeEmptyVehicle(next.length === 0 ? verifiedUnit?.existingParkingCode || '' : ''));
      }
      return next;
    });
  };

  const updateVehicle = (id: string, patch: Partial<ResidentVehicleEntry>) => {
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  const handleUploadAttachment = async (
    file: File | undefined,
    onDone: (dataUrl: string, name: string) => void,
  ) => {
    if (!file) return;
    if (file.size > 2_200_000) {
      setFeedback({
        tone: 'danger',
        text: 'حجم فایل پیوست باید کمتر از ۲ مگابایت باشد.',
      });
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onDone(dataUrl, file.name);
      setFeedback({
        tone: 'success',
        text: `مدرک «${file.name}» با موفقیت پیوست شد.`,
      });
    } catch {
      setFeedback({ tone: 'danger', text: 'خواندن فایل انتخابی انجام نشد.' });
    }
  };

  const handleGoToVehicles = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!fullName.trim() || fullName.trim().length < 3) {
      setFeedback({ tone: 'danger', text: 'لطفاً نام و نام خانوادگی کامل را وارد کنید.' });
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setFeedback({ tone: 'danger', text: 'شماره موبایل معتبر ساکن الزامی است.' });
      return;
    }
    if (occupancyType === 'مستأجر') {
      if (!landlordName.trim() || !landlordPhone.trim()) {
        setFeedback({
          tone: 'danger',
          text: 'برای مستأجرین، نام و شماره تماس صاحبخانه الزامی است.',
        });
        return;
      }
      if (!leaseStartJalali.trim() || !leaseEndJalali.trim()) {
        setFeedback({
          tone: 'danger',
          text: 'لطفاً تاریخ دقیق شروع و پایان مدت اجاره (شمسی) را انتخاب کنید.',
        });
        return;
      }
    }
    setView('step3_vehicles');
  };

  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedUnit) return;
    setFeedback(null);

    const payload = {
      inviteCode: verifiedUnit.code,
      fullName: fullName.trim(),
      nationalId: nationalId.trim() || undefined,
      phone: phone.trim(),
      secondaryPhone: secondaryPhone.trim() || undefined,
      emergencyContactName: emergencyContactName.trim() || undefined,
      emergencyContactPhone: emergencyContactPhone.trim() || undefined,
      householdCount,
      occupancyType,
      landlordName: occupancyType === 'مستأجر' ? landlordName.trim() : undefined,
      landlordPhone: occupancyType === 'مستأجر' ? landlordPhone.trim() : undefined,
      leaseStartJalali: occupancyType === 'مستأجر' ? leaseStartJalali : undefined,
      leaseEndJalali: occupancyType === 'مستأجر' ? leaseEndJalali : undefined,
      leaseContractDataUrl: occupancyType === 'مستأجر' ? leaseContractDataUrl : undefined,
      leaseContractName: occupancyType === 'مستأجر' ? leaseContractName : undefined,
      storageCode: storageCode.trim() || undefined,
      hasPets,
      specialNeedsNote: specialNeedsNote.trim() || undefined,
      desiredUsername: desiredUsername.trim() || undefined,
      desiredPassword: desiredPassword.trim() || undefined,
      vehicles,
    };

    const check = validateResidentOnboarding(payload);
    if (!check.ok) {
      setFeedback({ tone: 'danger', text: check.errors[0] });
      return;
    }

    setBusy(true);
    try {
      const res = await rbacApi.submitResidentOnboarding(payload);
      setTrackingCode(res.trackingCode);
      setView('step4_done');
      setFeedback({
        tone: 'success',
        text: `اطلاعات واحد ${verifiedUnit.unitCode} با کد رهگیری ${res.trackingCode} ثبت شد.`,
      });
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت نهایی اطلاعات ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface text-on-surface pb-16" dir="rtl">
      {feedback && (
        <NoticeBanner
          message={feedback.text}
          tone={feedback.tone}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Standalone Resident App Header (Distinct from Management App!) */}
      <header className="sticky top-0 z-30 bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/60 px-4 py-3">
        <div className="max-w-[680px] mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-[var(--ui-card-radius)] bg-primary text-on-primary flex items-center justify-center shrink-0">
              <Home size={20} />
            </span>
            <div className="min-w-0">
              <strong className="text-[14.5px] font-extrabold text-on-surface block truncate">
                اپلیکیشن اختصاصی ساکنین نیلوفر
              </strong>
              <span className="text-[11.5px] text-on-surface-variant block truncate">
                {verifiedUnit
                  ? `${verifiedUnit.blockName} • واحد ${verifiedUnit.unitCode}`
                  : `${blockTitle} • ثبت‌نام امن با کد اختصاصی مدیر`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-9 h-9 rounded-[var(--ui-btn-radius)] border border-outline-variant/60 bg-surface-container-low text-on-surface flex items-center justify-center"
              aria-label="تغییر تم روشن و تاریک"
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link
              to="/m"
              className="h-9 px-2.5 rounded-[var(--ui-btn-radius)] border border-outline-variant/60 bg-surface-container-low text-on-surface text-[11.5px] font-semibold inline-flex items-center gap-1 no-underline"
            >
              <span>ورود به پنل</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[680px] mx-auto px-3.5 pt-5 space-y-4">
        {/* ==================== VIEW 0: STANDALONE RESIDENT APP DOWNLOAD LANDING ==================== */}
        {view === 'download' && (
          <div className="space-y-4 m-panel-in">
            <SurfaceCard className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1.5 flex-1 min-w-[220px]">
                  <StatusPill label="نسخه مجزا و اختصاصی ساکنین" tone="primary" />
                  <h1 className="text-[19px] sm:text-[21px] font-extrabold text-on-surface mb-0 leading-snug pt-1">
                    نصب اپ ساکنین مجتمع مسکونی نیلوفر
                  </h1>
                  <p className="text-[13px] text-on-surface-variant mb-0 leading-relaxed">
                    این اپلیکیشن به‌صورت کاملاً مجزا از سامانه مدیریت طراحی شده تا ساکنین {blockTitle}{' '}
                    مشخصات سکونت، پلاک خودرو و مدارک پارکینگ خود را به‌صورت مستقیم و بدون مراجعه حضوری ثبت کنند.
                  </p>
                </div>
                <div className="w-16 h-16 rounded-[var(--ui-card-radius)] bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 border border-primary/25">
                  <Smartphone size={32} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <StitchButton
                  onClick={() => setView('step1_code')}
                  className="w-full h-11"
                >
                  <KeyRound size={17} />
                  <span>شروع تکمیل اطلاعات با کد واحد</span>
                </StitchButton>
                <StitchButton
                  variant="secondary"
                  onClick={handleDownloadStandaloneApp}
                  className="w-full h-11"
                >
                  <Download size={17} />
                  <span>دانلود نسخه اپ ساکنین (Android / iOS)</span>
                </StitchButton>
              </div>

              {installGuideOpen && (
                <div className="p-3 rounded-[var(--ui-card-radius)] bg-secondary-container/45 border border-secondary/30 text-[12px] text-on-surface space-y-1">
                  <strong>راهنمای نصب سریع روی صفحه اصلی موبایل:</strong>
                  <p className="mb-0 text-on-surface-variant leading-relaxed">
                    • در آیفون (Safari): دکمه Share و سپس <strong>Add to Home Screen</strong> را بزنید.
                    <br />• در اندروید (Chrome): از منوی سه‌نقطه گزینه <strong>Install App / افزودن به صفحه اصلی</strong> را انتخاب کنید.
                  </p>
                </div>
              )}
            </SurfaceCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  icon: ShieldCheck,
                  title: 'احراز هویت امن با کد اختصاصی واحد',
                  desc: `فقط با کد تحویلی از مدیر بلوک (${managerTitle}) امکان ثبت اطلاعات واحد وجود دارد.`,
                },
                {
                  icon: Car,
                  title: 'ثبت پلاک خودرو و فعال‌سازی در گیت',
                  desc: 'پس از تایید مدیر بلوک، پلاک‌های شما خودکار وارد لیست مجاز انتظامات و درب ورودی می‌شوند.',
                },
                {
                  icon: Building2,
                  title: 'احراز پارکینگ اختصاصی و اجاره‌ای',
                  desc: 'با پیوست سند یا قرارداد اجاره پارکینگ، حق استفاده قانونی پارکینگ شما تضمین می‌شود.',
                },
                {
                  icon: UserCheck,
                  title: 'دسترسی کامل به امکانات ساکنین',
                  desc: 'پرداخت شارژ، ثبت مهمان گیت، اعلام خرابی با عکس و مکاتبه تلگرامی با مدیر بلوک.',
                },
              ].map((feat) => {
                const Icon = feat.icon;
                return (
                  <SurfaceCard key={feat.title} className="p-3.5 flex items-start gap-3">
                    <span className="w-9 h-9 rounded-[var(--ui-btn-radius)] bg-primary-container/60 text-primary flex items-center justify-center shrink-0">
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0">
                      <strong className="text-[13px] font-bold text-on-surface block">
                        {feat.title}
                      </strong>
                      <p className="text-[12px] text-on-surface-variant mb-0 mt-0.5 leading-relaxed">
                        {feat.desc}
                      </p>
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== STEPPER BAR FOR WIZARD ==================== */}
        {view !== 'download' && view !== 'step4_done' && (
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'step1_code', num: '۱', label: 'کد اختصاصی واحد' },
              { id: 'step2_resident', num: '۲', label: 'مشخصات و اجاره' },
              { id: 'step3_vehicles', num: '۳', label: 'خودرو و پارکینگ' },
            ].map((st) => {
              const active = view === st.id;
              const done =
                (st.id === 'step1_code' && view !== 'step1_code') ||
                (st.id === 'step2_resident' && view === 'step3_vehicles');
              return (
                <div
                  key={st.id}
                  className={`p-2 rounded-[var(--ui-btn-radius)] border text-center text-[11.5px] font-bold ${
                    active
                      ? 'bg-primary text-on-primary border-primary'
                      : done
                        ? 'bg-secondary-container/60 text-on-secondary-container border-secondary/35'
                        : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/55'
                  }`}
                >
                  {st.num}. {st.label}
                </div>
              );
            })}
          </div>
        )}

        {/* ==================== STEP 1: UNIT VERIFICATION CODE ==================== */}
        {view === 'step1_code' && (
          <SurfaceCard className="p-5 space-y-4 m-panel-in">
            <div className="space-y-1">
              <h2 className="text-[16px] font-extrabold text-on-surface mb-0">
                مرحله ۱: وارد کردن کد اختصاصی واحد
              </h2>
              <p className="text-[12.5px] text-on-surface-variant mb-0 leading-relaxed">
                جهت جلوگیری از ورود اطلاعات اشتباه، کد اختصاصی واحد خود را که توسط مدیر بلوک صادر شده وارد نمایید.
              </p>
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-3">
              <div>
                <label
                  htmlFor="unit-invite-code"
                  className="block text-[12px] font-bold text-on-surface-variant mb-1"
                >
                  کد اختصاصی واحد *
                </label>
                <input
                  id="unit-invite-code"
                  type="text"
                  dir="ltr"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="مثال: BLB-302-4821"
                  className="w-full h-12 px-3.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low border border-outline-variant/65 text-center font-mono text-[16px] font-bold tracking-widest uppercase"
                />
              </div>

              <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/45 text-[11.5px] text-on-surface-variant flex items-center justify-between gap-2 flex-wrap">
                <span>کد نمونه فعال برای تست سریع (واحد B-302):</span>
                <button
                  type="button"
                  onClick={() => setInviteCode('BLB-302-4821')}
                  className="font-mono font-bold text-primary underline"
                  dir="ltr"
                >
                  BLB-302-4821
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <StitchButton
                  variant="secondary"
                  onClick={() => setView('download')}
                >
                  <ArrowRight size={15} />
                  <span>بازگشت</span>
                </StitchButton>
                <StitchButton type="submit" disabled={busy || !inviteCode.trim()} className="flex-1">
                  <span>{busy ? 'در حال بررسی کد...' : 'تایید کد واحد و ادامه'}</span>
                  <ArrowLeft size={15} />
                </StitchButton>
              </div>
            </form>
          </SurfaceCard>
        )}

        {/* ==================== STEP 2: RESIDENT, HOUSEHOLD, TENANT/LANDLORD & JALALI LEASE ==================== */}
        {view === 'step2_resident' && verifiedUnit && (
          <SurfaceCard className="p-4 sm:p-5 space-y-4 m-panel-in">
            <div className="p-3 rounded-[var(--ui-card-radius)] bg-secondary-container/45 border border-secondary/35 flex items-center justify-between gap-2 flex-wrap">
              <div>
                <strong className="text-[13.5px] font-bold text-on-surface block">
                  واحد احرازشده: {verifiedUnit.unitCode} ({verifiedUnit.blockName})
                </strong>
                <span className="text-[11.5px] text-on-surface-variant">
                  مدیر تاییدکننده: {verifiedUnit.managerName}
                </span>
              </div>
              <StatusPill label={`کد ${verifiedUnit.code}`} tone="positive" />
            </div>

            <form onSubmit={handleGoToVehicles} className="space-y-3.5">
              <h2 className="text-[15px] font-extrabold text-on-surface mb-0">
                مرحله ۲: مشخصات ساکن، خانوار و وضعیت سکونت
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="res-fullname" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                    نام و نام خانوادگی سرپرست / ساکن *
                  </label>
                  <input
                    id="res-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثلاً: مهندس علیرضا احمدی"
                    className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/60"
                  />
                </div>
                <div>
                  <label htmlFor="res-nid" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                    کد ملی (اختیاری)
                  </label>
                  <input
                    id="res-nid"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="0012345678"
                    className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/60"
                  />
                </div>
                <div>
                  <label htmlFor="res-phone" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                    شماره موبایل اصلی *
                  </label>
                  <input
                    id="res-phone"
                    type="tel"
                    dir="ltr"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09121234567"
                    className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/60"
                  />
                </div>
                <div>
                  <label htmlFor="res-phone2" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                    تلفن ثابت یا موبایل دوم
                  </label>
                  <input
                    id="res-phone2"
                    type="tel"
                    dir="ltr"
                    value={secondaryPhone}
                    onChange={(e) => setSecondaryPhone(e.target.value)}
                    placeholder="02188001122"
                    className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/60"
                  />
                </div>
              </div>

              {/* Household size & Occupancy toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="res-household" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                    تعداد نفرات ساکن در واحد *
                  </label>
                  <select
                    id="res-household"
                    value={householdCount}
                    onChange={(e) => setHouseholdCount(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/60"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n.toLocaleString('fa-IR')} نفر
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                    وضعیت سکونت *
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(['مالک ساکن', 'مستأجر'] as OccupancyKind[]).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setOccupancyType(kind)}
                        className={`h-10 rounded-[var(--ui-btn-radius)] border text-[12.5px] font-bold transition-colors ${
                          occupancyType === kind
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface-container-low text-on-surface border-outline-variant/60'
                        }`}
                      >
                        {kind}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tenant-specific Landlord + Exact Jalali Lease Dates + Lease Attachment */}
              {occupancyType === 'مستأجر' && (
                <div className="p-3.5 rounded-[var(--ui-card-radius)] bg-primary-container/25 border border-primary/30 space-y-3">
                  <strong className="text-[13px] font-bold text-on-surface block">
                    مشخصات صاحبخانه و مدت دقیق قرارداد اجاره (شمسی)
                  </strong>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="ll-name" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                        نام و نام خانوادگی صاحبخانه *
                      </label>
                      <input
                        id="ll-name"
                        type="text"
                        required
                        value={landlordName}
                        onChange={(e) => setLandlordName(e.target.value)}
                        placeholder="مثلاً: حاج حسین محمدی"
                        className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[13px] border border-outline-variant/60"
                      />
                    </div>
                    <div>
                      <label htmlFor="ll-phone" className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                        شماره تماس صاحبخانه *
                      </label>
                      <input
                        id="ll-phone"
                        type="tel"
                        dir="ltr"
                        required
                        value={landlordPhone}
                        onChange={(e) => setLandlordPhone(e.target.value)}
                        placeholder="09121112233"
                        className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[13px] border border-outline-variant/60"
                      />
                    </div>
                    <JalaliDateTimePicker
                      label="تاریخ شروع قرارداد اجاره *"
                      mode="date"
                      value={leaseStartJalali}
                      onChange={(formatted) => setLeaseStartJalali(formatted)}
                    />
                    <JalaliDateTimePicker
                      label="تاریخ پایان قرارداد اجاره *"
                      mode="date"
                      value={leaseEndJalali}
                      onChange={(formatted) => setLeaseEndJalali(formatted)}
                    />
                  </div>

                  <label className="w-full min-h-10 px-3 py-2 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest border border-dashed border-primary/50 text-primary text-[12px] font-semibold flex items-center justify-center gap-2 cursor-pointer">
                    <FileUp size={16} />
                    <span>
                      {leaseContractName
                        ? `اجاره‌نامه پیوست شد: ${leaseContractName}`
                        : 'پیوست تصویر یا PDF قرارداد اجاره واحد (توصیه‌شده)'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      hidden
                      onChange={(e) =>
                        void handleUploadAttachment(e.target.files?.[0], (url, name) => {
                          setLeaseContractDataUrl(url);
                          setLeaseContractName(name);
                        })
                      }
                    />
                  </label>
                </div>
              )}

              {/* Extra Practical Building Safety & Contact Details */}
              <div className="p-3.5 rounded-[var(--ui-card-radius)] bg-surface-container-low/70 border border-outline-variant/50 space-y-3">
                <strong className="text-[12.5px] font-bold text-on-surface block">
                  اطلاعات تکمیلی ایمنی، انباری و حساب کاربری پنل ساکنین
                </strong>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="نام تماس اضطراری (مثلاً بستگان نزدیک)"
                    className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[12.5px] border border-outline-variant/60"
                  />
                  <input
                    type="tel"
                    dir="ltr"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="شماره تماس اضطراری (09...)"
                    className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[12.5px] border border-outline-variant/60"
                  />
                  <input
                    type="text"
                    value={storageCode}
                    onChange={(e) => setStorageCode(e.target.value)}
                    placeholder="شماره انباری (مثلاً S-26)"
                    className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[12.5px] border border-outline-variant/60"
                  />
                  <label className="h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest border border-outline-variant/60 flex items-center gap-2 text-[12.5px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasPets}
                      onChange={(e) => setHasPets(e.target.checked)}
                    />
                    <span>نگهداری حیوان خانگی در واحد</span>
                  </label>
                </div>

                <input
                  type="text"
                  value={specialNeedsNote}
                  onChange={(e) => setSpecialNeedsNote(e.target.value)}
                  placeholder="نکته اضطراری (مثلاً سالمند، کودک یا دستگاه پزشکی جهت اولویت هنگام قطعی برق/آسانسور)"
                  className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[12.5px] border border-outline-variant/60"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <input
                    type="text"
                    dir="ltr"
                    value={desiredUsername}
                    onChange={(e) => setDesiredUsername(e.target.value)}
                    placeholder="نام کاربری دلخواه پنل ساکنین (اختیاری)"
                    className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[12.5px] border border-outline-variant/60"
                  />
                  <input
                    type="password"
                    dir="ltr"
                    value={desiredPassword}
                    onChange={(e) => setDesiredPassword(e.target.value)}
                    placeholder="رمز عبور دلخواه (حداقل ۴ کاراکتر)"
                    className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[12.5px] border border-outline-variant/60"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <StitchButton variant="secondary" onClick={() => setView('step1_code')}>
                  <ArrowRight size={15} />
                  <span>مرحله قبل</span>
                </StitchButton>
                <StitchButton type="submit" className="flex-1">
                  <span>ادامه به ثبت خودرو و پارکینگ</span>
                  <ArrowLeft size={15} />
                </StitchButton>
              </div>
            </form>
          </SurfaceCard>
        )}

        {/* ==================== STEP 3: VEHICLES, PLATES & PARKING PROOF ==================== */}
        {view === 'step3_vehicles' && verifiedUnit && (
          <SurfaceCard className="p-4 sm:p-5 space-y-4 m-panel-in">
            <div className="space-y-1">
              <h2 className="text-[15.5px] font-extrabold text-on-surface mb-0">
                مرحله ۳: وسایل نقلیه، پلاک‌ها و احراز پارکینگ
              </h2>
              <p className="text-[12px] text-on-surface-variant mb-0 leading-relaxed">
                تمامی پلاک‌های ثبت‌شده پس از تایید مدیر بلوک، مستقیماً به لیست مجاز{' '}
                <strong className="text-on-surface">انتظامات و گیت ورودی خودرو</strong> اضافه می‌شوند.
              </p>
            </div>

            <form onSubmit={handleSubmitAll} className="space-y-3.5">
              {/* Vehicle count quick selector */}
              <div className="space-y-1.5">
                <span className="block text-[12px] font-bold text-on-surface-variant">
                  تعداد وسایل نقلیه واحد {verifiedUnit.unitCode}:
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[0, 1, 2, 3, 4].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleVehicleCountChange(cnt)}
                      className={`h-10 rounded-[var(--ui-btn-radius)] border text-[12.5px] font-bold transition-colors ${
                        vehicles.length === cnt
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-low text-on-surface border-outline-variant/60'
                      }`}
                    >
                      {cnt === 0 ? 'ندارم' : `${cnt.toLocaleString('fa-IR')} دستگاه`}
                    </button>
                  ))}
                </div>
              </div>

              {vehicles.map((v, idx) => (
                <div
                  key={v.id}
                  className="p-3.5 rounded-[var(--ui-card-radius)] bg-surface-container-low/80 border border-outline-variant/60 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[13.5px] font-bold text-on-surface flex items-center gap-1.5">
                      <Car size={16} className="text-primary" />
                      <span>وسیله نقلیه شماره {(idx + 1).toLocaleString('fa-IR')}</span>
                    </strong>
                    <button
                      type="button"
                      onClick={() => setVehicles((prev) => prev.filter((item) => item.id !== v.id))}
                      className="text-error text-[11.5px] font-semibold inline-flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                      <span>حذف</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <select
                      aria-label={`نوع وسیله نقلیه ${idx + 1}`}
                      value={v.vehicleType}
                      onChange={(e) =>
                        updateVehicle(v.id, {
                          vehicleType: e.target.value as ResidentVehicleEntry['vehicleType'],
                        })
                      }
                      className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[12.5px] border border-outline-variant/60"
                    >
                      <option value="سواری">خودرو سواری</option>
                      <option value="وانت / شاسی‌بلند">شاسی‌بلند / وانت</option>
                      <option value="موتورسیکلت">موتورسیکلت</option>
                    </select>
                    <input
                      type="text"
                      value={v.modelAndColor}
                      onChange={(e) => updateVehicle(v.id, { modelAndColor: e.target.value })}
                      placeholder="مدل و رنگ (مثلاً پژو ۲۰۷ سفید)"
                      className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[12.5px] border border-outline-variant/60"
                    />
                  </div>

                  <IranPlateInput
                    label={`پلاک رسمی وسیله نقلیه ${(idx + 1).toLocaleString('fa-IR')} *`}
                    value={v.plateText}
                    onChange={(val) => updateVehicle(v.id, { plateText: val })}
                    compact
                  />

                  <div className="space-y-1.5">
                    <span className="block text-[11.5px] font-semibold text-on-surface-variant">
                      نوع پارکینگ محل توقف *
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        ['اختصاصی سنددار', 'پارکینگ طبقاتی', 'پارکینگ اجاره‌ای'] as ParkingAllocationType[]
                      ).map((pt) => (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => updateVehicle(v.id, { parkingType: pt })}
                          className={`h-9 px-2 rounded-[var(--ui-btn-radius)] border text-[11.5px] font-bold transition-colors ${
                            v.parkingType === pt
                              ? 'bg-primary text-on-primary border-primary'
                              : 'bg-surface-container-lowest text-on-surface border-outline-variant/60'
                          }`}
                        >
                          {pt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      value={v.parkingNumber}
                      onChange={(e) => updateVehicle(v.id, { parkingNumber: e.target.value })}
                      placeholder="شماره پارکینگ * (مثلاً P-35)"
                      className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[12.5px] border border-outline-variant/60"
                    />
                    <input
                      type="text"
                      value={v.parkingFloorOrZone || ''}
                      onChange={(e) => updateVehicle(v.id, { parkingFloorOrZone: e.target.value })}
                      placeholder="طبقه یا ردیف (مثلاً طبقه منفی ۲ - ردیف B)"
                      className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[12.5px] border border-outline-variant/60"
                    />
                  </div>

                  <label
                    className={`w-full min-h-10 px-3 py-2 rounded-[var(--ui-btn-radius)] border border-dashed text-[12px] font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                      v.parkingType === 'پارکینگ اجاره‌ای' && !v.parkingProofDataUrl
                        ? 'bg-error-container/40 border-error text-on-error-container'
                        : 'bg-surface-container-lowest border-primary/45 text-primary'
                    }`}
                  >
                    <FileUp size={16} />
                    <span>
                      {v.parkingProofName
                        ? `مدرک پارکینگ پیوست شد: ${v.parkingProofName}`
                        : v.parkingType === 'پارکینگ اجاره‌ای'
                          ? 'پیوست قرارداد اجاره پارکینگ (الزامی جهت تایید عدم غصب) *'
                          : 'پیوست سند یا مدرک پارکینگ (اختیاری)'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      hidden
                      onChange={(e) =>
                        void handleUploadAttachment(e.target.files?.[0], (url, name) =>
                          updateVehicle(v.id, {
                            parkingProofDataUrl: url,
                            parkingProofName: name,
                          }),
                        )
                      }
                    />
                  </label>
                </div>
              ))}

              {vehicles.length < 4 && (
                <StitchButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setVehicles((prev) => [...prev, makeEmptyVehicle()])}
                  className="w-full"
                >
                  <Plus size={15} />
                  <span>افزودن وسیله نقلیه دیگر</span>
                </StitchButton>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/45">
                <StitchButton variant="secondary" onClick={() => setView('step2_resident')}>
                  <ArrowRight size={15} />
                  <span>مرحله قبل</span>
                </StitchButton>
                <StitchButton type="submit" disabled={busy} className="flex-1">
                  <ShieldCheck size={16} />
                  <span>{busy ? 'در حال ثبت در دیتابیس...' : 'ثبت نهایی و ارسال برای تایید مدیر بلوک'}</span>
                </StitchButton>
              </div>
            </form>
          </SurfaceCard>
        )}

        {/* ==================== STEP 4: CONFIRMATION & TRACKING CODE ==================== */}
        {view === 'step4_done' && verifiedUnit && (
          <SurfaceCard className="p-6 text-center space-y-4 m-panel-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-secondary-container text-secondary flex items-center justify-center">
              <CheckCircle2 size={36} />
            </div>
            <div className="space-y-1">
              <h2 className="text-[18px] font-extrabold text-on-surface mb-0">
                اطلاعات واحد {verifiedUnit.unitCode} با موفقیت ثبت شد!
              </h2>
              <p className="text-[13px] text-on-surface-variant mb-0 leading-relaxed">
                پرونده شما برای <strong className="text-on-surface">{verifiedUnit.managerName}</strong>{' '}
                و مدیریت کل شهرک ارسال گردید. به محض تایید مدیر بلوک، پلاک‌های شما به‌صورت خودکار در لیست مجاز{' '}
                <strong className="text-on-surface">انتظامات و گیت ورودی خودرو</strong> فعال می‌شوند.
              </p>
            </div>

            <div className="inline-flex flex-col items-center gap-1 px-6 py-3 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/60">
              <span className="text-[11.5px] text-on-surface-variant">کد رهگیری پرونده شما:</span>
              <strong className="text-[20px] font-mono text-primary tracking-wider" dir="ltr">
                {trackingCode}
              </strong>
            </div>

            {vehicles.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-outline-variant/40 text-right">
                <span className="text-[12px] font-bold text-on-surface-variant block">
                  پلاک‌های ارسال‌شده برای تایید گیت ورودی:
                </span>
                <div className="flex flex-wrap gap-2">
                  {vehicles.map((v) => (
                    <div
                      key={v.id}
                      className="p-2 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/50 flex items-center gap-2"
                    >
                      <IranPlateBadge value={v.plateText} size="sm" />
                      <span className="text-[11.5px] text-on-surface-variant">
                        پارکینگ {v.parkingNumber}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
              <Link
                to="/m?role=resident"
                className="h-10 px-4 rounded-[var(--ui-btn-radius)] bg-primary text-on-primary text-[13px] font-bold inline-flex items-center gap-1.5 no-underline"
              >
                <span>ورود به پنل ساکنین</span>
              </Link>
              <Link
                to="/m?role=block_manager"
                className="h-10 px-4 rounded-[var(--ui-btn-radius)] bg-surface-container-low border border-outline-variant/60 text-on-surface text-[13px] font-semibold inline-flex items-center gap-1.5 no-underline"
              >
                <span>مشاهده تاییدیه در پنل مدیر بلوک</span>
              </Link>
            </div>
          </SurfaceCard>
        )}
      </main>
    </div>
  );
};
