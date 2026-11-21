import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mobileApi, type MobileBootstrap } from './mobileApi';
import {
  HeroSummaryCard,
  NoticeBanner,
  SectionHeader,
  StatusPill,
  StitchButton,
  SubMenuTabs,
  SurfaceCard,
} from './ui/StitchKit';

interface Props {
  bootstrap: MobileBootstrap;
  onSyncChanged: () => void;
  onNavigate?: (route: string) => void;
}

type LetterView = 'cartable' | 'detail' | 'referral' | 'print' | 'compose';
const VALID_VIEWS: LetterView[] = ['cartable', 'detail', 'referral', 'print', 'compose'];

const GUARD_POS_IDS = new Set(['pos_tw_guard_chief', 'pos_off_sec_mgr', 'pos_off_guard_op']);

const REFERRAL_RECIPIENTS = [
  { id: 'rec_1', name: 'دکتر کیوان رادفر', role: 'رئیس هیئت‌مدیره شهرک' },
  { id: 'rec_2', name: 'علیرضا شمس‌آبادی', role: 'خزانه‌دار و امور مالی' },
  { id: 'rec_3', name: 'مهندس بهنام صابری', role: 'ناظر فنی و تاسیسات' },
  { id: 'rec_4', name: 'رحمان حسینی', role: 'سرشیفت انتظامات گیت' },
];

const REFERRAL_ACTIONS = [
  'جهت اقدام فوری',
  'جهت بررسی و اعلام نظر',
  'جهت صدور دستور پرداخت',
  'جهت اطلاع و بهره‌برداری',
];

