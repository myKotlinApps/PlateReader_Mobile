import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mobileApi, type MobileBootstrap, type MobileFormTemplate } from './mobileApi';
import {
  NoticeBanner,
  SectionHeader,
  StatusPill,
  StitchButton,
  SubMenuTabs,
  SurfaceCard,
} from './ui/StitchKit';
import { IranPlateInput } from './ui/IranPlate';

const DRAFTS_KEY = 'alpr_mobile_form_drafts_v1';

type FormMode = 'operational' | 'resolution' | 'assembly';
const VALID_MODES: FormMode[] = ['operational', 'resolution', 'assembly'];

interface Props {
  bootstrap: MobileBootstrap;
  onSyncChanged: () => void;
  onNavigate?: (route: string) => void;
}

export const MobileFormsPage: React.FC<Props> = ({
  bootstrap,
  onSyncChanged,
  onNavigate,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') as FormMode) || 'operational';
  const [mode, setMode] = useState<FormMode>(
    VALID_MODES.includes(initialMode) ? initialMode : 'operational',
  );
  const [forms, setForms] = useState<MobileFormTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const raw = window.localStorage.getItem(DRAFTS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, Record<string, string>>) : {};
    } catch {
      return {};
    }
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'info' | 'danger';
    text: string;
  } | null>(null);

  // Stitch _8 Board Resolution Form State
  const [resSessionNo, setResSessionNo] = useState('BM-1402-14');
  const [resDate, setResDate] = useState('۱۴۰۵/۰۸/۲۵');
  const [resCategory, setResCategory] = useState('مالی و شارژ');
  const [resTitle, setResTitle] = useState(
    'تصویب بازسازی روشنایی معابر و ارتقای دوربین‌های پلاک‌خوان گیت شمالی',
  );
  const [resClauses, setResClauses] = useState(
    'بند ۱: جایگزینی چراغ‌های بلوار اصلی با پروژکتور LED ۵۰ وات.\nبند ۲: سقف بودجه ۱۸,۵۰۰,۰۰۰ تومان از محل صندوق ذخیره عمرانی.',
  );
  const [resBudget, setResBudget] = useState('۱۸,۵۰۰,۰۰۰');

  // Stitch _9 General Assembly Invitation Form State
  const [asmType, setAsmType] = useState('مجمع عمومی عادی سالیانه');
  const [asmTitle, setAsmTitle] = useState(
    'فراخوان مجمع عمومی سالیانه مالکین شهرک نیلوفر — تصویب بودجه',
  );
  const [asmDate, setAsmDate] = useState('پنجشنبه ۱۴۰۵/۰۹/۱۵');
  const [asmTime, setAsmTime] = useState('۱۸:۰۰ الی ۲۰:۳۰');
  const [asmVenue, setAsmVenue] = useState('سالن اجتماعات مرکزی (جنب لابی بلوک A)');
  const [asmAgenda, setAsmAgenda] = useState(
    '۱. گزارش عملکرد سالیانه هیئت‌مدیره\n۲. تصویب صورت‌های مالی و شارژ جدید\n۳. پروژه هوشمندسازی گیت‌های ورود و خروج',
  );

  useEffect(() => {
    const q = searchParams.get('mode') as FormMode | null;
    if (q && VALID_MODES.includes(q) && q !== mode) {
      setMode(q);
    }
  }, [searchParams, mode]);

  const switchMode = (next: FormMode) => {
    setMode(next);
    setSearchParams({ mode: next }, { replace: true });
    setFeedback(null);
  };

  useEffect(() => {
    void mobileApi
      .listForms()
      .then((res) => {
        const list = res.data?.forms ?? [];
        setForms(list);
        if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
      })
      .catch(() => undefined);
  }, [selectedId]);

  const currentForm = forms.find((f) => f.id === selectedId) ?? forms[0] ?? null;
  const currentData = (currentForm ? values[currentForm.id] : undefined) ?? {};

  const updateField = (formId: string, name: string, val: string) => {
    setValues((prev) => {
      const next = { ...prev, [formId]: { ...(prev[formId] ?? {}), [name]: val } };
      try {
        window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const canWriteSection = (sectionId: string) =>
    bootstrap.permissions[sectionId] === 'write' || bootstrap.user.role === 'admin';

  const handleSubmitOperational = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentForm) return;
    setFeedback(null);
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { ...currentData };
      if (!payload.blockId && bootstrap.user.allowed_block_ids.length === 1) {
        payload.blockId = bootstrap.user.allowed_block_ids[0];
      }
      if (currentForm.id === 'meter_reading' && payload.currReading != null) {
        payload.currReading = Number(payload.currReading);
      }
      const res = await mobileApi.submitForm(currentForm.id, payload);
      setValues((prev) => {
        const next = { ...prev, [currentForm.id]: {} };
        try {
          window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      onSyncChanged();
      setFeedback({
        tone: res.queuedOffline ? 'info' : 'success',
        text: res.queuedOffline
          ? 'فرم در صف آفلاین ذخیره شد.'
          : 'فرم عملیاتی با موفقیت ثبت شد.',
      });
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت فرم ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      await mobileApi.submitForm('board_resolution_stitch_8', {
        session_number: resSessionNo,
        date: resDate,
        category: resCategory,
        title: resTitle,
        clauses: resClauses,
        budget_tomans: resBudget,
      });
      onSyncChanged();
      setFeedback({
        tone: 'success',
        text: `مصوبه هیئت‌مدیره (${resSessionNo}) ثبت و ابلاغ شد.`,
      });
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت مصوبه انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitAssembly = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      await mobileApi.submitForm('general_assembly_stitch_9', {
        assembly_type: asmType,
        title: asmTitle,
        date: asmDate,
        time: asmTime,
        venue: asmVenue,
        agenda: asmAgenda,
      });
      onSyncChanged();
      setFeedback({
        tone: 'success',
        text: `فراخوان «${asmType}» صادر و پیامک دعوت‌نامه ارسال شد.`,
      });
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت فراخوان انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 pb-4" dir="rtl">
      {/* Unified Sub-Menu: Operational Forms + Stitch _8 Resolution + Stitch _9 Assembly */}
      <SubMenuTabs
        active={mode}
        onChange={(id) => switchMode(id as FormMode)}
        items={[
          { id: 'operational', label: 'فرم‌های عملیاتی', icon: 'fact_check' },
          { id: 'resolution', label: 'مصوبه هیئت‌مدیره', icon: 'gavel' },
          { id: 'assembly', label: 'فراخوان مجمع', icon: 'groups' },
        ]}
      />

      {feedback && (
        <NoticeBanner
          message={feedback.text}
          tone={feedback.tone}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* MODE 1: Operational Forms */}
      {mode === 'operational' && (
        <div className="space-y-3.5">
          <SurfaceCard className="space-y-3">
            <SectionHeader
              title="انتخاب فرم عملیاتی"
              icon="fact_check"
              action={<StatusPill label={`${forms.length.toLocaleString('fa-IR')} فرم`} tone="primary" />}
            />
            <div className="flex flex-wrap gap-1.5">
              {forms.map((form) => (
                <button
                  key={form.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(form.id);
                    setFeedback(null);
                  }}
                  className={`h-9 px-3 rounded-xl text-[12.5px] font-medium transition-colors ${
                    currentForm?.id === form.id
                      ? 'bg-primary-container text-on-primary-container font-semibold'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {form.title}
                </button>
              ))}
            </div>
          </SurfaceCard>

          {currentForm && (
            <SurfaceCard className="space-y-3">
              <SectionHeader
                title={currentForm.title}
                icon="assignment"
                action={
                  currentForm.id === 'guest_vehicle_permit' && onNavigate ? (
                    <StitchButton
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigate('guard?tab=gate')}
                    >
                      رفتن به گیت
                    </StitchButton>
                  ) : undefined
                }
              />

              <form onSubmit={handleSubmitOperational} className="space-y-2.5">
                {currentForm.fields.map((field) => {
                  const val = currentData[field.name] ?? '';
                  if (field.type === 'textarea') {
                    return (
                      <div key={field.name}>
                        <label className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                          {field.label}
                        </label>
                        <textarea
                          rows={3}
                          required={field.required}
                          value={val}
                          onChange={(e) => updateField(currentForm.id, field.name, e.target.value)}
                          className="w-full p-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
                        />
                      </div>
                    );
                  }
                  if (field.type === 'select') {
                    return (
                      <div key={field.name}>
                        <label className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                          {field.label}
                        </label>
                        <select
                          required={field.required}
                          value={val || field.options?.[0] || ''}
                          onChange={(e) => updateField(currentForm.id, field.name, e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
                        >
                          {(field.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  if (field.name.toLowerCase().includes('plate')) {
                    return (
                      <div key={field.name} className="pt-1">
                        <IranPlateInput
                          label={field.label}
                          value={val}
                          onChange={(formatted) => updateField(currentForm.id, field.name, formatted)}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={field.name}>
                      <label className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                        {field.label}
                      </label>
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        required={field.required}
                        value={val}
                        onChange={(e) => updateField(currentForm.id, field.name, e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
                      />
                    </div>
                  );
                })}

                <StitchButton
                  type="submit"
                  disabled={busy || !canWriteSection(currentForm.section)}
                  icon="send"
                  className="w-full"
                >
                  {busy ? 'در حال ثبت...' : 'ثبت فرم'}
                </StitchButton>
              </form>
            </SurfaceCard>
          )}
        </div>
      )}

      {/* MODE 2: Stitch _8 Board Resolution */}
      {mode === 'resolution' && (
        <form onSubmit={handleSubmitResolution} className="space-y-3.5">
          <SurfaceCard className="space-y-3">
            <SectionHeader
              title="صدور مصوبه قانونی هیئت‌مدیره"
              icon="gavel"
              action={<StatusPill label="ماده ۶ و ۱۴" tone="primary" />}
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                  شماره صورت‌جلسه
                </label>
                <input
                  type="text"
                  value={resSessionNo}
                  onChange={(e) => setResSessionNo(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low font-numeric-stat font-bold text-[12.5px] border border-outline-variant/30"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-on-surface-variant mb-1">
                  تاریخ تصویب
                </label>
                <input
                  type="text"
                  value={resDate}
                  onChange={(e) => setResDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low font-numeric-stat text-[12.5px] border border-outline-variant/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {['مالی و شارژ', 'فنی و عمرانی', 'انتظامات و پلاک‌خوان', 'آیین‌نامه داخلی'].map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setResCategory(cat)}
                    className={`h-9 px-2.5 rounded-xl text-[12.5px] font-medium border transition-colors truncate ${
                      resCategory === cat
                        ? 'border-primary/35 bg-primary-container text-on-primary-container font-semibold'
                        : 'border-outline-variant/40 bg-surface-container-low text-on-surface'
                    }`}
                  >
                    {cat}
                  </button>
                ),
              )}
            </div>

            <input
              type="text"
              required
              value={resTitle}
              onChange={(e) => setResTitle(e.target.value)}
              placeholder="عنوان مصوبه"
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
            />
            <textarea
              rows={3}
              required
              value={resClauses}
              onChange={(e) => setResClauses(e.target.value)}
              className="w-full p-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
            />
            <input
              type="text"
              value={resBudget}
              onChange={(e) => setResBudget(e.target.value)}
              placeholder="سقف بودجه (تومان)"
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low font-numeric-stat font-bold text-[12.5px] border border-outline-variant/30"
            />

            <StitchButton type="submit" disabled={busy} icon="verified" className="w-full">
              {busy ? 'در حال ثبت...' : 'ثبت و ابلاغ مصوبه'}
            </StitchButton>
          </SurfaceCard>
        </form>
      )}

      {/* MODE 3: Stitch _9 General Assembly */}
      {mode === 'assembly' && (
        <form onSubmit={handleSubmitAssembly} className="space-y-3.5">
          <SurfaceCard className="space-y-3">
            <SectionHeader
              title="دعوت‌نامه رسمی مجمع عمومی"
              icon="groups"
              action={<StatusPill label="حدنصاب ۲۵ واحد" tone="primary" />}
            />

            <div className="grid grid-cols-2 gap-1.5">
              {[
                'مجمع عمومی عادی سالیانه',
                'مجمع عمومی فوق‌العاده',
                'نظرسنجی فوری',
                'انتخابات هیئت‌مدیره',
              ].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAsmType(t)}
                  className={`h-9 px-2.5 rounded-xl text-[12.5px] font-medium border transition-colors truncate ${
                    asmType === t
                      ? 'border-primary/35 bg-primary-container text-on-primary-container font-semibold'
                      : 'border-outline-variant/40 bg-surface-container-low text-on-surface'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <input
              type="text"
              required
              value={asmTitle}
              onChange={(e) => setAsmTitle(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={asmDate}
                onChange={(e) => setAsmDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
              />
              <input
                type="text"
                value={asmTime}
                onChange={(e) => setAsmTime(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
              />
            </div>

            <input
              type="text"
              value={asmVenue}
              onChange={(e) => setAsmVenue(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
            />
            <textarea
              rows={3}
              required
              value={asmAgenda}
              onChange={(e) => setAsmAgenda(e.target.value)}
              className="w-full p-3 rounded-xl bg-surface-container-low text-[12.5px] border border-outline-variant/30"
            />

            <StitchButton type="submit" disabled={busy} icon="how_to_vote" className="w-full">
              {busy ? 'در حال ارسال...' : 'صدور دعوت‌نامه و ارسال پیامک'}
            </StitchButton>
          </SurfaceCard>
        </form>
      )}
    </div>
  );
};