import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rbacApi, readFileAsDataUrl } from '../rbac/rbacApi';
import type { RbacUserRecord } from '../rbac/roles';
import type {
  BlockNoticeDoc,
  GuestPermitDoc,
  PaymentReceiptDoc,
  ResidentMessageDoc,
  ResidentRequestDoc,
  UnitDoc,
} from '../../server/nosqlStore';
import {
  EmptyState,
  HeroSummaryCard,
  NoticeBanner,
  SectionHeader,
  StatusPill,
  StitchButton,
  SubMenuTabs,
  SurfaceCard,
} from '../ui/StitchKit';
import { IranPlateBadge, IranPlateInput } from '../ui/IranPlate';
import { PersianAmountInput } from '../components/PersianAmountInput';
import { JalaliDateTimePicker } from '../components/JalaliDateTimePicker';
import { TelegramChatPanel } from '../components/TelegramChatPanel';
import { formatAmountFa } from '../utils/persianMoney';
import { formatJalaliDateTime, getTodayJalali } from '../utils/jalaliDate';

type ResidentTab = 'home' | 'charge' | 'guest' | 'repair' | 'messages';
const VALID_TABS: ResidentTab[] = ['home', 'charge', 'guest', 'repair', 'messages'];

interface Props {
  currentUser: RbacUserRecord;
  onSyncChanged?: () => void;
}

const fmtT = (n: number) => formatAmountFa(n);

