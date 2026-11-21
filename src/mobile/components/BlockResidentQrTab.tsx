import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Car,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  KeyRound,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { rbacApi } from '../rbac/rbacApi';
import type { RbacUserRecord } from '../rbac/roles';
import type {
  ApprovedVehicleDoc,
  ResidentSubmissionDoc,
  UnitInviteCodeDoc,
} from '../utils/residentOnboarding';
import { IranPlateBadge } from '../ui/IranPlate';
import {
  EmptyState,
  SectionHeader,
  StatusPill,
  StitchButton,
  StitchModal,
  SurfaceCard,
} from '../ui/StitchKit';
import { pushDockAlarm } from '../ui/dockAlarmBus';

interface Props {
  blockId: string;
  blockName: string;
  managerName: string;
  currentUser: RbacUserRecord;
  onApprovedChanged: () => void;
}

export const BlockResidentQrTab: React.FC<Props> = ({
  blockId,
  blockName,
  managerName,
  currentUser,
  onApprovedChanged,
}) => {
  const [invites, setInvites] = useState<UnitInviteCodeDoc[]>([]);
  const [submissions, setSubmissions] = useState<ResidentSubmissionDoc[]>([]);
  const [vehicles, setVehicles] = useState<ApprovedVehicleDoc[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [newUnitCode, setNewUnitCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const [rejectingSub, setRejectingSub] = useState<ResidentSubmissionDoc | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [previewDoc, setPreviewDoc] = useState<{ title: string; dataUrl: string } | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const residentAppUrl = `${origin}/resident-app?block=${encodeURIComponent(blockId)}`;

  const loadData = useCallback(async () => {
    try {
      const [invRes, subRes, vehRes] = await Promise.all([
        rbacApi.listUnitInviteCodes(blockId),
        rbacApi.listResidentSubmissions(blockId),
        rbacApi.listApprovedVehicles(blockId),
      ]);
      setInvites(invRes.items);
      setSubmissions(subRes.items);
      setVehicles(vehRes.items);
    } catch (err) {
      pushDockAlarm({
        tone: 'danger',
        title: 'خطا در بارگذاری QR ساکنین',
        message: err instanceof Error ? err.message : 'دریافت کدهای واحد ناموفق بود.',
      });
    }
  }, [blockId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    let mounted = true;
    void QRCode.toDataURL(residentAppUrl, {
      width: 520,
      margin: 2,
      color: {
        dark: '#142033',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (mounted) setQrDataUrl(url);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      mounted = false;
    };
  }, [residentAppUrl]);

  const copyText = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* fallback ignored in sandbox */
    }
    setCopiedKey(key);
    pushDockAlarm({
      tone: 'success',
      title: 'کپی انجام شد',
      message: `${label} در حافظه کپی شد.`,
    });
    window.setTimeout(() => setCopiedKey(''), 1800);
  };

  /**
   * Generates a crisp high-resolution print-ready PNG lobby poster containing the scannable QR code,
   * block name, and Persian instructions for residents passing through the lobby.
   */
  const handleDownloadPosterPng = async () => {
    if (!qrDataUrl) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clean white architectural poster background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Top brand header band
      ctx.fillStyle = '#243b6b';
      ctx.fillRect(0, 0, canvas.width, 250);

      // Subtle accent line
      ctx.fillStyle = '#2b7a5e';
      ctx.fillRect(0, 250, canvas.width, 12);

      // Header text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 52px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText('مجتمع مسکونی نیلوفر', canvas.width / 2, 118);
      ctx.font = '600 34px Vazirmatn, Tahoma, sans-serif';
      ctx.fillStyle = '#dbe7ff';
      ctx.fillText(`پوستر ثبت‌نام و دانلود اپلیکیشن ساکنین • ${blockName}`, canvas.width / 2, 192);

      // Instruction headline
      ctx.fillStyle = '#1b2533';
      ctx.font = 'bold 38px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText('ساکن محترم، جهت ثبت اطلاعات واحد و پلاک خودرو اسکن کنید', canvas.width / 2, 345);

      // QR frame box
      const qrSize = 540;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 400;
      ctx.fillStyle = '#f6f8fb';
      ctx.fillRect(qrX - 30, qrY - 30, qrSize + 60, qrSize + 60);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.strokeRect(qrX - 30, qrY - 30, qrSize + 60, qrSize + 60);

      const img = new Image();
      img.src = qrDataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('QR image load failed'));
      });
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      // Steps list
      ctx.fillStyle = '#1b2533';
      ctx.font = 'bold 30px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText('مراحل ثبت‌نام امن ساکنین:', canvas.width / 2, 1060);

      ctx.fillStyle = '#475569';
      ctx.font = '500 26px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText('۱. کد QR بالا را با دوربین گوشی اسکن و اپ ساکنین را باز / نصب کنید.', canvas.width / 2, 1125);
      ctx.fillText('۲. «کد اختصاصی واحد» دریافتی از مدیر بلوک را وارد نمایید.', canvas.width / 2, 1178);
      ctx.fillText('۳. مشخصات خانوار، پلاک خودرو و سند/اجاره‌نامه پارکینگ را ثبت کنید.', canvas.width / 2, 1231);
      ctx.fillText('۴. پس از تایید مدیر بلوک، پلاک شما خودکار در گیت انتظامات فعال می‌شود.', canvas.width / 2, 1284);

      // Footer bar
      ctx.fillStyle = '#f1f4f9';
      ctx.fillRect(60, 1340, canvas.width - 120, 90);
      ctx.fillStyle = '#3b5998';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(residentAppUrl, canvas.width / 2, 1394);

      const posterUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = posterUrl;
      a.download = `niloofar-lobby-qr-block-${blockId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      pushDockAlarm({
        tone: 'success',
        title: 'پوستر لابی آماده چاپ ذخیره شد',
        message: `فایل تصویر پوستر QR بلوک ${blockId} با کیفیت چاپ دانلود گردید.`,
      });
    } catch {
      pushDockAlarm({
        tone: 'danger',
        title: 'خطا در تولید پوستر',
        message: 'ذخیره تصویر پوستر QR انجام نشد.',
      });
    }
  };

  const handlePrintPoster = () => {
    if (!qrDataUrl) return;
    const win = window.open('', '_blank', 'width=820,height=960');
    if (!win) {
      window.print();
      return;
    }
    win.document.write(`<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8" />
<title>پوستر QR لابی ${blockName}</title>
<style>
  body { font-family: Tahoma, Vazirmatn, sans-serif; margin: 0; padding: 32px; background: #fff; color: #1b2533; text-align: center; }
  .poster { max-width: 640px; margin: 0 auto; border: 2px solid #243b6b; padding: 28px; }
  .hdr { background: #243b6b; color: #fff; padding: 20px; margin: -28px -28px 24px; }
  .qr { width: 320px; height: 320px; border: 1px solid #cbd5e1; padding: 12px; background: #f8fafc; }
  ul { text-align: right; line-height: 2; font-size: 14px; }
  .url { font-family: monospace; background: #f1f4f9; padding: 8px 12px; margin-top: 16px; direction: ltr; font-size: 13px; }
</style></head><body>
  <div class="poster">
    <div class="hdr">
      <h1 style="margin:0;font-size:24px;">مجتمع مسکونی نیلوفر</h1>
      <p style="margin:6px 0 0;font-size:15px;">دانلود اپلیکیشن اختصاصی ساکنین و ثبت اطلاعات واحد • ${blockName}</p>
    </div>
    <p style="font-weight:bold;font-size:16px;">لطفاً جهت ثبت اطلاعات سکونت و فعال‌سازی پلاک خودرو در گیت ورودی، کد زیر را اسکن کنید:</p>
    <img class="qr" src="${qrDataUrl}" alt="QR Code" />
    <ul>
      <li>اپلیکیشن اختصاصی ساکنین را از صفحه بازشده نصب یا اجرا کنید.</li>
      <li>کد اختصاصی واحد خود (دریافتی از مدیر بلوک: ${managerName}) را وارد نمایید.</li>
      <li>اطلاعات خانوار، مالک/مستأجر، پلاک خودرو و شماره/اجاره‌نامه پارکینگ را تکمیل کنید.</li>
    </ul>
    <div class="url">${residentAppUrl}</div>
  </div>
  <script>window.onload = function(){ window.print(); };</script>
</body></html>`);
    win.document.close();
  };

  const handleCreateUnitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitCode.trim()) return;
    setBusy(true);
    try {
      const res = await rbacApi.createUnitInviteCode({
        blockId,
        unitCode: newUnitCode.trim(),
      });
      setNewUnitCode('');
      pushDockAlarm({
        tone: 'success',
        title: 'کد اختصاصی واحد ساخته شد',
        message: `کد واحد ${res.invite?.unitCode}: ${res.invite?.code} (برای تحویل به ساکن آماده است)`,
      });
      await loadData();
    } catch (err) {
      pushDockAlarm({
        tone: 'danger',
        title: 'خطا در تولید کد واحد',
        message: err instanceof Error ? err.message : 'ساخت کد واحد ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleBatchGenerateCodes = async () => {
    setBusy(true);
    try {
      const res = await rbacApi.createUnitInviteCode({
        blockId,
        batchAllUnits: true,
      });
      pushDockAlarm({
        tone: 'success',
        title: 'تولید یکجای کد واحدها',
        message:
          (res.createdCount ?? 0) > 0
            ? `${(res.createdCount ?? 0).toLocaleString('fa-IR')} کد اختصاصی جدید برای واحدهای فاقد کد در بلوک ${blockId} ساخته شد.`
            : 'همه واحدهای ثبت‌شده این بلوک هم‌اکنون کد اختصاصی فعال دارند.',
      });
      await loadData();
    } catch (err) {
      pushDockAlarm({
        tone: 'danger',
        title: 'خطا در تولید کدها',
        message: err instanceof Error ? err.message : 'تولید کدها انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleCode = async (inv: UnitInviteCodeDoc) => {
    setBusy(true);
    try {
      const next = inv.status === 'active' ? 'revoked' : 'active';
      await rbacApi.updateUnitInviteCode(inv.id, next);
      pushDockAlarm({
        tone: 'info',
        title: next === 'active' ? 'کد واحد فعال شد' : 'کد واحد باطل شد',
        message: `وضعیت کد ${inv.code} (واحد ${inv.unitCode}) به‌روزرسانی شد.`,
      });
      await loadData();
    } catch (err) {
      pushDockAlarm({
        tone: 'danger',
        title: 'خطا در تغییر وضعیت کد',
        message: err instanceof Error ? err.message : 'تغییر وضعیت انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleApproveSubmission = async (sub: ResidentSubmissionDoc) => {
    setBusy(true);
    try {
      const res = await rbacApi.reviewResidentSubmission(sub.id, 'approved');
      pushDockAlarm({
        tone: 'success',
        title: 'پرونده ساکن تایید و به گیت ارسال شد',
        message: `اطلاعات واحد ${sub.unitCode} (${sub.fullName}) در بلوک و مدیریت کل ثبت و ${res.approvedVehiclesCount.toLocaleString('fa-IR')} پلاک در لیست مجاز انتظامات فعال شد.`,
      });
      await loadData();
      onApprovedChanged();
    } catch (err) {
      pushDockAlarm({
        tone: 'danger',
        title: 'خطا در تایید پرونده',
        message: err instanceof Error ? err.message : 'تایید پرونده ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRejectSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingSub) return;
    setBusy(true);
    try {
      await rbacApi.reviewResidentSubmission(
        rejectingSub.id,
        'rejected',
        rejectNote.trim() || 'لطفاً مدارک پارکینگ یا مشخصات را اصلاح و مجدداً ارسال کنید.',
      );
      setRejectingSub(null);
      setRejectNote('');
      pushDockAlarm({
        tone: 'info',
        title: 'پرونده جهت اصلاح بازگردانده شد',
        message: `کد اختصاصی واحد ${rejectingSub.unitCode} مجدداً فعال شد تا ساکن اطلاعات صحیح را ارسال کند.`,
      });
      await loadData();
    } catch (err) {
      pushDockAlarm({
        tone: 'danger',
        title: 'خطا در رد پرونده',
        message: err instanceof Error ? err.message : 'ثبت نظر انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleVehicleGate = async (veh: ApprovedVehicleDoc) => {
    setBusy(true);
    try {
      await rbacApi.updateApprovedVehicle(veh.id, !veh.gateAccessEnabled);
      pushDockAlarm({
        tone: 'info',
        title: veh.gateAccessEnabled ? 'تردد گیت خودرو معلق شد' : 'تردد گیت خودرو فعال شد',
        message: `پلاک ${veh.plateText} (واحد ${veh.unitCode}) در سامانه انتظامات به‌روزرسانی شد.`,
      });
      await loadData();
    } catch (err) {
      pushDockAlarm({
        tone: 'danger',
        title: 'خطا در تغییر وضعیت پلاک',
        message: err instanceof Error ? err.message : 'عملیات انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const canReview =
    currentUser.role === 'complex_manager' || currentUser.role === 'block_manager';
  const pendingSubs = submissions.filter((s) => s.status === 'pending_review');

  return (
    <div className="space-y-4 m-panel-in" dir="rtl">
      {/* 1. Printable Lobby QR Code Poster Card + Per-Unit Code Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Lobby QR Poster */}
        <SurfaceCard className="lg:col-span-5 space-y-3">
          <SectionHeader
            title={`پوستر QR لابی ${blockName}`}
            icon="qr_code_2"
            action={<StatusPill label="اپ اختصاصی ساکنین" tone="primary" />}
          />

          <p className="text-[12px] text-on-surface-variant mb-0 leading-relaxed">
            این QR را ذخیره یا پرینت کرده و در لابی بلوک نصب کنید. ساکنین با اسکن آن به{' '}
            <strong className="text-on-surface">صفحه اختصاصی دانلود اپلیکیشن ساکنین</strong>{' '}
            هدایت شده و فقط با «کد اختصاصی واحد» اطلاعات و پلاک خودرو را ثبت می‌کنند.
          </p>

          <div className="p-4 rounded-[var(--ui-card-radius)] bg-surface-container-low border border-outline-variant/60 flex flex-col items-center gap-2.5">
            {qrDataUrl ? (
              <div className="p-2.5 bg-white border border-outline-variant/70 rounded-[2px] shadow-xs">
                <img
                  src={qrDataUrl}
                  alt={`کد QR ثبت‌نام ساکنین ${blockName}`}
                  className="w-[184px] h-[184px] block"
                />
              </div>
            ) : (
              <div className="w-[184px] h-[184px] flex items-center justify-center bg-surface-container text-on-surface-variant">
                <QrCode size={42} />
              </div>
            )}

            <div className="text-center space-y-0.5 max-w-full">
              <strong className="text-[12.5px] font-bold text-on-surface block">
                لینک مستقیم اپ ساکنین {blockName}
              </strong>
              <code
                dir="ltr"
                className="text-[11px] text-primary block truncate max-w-[280px] px-2 py-0.5 bg-surface-container-lowest border border-outline-variant/45 rounded-[2px]"
              >
                {residentAppUrl}
              </code>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StitchButton
              size="sm"
              onClick={() => void handleDownloadPosterPng()}
              className="w-full"
            >
              <Download size={15} />
              <span>ذخیره PNG پوستر چاپ</span>
            </StitchButton>
            <StitchButton
              variant="secondary"
              size="sm"
              onClick={handlePrintPoster}
              className="w-full"
            >
              <Printer size={15} />
              <span>پرینت پوستر لابی</span>
            </StitchButton>
            <StitchButton
              variant="secondary"
              size="sm"
              onClick={() => void copyText(residentAppUrl, 'qr-url', 'لینک QR اپ ساکنین')}
              className="w-full"
            >
              {copiedKey === 'qr-url' ? <Check size={15} /> : <Copy size={15} />}
              <span>کپی لینک QR</span>
            </StitchButton>
            <a
              href={residentAppUrl}
              className="h-9 px-3 rounded-[var(--ui-btn-radius)] text-[12.5px] font-semibold bg-primary-container text-on-primary-container border border-primary/25 inline-flex items-center justify-center gap-1.5 no-underline hover:opacity-90 transition-opacity"
            >
              <ExternalLink size={15} />
              <span>باز کردن اپ ساکنین</span>
            </a>
          </div>
        </SurfaceCard>

        {/* Per-Unit Unique Verification Codes */}
        <SurfaceCard className="lg:col-span-7 space-y-3">
          <SectionHeader
            title={`کدهای اختصاصی واحدهای بلوک ${blockId} (ضد ثبت اطلاعات جعلی)`}
            icon="vpn_key"
            action={
              canReview && (
                <StitchButton
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleBatchGenerateCodes()}
                >
                  <RefreshCw size={14} />
                  <span>تولید کد همه واحدها</span>
                </StitchButton>
              )
            }
          />

          <p className="text-[12px] text-on-surface-variant mb-0 leading-relaxed">
            برای جلوگیری از ثبت اطلاعات نادرست توسط افراد غیرمجاز، هر واحد یک{' '}
            <strong className="text-on-surface">کد اختصاصی یکبارمصرف</strong> دارد که مدیر بلوک به ساکن همان واحد تحویل می‌دهد.
          </p>

          {canReview && (
            <form onSubmit={handleCreateUnitCode} className="flex items-center gap-2">
              <input
                type="text"
                value={newUnitCode}
                onChange={(e) => setNewUnitCode(e.target.value)}
                placeholder={`شماره واحد جدید (مثلاً ${blockId}-305 یا 305)`}
                className="flex-1 h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
              />
              <StitchButton type="submit" disabled={busy || !newUnitCode.trim()}>
                <KeyRound size={15} />
                <span>تولید کد واحد</span>
              </StitchButton>
            </form>
          )}

          {invites.length === 0 ? (
            <EmptyState
              icon="vpn_key"
              title="هنوز کد اختصاصی برای این بلوک صادر نشده است"
              description="دکمه «تولید کد همه واحدها» را بزنید تا کد امن هر واحد ساخته شود."
            />
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto pl-0.5">
              {invites.map((inv) => {
                const directUnitUrl = `${origin}/resident-app?block=${encodeURIComponent(
                  inv.blockId,
                )}&code=${encodeURIComponent(inv.code)}`;
                return (
                  <div
                    key={inv.id}
                    className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low/80 border border-outline-variant/50 flex items-center justify-between gap-2 flex-wrap"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-[13px] font-bold text-on-surface">
                          واحد {inv.unitCode}
                        </strong>
                        <code
                          dir="ltr"
                          className="px-2 py-0.5 rounded-[2px] bg-surface-container-lowest border border-primary/35 text-primary text-[12px] font-bold tracking-wider"
                        >
                          {inv.code}
                        </code>
                        <StatusPill
                          label={
                            inv.status === 'active'
                              ? 'فعال و آماده تحویل'
                              : inv.status === 'used'
                                ? `ثبت شد (${inv.usedByName || 'ساکن'})`
                                : 'باطل شده'
                          }
                          tone={
                            inv.status === 'active'
                              ? 'positive'
                              : inv.status === 'used'
                                ? 'primary'
                                : 'danger'
                          }
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <StitchButton
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          void copyText(inv.code, `code-${inv.id}`, `کد واحد ${inv.unitCode}`)
                        }
                      >
                        {copiedKey === `code-${inv.id}` ? <Check size={14} /> : <Copy size={14} />}
                        <span>کپی کد</span>
                      </StitchButton>
                      {inv.status === 'active' && (
                        <a
                          href={directUnitUrl}
                          className="h-9 px-2.5 rounded-[var(--ui-btn-radius)] text-[11.5px] font-semibold bg-primary-container/70 text-on-primary-container inline-flex items-center gap-1 no-underline"
                          title="تست لینک مستقیم این واحد در اپ ساکنین"
                        >
                          <ExternalLink size={13} />
                          <span>فرم واحد</span>
                        </a>
                      )}
                      {canReview && inv.status !== 'used' && (
                        <StitchButton
                          variant={inv.status === 'active' ? 'danger' : 'primary'}
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleToggleCode(inv)}
                        >
                          {inv.status === 'active' ? 'ابطال' : 'فعال'}
                        </StitchButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SurfaceCard>
      </div>

      {/* 2. Resident Onboarding Submissions Review Queue (Auto-writes to Block + Complex + Gate Guard!) */}
      <SurfaceCard className="space-y-3">
        <SectionHeader
          title={`پرونده‌های خودثبت‌نامی ساکنین بلوک ${blockId} (منتظر تایید مدیر و ارسال به انتظامات)`}
          icon="how_to_reg"
          action={
            <StatusPill
              label={
                pendingSubs.length > 0
                  ? `${pendingSubs.length.toLocaleString('fa-IR')} پرونده منتظر تایید`
                  : 'همه بررسی شدند'
              }
              tone={pendingSubs.length > 0 ? 'danger' : 'positive'}
            />
          }
        />

        {submissions.length === 0 ? (
          <EmptyState
            icon="assignment_ind"
            title="هنوز پرونده‌ای از طریق اپ ساکنین ارسال نشده است"
            description="پس از اسکن QR لابی و ورود کد اختصاصی واحد توسط ساکن، پرونده کامل سکونت و پلاک‌ها اینجا نمایش داده می‌شود."
          />
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => (
              <div
                key={sub.id}
                className="p-3.5 rounded-[var(--ui-card-radius)] bg-surface-container-low/75 border border-outline-variant/60 space-y-3"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-[14.5px] font-bold text-on-surface">
                        واحد {sub.unitCode} — {sub.fullName}
                      </strong>
                      <StatusPill
                        label={sub.occupancyType}
                        tone={sub.occupancyType === 'مستأجر' ? 'primary' : 'positive'}
                      />
                      <span className="text-[11.5px] text-on-surface-variant font-mono" dir="ltr">
                        #{sub.trackingCode}
                      </span>
                    </div>
                    <p className="text-[12px] text-on-surface-variant mb-0 mt-1">
                      تعداد نفرات: <strong className="text-on-surface">{sub.householdCount.toLocaleString('fa-IR')} نفر</strong>
                      {' • '}موبایل: <strong className="text-on-surface">{sub.phone}</strong>
                      {sub.storageCode ? ` • انباری: ${sub.storageCode}` : ''}
                      {sub.desiredUsername ? ` • اکانت پیشنهادی: @${sub.desiredUsername}` : ''}
                    </p>
                  </div>

                  <StatusPill
                    label={
                      sub.status === 'approved'
                        ? 'تایید و ثبت‌شده در بلوک و گیت'
                        : sub.status === 'rejected'
                          ? 'رد و بازگردانده شده'
                          : 'منتظر بررسی مدیر'
                    }
                    tone={
                      sub.status === 'approved'
                        ? 'positive'
                        : sub.status === 'rejected'
                          ? 'danger'
                          : 'primary'
                    }
                  />
                </div>

                {/* Tenant Landlord + Exact Jalali Lease Info */}
                {sub.occupancyType === 'مستأجر' && (
                  <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-primary-container/30 border border-primary/25 text-[12px] flex items-center justify-between gap-2 flex-wrap">
                    <div className="space-y-0.5">
                      <div>
                        <strong>صاحبخانه:</strong> {sub.landlordName || '—'} ({sub.landlordPhone || '—'})
                      </div>
                      <div>
                        <strong>مدت دقیق اجاره (شمسی):</strong> از{' '}
                        <span className="font-bold font-numeric-stat">{sub.leaseStartJalali || '—'}</span> تا{' '}
                        <span className="font-bold font-numeric-stat">{sub.leaseEndJalali || '—'}</span>
                      </div>
                    </div>
                    {sub.leaseContractDataUrl && (
                      <StitchButton
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setPreviewDoc({
                            title: `قرارداد اجاره واحد ${sub.unitCode} (${sub.fullName})`,
                            dataUrl: sub.leaseContractDataUrl!,
                          })
                        }
                      >
                        <FileCheck2 size={14} />
                        <span>مشاهده پیوست اجاره‌نامه</span>
                      </StitchButton>
                    )}
                  </div>
                )}

                {/* Emergency / Special Needs Extra Info */}
                {(sub.emergencyContactName || sub.specialNeedsNote) && (
                  <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-lowest border border-outline-variant/45 text-[12px] space-y-1">
                    {sub.emergencyContactName && (
                      <div>
                        <strong>تماس اضطراری:</strong> {sub.emergencyContactName} ({sub.emergencyContactPhone || '—'})
                      </div>
                    )}
                    {sub.specialNeedsNote && (
                      <div className="text-error font-medium">
                        <strong>نکته ایمنی / اضطراری واحد:</strong> {sub.specialNeedsNote}
                      </div>
                    )}
                  </div>
                )}

                {/* Vehicles, Plates & Parking Proof Verification */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-on-surface">
                    <Car size={15} className="text-primary" />
                    <span>
                      وسایل نقلیه و پارکینگ ثبت‌شده ({sub.vehicles.length.toLocaleString('fa-IR')} دستگاه):
                    </span>
                  </div>
                  {sub.vehicles.length === 0 ? (
                    <p className="text-[12px] text-on-surface-variant mb-0">
                      بدون وسیله نقلیه ثبت‌شده.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {sub.vehicles.map((v) => (
                        <div
                          key={v.id}
                          className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-lowest border border-outline-variant/55 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <IranPlateBadge value={v.plateText} size="sm" showTypeLabel />
                            <StatusPill
                              label={v.parkingType}
                              tone={v.parkingType === 'پارکینگ اجاره‌ای' ? 'primary' : 'positive'}
                            />
                          </div>
                          <div className="text-[12px] text-on-surface-variant space-y-0.5">
                            <div>
                              <strong className="text-on-surface">{v.vehicleType}</strong>
                              {v.modelAndColor ? ` • ${v.modelAndColor}` : ''}
                            </div>
                            <div>
                              شماره پارکینگ: <strong className="text-on-surface">{v.parkingNumber}</strong>
                              {v.parkingFloorOrZone ? ` (${v.parkingFloorOrZone})` : ''}
                            </div>
                          </div>
                          {(v.parkingProofDataUrl || v.parkingProofName) && (
                            <div className="pt-1.5 border-t border-outline-variant/35 flex items-center justify-between gap-2">
                              <span className="text-[11px] text-secondary font-semibold truncate">
                                مدرک احراز پارکینگ: {v.parkingProofName || 'پیوست شده'}
                              </span>
                              {v.parkingProofDataUrl && (
                                <StitchButton
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    setPreviewDoc({
                                      title: `مدرک پارکینگ ${v.parkingNumber} — پلاک ${v.plateText}`,
                                      dataUrl: v.parkingProofDataUrl!,
                                    })
                                  }
                                >
                                  <FileCheck2 size={13} />
                                  <span>مشاهده سند</span>
                                </StitchButton>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {sub.reviewNote && (
                  <p className="text-[11.5px] text-on-surface-variant mb-0">
                    یادداشت بررسی ({sub.reviewedByName}): {sub.reviewNote}
                  </p>
                )}

                {canReview && sub.status === 'pending_review' && (
                  <div className="pt-2.5 border-t border-outline-variant/45 flex items-center justify-end gap-2 flex-wrap">
                    <StitchButton
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setRejectingSub(sub);
                        setRejectNote('');
                      }}
                    >
                      <XCircle size={15} />
                      <span>رد و درخواست اصلاح</span>
                    </StitchButton>
                    <StitchButton
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleApproveSubmission(sub)}
                    >
                      <ShieldCheck size={15} />
                      <span>تایید نهایی و ارسال پلاک‌ها به انتظامات</span>
                    </StitchButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {/* 3. Approved Resident Vehicles Active at Gate Guard */}
      <SurfaceCard className="space-y-3">
        <SectionHeader
          title={`پلاک‌های تاییدشده ساکنین بلوک ${blockId} در لیست گیت انتظامات`}
          icon="verified_user"
          action={
            <StatusPill
              label={`${vehicles.filter((v) => v.gateAccessEnabled).length.toLocaleString('fa-IR')} پلاک مجاز`}
              tone="positive"
            />
          }
        />

        {vehicles.length === 0 ? (
          <p className="text-[12.5px] text-on-surface-variant text-center py-4 mb-0">
            هنوز خودرویی برای این بلوک در لیست انتظامات تایید نشده است.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="p-3 rounded-[var(--ui-card-radius)] bg-surface-container-low/75 border border-outline-variant/50 flex items-center justify-between gap-2.5 flex-wrap"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <IranPlateBadge value={v.plateText} size="sm" />
                    <StatusPill
                      label={v.gateAccessEnabled ? 'مجاز گیت ورودی' : 'تردد معلق'}
                      tone={v.gateAccessEnabled ? 'positive' : 'danger'}
                    />
                  </div>
                  <div className="text-[12px] text-on-surface-variant">
                    <strong className="text-on-surface">واحد {v.unitCode}</strong> — {v.residentName} • پارکینگ{' '}
                    <strong className="text-on-surface">{v.parkingNumber}</strong> ({v.parkingType})
                  </div>
                </div>
                {canReview && (
                  <StitchButton
                    variant={v.gateAccessEnabled ? 'danger' : 'primary'}
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleToggleVehicleGate(v)}
                  >
                    {v.gateAccessEnabled ? 'تعلیق گیت' : 'فعال‌سازی'}
                  </StitchButton>
                )}
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {/* Reject Submission Modal */}
      <StitchModal
        open={Boolean(rejectingSub)}
        onClose={() => setRejectingSub(null)}
        title="رد پرونده و بازگردانی جهت اصلاح"
        subtitle={
          rejectingSub
            ? `واحد ${rejectingSub.unitCode} (${rejectingSub.fullName}) — کد واحد مجدداً فعال می‌شود`
            : undefined
        }
        titleTone="danger"
      >
        <form onSubmit={handleRejectSubmission} className="space-y-3">
          <textarea
            rows={3}
            required
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="دلیل رد (مثلاً: تصویر اجاره‌نامه پارکینگ خوانا نیست یا شماره پارکینگ صحیح نیست)..."
            className="w-full p-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
          />
          <StitchButton type="submit" variant="danger" disabled={busy} className="w-full">
            ثبت رد و فعال‌سازی مجدد کد واحد
          </StitchButton>
        </form>
      </StitchModal>

      {/* Attachment Preview Modal */}
      <StitchModal
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || 'پیش‌نمایش مدرک پیوست‌شده'}
      >
        {previewDoc &&
          (previewDoc.dataUrl.startsWith('data:application/pdf') ? (
            <div className="space-y-3 text-center py-4">
              <p className="text-[13px] text-on-surface-variant mb-0">
                فایل PDF قرارداد پیوست شده است.
              </p>
              <a
                href={previewDoc.dataUrl}
                download="contract-attachment.pdf"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--ui-btn-radius)] bg-primary text-on-primary text-[13px] font-bold no-underline"
              >
                <Download size={15} />
                <span>دانلود فایل PDF قرارداد</span>
              </a>
            </div>
          ) : (
            <img
              src={previewDoc.dataUrl}
              alt={previewDoc.title}
              className="w-full max-h-[65vh] object-contain rounded-[2px] border border-outline-variant/40"
            />
          ))}
      </StitchModal>
    </div>
  );
};
