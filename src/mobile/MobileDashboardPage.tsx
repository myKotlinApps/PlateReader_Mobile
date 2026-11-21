import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { MobileBootstrap } from './mobileApi';
import {
  HeroSummaryCard,
  NoticeBanner,
  SectionHeader,
  StatusPill,
  StitchButton,
  SubMenuTabs,
  SurfaceCard,
} from './ui/StitchKit';
import { IranPlateBadge } from './ui/IranPlate';

interface Props {
  bootstrap: MobileBootstrap;
  outboxCount: number;
  onNavigate: (route: string) => void;
}

type DashView = 'mobile' | 'overview' | 'executive';

export const MobileDashboardPage: React.FC<Props> = ({ bootstrap, outboxCount, onNavigate }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = (searchParams.get('view') as DashView) || 'mobile';
  const [view, setView] = useState<DashView>(
    ['mobile', 'overview', 'executive'].includes(initialView) ? initialView : 'mobile',
  );

  // Sub-menus inside Overview (_1) and Executive (_7) so each screen stays calm and short
  const [overviewSub, setOverviewSub] = useState<'tickets' | 'ledger'>('tickets');
  const [execSub, setExecSub] = useState<'approvals' | 'projects'>('approvals');

  const [ticketStates, setTicketStates] = useState<Record<string, 'open' | 'done'>>({
    t1: 'open',
    t2: 'open',
    t3: 'done',
  });
  const [execApprovals, setExecApprovals] = useState<
    Record<string, 'pending' | 'approved' | 'rejected'>
  >({
    ex1: 'pending',
    ex2: 'pending',
    ex3: 'pending',
  });
  const [toast, setToast] = useState('');

  useEffect(() => {
    const qView = searchParams.get('view') as DashView | null;
    if (qView && ['mobile', 'overview', 'executive'].includes(qView) && qView !== view) {
      setView(qView);
    }
  }, [searchParams, view]);

  const switchView = (next: DashView) => {
    setView(next);
    setSearchParams({ view: next }, { replace: true });
  };

  const fa = (n: number) => n.toLocaleString('fa-IR');
  const activeLeaks = bootstrap.counters.active_leaks ?? 2;

  return (
    <div className="flex flex-col gap-3.5 pb-4" dir="rtl">
      {/* Unified Sub-Menu: Stitch _3 Mobile, _1 Overview, _7 Executive */}
      <SubMenuTabs
        active={view}
        onChange={(id) => switchView(id as DashView)}
        items={[
          { id: 'mobile', label: 'داشبورد مدیر', icon: 'dashboard' },
          { id: 'overview', label: 'تیکت و گردش', icon: 'monitoring' },
          { id: 'executive', label: 'مدیریت عالی', icon: 'corporate_fare' },
        ]}
      />

      {toast && <NoticeBanner message={toast} tone="success" onClose={() => setToast('')} />}

      {/* VIEW 1: Stitch _3 — Clean Mobile Manager Dashboard */}
      {view === 'mobile' && (
        <div className="space-y-3.5 m-panel-in">
          <HeroSummaryCard
            title="مجتمع مسکونی نیلوفر"
            subtitle={`${bootstrap.user.display_name} • ۴۸ واحد (۳ بلوک)`}
            badge="وصولی ۹۲٪"
            stats={[
              { label: 'صندوق (م.ت)', value: '۱۸۴.۵' },
              { label: 'واریزی ماه (م.ت)', value: '۶۸.۲', accent: 'positive' },
              { label: 'هزینه‌ها (م.ت)', value: '۲۴.۹' },
            ]}
          />

          {/* Quick Shortcuts Grid — Calm Tonal with Tactile Press */}
          <SurfaceCard className="space-y-3">
            <SectionHeader title="دسترسی سریع" icon="apps" />
            <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
              {[
                { label: 'واحدها', icon: 'domain', route: 'finance?tab=units' },
                { label: 'حسابداری', icon: 'account_balance', route: 'finance?tab=accountant' },
                { label: 'تطبیق بانک', icon: 'document_scanner', route: 'finance?tab=reconcile' },
                { label: 'تنخواه', icon: 'analytics', route: 'finance?tab=petty' },
                { label: 'نشتی آب', icon: 'water_damage', route: 'facilities?tab=leaks', badge: activeLeaks },
                { label: 'نقشه‌ها', icon: 'architecture', route: 'facilities?tab=blueprints' },
                { label: 'دبیرخانه', icon: 'mail', route: 'letters?view=cartable' },
                { label: 'پلاک‌خوان', icon: 'directions_car', route: 'guard?tab=gate', badge: bootstrap.counters.unread_guard_directives },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onNavigate(item.route)}
                  className="relative flex flex-col items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-xl bg-surface-container-low/75 hover:bg-surface-container active:scale-[0.96] transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-[inset_0_0_0_1px_rgba(27,37,51,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute top-1 left-1 min-w-[17px] h-[17px] px-1 rounded-full bg-error text-on-error text-[10.5px] font-bold flex items-center justify-center">
                      {fa(item.badge)}
                    </span>
                  ) : null}
                  <span className="material-symbols-outlined text-[20px] text-primary/85">
                    {item.icon}
                  </span>
                  <span className="text-[12px] font-medium text-on-surface text-center leading-snug truncate max-w-full">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </SurfaceCard>

          <div className="space-y-3.5 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {/* Compact Blocks Status */}
            <SurfaceCard className="space-y-2.5">
              <SectionHeader
                title="وضعیت بلوک‌ها"
                icon="apartment"
                action={
                  <StitchButton
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate('finance?tab=units')}
                  >
                    مشاهده همه
                  </StitchButton>
                }
              />
              <div className="divide-y divide-surface-container-high">
                {[
                  { code: 'A', name: 'بلوک A (شرقی)', status: 'تسویه کامل', pct: 100, ok: true, route: 'finance?tab=units' },
                  { code: 'B', name: 'بلوک B (غربی)', status: '۳ معوقه • ۱ نشتی', pct: 81, ok: false, route: 'facilities?tab=leaks' },
                  { code: 'C', name: 'بلوک C (مرکزی)', status: '۱ معوقه', pct: 94, ok: true, route: 'finance?tab=units' },
                ].map((blk) => (
                  <button
                    key={blk.code}
                    type="button"
                    onClick={() => onNavigate(blk.route)}
                    className="w-full py-2.5 flex items-center justify-between gap-2.5 text-right hover:bg-surface-container-low/60 active:scale-[0.99] rounded-xl px-1.5 transition-[transform,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="w-9 h-9 rounded-xl bg-primary-container/70 text-on-primary-container font-bold text-[13.5px] flex items-center justify-center shrink-0">
                        {blk.code}
                      </span>
                      <div className="min-w-0 flex-1">
                        <strong className="text-[14px] font-semibold text-on-surface block truncate">
                          {blk.name}
                        </strong>
                        <span className="text-[13px] text-on-surface-variant block truncate mt-0.5">
                          {blk.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusPill label={`${fa(blk.pct)}٪`} tone={blk.ok ? 'positive' : 'danger'} />
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                        chevron_left
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </SurfaceCard>

            {/* Concise Urgent Alerts */}
            <SurfaceCard className="space-y-2.5">
              <SectionHeader title="موارد نیازمند اقدام" icon="notifications_active" />
              <button
                type="button"
                onClick={() => onNavigate('facilities?tab=leaks')}
                className="w-full p-3 rounded-xl bg-error-container/50 hover:bg-error-container/70 active:scale-[0.985] transition-[transform,background-color] duration-150 border border-error/15 flex items-center justify-between gap-2.5 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
              >
                <div className="min-w-0 flex-1">
                  <strong className="text-[14px] font-semibold text-on-error-container block truncate">
                    نشتی بحرانی #TR-8842 — واحد ۳۰۲ بلوک B
                  </strong>
                  <span className="text-[13px] text-on-surface-variant block truncate mt-0.5">
                    شیر فلکه V-B2-03-W قطع شد • مهندس صابری در مسیر
                  </span>
                </div>
                <span className="material-symbols-outlined text-[18px] text-error shrink-0">
                  chevron_left
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('finance?tab=voucher')}
                className="w-full p-3 rounded-xl bg-surface-container-low/80 hover:bg-surface-container active:scale-[0.985] transition-[transform,background-color] duration-150 border border-outline-variant/35 flex items-center justify-between gap-2.5 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <strong className="text-[14px] font-semibold text-on-surface block truncate">
                    سند پایا VCH-402-882 — اورهال بوسترپمپ
                  </strong>
                  <span className="text-[13px] text-on-surface-variant block truncate mt-0.5">
                    ۱۸,۵۰۰,۰۰۰ تومان • آماده تایید نهایی
                  </span>
                </div>
                <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
                  chevron_left
                </span>
              </button>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* VIEW 2: Stitch _1 — Complex Overview (Split into Sub-Menus: Tickets vs Ledger) */}
      {view === 'overview' && (
        <div className="space-y-3.5 m-panel-in">
          <HeroSummaryCard
            title="نمای جامع مجتمع نیلوفر"
            subtitle="تیکت‌های ساکنین و گردش صندوق"
            badge="فعال"
            stats={[
              { label: 'موجودی (م.ت)', value: '۱۸۴.۵' },
              { label: 'وصول شارژ', value: '۹۲٪', accent: 'positive' },
              {
                label: 'موارد باز',
                value: fa(bootstrap.counters.open_work_orders + activeLeaks),
                accent: 'danger',
              },
            ]}
          />

          <SubMenuTabs
            active={overviewSub}
            onChange={(id) => setOverviewSub(id as typeof overviewSub)}
            items={[
              { id: 'tickets', label: 'تیکت‌های ساکنین', icon: 'support_agent' },
              { id: 'ledger', label: 'گردش مالی اخیر', icon: 'swap_horiz' },
            ]}
          />

          {overviewSub === 'tickets' && (
            <SurfaceCard className="space-y-2.5">
              <SectionHeader
                title="درخواست‌های ساکنین"
                icon="support_agent"
                action={
                  <StitchButton
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate('forms?mode=operational')}
                  >
                    + ثبت جدید
                  </StitchButton>
                }
              />
              {[
                {
                  id: 't1',
                  unit: 'واحد ۳۰۲ بلوک B',
                  title: 'رطوبت سقف سرویس مستر',
                  tag: 'فوری',
                  route: 'facilities?tab=leaks',
                },
                {
                  id: 't2',
                  unit: 'واحد ۱۰۴ بلوک A',
                  title: 'ثبت پلاک خودرو دوم ساکن',
                  plate: '۶۸ د ۷۹۱ - ایران ۲۲',
                  tag: 'گیت',
                  route: 'guard?tab=gate',
                },
                {
                  id: 't3',
                  unit: 'واحد ۵۰۱ بلوک C',
                  title: 'تنظیم سنسور روشنایی راهرو',
                  tag: 'برق',
                  route: 'facilities?tab=blueprints',
                },
              ].map((tk) => {
                const done = ticketStates[tk.id] === 'done';
                return (
                  <div
                    key={tk.id}
                    className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <h4 className="text-[14px] font-semibold text-on-surface mb-0 truncate">
                          {tk.title}
                        </h4>
                        <span className="text-[13px] text-on-surface-variant block truncate">
                          {tk.unit}
                        </span>
                        {'plate' in tk && tk.plate && (
                          <IranPlateBadge value={tk.plate} size="sm" />
                        )}
                      </div>
                      <StatusPill label={done ? 'انجام شد' : tk.tag} tone={done ? 'positive' : 'danger'} />
                    </div>
                    <div className="flex items-center gap-2">
                      <StitchButton
                        variant="secondary"
                        size="sm"
                        onClick={() => onNavigate(tk.route)}
                      >
                        مشاهده
                      </StitchButton>
                      {!done && (
                        <StitchButton
                          size="sm"
                          onClick={() => {
                            setTicketStates((prev) => ({ ...prev, [tk.id]: 'done' }));
                            setToast(`تیکت ${tk.unit} تکمیل شد.`);
                          }}
                        >
                          تکمیل
                        </StitchButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </SurfaceCard>
          )}

          {overviewSub === 'ledger' && (
            <SurfaceCard className="space-y-2.5">
              <SectionHeader
                title="آخرین تراکنش‌های صندوق"
                icon="swap_horiz"
                action={
                  <StitchButton
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate('finance?tab=voucher')}
                  >
                    سند پایا
                  </StitchButton>
                }
              />
              <div className="divide-y divide-surface-container-high">
                {[
                  { title: 'شارژ آبان — واحد ۱۰۱ بلوک A', amount: '+۱,۸۵۰,۰۰۰', ok: true, date: 'امروز ۱۰:۱۲' },
                  { title: 'اورهال بوسترپمپ (VCH-402-882)', amount: '-۱۸,۵۰۰,۰۰۰', ok: false, date: 'دیروز ۱۸:۱۵' },
                  { title: 'شارژ آبان — واحد ۲۰۳ بلوک B', amount: '+۲,۱۰۰,۰۰۰', ok: true, date: 'دیروز ۱۴:۳۰' },
                  { title: 'کنتاکتور آسانسور بلوک B', amount: '-۴,۲۰۰,۰۰۰', ok: false, date: '۲۶ بهمن' },
                ].map((tx, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <strong className="block text-[14px] font-semibold text-on-surface truncate">
                        {tx.title}
                      </strong>
                      <span className="block text-[12.5px] text-on-surface-variant truncate mt-0.5">
                        {tx.date}
                      </span>
                    </div>
                    <span
                      className={`text-[13.5px] font-bold font-numeric-stat shrink-0 ${
                        tx.ok ? 'text-secondary' : 'text-on-surface'
                      }`}
                    >
                      {tx.amount} ت
                    </span>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          )}
        </div>
      )}

      {/* VIEW 3: Stitch _7 — Executive Panel (Split into Sub-Menus: Approvals vs Capital Projects) */}
      {view === 'executive' && (
        <div className="space-y-3.5 m-panel-in">
          <HeroSummaryCard
            title="مدیریت عالی شهرک نیلوفر"
            subtitle="شورای راهبردی و پروژه‌های کلان"
            badge="فاز ۱ تا ۳"
            stats={[
              { label: 'ذخیره عمرانی (م.ت)', value: '۱,۴۲۰' },
              { label: 'پروژه‌های کلان', value: '۷۴٪', accent: 'positive' },
              { label: 'تاییدیه‌های باز', value: '۳ مورد' },
            ]}
          />

          <SubMenuTabs
            active={execSub}
            onChange={(id) => setExecSub(id as typeof execSub)}
            items={[
              { id: 'approvals', label: 'تاییدیه‌های فوری', icon: 'verified_user' },
              { id: 'projects', label: 'پروژه‌های عمرانی', icon: 'construction' },
            ]}
          />

          {execSub === 'approvals' && (
            <SurfaceCard className="space-y-2.5">
              <SectionHeader title="تاییدیه‌های مدیریت عالی" icon="verified_user" />
              {[
                { id: 'ex1', title: 'بهسازی آسفالت و روشنایی رینگ غربی', meta: '۲۴۰ میلیون تومان' },
                { id: 'ex2', title: 'قرارداد لابی‌من شب بلوک‌های D و E', meta: 'شروع از اول آذر' },
                { id: 'ex3', title: 'مجوز بازسازی واحد ۲۰۴ بلوک B', meta: 'تاییدیه ناظر سازه' },
              ].map((ap) => {
                const st = execApprovals[ap.id];
                return (
                  <div
                    key={ap.id}
                    className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <strong className="block text-[14px] font-semibold text-on-surface truncate">
                          {ap.title}
                        </strong>
                        <span className="block text-[13px] text-on-surface-variant truncate mt-0.5">
                          {ap.meta}
                        </span>
                      </div>
                      {st !== 'pending' && (
                        <StatusPill
                          label={st === 'approved' ? 'تایید شد' : 'عودت'}
                          tone={st === 'approved' ? 'positive' : 'danger'}
                        />
                      )}
                    </div>
                    {st === 'pending' && (
                      <div className="flex gap-2">
                        <StitchButton
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setExecApprovals((p) => ({ ...p, [ap.id]: 'approved' }));
                            setToast(`تایید «${ap.title}» ثبت شد.`);
                          }}
                        >
                          تایید و ابلاغ
                        </StitchButton>
                        <StitchButton
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setExecApprovals((p) => ({ ...p, [ap.id]: 'rejected' }));
                            setToast(`«${ap.title}» جهت اصلاح عودت داده شد.`);
                          }}
                        >
                          عودت
                        </StitchButton>
                      </div>
                    )}
                  </div>
                );
              })}
            </SurfaceCard>
          )}

          {execSub === 'projects' && (
            <SurfaceCard className="space-y-2.5">
              <SectionHeader title="پروژه‌های عمرانی فعال" icon="construction" />
              {[
                { name: 'هوشمندسازی گیت شمالی (ALPR)', pct: 92, route: 'guard?tab=gate' },
                { name: 'اورهال چیلرها و موتورخانه', pct: 78, route: 'facilities?tab=blueprints' },
                { name: 'آبیاری قطره‌ای هوشمند فضای سبز', pct: 64, route: 'finance?tab=petty' },
                { name: 'روشنایی خورشیدی معابر', pct: 55, route: 'forms?mode=resolution' },
              ].map((prj) => (
                <button
                  key={prj.name}
                  type="button"
                  onClick={() => onNavigate(prj.route)}
                  className="w-full p-3 rounded-xl bg-surface-container-low space-y-2 text-right hover:bg-surface-container transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-[13.5px]">
                    <strong className="font-semibold text-on-surface truncate">{prj.name}</strong>
                    <span className="font-bold text-primary font-numeric-stat shrink-0">
                      {fa(prj.pct)}٪
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                    <div
                      className="h-full bg-primary/75 rounded-full"
                      style={{ width: `${prj.pct}%` }}
                    ></div>
                  </div>
                </button>
              ))}
            </SurfaceCard>
          )}
        </div>
      )}

      {outboxCount > 0 && (
        <NoticeBanner
          tone="info"
          message={`${fa(outboxCount)} مورد در صف آفلاین ذخیره شده است و با دکمه همگام‌سازی ارسال می‌شود.`}
        />
      )}
    </div>
  );
};