import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rbacApi, readFileAsDataUrl } from '../rbac/rbacApi';
import { formatRemainingDurationFa, type RbacUserRecord } from '../rbac/roles';
import { getCaretakerBlockIds } from '../utils/caretakerAccess';
import type { CaretakerTaskDoc } from '../../server/nosqlStore';
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
} from '../ui/StitchKit';

type CaretakerTab = 'tasks' | 'done' | 'report';
const VALID_TABS: CaretakerTab[] = ['tasks', 'done', 'report'];

interface Props {
  currentUser: RbacUserRecord;
  remainingMs: number | null;
  onSyncChanged?: () => void;
}

export const CaretakerPanelPage: React.FC<Props> = ({
  currentUser,
  remainingMs,
  onSyncChanged,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const qTab = (searchParams.get('tab') as CaretakerTab) || 'tasks';
  const [tab, setTab] = useState<CaretakerTab>(VALID_TABS.includes(qTab) ? qTab : 'tasks');

  const [tasks, setTasks] = useState<CaretakerTaskDoc[]>([]);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Live countdown tick for temporary caretakers
  const [liveRemainingMs, setLiveRemainingMs] = useState<number | null>(remainingMs);

  // Completion modal state
  const [completingTask, setCompletingTask] = useState<CaretakerTaskDoc | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [completionPhoto, setCompletionPhoto] = useState('');

  const assignedBlockIds = useMemo(() => {
    const ids = getCaretakerBlockIds(currentUser);
    return ids.length > 0 ? ids : [currentUser.blockId || 'B'];
  }, [currentUser]);

  const [selectedBlockFilter, setSelectedBlockFilter] = useState<string>('ALL');

  // Common area defect report state
  const [repBlockId, setRepBlockId] = useState<string>(() => assignedBlockIds[0] || 'B');
  const [repTitle, setRepTitle] = useState('');
  const [repCategory, setRepCategory] = useState('روشنایی و برق مشاعات');
  const [repDesc, setRepDesc] = useState('');
  const [repPhoto, setRepPhoto] = useState('');

  useEffect(() => {
    setLiveRemainingMs(remainingMs);
  }, [remainingMs]);

  useEffect(() => {
    if (!currentUser.isTemporary || !currentUser.validUntilMs) return;
    const tick = () => {
      setLiveRemainingMs(Math.max(0, (currentUser.validUntilMs || 0) - Date.now()));
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [currentUser.isTemporary, currentUser.validUntilMs]);

  useEffect(() => {
    const paramTab = searchParams.get('tab') as CaretakerTab | null;
    if (paramTab && VALID_TABS.includes(paramTab) && paramTab !== tab) {
      setTab(paramTab);
    }
  }, [searchParams, tab]);

  const switchTab = (next: CaretakerTab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
    setFeedback(null);
  };

  const loadTasks = useCallback(async () => {
    try {
      const res = await rbacApi.listTasks();
      setTasks(res.items);
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'دریافت وظایف انجام نشد.',
      });
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const visibleTasks = useMemo(
    () =>
      selectedBlockFilter === 'ALL'
        ? tasks
        : tasks.filter((t) => t.blockId === selectedBlockFilter),
    [tasks, selectedBlockFilter],
  );

  const activeTasks = visibleTasks.filter(
    (t) => t.status === 'todo' || t.status === 'in_progress' || t.status === 'needs_fix',
  );
  const doneTasks = visibleTasks.filter(
    (t) => t.status === 'done_pending_review' || t.status === 'approved',
  );

  const handleStartTask = async (task: CaretakerTaskDoc) => {
    setBusy(true);
    try {
      await rbacApi.updateTask(task.id, { status: 'in_progress' });
      setFeedback({ tone: 'info', text: `انجام وظیفه «${task.title}» آغاز شد.` });
      await loadTasks();
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'تغییر وضعیت انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTask) return;
    setBusy(true);
    try {
      await rbacApi.updateTask(completingTask.id, {
        status: 'done_pending_review',
        completionNote: completionNote.trim() || 'انجام شد و آماده بررسی مدیر بلوک است.',
        completionPhoto: completionPhoto || undefined,
      });
      setCompletingTask(null);
      setCompletionNote('');
      setCompletionPhoto('');
      setFeedback({
        tone: 'success',
        text: 'گزارش اتمام کار ثبت شد و برای بررسی و تایید مدیر بلوک ارسال گردید.',
      });
      await loadTasks();
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت اتمام کار ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReportCommonArea = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await rbacApi.createResidentRequest({
        type: 'common_area',
        category: repCategory,
        title: repTitle.trim(),
        description: repDesc.trim(),
        photoDataUrl: repPhoto || undefined,
        blockId: repBlockId,
        unitCode: `مشاعات بلوک ${repBlockId}`,
      });
      setRepTitle('');
      setRepDesc('');
      setRepPhoto('');
      setFeedback({
        tone: 'success',
        text: 'گزارش اشکال مشاعات به کارتابل مدیر بلوک و مسئول تاسیسات ارسال شد.',
      });
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت گزارش ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 pb-4" dir="rtl">
      {/* Temporary Caretaker Countdown Banner */}
      {currentUser.isTemporary && (
        <div className="bg-error-container/75 border border-error/30 rounded-[2px] p-3.5 flex items-center justify-between gap-2.5 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-[22px] text-error shrink-0">
              hourglass_top
            </span>
            <div className="min-w-0">
              <strong className="text-[13.5px] font-bold text-on-error-container block">
                دسترسی موقت / کمکی • {currentUser.accessDurationLabel || 'شیفت زمان‌دار'}
              </strong>
              <span className="text-[12px] text-on-error-container/85 block">
                تعریف‌شده توسط {currentUser.createdByName || 'مدیر بلوک'} • دسترسی پس از پایان زمان خودکار بسته می‌شود
              </span>
            </div>
          </div>
          <StatusPill
            label={
              typeof liveRemainingMs === 'number'
                ? `زمان باقی‌مانده: ${formatRemainingDurationFa(liveRemainingMs)}`
                : 'موقت فعال'
            }
            tone="danger"
          />
        </div>
      )}

      <HeroSummaryCard
        title={
          assignedBlockIds.length > 1
            ? `پنل سرایداری بلوک‌های ${assignedBlockIds.join('، ')} • ${currentUser.displayName}`
            : `پنل سرایداری بلوک ${assignedBlockIds[0]} • ${currentUser.displayName}`
        }
        subtitle={
          currentUser.isTemporary
            ? `سرایدار موقت / کمکی • دسترسی به ${assignedBlockIds.map((b) => `بلوک ${b}`).join('، ')}`
            : `سرایدار دائم • دسترسی به ${assignedBlockIds.map((b) => `بلوک ${b}`).join('، ')}`
        }
        badge={
          assignedBlockIds.length > 1
            ? `بلوک‌های ${assignedBlockIds.join('، ')}`
            : `بلوک ${assignedBlockIds[0]}`
        }
        stats={[
          {
            label: 'وظایف باز',
            value: activeTasks.length.toLocaleString('fa-IR'),
            accent: activeTasks.length > 0 ? 'danger' : 'positive',
          },
          {
            label: 'منتظر تایید مدیر',
            value: visibleTasks.filter((t) => t.status === 'done_pending_review').length.toLocaleString('fa-IR'),
          },
          {
            label: 'تاییدشده',
            value: visibleTasks.filter((t) => t.status === 'approved').length.toLocaleString('fa-IR'),
            accent: 'positive',
          },
        ]}
      />

      {assignedBlockIds.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedBlockFilter('ALL')}
            className={`h-8 px-3 rounded-[var(--ui-btn-radius)] border text-[12px] font-semibold ${
              selectedBlockFilter === 'ALL'
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-lowest text-on-surface border-outline-variant/60'
            }`}
          >
            همه بلوک‌های مجاز ({assignedBlockIds.length.toLocaleString('fa-IR')})
          </button>
          {assignedBlockIds.map((bId) => (
            <button
              key={bId}
              type="button"
              onClick={() => setSelectedBlockFilter(bId)}
              className={`h-8 px-3 rounded-[var(--ui-btn-radius)] border text-[12px] font-semibold ${
                selectedBlockFilter === bId
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container-lowest text-on-surface border-outline-variant/60'
              }`}
            >
              بلوک {bId}
            </button>
          ))}
        </div>
      )}

      <SubMenuTabs
        active={tab}
        onChange={(id) => switchTab(id as CaretakerTab)}
        items={[
          { id: 'tasks', label: 'وظایف من', icon: 'checklist', badge: activeTasks.length },
          { id: 'done', label: 'انجام‌شده و تایید', icon: 'task_alt', badge: doneTasks.length },
          { id: 'report', label: 'گزارش مشاعات', icon: 'report_problem' },
        ]}
      />

      {feedback && (
        <NoticeBanner
          message={feedback.text}
          tone={feedback.tone}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* TAB 1: ACTIVE TASKS */}
      {tab === 'tasks' && (
        <div className="space-y-2.5 m-panel-in">
          {activeTasks.length === 0 ? (
            <EmptyState
              icon="verified"
              title="همه وظایف ابلاغی انجام شده است"
              description="وظیفه باز دیگری در کارتابل شما وجود ندارد."
            />
          ) : (
            <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
              {activeTasks.map((t) => (
                <SurfaceCard key={t.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[11.5px] font-semibold text-primary">
                        {t.category} • ابلاغ: {t.assignedByName}
                      </span>
                      <h3 className="text-[14px] font-bold text-on-surface mb-0 mt-0.5">
                        {t.title}
                      </h3>
                    </div>
                    <StatusPill
                      label={
                        t.status === 'needs_fix'
                          ? 'نیاز به اصلاح'
                          : t.status === 'in_progress'
                            ? 'در حال انجام'
                            : 'جدید'
                      }
                      tone={
                        t.status === 'needs_fix'
                          ? 'danger'
                          : t.status === 'in_progress'
                            ? 'primary'
                            : 'neutral'
                      }
                    />
                  </div>
                  {t.description && (
                    <p className="text-[12.5px] text-on-surface-variant mb-0 leading-relaxed">
                      {t.description}
                    </p>
                  )}
                  {t.status === 'needs_fix' && t.reviewNote && (
                    <div className="p-2 rounded-[2px] bg-error-container/60 border border-error/25 text-[12px] text-on-error-container">
                      <strong>تذکر مدیر بلوک:</strong> {t.reviewNote}
                    </div>
                  )}
                  <div className="pt-2 border-t border-outline-variant/35 flex items-center justify-between gap-2">
                    <span className="text-[12px] text-on-surface-variant">مهلت: {t.dueLabel}</span>
                    <div className="flex items-center gap-1.5">
                      {t.status === 'todo' && (
                        <StitchButton
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleStartTask(t)}
                          className="!rounded-[2px]"
                        >
                          شروع انجام
                        </StitchButton>
                      )}
                      <StitchButton
                        size="sm"
                        icon="task_alt"
                        disabled={busy}
                        onClick={() => {
                          setCompletingTask(t);
                          setCompletionNote('');
                          setCompletionPhoto('');
                        }}
                        className="!rounded-[2px]"
                      >
                        ثبت اتمام کار
                      </StitchButton>
                    </div>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DONE & APPROVED */}
      {tab === 'done' && (
        <div className="space-y-2.5 m-panel-in">
          {doneTasks.length === 0 ? (
            <EmptyState
              icon="history"
              title="هنوز وظیفه‌ای تکمیل نشده است"
              actionLabel="مشاهده وظایف من"
              onAction={() => switchTab('tasks')}
            />
          ) : (
            doneTasks.map((t) => (
              <SurfaceCard key={t.id} className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[14px] font-bold text-on-surface mb-0">{t.title}</h3>
                  <StatusPill
                    label={t.status === 'approved' ? 'تایید مدیر بلوک ✓' : 'در انتظار بررسی مدیر'}
                    tone={t.status === 'approved' ? 'positive' : 'primary'}
                  />
                </div>
                {t.completionNote && (
                  <p className="text-[12.5px] text-on-surface-variant mb-0">
                    گزارش شما: {t.completionNote}
                  </p>
                )}
                {t.reviewNote && (
                  <p className="text-[12px] text-secondary font-semibold mb-0">
                    پاسخ مدیر: {t.reviewNote}
                  </p>
                )}
              </SurfaceCard>
            ))
          )}
        </div>
      )}

      {/* TAB 3: COMMON AREA DEFECT REPORT */}
      {tab === 'report' && (
        <SurfaceCard className="space-y-3 m-panel-in">
          <SectionHeader
            title="گزارش اشکال مشاعات به مدیر بلوک و تاسیسات"
            icon="report_problem"
          />
          <form onSubmit={handleReportCommonArea} className="space-y-2.5">
            {assignedBlockIds.length > 1 && (
              <div>
                <label htmlFor="cr-block" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                  بلوک محل اشکال
                </label>
                <select
                  id="cr-block"
                  value={repBlockId}
                  onChange={(e) => setRepBlockId(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
                >
                  {assignedBlockIds.map((bId) => (
                    <option key={bId} value={bId}>
                      بلوک {bId}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="cr-cat" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                بخش مشاعات
              </label>
              <select
                id="cr-cat"
                value={repCategory}
                onChange={(e) => setRepCategory(e.target.value)}
                className="w-full h-10 px-2.5 rounded-[2px] bg-surface-container-low text-[13px] border border-outline-variant/55"
              >
                <option value="روشنایی و برق مشاعات">روشنایی و برق مشاعات</option>
                <option value="آسانسور و راهرو">آسانسور و راهرو</option>
                <option value="پارکینگ و رمپ">پارکینگ و رمپ</option>
                <option value="آب و لوله‌کشی مشاعات">آب و لوله‌کشی مشاعات</option>
              </select>
            </div>
            <div>
              <label htmlFor="cr-title" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                عنوان مشکل
              </label>
              <input
                id="cr-title"
                type="text"
                required
                value={repTitle}
                onChange={(e) => setRepTitle(e.target.value)}
                placeholder="مثلاً: سوختن پروژکتور پارکینگ طبقه منفی ۱"
                className="w-full h-10 px-3 rounded-[2px] bg-surface-container-low text-[13px] border border-outline-variant/55"
              />
            </div>
            <div>
              <label htmlFor="cr-desc" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                شرح دقیق محل و مشکل
              </label>
              <textarea
                id="cr-desc"
                rows={3}
                required
                value={repDesc}
                onChange={(e) => setRepDesc(e.target.value)}
                className="w-full p-2.5 rounded-[2px] bg-surface-container-low text-[13px] border border-outline-variant/55"
              />
            </div>
            <label className="w-full h-10 rounded-[2px] bg-surface-container-low text-primary text-[12.5px] font-semibold flex items-center justify-center gap-1.5 border border-dashed border-outline-variant cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
              <span>{repPhoto ? 'تصویر پیوست شد ✓' : 'پیوست عکس از محل (اختیاری)'}</span>
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
            <StitchButton type="submit" disabled={busy} icon="send" className="w-full">
              ارسال گزارش به مدیر بلوک
            </StitchButton>
          </form>
        </SurfaceCard>
      )}

      {/* MODAL: COMPLETE TASK */}
      <StitchModal
        open={Boolean(completingTask)}
        onClose={() => setCompletingTask(null)}
        title="ثبت گزارش اتمام وظیفه"
        subtitle={completingTask?.title}
      >
        <form onSubmit={handleSubmitCompletion} className="space-y-3">
          <div>
            <label htmlFor="cmp-note" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
              شرح اقدام انجام‌شده
            </label>
            <textarea
              id="cmp-note"
              rows={3}
              required
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="مثلاً: کل راهرو شستشو و ضدعفونی شد..."
              className="w-full p-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
            />
          </div>
          <label className="w-full h-10 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-primary text-[12.5px] font-semibold flex items-center justify-center gap-1.5 border border-dashed border-outline-variant cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
            <span>{completionPhoto ? 'عکس مدرک پیوست شد ✓' : 'آپلود عکس انجام کار (اختیاری)'}</span>
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFileAsDataUrl(file).then(setCompletionPhoto);
              }}
            />
          </label>
          {completionPhoto && (
            <img
              src={completionPhoto}
              alt="پیش‌نمایش عکس انجام کار"
              className="w-full max-h-40 object-contain rounded-[var(--ui-btn-radius)] border border-outline-variant/45 bg-surface-container-low"
            />
          )}
          <StitchButton type="submit" disabled={busy} icon="check_circle" className="w-full">
            ارسال برای تایید مدیر بلوک
          </StitchButton>
        </form>
      </StitchModal>
    </div>
  );
};
