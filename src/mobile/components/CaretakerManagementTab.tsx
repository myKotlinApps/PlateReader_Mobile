import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Clock,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Power,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { rbacApi, type ListedUserDoc } from '../rbac/rbacApi';
import {
  formatRemainingDurationFa,
  type RbacUserRecord,
  type TempDurationPreset,
} from '../rbac/roles';
import type { BlockDoc } from '../../server/nosqlStore';
import {
  getCaretakerBlockIds,
  validateCaretakerAccountInput,
  type CaretakerRoleId,
} from '../utils/caretakerAccess';
import { formatJalaliDateTime, getTodayJalali } from '../utils/jalaliDate';
import { JalaliDateTimePicker } from './JalaliDateTimePicker';
import {
  EmptyState,
  NoticeBanner,
  SectionHeader,
  StatusPill,
  StitchButton,
  StitchModal,
  SurfaceCard,
} from '../ui/StitchKit';

interface Props {
  currentUser: RbacUserRecord;
  selectedBlockId: string;
  onDataChanged?: () => void;
}

type FilterMode = 'all' | 'permanent' | 'temporary' | 'inactive';

function generateReadablePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = 'nf_';
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export const CaretakerManagementTab: React.FC<Props> = ({
  currentUser,
  selectedBlockId,
  onDataChanged,
}) => {
  const [caretakers, setCaretakers] = useState<ListedUserDoc[]>([]);
  const [allBlocks, setAllBlocks] = useState<BlockDoc[]>([]);
  const [manageableBlockIds, setManageableBlockIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'danger' | 'info';
    text: string;
  } | null>(null);

  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create / Edit Caretaker Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCaretaker, setEditingCaretaker] = useState<ListedUserDoc | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<CaretakerRoleId>('block_caretaker');
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [durationPreset, setDurationPreset] = useState<TempDurationPreset>('one_day');
  const [customFrom, setCustomFrom] = useState(() => formatJalaliDateTime(getTodayJalali()));
  const [customFromMs, setCustomFromMs] = useState<number>(() => Date.now());
  const [customUntil, setCustomUntil] = useState(() => {
    const dt = getTodayJalali();
    return formatJalaliDateTime({ ...dt, hour: Math.min(23, dt.hour + 6) });
  });
  const [customUntilMs, setCustomUntilMs] = useState<number>(() => Date.now() + 12 * 3600_000);

  // Delete confirmation modal
  const [deletingTarget, setDeletingTarget] = useState<ListedUserDoc | null>(null);

  const isComplexManager = currentUser.role === 'complex_manager';

  const loadCaretakers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rbacApi.listCaretakers();
      setCaretakers(res.items);
      setAllBlocks(res.blocks);
      setManageableBlockIds(res.manageableBlockIds);
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'دریافت فهرست سرایداران ناموفق بود.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCaretakers();
  }, [loadCaretakers]);

  const blockMap = useMemo(() => {
    const map = new Map<string, BlockDoc>();
    for (const blk of allBlocks) {
      map.set(blk.id, blk);
    }
    return map;
  }, [allBlocks]);

  const filteredCaretakers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return caretakers.filter((ct) => {
      if (filterMode === 'permanent' && ct.isTemporary) return false;
      if (filterMode === 'temporary' && !ct.isTemporary) return false;
      if (filterMode === 'inactive' && ct.isCurrentlyActive) return false;
      if (!q) return true;
      const blocksText = getCaretakerBlockIds(ct).join(' ').toLowerCase();
      return (
        ct.displayName.toLowerCase().includes(q) ||
        ct.username.toLowerCase().includes(q) ||
        (ct.phone || '').toLowerCase().includes(q) ||
        blocksText.includes(q)
      );
    });
  }, [caretakers, filterMode, searchQuery]);

  const stats = useMemo(() => {
    const total = caretakers.length;
    const activeCount = caretakers.filter((c) => c.isCurrentlyActive).length;
    const tempCount = caretakers.filter((c) => c.isTemporary).length;
    const multiBlockCount = caretakers.filter((c) => getCaretakerBlockIds(c).length > 1).length;
    return { total, activeCount, tempCount, multiBlockCount };
  }, [caretakers]);

  const openCreateModal = () => {
    setEditingCaretaker(null);
    setDisplayName('');
    setUsername('');
    setPassword('');
    setShowPassword(true);
    setPhone('');
    setRole('block_caretaker');
    const defaultBlock =
      (selectedBlockId && manageableBlockIds.includes(selectedBlockId) ? selectedBlockId : '') ||
      manageableBlockIds[0] ||
      'B';
    setSelectedBlocks(defaultBlock ? [defaultBlock] : []);
    setDurationPreset('one_day');
    setModalOpen(true);
  };

  const openEditModal = (ct: ListedUserDoc) => {
    setEditingCaretaker(ct);
    setDisplayName(ct.displayName);
    setUsername(ct.username);
    setPassword('');
    setShowPassword(false);
    setPhone(ct.phone || '');
    setRole(ct.role === 'temp_caretaker' ? 'temp_caretaker' : 'block_caretaker');
    setSelectedBlocks(getCaretakerBlockIds(ct));
    setDurationPreset('one_day');
    setModalOpen(true);
  };

  const toggleBlockSelection = (blockId: string) => {
    if (!manageableBlockIds.includes(blockId)) return;
    setSelectedBlocks((prev) =>
      prev.includes(blockId) ? prev.filter((id) => id !== blockId) : [...prev, blockId],
    );
  };

  const handleSaveCaretaker = async (e: React.FormEvent) => {
    e.preventDefault();
    const mode = editingCaretaker ? 'edit' : 'create';
    const check = validateCaretakerAccountInput(
      {
        displayName,
        username,
        password,
        phone,
        role,
        blockIds: selectedBlocks,
      },
      mode,
    );
    if (!check.ok || !check.cleaned) {
      setFeedback({
        tone: 'danger',
        text: check.errors[0] || 'لطفاً اطلاعات سرایدار را کامل وارد کنید.',
      });
      return;
    }

    setBusy(true);
    try {
      if (editingCaretaker) {
        const res = await rbacApi.updateCaretaker(editingCaretaker.id, {
          displayName: check.cleaned.displayName,
          username: check.cleaned.username,
          password: check.cleaned.password,
          phone: check.cleaned.phone,
          role: check.cleaned.role,
          blockIds: check.cleaned.blockIds,
          durationPreset: check.cleaned.role === 'temp_caretaker' ? durationPreset : undefined,
          customFromMs:
            check.cleaned.role === 'temp_caretaker' && durationPreset === 'custom'
              ? customFromMs
              : undefined,
          customUntilMs:
            check.cleaned.role === 'temp_caretaker' && durationPreset === 'custom'
              ? customUntilMs
              : undefined,
        });
        setModalOpen(false);
        setFeedback({
          tone: 'success',
          text: `اکانت سرایدار «${res.caretaker.displayName}» (@${res.caretaker.username}) و دسترسی بلوک‌های (${getCaretakerBlockIds(res.caretaker).join('، ')}) در دیتابیس NoSQL ذخیره شد.`,
        });
      } else {
        const res = await rbacApi.createCaretaker({
          displayName: check.cleaned.displayName,
          username: check.cleaned.username,
          password: check.cleaned.password!,
          phone: check.cleaned.phone,
          role: check.cleaned.role,
          blockIds: check.cleaned.blockIds,
          durationPreset: check.cleaned.role === 'temp_caretaker' ? durationPreset : undefined,
          customFromMs:
            check.cleaned.role === 'temp_caretaker' && durationPreset === 'custom'
              ? customFromMs
              : undefined,
          customUntilMs:
            check.cleaned.role === 'temp_caretaker' && durationPreset === 'custom'
              ? customUntilMs
              : undefined,
        });
        setModalOpen(false);
        setFeedback({
          tone: 'success',
          text: `اکانت سرایدار «${res.caretaker.displayName}» (@${res.caretaker.username}) با دسترسی به بلوک‌های (${getCaretakerBlockIds(res.caretaker).join('، ')}) در دیتابیس NoSQL ایجاد شد.`,
        });
      }
      await loadCaretakers();
      onDataChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ذخیره‌سازی اطلاعات سرایدار ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (ct: ListedUserDoc) => {
    setBusy(true);
    try {
      await rbacApi.updateCaretaker(ct.id, { active: !ct.active });
      setFeedback({
        tone: ct.active ? 'info' : 'success',
        text: ct.active
          ? `دسترسی اکانت «${ct.displayName}» (@${ct.username}) غیرفعال شد.`
          : `اکانت «${ct.displayName}» (@${ct.username}) مجدداً فعال شد.`,
      });
      await loadCaretakers();
      onDataChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'تغییر وضعیت اکانت ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleExtendTemp = async (ct: ListedUserDoc, hours: number) => {
    setBusy(true);
    try {
      await rbacApi.updateCaretaker(ct.id, { extendHours: hours });
      setFeedback({
        tone: 'success',
        text: `مهلت دسترسی سرایدار موقت «${ct.displayName}» به میزان ${hours.toLocaleString('fa-IR')} ساعت تمدید شد.`,
      });
      await loadCaretakers();
      onDataChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'تمدید دسترسی ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTarget) return;
    setBusy(true);
    try {
      await rbacApi.deleteCaretaker(deletingTarget.id);
      const removedName = deletingTarget.displayName;
      setDeletingTarget(null);
      setFeedback({
        tone: 'info',
        text: `اکانت سرایدار «${removedName}» از دیتابیس NoSQL حذف شد.`,
      });
      await loadCaretakers();
      onDataChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'حذف اکانت انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCopyUsername = async (ct: ListedUserDoc) => {
    try {
      await navigator.clipboard.writeText(ct.username);
      setCopiedId(ct.id);
      window.setTimeout(() => setCopiedId((prev) => (prev === ct.id ? null : prev)), 1800);
    } catch {
      /* ignore clipboard denial in sandboxed contexts */
    }
  };

  return (
    <div className="space-y-3.5 m-panel-in" dir="rtl">
      {feedback && (
        <NoticeBanner
          message={feedback.text}
          tone={feedback.tone}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Header & Summary Card */}
      <SurfaceCard className="p-4 space-y-3.5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 min-w-0 flex-1">
            <SectionHeader
              title="مدیریت اختصاصی اکانت‌های سرایدار و دسترسی بلوک‌ها"
              icon="cleaning_services"
            />
            <p className="text-[12px] text-on-surface-variant mb-0">
              {isComplexManager
                ? 'تعریف نام کاربری، رمز عبور و اختصاص یک یا چند بلوک خاص برای هر سرایدار با ذخیره مستقیم در دیتابیس NoSQL'
                : `مدیریت نام کاربری، رمز عبور و وضعیت سرایداران بلوک ${currentUser.blockId || selectedBlockId}`}
            </p>
          </div>
          <StitchButton onClick={openCreateModal} disabled={busy}>
            <UserPlus size={16} />
            <span>تعریف سرایدار جدید</span>
          </StitchButton>
        </div>

        {/* Summary KPI Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low/80 border border-outline-variant/50">
            <span className="text-[11px] text-on-surface-variant block">کل اکانت‌های سرایدار</span>
            <strong className="text-[16px] font-extrabold text-on-surface font-numeric-stat">
              {stats.total.toLocaleString('fa-IR')} نفر
            </strong>
          </div>
          <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-secondary-container/35 border border-secondary/25">
            <span className="text-[11px] text-on-surface-variant block">اکانت‌های فعال</span>
            <strong className="text-[16px] font-extrabold text-secondary font-numeric-stat">
              {stats.activeCount.toLocaleString('fa-IR')} فعال
            </strong>
          </div>
          <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-primary-container/35 border border-primary/25">
            <span className="text-[11px] text-on-surface-variant block">سرایداران چندبلوکی</span>
            <strong className="text-[16px] font-extrabold text-primary font-numeric-stat">
              {stats.multiBlockCount.toLocaleString('fa-IR')} نفر
            </strong>
          </div>
          <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low/80 border border-outline-variant/50">
            <span className="text-[11px] text-on-surface-variant block">شیفت موقت / کمکی</span>
            <strong className="text-[16px] font-extrabold text-on-surface font-numeric-stat">
              {stats.tempCount.toLocaleString('fa-IR')} نفر
            </strong>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'all', label: 'همه' },
                { id: 'permanent', label: 'سرایدار دائم' },
                { id: 'temporary', label: 'موقت / کمکی' },
                { id: 'inactive', label: 'غیرفعال / منقضی' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterMode(f.id)}
                className={`h-8 px-3 rounded-[var(--ui-btn-radius)] text-[12px] font-semibold border transition-colors ${
                  filterMode === f.id
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant/55 hover:border-primary/50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative sm:w-64">
            <Search
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام، نام کاربری یا بلوک..."
              aria-label="جستجوی سرایدار"
              className="w-full h-9 pr-9 pl-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low border border-outline-variant/60 text-[12.5px] text-on-surface"
            />
          </div>
        </div>
      </SurfaceCard>

      {/* Caretakers List */}
      {loading ? (
        <SurfaceCard className="p-6 text-center text-[13px] text-on-surface-variant">
          در حال دریافت اکانت‌های سرایداران از دیتابیس NoSQL...
        </SurfaceCard>
      ) : filteredCaretakers.length === 0 ? (
        <EmptyState
          icon="cleaning_services"
          title="اکانت سرایداری با این فیلتر یافت نشد"
          description="از دکمه «تعریف سرایدار جدید» برای ساخت نام کاربری، رمز عبور و تعیین بلوک‌های مجاز استفاده کنید."
          actionLabel="تعریف سرایدار جدید"
          onAction={openCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredCaretakers.map((ct) => {
            const assignedIds = getCaretakerBlockIds(ct);
            return (
              <SurfaceCard key={ct.id} className="p-4 space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  {/* Top identity row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-[14.5px] font-extrabold text-on-surface">
                          {ct.displayName}
                        </strong>
                        <StatusPill
                          label={ct.isTemporary ? 'سرایدار موقت' : 'سرایدار دائم'}
                          tone={ct.isTemporary ? 'primary' : 'neutral'}
                        />
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-[12px]">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--ui-btn-radius)] bg-primary-container/45 text-primary font-mono font-bold"
                          dir="ltr"
                        >
                          @{ct.username}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopyUsername(ct)}
                          className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-primary"
                          aria-label={`کپی نام کاربری ${ct.username}`}
                        >
                          {copiedId === ct.id ? <Check size={13} /> : <Copy size={13} />}
                          <span>{copiedId === ct.id ? 'کپی شد' : 'کپی'}</span>
                        </button>
                        {ct.phone && (
                          <span className="text-on-surface-variant">• {ct.phone}</span>
                        )}
                      </div>
                    </div>

                    <StatusPill
                      label={
                        !ct.isCurrentlyActive
                          ? ct.isTemporary
                            ? 'منقضی / غیرفعال'
                            : 'غیرفعال'
                          : ct.isTemporary && typeof ct.remainingMs === 'number'
                            ? formatRemainingDurationFa(ct.remainingMs)
                            : 'فعال'
                      }
                      tone={
                        !ct.isCurrentlyActive
                          ? 'danger'
                          : ct.isTemporary
                            ? 'primary'
                            : 'positive'
                      }
                    />
                  </div>

                  {/* Assigned Blocks Chips */}
                  <div className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-low/80 border border-outline-variant/50 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11.5px] text-on-surface-variant font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <Building2 size={14} className="text-primary" />
                        <span>بلوک‌های مجاز دسترسی ({assignedIds.length.toLocaleString('fa-IR')} بلوک):</span>
                      </span>
                      {assignedIds.length > 1 && (
                        <span className="text-[11px] text-secondary font-bold">دسترسی چندبلوکی</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {assignedIds.map((bId, idx) => {
                        const blk = blockMap.get(bId);
                        return (
                          <span
                            key={bId}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--ui-btn-radius)] text-[11.5px] font-bold border ${
                              idx === 0
                                ? 'bg-primary-container/60 text-on-primary-container border-primary/35'
                                : 'bg-secondary-container/50 text-on-secondary-container border-secondary/35'
                            }`}
                          >
                            <ShieldCheck size={13} />
                            <span>{blk ? blk.name : `بلوک ${bId}`}</span>
                            {idx === 0 && (
                              <span className="text-[10px] opacity-80">(اصلی)</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Temp window info */}
                  {ct.isTemporary && ct.accessDurationLabel && (
                    <div className="px-2.5 py-1.5 rounded-[var(--ui-card-radius)] bg-primary-container/25 border border-primary/20 text-[11.5px] text-on-surface flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={13} className="text-primary" />
                        <span>شیفت: {ct.accessDurationLabel}</span>
                      </span>
                      {ct.validUntilMs && (
                        <span className="font-numeric-stat text-on-surface-variant">
                          پایان:{' '}
                          {new Date(ct.validUntilMs).toLocaleTimeString('fa-IR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="pt-2.5 border-t border-outline-variant/40 flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StitchButton
                      variant="primary"
                      size="sm"
                      disabled={busy}
                      onClick={() => openEditModal(ct)}
                    >
                      <Edit3 size={14} />
                      <span>ویرایش حساب و بلوک‌ها</span>
                    </StitchButton>

                    {ct.isTemporary && (
                      <>
                        <StitchButton
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleExtendTemp(ct, 12)}
                        >
                          +۱۲ ساعت
                        </StitchButton>
                        <StitchButton
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleExtendTemp(ct, 24)}
                        >
                          +۱ روز
                        </StitchButton>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <StitchButton
                      variant={ct.active ? 'secondary' : 'primary'}
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleToggleActive(ct)}
                      aria-label={ct.active ? `غیرفعال‌سازی ${ct.displayName}` : `فعال‌سازی ${ct.displayName}`}
                    >
                      <Power size={14} />
                      <span>{ct.active ? 'تعلیق' : 'فعال‌سازی'}</span>
                    </StitchButton>
                    {(isComplexManager ||
                      (assignedIds.length <= 1 && assignedIds[0] === currentUser.blockId)) && (
                      <StitchButton
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onClick={() => setDeletingTarget(ct)}
                        aria-label={`حذف اکانت ${ct.displayName}`}
                      >
                        <Trash2 size={14} />
                      </StitchButton>
                    )}
                  </div>
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}

      {/* ==================== CREATE / EDIT CARETAKER MODAL ==================== */}
      <StitchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCaretaker ? `ویرایش اکانت سرایدار (${editingCaretaker.displayName})` : 'تعریف اکانت سرایدار جدید'}
        subtitle="نام کاربری، رمز عبور رمزنگاری‌شده و دسترسی بلوک‌ها مستقیماً در دیتابیس NoSQL ذخیره می‌شود"
      >
        <form onSubmit={handleSaveCaretaker} className="space-y-3.5">
          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="ct-display-name"
                className="block text-[12px] font-semibold text-on-surface-variant mb-1"
              >
                نام و نام خانوادگی سرایدار *
              </label>
              <input
                id="ct-display-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="مثلاً: حسین کریمی"
                className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/60"
              />
            </div>
            <div>
              <label
                htmlFor="ct-phone"
                className="block text-[12px] font-semibold text-on-surface-variant mb-1"
              >
                شماره موبایل سرایدار
              </label>
              <input
                id="ct-phone"
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09123456789"
                className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/60"
              />
            </div>
          </div>

          {/* Credentials Box */}
          <div className="p-3 rounded-[var(--ui-card-radius)] bg-primary-container/20 border border-primary/25 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold text-on-surface inline-flex items-center gap-1.5">
                <KeyRound size={15} className="text-primary" />
                <span>اطلاعات ورود به پنل سرایداری</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setPassword(generateReadablePassword());
                  setShowPassword(true);
                }}
                className="text-[11.5px] font-semibold text-primary inline-flex items-center gap-1 hover:underline"
              >
                <Sparkles size={13} />
                <span>تولید رمز پیشنهادی</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="ct-username"
                  className="block text-[11.5px] font-semibold text-on-surface-variant mb-1"
                >
                  نام کاربری (حروف لاتین و عدد) *
                </label>
                <input
                  id="ct-username"
                  type="text"
                  required
                  dir="ltr"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="caretaker_a1"
                  className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[13px] font-mono border border-outline-variant/60"
                />
              </div>

              <div>
                <label
                  htmlFor="ct-password"
                  className="block text-[11.5px] font-semibold text-on-surface-variant mb-1"
                >
                  {editingCaretaker ? 'رمز عبور جدید (خالی = بدون تغییر)' : 'رمز عبور ورود (حداقل ۴ کاراکتر) *'}
                </label>
                <div className="relative">
                  <input
                    id="ct-password"
                    type={showPassword ? 'text' : 'password'}
                    required={!editingCaretaker}
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingCaretaker ? 'برای تغییر وارد کنید' : 'حداقل ۴ کاراکتر'}
                    className="w-full h-10 pl-9 pr-3 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest text-[13px] font-mono border border-outline-variant/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Caretaker Role Type (Permanent vs Temporary) */}
          <div className="space-y-2">
            <span className="block text-[12px] font-semibold text-on-surface-variant">
              نوع دسترسی سرایدار
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('block_caretaker')}
                className={`h-10 rounded-[var(--ui-btn-radius)] border text-[12.5px] font-bold transition-colors ${
                  role === 'block_caretaker'
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low text-on-surface border-outline-variant/60'
                }`}
              >
                سرایدار دائم
              </button>
              <button
                type="button"
                onClick={() => setRole('temp_caretaker')}
                className={`h-10 rounded-[var(--ui-btn-radius)] border text-[12.5px] font-bold transition-colors ${
                  role === 'temp_caretaker'
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low text-on-surface border-outline-variant/60'
                }`}
              >
                سرایدار موقت / کمکی
              </button>
            </div>

            {role === 'temp_caretaker' && (
              <div className="p-3 rounded-[var(--ui-card-radius)] bg-surface-container-low/80 border border-outline-variant/55 space-y-2.5">
                <span className="block text-[11.5px] font-semibold text-on-surface-variant">
                  مدت اعتبار دسترسی موقت:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'half_day', label: '۱۲ ساعت' },
                      { id: 'one_day', label: '۱ روز' },
                      { id: 'two_days', label: '۲ روز' },
                      { id: 'custom', label: 'بازه شمسی' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDurationPreset(p.id)}
                      className={`h-9 rounded-[var(--ui-btn-radius)] border text-[12px] font-bold ${
                        durationPreset === p.id
                          ? 'bg-secondary text-on-secondary border-secondary'
                          : 'bg-surface-container-lowest text-on-surface border-outline-variant/55'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {durationPreset === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <JalaliDateTimePicker
                      id="ct-custom-from"
                      label="شروع دسترسی (شمسی)"
                      mode="datetime"
                      value={customFrom}
                      onChange={(formatted, epochMs) => {
                        setCustomFrom(formatted);
                        if (typeof epochMs === 'number' && Number.isFinite(epochMs)) {
                          setCustomFromMs(epochMs);
                        }
                      }}
                    />
                    <JalaliDateTimePicker
                      id="ct-custom-until"
                      label="پایان دسترسی (شمسی)"
                      mode="datetime"
                      value={customUntil}
                      onChange={(formatted, epochMs) => {
                        setCustomUntil(formatted);
                        if (typeof epochMs === 'number' && Number.isFinite(epochMs)) {
                          setCustomUntilMs(epochMs);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Specific Block Access Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[12px] font-bold text-on-surface inline-flex items-center gap-1.5">
                <Building2 size={15} className="text-primary" />
                <span>تعیین دسترسی به بلوک‌های خاص *</span>
              </span>
              {isComplexManager && allBlocks.length > 1 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedBlocks(allBlocks.map((b) => b.id))}
                    className="text-primary font-semibold hover:underline"
                  >
                    انتخاب همه بلوک‌ها
                  </button>
                  <span className="text-outline-variant">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedBlocks(selectedBlockId ? [selectedBlockId] : ['B'])}
                    className="text-on-surface-variant hover:text-primary"
                  >
                    فقط بلوک {selectedBlockId}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              {allBlocks.map((blk) => {
                const checked = selectedBlocks.includes(blk.id);
                const canToggle = manageableBlockIds.includes(blk.id);
                const isPrimary = checked && selectedBlocks[0] === blk.id;
                return (
                  <label
                    key={blk.id}
                    className={`p-2.5 rounded-[var(--ui-card-radius)] border flex items-start gap-2 transition-colors ${
                      !canToggle
                        ? 'opacity-55 cursor-not-allowed bg-surface-container-low/40 border-outline-variant/40'
                        : checked
                          ? 'cursor-pointer bg-primary-container/40 border-primary shadow-xs'
                          : 'cursor-pointer bg-surface-container-low/70 border-outline-variant/55 hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canToggle}
                      onChange={() => toggleBlockSelection(blk.id)}
                      className="mt-1 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <strong className="text-[12.5px] font-bold text-on-surface truncate">
                          {blk.name}
                        </strong>
                        {isPrimary && (
                          <span className="text-[10px] font-bold text-primary shrink-0">اصلی</span>
                        )}
                      </div>
                      <span className="text-[11px] text-on-surface-variant block truncate">
                        {blk.floors.toLocaleString('fa-IR')} طبقه • {blk.unitsCount.toLocaleString('fa-IR')} واحد
                      </span>
                      {!canToggle && (
                        <span className="text-[10px] text-on-surface-variant block mt-0.5">
                          در اختیار مدیر کل
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-on-surface-variant mb-0">
              سرایدار فقط وظایف، گزارش مشاعات و اعلانات بلوک‌های انتخاب‌شده را مشاهده و ثبت خواهد کرد.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/45">
            <StitchButton variant="secondary" onClick={() => setModalOpen(false)}>
              انصراف
            </StitchButton>
            <StitchButton type="submit" disabled={busy || selectedBlocks.length === 0}>
              <ShieldCheck size={16} />
              <span>
                {busy
                  ? 'در حال ذخیره در NoSQL...'
                  : editingCaretaker
                    ? 'ذخیره تغییرات در دیتابیس NoSQL'
                    : 'ثبت اکانت سرایدار در دیتابیس NoSQL'}
              </span>
            </StitchButton>
          </div>
        </form>
      </StitchModal>

      {/* ==================== DELETE CONFIRMATION MODAL ==================== */}
      <StitchModal
        open={Boolean(deletingTarget)}
        onClose={() => setDeletingTarget(null)}
        title="حذف اکانت سرایدار"
        subtitle={
          deletingTarget
            ? `اکانت «${deletingTarget.displayName}» (@${deletingTarget.username}) به‌طور کامل از دیتابیس حذف می‌شود`
            : undefined
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] text-on-surface-variant mb-0 leading-relaxed">
            آیا از حذف دائمی این اکانت سرایدار مطمئن هستید؟ در صورتی که فقط قصد قطع موقت دسترسی دارید، می‌توانید از گزینه «تعلیق» استفاده کنید.
          </p>
          <div className="flex items-center justify-end gap-2">
            <StitchButton variant="secondary" onClick={() => setDeletingTarget(null)}>
              انصراف
            </StitchButton>
            <StitchButton variant="danger" disabled={busy} onClick={() => void handleConfirmDelete()}>
              <Trash2 size={15} />
              <span>تایید و حذف اکانت</span>
            </StitchButton>
          </div>
        </div>
      </StitchModal>
    </div>
  );
};