export const ResidentPanelPage: React.FC<Props> = ({ currentUser, onSyncChanged }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const qTab = (searchParams.get('tab') as ResidentTab) || 'home';
  const [tab, setTab] = useState<ResidentTab>(VALID_TABS.includes(qTab) ? qTab : 'home');

  const [unit, setUnit] = useState<UnitDoc | null>(null);
  const [blockManagerName, setBlockManagerName] = useState<string>('');
  const [notices, setNotices] = useState<BlockNoticeDoc[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceiptDoc[]>([]);
  const [permits, setPermits] = useState<GuestPermitDoc[]>([]);
  const [requests, setRequests] = useState<ResidentRequestDoc[]>([]);
  const [messages, setMessages] = useState<ResidentMessageDoc[]>([]);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Payment Receipt upload state (integer amount — formatted live in Persian with 3-digit commas)
  const [payAmount, setPayAmount] = useState<number>(1450000);
  const [payTrace, setPayTrace] = useState('');
  const [payChannel, setPayChannel] = useState<PaymentReceiptDoc['channel']>('کارت‌به‌کارت');
  const [payBank, setPayBank] = useState<'1102' | '1103'>('1102');
  const [payNote, setPayNote] = useState('شارژ ماهانه واحد');
  const [payPhoto, setPayPhoto] = useState('');

  // Guest permit state (Jalali date + Time Picker)
  const [guestName, setGuestName] = useState('');
  const [guestPlate, setGuestPlate] = useState('');
  const [guestDate, setGuestDate] = useState(() => {
    const t = getTodayJalali();
    return formatJalaliDateTime({ ...t, hour: 18, minute: 0 });
  });
  const [guestHours, setGuestHours] = useState('6');
  const [guestNote, setGuestNote] = useState('');

  // Repair request state
  const [repCategory, setRepCategory] = useState('لوله‌کشی و نشتی');
  const [repTitle, setRepTitle] = useState('');
  const [repDesc, setRepDesc] = useState('');
  const [repPhoto, setRepPhoto] = useState('');

  useEffect(() => {
    const paramTab = searchParams.get('tab') as ResidentTab | null;
    if (paramTab && VALID_TABS.includes(paramTab) && paramTab !== tab) {
      setTab(paramTab);
    }
  }, [searchParams, tab]);

  const switchTab = (next: ResidentTab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
    setFeedback(null);
  };

  const loadAll = useCallback(async () => {
    try {
      const [blkRes, notRes, rcpRes, prmRes, reqRes, msgRes] = await Promise.all([
        rbacApi.getBlocks(),
        rbacApi.listNotices(),
        rbacApi.listReceipts(),
        rbacApi.listGuestPermits(),
        rbacApi.listResidentRequests(),
        rbacApi.listMessages(),
      ]);
      const myUnit =
        blkRes.units.find((u) => u.unitCode === currentUser.unitCode) ?? blkRes.units[0] ?? null;
      const myBlock = blkRes.blocks.find((b) => b.id === (currentUser.blockId || myUnit?.blockId));
      setUnit(myUnit);
      if (myBlock?.managerName) setBlockManagerName(myBlock.managerName);
      setNotices(notRes.items);
      setReceipts(rcpRes.items);
      setPermits(prmRes.items);
      setRequests(reqRes.items);
      setMessages(msgRes.items);
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'دریافت اطلاعات واحد انجام نشد.',
      });
    }
  }, [currentUser.unitCode, currentUser.blockId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) {
      setFeedback({ tone: 'danger', text: 'لطفاً مبلغ واریزی معتبر (بیشتر از صفر تومان) وارد کنید.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await rbacApi.createReceipt({
        amountTomans: payAmount,
        traceCode: payTrace.trim(),
        channel: payChannel,
        bankAccountCode: payBank,
        note: payNote.trim(),
        receiptPhotoDataUrl: payPhoto || undefined,
      });
      setPayTrace('');
      setPayPhoto('');
      setFeedback({
        tone: 'success',
        text: `فیش پرداختی به مبلغ ${fmtT(res.receipt.amountTomans)} تومان ثبت شد و به صف تایید حسابدار ارسال گردید.`,
      });
      await loadAll();
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت فیش انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await rbacApi.createGuestPermit({
        guestName: guestName.trim(),
        plateText: guestPlate.trim(),
        visitDateLabel: guestDate.trim(),
        validHours: Number(guestHours) || 6,
        note: guestNote.trim(),
      });
      setGuestName('');
      setGuestPlate('');
      setGuestNote('');
      setFeedback({
        tone: 'success',
        text: `مجوز ورود مهمان «${res.permit.guestName}» ثبت شد و هم‌اکنون در پنل نگهبانی گیت قابل مشاهده است.`,
      });
      await loadAll();
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت مهمان انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCancelPermit = async (id: string) => {
    setBusy(true);
    try {
      await rbacApi.updateGuestPermit(id, 'cancelled');
      setFeedback({ tone: 'info', text: 'مجوز مهمان لغو شد.' });
      await loadAll();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'لغو مجوز ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await rbacApi.createResidentRequest({
        type: 'maintenance',
        category: repCategory,
        title: repTitle.trim(),
        description: repDesc.trim(),
        photoDataUrl: repPhoto || undefined,
      });
      setRepTitle('');
      setRepDesc('');
      setRepPhoto('');
      setFeedback({
        tone: 'success',
        text: 'گزارش خرابی واحد با موفقیت برای مدیر بلوک و مسئول تاسیسات ارسال شد.',
      });
      await loadAll();
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت خرابی انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSendTelegramMessage = async (text: string) => {
    setBusy(true);
    try {
      await rbacApi.sendMessage({ body: text });
      await loadAll();
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ارسال پیام ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleMarkChatRead = useCallback(() => {
    void rbacApi.markMessagesRead().then((r) => {
      if (r.updatedCount > 0) void loadAll();
    });
  }, [loadAll]);

  const pendingReceipts = receipts.filter((r) => r.status === 'pending').length;
  const activePermits = permits.filter((p) => p.status === 'pending_gate' || p.status === 'entered').length;
  const openRepairs = requests.filter((r) => r.status !== 'resolved').length;

  return (
    <div className="flex flex-col gap-3.5 pb-4" dir="rtl">
      <HeroSummaryCard
        title={`واحد ${currentUser.unitCode || unit?.unitCode || 'B-208'} • ${currentUser.displayName}`}
        subtitle={`بلوک ${currentUser.blockId || 'B'} • ${unit ? `${unit.occupancyType} • پارکینگ ${unit.parkingCode}` : 'پنل اختصاصی ساکنین'}`}
        badge={`بلوک ${currentUser.blockId || 'B'}`}
        stats={[
          {
            label: 'بدهی شارژ (تومان)',
            value: unit ? fmtT(unit.debtTomans) : '۰',
            accent: (unit?.debtTomans ?? 0) > 0 ? 'danger' : 'positive',
          },
          {
            label: 'مهمان فعال گیت',
            value: activePermits.toLocaleString('fa-IR'),
          },
          {
            label: 'اعلان‌های بلوک',
            value: notices.length.toLocaleString('fa-IR'),
            accent: 'positive',
          },
        ]}
      />

      <SubMenuTabs
        active={tab}
        onChange={(id) => switchTab(id as ResidentTab)}
        items={[
          { id: 'home', label: 'واحد و اعلان‌ها', icon: 'home', badge: notices.length },
          { id: 'charge', label: 'شارژ و فیش', icon: 'receipt_long', badge: pendingReceipts },
          { id: 'guest', label: 'مهمان گیت', icon: 'directions_car', badge: activePermits },
          { id: 'repair', label: 'خرابی واحد', icon: 'build', badge: openRepairs },
          { id: 'messages', label: 'مدیر بلوک', icon: 'chat' },
        ]}
      />

      {feedback && (
        <NoticeBanner
          message={feedback.text}
          tone={feedback.tone}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* ==================== TAB 1: HOME & BLOCK NOTICES ==================== */}
      {tab === 'home' && (
        <div className="space-y-3.5 m-panel-in">
          {/* Quick Resident Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'charge', title: 'ارسال فیش شارژ', sub: 'آپلود عکس فیش و تایید', icon: 'payments' },
              { id: 'guest', title: 'ثبت مهمان در گیت', sub: 'اعلام پلاک به نگهبانی', icon: 'directions_car' },
              { id: 'repair', title: 'اعلام خرابی واحد', sub: 'ارسال عکس به تاسیسات', icon: 'add_a_photo' },
              { id: 'messages', title: 'مکاتبه با مدیر', sub: 'پیام مستقیم به مدیر بلوک', icon: 'forum' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => switchTab(item.id as ResidentTab)}
                className="bg-surface-container-lowest rounded-[2px] border border-outline-variant/60 p-3 text-right hover:border-primary/65 active:scale-[0.98] transition-[transform,border-color] space-y-1.5"
              >
                <span className="w-9 h-9 rounded-[2px] bg-primary-container/60 text-on-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                </span>
                <strong className="text-[13px] font-bold text-on-surface block truncate">
                  {item.title}
                </strong>
                <span className="text-[11.5px] text-on-surface-variant block truncate">
                  {item.sub}
                </span>
              </button>
            ))}
          </div>

          <SurfaceCard className="space-y-3">
            <SectionHeader title="اطلاعیه‌ها و اعلان‌های مدیر بلوک" icon="notifications_active" />
            {notices.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant text-center py-5 mb-0">
                اعلان جدیدی از سوی مدیر بلوک ثبت نشده است.
              </p>
            ) : (
              <div className="space-y-2">
                {notices.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-[2px] border space-y-1 ${
                      n.severity === 'urgent'
                        ? 'bg-error-container/50 border-error/30'
                        : n.severity === 'warning'
                          ? 'bg-primary-container/35 border-primary/25'
                          : 'bg-surface-container-low/80 border-outline-variant/45'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-[13.5px] font-bold text-on-surface">{n.title}</strong>
                      <StatusPill
                        label={
                          n.severity === 'urgent'
                            ? 'فوری'
                            : n.severity === 'warning'
                              ? 'مهم'
                              : 'اطلاعیه'
                        }
                        tone={
                          n.severity === 'urgent'
                            ? 'danger'
                            : n.severity === 'warning'
                              ? 'primary'
                              : 'neutral'
                        }
                      />
                    </div>
                    <p className="text-[12.5px] text-on-surface-variant mb-0 leading-relaxed">
                      {n.body}
                    </p>
                    <span className="text-[11px] text-on-surface-variant block pt-1">
                      از طرف: {n.senderName} ({n.senderRoleTitle})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      )}

      {/* ==================== TAB 2: CHARGE & PAYMENT RECEIPT UPLOAD ==================== */}
      {tab === 'charge' && (
        <div className="space-y-3.5 m-panel-in lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
          <SurfaceCard className="space-y-3">
            <SectionHeader title="ارسال فیش پرداختی شارژ به حسابداری" icon="upload_file" />
            <form onSubmit={handleSubmitReceipt} className="space-y-3">
              <PersianAmountInput
                id="rcp-amt"
                label="مبلغ واریزی (تومان)"
                required
                value={payAmount}
                onChange={setPayAmount}
                placeholder="مثلاً: ۱,۴۵۰,۰۰۰"
              />

              <div>
                <label htmlFor="rcp-trace" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                  کد رهگیری / شماره پیگیری
                </label>
                <input
                  id="rcp-trace"
                  type="text"
                  required
                  dir="ltr"
                  value={payTrace}
                  onChange={(e) => setPayTrace(e.target.value)}
                  placeholder="SHB-4058891"
                  className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] font-numeric-stat border border-outline-variant/55"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="rcp-ch" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                    روش پرداخت
                  </label>
                  <select
                    id="rcp-ch"
                    value={payChannel}
                    onChange={(e) => setPayChannel(e.target.value as PaymentReceiptDoc['channel'])}
                    className="w-full h-10 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
                  >
                    <option value="کارت‌به‌کارت">کارت‌به‌کارت</option>
                    <option value="شبا / پایا">شبا / پایا</option>
                    <option value="درگاه پرداخت">درگاه پرداخت</option>
                    <option value="پوز مدیریت">پوز مدیریت</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="rcp-bank" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                    حساب مقصد مجتمع
                  </label>
                  <select
                    id="rcp-bank"
                    value={payBank}
                    onChange={(e) => setPayBank(e.target.value as '1102' | '1103')}
                    className="w-full h-10 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
                  >
                    <option value="1102">بانک پاسارگاد (شارژ جاری)</option>
                    <option value="1103">بانک سامان (اندوخته عمرانی)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="rcp-note" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                  توضیحات فیش
                </label>
                <input
                  id="rcp-note"
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
                />
              </div>

              <label className="w-full h-10 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-primary text-[12.5px] font-semibold flex items-center justify-center gap-1.5 border border-dashed border-outline-variant cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
                <span>{payPhoto ? 'تصویر فیش بانکی بارگذاری شد ✓' : 'آپلود تصویر فیش واریزی (اختیاری)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void readFileAsDataUrl(file).then(setPayPhoto);
                  }}
                />
              </label>

              {payPhoto && (
                <img
                  src={payPhoto}
                  alt="پیش‌نمایش فیش واریزی"
                  className="w-full max-h-40 object-contain rounded-[var(--ui-card-radius)] border border-outline-variant/45 bg-surface-container-low"
                />
              )}

              <StitchButton type="submit" disabled={busy} icon="send" className="w-full">
                {busy ? 'در حال ارسال...' : 'ثبت و ارسال فیش به حسابدار'}
              </StitchButton>
            </form>
          </SurfaceCard>

          <SurfaceCard className="space-y-3">
            <SectionHeader title="سوابق فیش‌های ارسالی واحد" icon="receipt" />
            {receipts.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant text-center py-5 mb-0">
                هنوز فیشی ارسال نشده است.
              </p>
            ) : (
              <div className="space-y-2">
                {receipts.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-[2px] bg-surface-container-low/80 border border-outline-variant/45 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <strong className="text-[13.5px] font-bold font-numeric-stat text-on-surface block">
                        {fmtT(r.amountTomans)} تومان
                      </strong>
                      <span className="text-[12px] text-on-surface-variant block truncate">
                        پیگیری {r.traceCode} • {r.channel}
                      </span>
                    </div>
                    <StatusPill
                      label={
                        r.status === 'approved'
                          ? r.voucherNo
                            ? `تایید • سند #${fmtT(r.voucherNo)}`
                            : 'تایید شد'
                          : r.status === 'rejected'
                            ? 'رد شد'
                            : 'در صف حسابدار'
                      }
                      tone={
                        r.status === 'approved'
                          ? 'positive'
                          : r.status === 'rejected'
                            ? 'danger'
                            : 'primary'
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      )}

      {/* ==================== TAB 3: GUEST REGISTRATION FOR GATE GUARD ==================== */}
      {tab === 'guest' && (
        <div className="space-y-3.5 m-panel-in lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
          <SurfaceCard className="space-y-3">
            <SectionHeader title="ثبت مهمان در انتظامات و گیت ورودی" icon="badge" />
            <form onSubmit={handleCreateGuest} className="space-y-3">
              <div>
                <label htmlFor="gp-name" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                  نام مهمان / مراجعه‌کننده
                </label>
                <input
                  id="gp-name"
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="مثلاً: مهندس سعید فرهادی"
                  className="w-full h-10 px-3 rounded-[2px] bg-surface-container-low text-[13px] border border-outline-variant/55"
                />
              </div>

              <IranPlateInput
                label="پلاک خودروی مهمان (ارسال مستقیم به گیت)"
                value={guestPlate}
                onChange={setGuestPlate}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <JalaliDateTimePicker
                  id="gp-date"
                  label="تاریخ و ساعت مراجعه (شمسی)"
                  mode="datetime"
                  value={guestDate}
                  onChange={(formatted) => setGuestDate(formatted)}
                />
                <div>
                  <label htmlFor="gp-hrs" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                    مدت اعتبار مجوز
                  </label>
                  <select
                    id="gp-hrs"
                    value={guestHours}
                    onChange={(e) => setGuestHours(e.target.value)}
                    className="w-full h-10 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
                  >
                    <option value="2">۲ ساعت</option>
                    <option value="6">۶ ساعت</option>
                    <option value="12">۱۲ ساعت</option>
                    <option value="24">۲۴ ساعت</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="gp-note" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                  توضیح برای نگهبانی (اختیاری)
                </label>
                <input
                  id="gp-note"
                  type="text"
                  value={guestNote}
                  onChange={(e) => setGuestNote(e.target.value)}
                  placeholder="مثلاً: اجازه ورود به پارکینگ مهمان"
                  className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
                />
              </div>

              <StitchButton type="submit" disabled={busy} icon="how_to_reg" className="w-full">
                ثبت مجوز و ارسال به نگهبانی گیت
              </StitchButton>
            </form>
          </SurfaceCard>

          <SurfaceCard className="space-y-3">
            <SectionHeader title="مجوزهای مهمان ثبت‌شده من" icon="history" />
            {permits.length === 0 ? (
              <EmptyState
                icon="directions_car"
                title="مجوز مهمانی ثبت نشده است"
                description="پس از ثبت مهمان، نگهبان ورودی بلافاصله پلاک و نام مهمان را مشاهده می‌کند."
              />
            ) : (
              <div className="space-y-2.5">
                {permits.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-[2px] bg-surface-container-low/80 border border-outline-variant/45 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <strong className="text-[13.5px] font-bold text-on-surface block">
                          {p.guestName}
                        </strong>
                        {p.plateText && <IranPlateBadge value={p.plateText} size="sm" />}
                      </div>
                      <StatusPill
                        label={
                          p.status === 'entered'
                            ? 'وارد مجتمع شد'
                            : p.status === 'exited'
                              ? 'خارج شد'
                              : p.status === 'cancelled'
                                ? 'لغو شده'
                                : 'در انتظار گیت'
                        }
                        tone={
                          p.status === 'entered'
                            ? 'positive'
                            : p.status === 'pending_gate'
                              ? 'primary'
                              : 'neutral'
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between text-[12px] text-on-surface-variant">
                      <span>{p.visitDateLabel}</span>
                      {p.status === 'pending_gate' && (
                        <button
                          type="button"
                          onClick={() => void handleCancelPermit(p.id)}
                          className="text-error font-semibold hover:underline"
                        >
                          لغو مجوز
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      )}

      {/* ==================== TAB 4: UNIT REPAIR REPORT WITH PHOTO ==================== */}
      {tab === 'repair' && (
        <div className="space-y-3.5 m-panel-in lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
          <SurfaceCard className="space-y-3">
            <SectionHeader title="اعلام خرابی در واحد با ارسال تصویر" icon="build" />
            <form onSubmit={handleSubmitRepair} className="space-y-2.5">
              <div>
                <label htmlFor="ur-cat" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                  نوع خرابی
                </label>
                <select
                  id="ur-cat"
                  value={repCategory}
                  onChange={(e) => setRepCategory(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-[2px] bg-surface-container-low text-[13px] border border-outline-variant/55"
                >
                  <option value="لوله‌کشی و نشتی">لوله‌کشی و نشتی</option>
                  <option value="برق و روشنایی">برق و روشنایی</option>
                  <option value="سرمایش و گرمایش">سرمایش و گرمایش</option>
                  <option value="آسانسور و مشاعات">آسانسور و مشاعات</option>
                  <option value="سایر موارد">سایر موارد</option>
                </select>
              </div>
              <div>
                <label htmlFor="ur-title" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                  عنوان خرابی
                </label>
                <input
                  id="ur-title"
                  type="text"
                  required
                  value={repTitle}
                  onChange={(e) => setRepTitle(e.target.value)}
                  placeholder="مثلاً: نشتی جزئی زیر سینک آشپزخانه"
                  className="w-full h-10 px-3 rounded-[2px] bg-surface-container-low text-[13px] border border-outline-variant/55"
                />
              </div>
              <div>
                <label htmlFor="ur-desc" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                  توضیحات
                </label>
                <textarea
                  id="ur-desc"
                  rows={3}
                  required
                  value={repDesc}
                  onChange={(e) => setRepDesc(e.target.value)}
                  placeholder="زمان مناسب حضور تکنسین و شرح مشکل..."
                  className="w-full p-2.5 rounded-[2px] bg-surface-container-low text-[13px] border border-outline-variant/55"
                />
              </div>
              <label className="w-full h-10 rounded-[2px] bg-surface-container-low text-primary text-[12.5px] font-semibold flex items-center justify-center gap-1.5 border border-dashed border-outline-variant cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
                <span>{repPhoto ? 'تصویر خرابی پیوست شد ✓' : 'انتخاب یا گرفتن عکس از خرابی'}</span>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void readFileAsDataUrl(file).then(setRepPhoto);
                  }}
                />
              </label>
              {repPhoto && (
                <img
                  src={repPhoto}
                  alt="پیش‌نمایش عکس خرابی"
                  className="w-full max-h-40 object-contain rounded-[2px] border border-outline-variant/45 bg-surface-container-low"
                />
              )}
              <StitchButton type="submit" disabled={busy} icon="send" className="w-full">
                ارسال به مدیر بلوک و تاسیسات
              </StitchButton>
            </form>
          </SurfaceCard>

          <SurfaceCard className="space-y-3">
            <SectionHeader title="پیگیری درخواست‌های خرابی من" icon="engineering" />
            {requests.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant text-center py-5 mb-0">
                درخواست خرابی ثبت نکرده‌اید.
              </p>
            ) : (
              <div className="space-y-2.5">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-[2px] bg-surface-container-low/80 border border-outline-variant/45 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-[13.5px] font-bold text-on-surface">{r.title}</strong>
                      <StatusPill
                        label={
                          r.status === 'resolved'
                            ? 'رفع شد'
                            : r.status === 'in_progress'
                              ? 'در حال تعمیر'
                              : r.status === 'assigned'
                                ? 'ارجاع به تاسیسات'
                                : 'ثبت شد'
                        }
                        tone={r.status === 'resolved' ? 'positive' : 'primary'}
                      />
                    </div>
                    <p className="text-[12.5px] text-on-surface-variant mb-0">{r.description}</p>
                    {r.managerReply && (
                      <div className="p-2 rounded-[2px] bg-surface-container-lowest border border-outline-variant/35 text-[12px]">
                        <strong>پاسخ مدیریت:</strong> {r.managerReply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      )}

      {/* ==================== TAB 5: TELEGRAM-STYLE MESSAGING WITH BLOCK MANAGER ==================== */}
      {tab === 'messages' && (
        <div className="m-panel-in">
          <TelegramChatPanel
            currentUser={currentUser}
            messages={messages}
            mode="resident"
            counterpartTitle={
              blockManagerName
                ? `${blockManagerName} — مدیر بلوک ${currentUser.blockId || 'B'}`
                : `مدیر بلوک ${currentUser.blockId || 'B'}`
            }
            counterpartSubtitle={`واحد ${currentUser.unitCode || ''} • ارتباط رسمی با مدیریت بلوک`}
            onSendMessage={(body) => handleSendTelegramMessage(body)}
            onMarkRead={handleMarkChatRead}
            sending={busy}
          />
        </div>
      )}
    </div>
  );
};