export const MobileLettersPage: React.FC<Props> = ({
  bootstrap,
  onSyncChanged,
  onNavigate,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = (searchParams.get('view') as LetterView) || 'cartable';
  const [view, setView] = useState<LetterView>(
    VALID_VIEWS.includes(initialView) ? initialView : 'cartable',
  );
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox');
  const [items, setItems] = useState<Array<Record<string, any>>>([]);
  const [selectedLetter, setSelectedLetter] = useState<Record<string, any> | null>(null);
  const [positions, setPositions] = useState<Array<{ id: string; title: string }>>([]);

  // Compose state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [targetPosId, setTargetPosId] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent' | 'immediate'>('normal');

  // Referral (_12) state
  const [refRecipient, setRefRecipient] = useState(REFERRAL_RECIPIENTS[1].name);
  const [refAction, setRefAction] = useState(REFERRAL_ACTIONS[2]);
  const [refNote, setRefNote] = useState(
    'با توجه به فوریت تامین فشار آب بلوک B، پس از کنترل فاکتور از محل صندوق ذخیره پرداخت گردد.',
  );

  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = searchParams.get('view') as LetterView | null;
    if (q && VALID_VIEWS.includes(q) && q !== view) {
      setView(q);
    }
  }, [searchParams, view]);

  const switchView = (next: LetterView) => {
    setView(next);
    setSearchParams({ view: next }, { replace: true });
    setFeedback('');
  };

  const loadLetters = useCallback(async () => {
    try {
      const [boot, cart] = await Promise.all([
        mobileApi.correspondenceBootstrap().catch(() => null),
        mobileApi.correspondenceCartable(folder).catch(() => null),
      ]);
      const allPos = (
        (boot?.data?.org_positions ?? []) as Array<{ id: string; title: string }>
      ).filter((p) => bootstrap.license.alpr_addon_enabled || !GUARD_POS_IDS.has(p.id));
      setPositions(allPos);
      if (allPos.length > 0 && !targetPosId) {
        setTargetPosId(allPos[0].id);
      }
      setItems((cart?.data?.items ?? []) as Array<Record<string, any>>);
    } catch {
      /* offline */
    }
  }, [folder, bootstrap.license.alpr_addon_enabled, targetPosId]);

  useEffect(() => {
    void loadLetters();
  }, [loadLetters]);

  const handleCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback('');
    try {
      const res = await mobileApi.correspondenceSave({
        letter_type: 'internal',
        subject,
        body_plain_text: body,
        priority,
        classification: 'normal',
        recipients: targetPosId
          ? [{ recipient_kind: 'to', target_position_id: targetPosId, action_type: 'for_action' }]
          : [],
        submit_immediately: true,
      });
      setSubject('');
      setBody('');
      onSyncChanged();
      setFeedback(
        res.queuedOffline
          ? 'نامه در صف آفلاین ذخیره شد.'
          : 'نامه رسمی در دبیرخانه ثبت و ارسال شد.',
      );
      switchView('cartable');
      void loadLetters();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'ارسال نامه ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const handleReferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback('');
    try {
      const letterNum = String(selectedLetter?.indicator_number || 'NL-B-1402');
      await mobileApi.referCorrespondenceLetter({
        letter_number: letterNum,
        recipient_name: refRecipient,
        action_type: refAction,
        annotation: refNote,
      });
      onSyncChanged();
      setFeedback(`ارجاع نامه ${letterNum} به «${refRecipient}» ثبت شد.`);
      switchView('cartable');
      void loadLetters();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'ثبت ارجاع ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const activeDoc = selectedLetter || {
    indicator_number: 'NL-B-1402',
    subject: 'درخواست اورهال فوری بوسترپمپ آبرسانی بلوک B',
    sender_title: 'حسین رضایی (مدیر بلوک B)',
    jalali_date_str: '۱۴۰۵/۰۸/۲۴',
    lifecycle_state: 'در انتظار دستور پرداخت',
    summary:
      'با توجه به افت فشار آب طبقات ۵ و ۶ بلوک B و بازدید شرکت پمپ‌سازان نوین، الکتروپمپ اصلی دچار سوختگی سیم‌پیچ شده است. برآورد هزینه تعمیر ۱۸,۵۰۰,۰۰۰ تومان است.',
  };

  return (
    <div className="flex flex-col gap-3.5 pb-4" dir="rtl">
      {/* Unified Sub-Menu: _10 Cartable, _11 Detail, _12 Referral, _14 Print, Compose */}
      <SubMenuTabs
        active={view}
        onChange={(id) => switchView(id as LetterView)}
        items={[
          { id: 'cartable', label: 'کارتابل', icon: 'inbox' },
          { id: 'detail', label: 'جزئیات نامه', icon: 'description' },
          { id: 'referral', label: 'ارجاع و هامش', icon: 'forward_to_inbox' },
          { id: 'print', label: 'سربرگ A4', icon: 'print' },
          { id: 'compose', label: 'نامه جدید', icon: 'edit_document' },
        ]}
      />

      {feedback && (
        <NoticeBanner message={feedback} tone="success" onClose={() => setFeedback('')} />
      )}

      {/* VIEW 1: Stitch _10 Cartable */}
      {view === 'cartable' && (
        <div className="space-y-3.5">
          <HeroSummaryCard
            title="دبیرخانه بلوک B (یاسمن)"
            subtitle="ارتباط رسمی با هیئت‌مدیره و انتظامات"
            badge="کانال رسمی"
            stats={[
              { label: 'نامه‌های کارتابل', value: items.length.toLocaleString('fa-IR') },
              { label: 'مجوز انتظامات', value: '۵', accent: 'positive' },
              { label: 'اقدام فوری', value: '۱', accent: 'danger' },
            ]}
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <StitchButton
                variant={folder === 'inbox' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFolder('inbox')}
              >
                وارده
              </StitchButton>
              <StitchButton
                variant={folder === 'sent' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFolder('sent')}
              >
                صادره
              </StitchButton>
            </div>
            <StitchButton size="sm" icon="add" onClick={() => switchView('compose')}>
              نگارش نامه
            </StitchButton>
          </div>

          <div className="space-y-2.5">
            {items.map((item, idx) => (
              <SurfaceCard key={item.id ?? idx} className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[14px] font-semibold text-on-surface mb-0 truncate">
                      {item.subject}
                    </h3>
                    <p className="text-[13px] text-on-surface-variant mt-0.5 mb-0 truncate">
                      {item.sender_title || 'دبیرخانه شهرک'} • {item.jalali_date_str || '۱۴۰۵/۰۸/۲۹'}
                    </p>
                  </div>
                  <StatusPill label={item.lifecycle_state || 'وارده'} tone="primary" />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-surface-container-high text-[12.5px]">
                  <span className="text-on-surface-variant font-numeric-stat">
                    شماره {item.indicator_number || 'NL-B-1402'}
                  </span>
                  <StitchButton
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedLetter(item);
                      switchView('detail');
                    }}
                  >
                    باز کردن
                  </StitchButton>
                </div>
              </SurfaceCard>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: Stitch _11 Letter Detail & Workflow */}
      {view === 'detail' && (
        <div className="space-y-3.5">
          <SurfaceCard className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <StatusPill label={activeDoc.lifecycle_state || 'در جریان'} tone="primary" />
              <span className="text-[11px] font-bold text-on-surface-variant font-numeric-stat">
                {activeDoc.indicator_number || 'NL-B-1402'} • {activeDoc.jalali_date_str || '۱۴۰۵/۰۸/۲۴'}
              </span>
            </div>
            <h2 className="text-[14.5px] font-bold text-on-surface mb-0">{activeDoc.subject}</h2>
            <p className="text-[12.5px] text-on-surface-variant leading-relaxed mb-0">
              {activeDoc.summary}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-container-high">
              <StitchButton icon="forward_to_inbox" onClick={() => switchView('referral')}>
                ارجاع و هامش
              </StitchButton>
              <StitchButton variant="secondary" icon="print" onClick={() => switchView('print')}>
                سربرگ A4
              </StitchButton>
            </div>
            {onNavigate && (
              <div className="grid grid-cols-2 gap-2">
                <StitchButton
                  variant="secondary"
                  size="sm"
                  icon="receipt_long"
                  onClick={() => onNavigate('finance?tab=voucher')}
                >
                  سند VCH-402-882
                </StitchButton>
                <StitchButton
                  variant="secondary"
                  size="sm"
                  icon="architecture"
                  onClick={() => onNavigate('facilities?tab=blueprints')}
                >
                  شناسنامه پمپ
                </StitchButton>
              </div>
            )}
          </SurfaceCard>

          {/* Compact 4-Step Workflow */}
          <SurfaceCard className="space-y-2.5">
            <SectionHeader
              title="گردش کار نامه"
              icon="account_tree"
              action={<StatusPill label="مرحله ۳ از ۴" tone="primary" />}
            />
            <div className="space-y-2 text-[12px]">
              {[
                { step: '۱. ثبت و امضای مدیر بلوک B', done: true },
                { step: '۲. ثبت اندیکاتور دبیرخانه مرکزی', done: true },
                { step: '۳. بررسی کمیته فنی و دستور پرداخت خزانه‌دار', done: false },
              ].map((s) => (
                <div
                  key={s.step}
                  className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between"
                >
                  <span className="font-semibold text-on-surface">{s.step}</span>
                  <StatusPill label={s.done ? 'انجام شد' : 'در دست اقدام'} tone={s.done ? 'positive' : 'primary'} />
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* VIEW 3: Stitch _12 Referral & Annotation */}
      {view === 'referral' && (
        <form onSubmit={handleReferSubmit} className="space-y-3.5">
          <SurfaceCard className="space-y-3">
            <SectionHeader
              title={`ارجاع نامه ${activeDoc.indicator_number || 'NL-B-1402'}`}
              icon="forward_to_inbox"
            />
            <div className="space-y-1.5">
              {REFERRAL_RECIPIENTS.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setRefRecipient(rec.name)}
                  className={`w-full p-2.5 rounded-xl border text-right flex items-center justify-between gap-2 transition-colors ${
                    refRecipient === rec.name
                      ? 'border-primary/40 bg-primary-container/50'
                      : 'border-outline-variant/40 bg-surface-container-lowest'
                  }`}
                >
                  <strong className="text-[14px] font-semibold text-on-surface truncate">
                    {rec.name}
                  </strong>
                  <span className="text-[13px] text-on-surface-variant truncate shrink-0">
                    {rec.role}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {REFERRAL_ACTIONS.map((act) => (
                <button
                  key={act}
                  type="button"
                  onClick={() => setRefAction(act)}
                  className={`h-9 px-2.5 rounded-xl text-[12.5px] font-medium border transition-colors truncate ${
                    refAction === act
                      ? 'border-primary/35 bg-primary-container text-on-primary-container font-semibold'
                      : 'border-outline-variant/40 bg-surface-container-low text-on-surface'
                  }`}
                >
                  {act}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              required
              value={refNote}
              onChange={(e) => setRefNote(e.target.value)}
              className="w-full p-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
            />

            <StitchButton type="submit" disabled={busy} icon="send" className="w-full">
              {busy ? 'در حال ثبت...' : 'ثبت هامش و ارسال ارجاع'}
            </StitchButton>
          </SurfaceCard>
        </form>
      )}

      {/* VIEW 4: Stitch _14 Official A4 Letterhead Print */}
      {view === 'print' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-on-surface-variant">
              سربرگ رسمی A4 دبیرخانه شهرک
            </span>
            <StitchButton size="sm" icon="print" onClick={() => window.print()}>
              چاپ / PDF
            </StitchButton>
          </div>

          <article className="bg-white text-[#0b1c30] rounded-2xl shadow-ambient border border-outline-variant/35 p-5 space-y-4">
            <div className="text-center text-[11.5px] font-bold text-[#00236f]">باسمه‌تعالی</div>
            <header className="flex items-start justify-between pb-3 border-b-2 border-[#00236f]">
              <div>
                <h2 className="text-[14.5px] font-black text-[#00236f] mb-0">شهرک مسکونی نیلوفر</h2>
                <span className="text-[10.5px] text-[#444651]">دبیرخانه مرکزی و هیئت‌مدیره</span>
              </div>
              <div className="text-[10.5px] text-left font-numeric-stat">
                <div>شماره: {activeDoc.indicator_number || 'NL-B-1402'}</div>
                <div>تاریخ: {activeDoc.jalali_date_str || '۱۴۰۵/۰۸/۲۴'}</div>
              </div>
            </header>
            <div className="text-[12px] space-y-1">
              <div>
                <strong>از:</strong> {activeDoc.sender_title}
              </div>
              <div>
                <strong>موضوع:</strong> {activeDoc.subject}
              </div>
            </div>
            <p className="text-[12.5px] leading-7 text-justify mb-0">{activeDoc.summary}</p>
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-dashed border-[#c4c5d3] text-center text-[11px]">
              <div>
                <span className="text-[#444651] block">فرستنده</span>
                <strong className="text-[#00236f]">حسین رضایی — مدیر بلوک B</strong>
              </div>
              <div>
                <span className="text-[#444651] block">تاییدیه دبیرخانه</span>
                <strong className="text-[#00236f]">دکتر کیوان رادفر — هیئت‌مدیره</strong>
              </div>
            </div>
          </article>
        </div>
      )}

      {/* VIEW 5: Compose New Letter */}
      {view === 'compose' && (
        <SurfaceCard className="space-y-3">
          <SectionHeader title="نگارش نامه رسمی جدید" icon="edit_document" />
          <form onSubmit={handleCompose} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                  گیرنده
                </label>
                <select
                  value={targetPosId}
                  onChange={(e) => setTargetPosId(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-xl bg-surface-container-low text-[12px] border border-outline-variant/30"
                >
                  {positions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                  فوریت
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as typeof priority)}
                  className="w-full h-10 px-2.5 rounded-xl bg-surface-container-low text-[12px] border border-outline-variant/30"
                >
                  <option value="normal">عادی</option>
                  <option value="urgent">فوری</option>
                  <option value="immediate">آنی</option>
                </select>
              </div>
            </div>

            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="موضوع نامه..."
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
            />
            <textarea
              rows={4}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="متن نامه..."
              className="w-full p-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
            />
            <StitchButton type="submit" disabled={busy} icon="send" className="w-full">
              {busy ? 'در حال ثبت...' : 'ثبت و ارسال نامه'}
            </StitchButton>
          </form>
        </SurfaceCard>
      )}
    </div>
  );
};