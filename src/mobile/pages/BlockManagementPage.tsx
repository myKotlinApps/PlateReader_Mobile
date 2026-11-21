import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  rbacApi,
  type EnrichedBlockDoc,
  type ListedUserDoc,
} from '../rbac/rbacApi';
import {
  canAccessBlock,
  formatRemainingDurationFa,
  ROLE_DEFINITIONS,
  type BlockSharePermission,
  type RbacUserRecord,
  type TempDurationPreset,
  type UserRoleId,
} from '../rbac/roles';
import type {
  BlockNoticeDoc,
  CaretakerTaskDoc,
  ResidentRequestDoc,
  UnitDoc,
} from '../../server/nosqlStore';
import { JalaliDateTimePicker } from '../components/JalaliDateTimePicker';
import { BlockResidentQrTab } from '../components/BlockResidentQrTab';
import { CaretakerManagementTab } from '../components/CaretakerManagementTab';
import { FinanceBankExcelTab } from '../finance/FinanceBankExcelTab';
import { formatAmountFa } from '../utils/persianMoney';
import { formatJalaliDateTime, getTodayJalali, jalaliDateTimeToMs } from '../utils/jalaliDate';
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

type BlockTab = 'overview' | 'caretakers' | 'excel' | 'qr_onboarding' | 'staff' | 'tasks' | 'requests';
const VALID_TABS: BlockTab[] = ['overview', 'caretakers', 'excel', 'qr_onboarding', 'staff', 'tasks', 'requests'];

interface Props {
  currentUser: RbacUserRecord;
  onSyncChanged?: () => void;
}

const fmtT = (n: number) => formatAmountFa(n);

const TASK_STATUS_LABEL: Record<CaretakerTaskDoc['status'], { label: string; tone: 'neutral' | 'primary' | 'positive' | 'danger' }> = {
  todo: { label: 'در انتظار شروع', tone: 'neutral' },
  in_progress: { label: 'در حال انجام', tone: 'primary' },
  done_pending_review: { label: 'منتظر تایید مدیر', tone: 'danger' },
  approved: { label: 'تایید نهایی شد', tone: 'positive' },
  needs_fix: { label: 'بازگشت جهت اصلاح', tone: 'danger' },
};

const REQ_STATUS_LABEL: Record<ResidentRequestDoc['status'], { label: string; tone: 'neutral' | 'primary' | 'positive' | 'danger' }> = {
  open: { label: 'جدید', tone: 'danger' },
  assigned: { label: 'ارجاع شده', tone: 'primary' },
  in_progress: { label: 'در حال تعمیر', tone: 'primary' },
  resolved: { label: 'حل شده', tone: 'positive' },
};

export const BlockManagementPage: React.FC<Props> = ({ currentUser, onSyncChanged }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qTab = (searchParams.get('tab') as BlockTab) || 'overview';
  const [tab, setTab] = useState<BlockTab>(VALID_TABS.includes(qTab) ? qTab : 'overview');

  const [blocks, setBlocks] = useState<EnrichedBlockDoc[]>([]);
  const [units, setUnits] = useState<UnitDoc[]>([]);
  const [users, setUsers] = useState<ListedUserDoc[]>([]);
  const [creatableRoles, setCreatableRoles] = useState<UserRoleId[]>([]);
  const [tasks, setTasks] = useState<CaretakerTaskDoc[]>([]);
  const [requests, setRequests] = useState<ResidentRequestDoc[]>([]);
  const [notices, setNotices] = useState<BlockNoticeDoc[]>([]);

  const [selectedBlockId, setSelectedBlockId] = useState<string>(currentUser.blockId || 'B');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Create Staff / Temp Caretaker modal state
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newRole, setNewRole] = useState<UserRoleId>('temp_caretaker');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('1234');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newBlockId, setNewBlockId] = useState<string>(currentUser.blockId || 'B');
  const [newUnitCode, setNewUnitCode] = useState('');
  const [isTempFlag, setIsTempFlag] = useState(true);
  const [durationPreset, setDurationPreset] = useState<TempDurationPreset>('half_day');
  const [customFrom, setCustomFrom] = useState(() => formatJalaliDateTime(getTodayJalali()));
  const [customFromMs, setCustomFromMs] = useState<number>(() => Date.now());
  const [customUntil, setCustomUntil] = useState(() => {
    const dt = getTodayJalali();
    return formatJalaliDateTime({ ...dt, hour: Math.min(23, dt.hour + 6) });
  });
  const [customUntilMs, setCustomUntilMs] = useState<number>(() => Date.now() + 12 * 3600 * 1000);

  // Multi-Block Sharing Modal state (grant an Accountant / Facilities technician access to this block)
  const [shareableStaff, setShareableStaff] = useState<RbacUserRecord[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTargetUserId, setShareTargetUserId] = useState('');
  const [sharePerms, setSharePerms] = useState<BlockSharePermission[]>(['finance', 'excel_import']);

  // Edit Staff / Caretaker Username & Password Modal state
  const [editingCredUser, setEditingCredUser] = useState<ListedUserDoc | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [pendingSubmissionsCount, setPendingSubmissionsCount] = useState(0);

  // Assign Task modal state
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskCategory, setTaskCategory] = useState<CaretakerTaskDoc['category']>('نظافت');
  const [taskPriority, setTaskPriority] = useState<'normal' | 'urgent'>('normal');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskDue, setTaskDue] = useState(() => {
    const dt = getTodayJalali();
    return formatJalaliDateTime({ ...dt, hour: 18, minute: 0 });
  });

  // Review Task modal state
  const [reviewingTask, setReviewingTask] = useState<CaretakerTaskDoc | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  // Broadcast Notice modal state
  const [showCreateNotice, setShowCreateNotice] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeTargetUnit, setNoticeTargetUnit] = useState('ALL');
  const [noticeSeverity, setNoticeSeverity] = useState<'info' | 'warning' | 'urgent'>('info');

  // Request reply / photo preview modal
  const [replyingReq, setReplyingReq] = useState<ResidentRequestDoc | null>(null);
  const [reqReplyText, setReqReplyText] = useState('');
  const [reqNextStatus, setReqNextStatus] = useState<ResidentRequestDoc['status']>('in_progress');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  useEffect(() => {
    const paramTab = searchParams.get('tab') as BlockTab | null;
    if (paramTab && VALID_TABS.includes(paramTab) && paramTab !== tab) {
      setTab(paramTab);
    }
  }, [searchParams, tab]);

  const switchTab = (next: BlockTab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
    setFeedback(null);
  };

  const loadAll = useCallback(async () => {
    try {
      const [blkRes, usrRes, tskRes, reqRes, notRes] = await Promise.all([
        rbacApi.getBlocks(),
        rbacApi.listUsers(),
        rbacApi.listTasks(),
        rbacApi.listResidentRequests(),
        rbacApi.listNotices(),
      ]);
      setBlocks(blkRes.blocks);
      setUnits(blkRes.units);
      setUsers(usrRes.items);
      setCreatableRoles(usrRes.creatableRoles);
      setTasks(tskRes.items);
      setRequests(reqRes.items);
      setNotices(notRes.items);
      if (usrRes.creatableRoles.length > 0 && !usrRes.creatableRoles.includes(newRole)) {
        const preferred: UserRoleId = usrRes.creatableRoles.includes('temp_caretaker')
          ? 'temp_caretaker'
          : usrRes.creatableRoles[0];
        setNewRole(preferred);
        setIsTempFlag(preferred === 'temp_caretaker');
      }
      if (currentUser.blockId && !blkRes.blocks.some((b) => b.id === selectedBlockId)) {
        setSelectedBlockId(currentUser.blockId);
        setNewBlockId(currentUser.blockId);
      }
      if (['complex_manager', 'block_manager', 'facilities_chief'].includes(currentUser.role)) {
        try {
          const shRes = await rbacApi.listShareableStaff();
          setShareableStaff(shRes.items);
          if (!shareTargetUserId && shRes.items.length > 0) {
            setShareTargetUserId(shRes.items[0].id);
          }
        } catch {
          /* ignore */
        }
      }
      if (['complex_manager', 'block_manager'].includes(currentUser.role)) {
        try {
          const subRes = await rbacApi.listResidentSubmissions(selectedBlockId);
          setPendingSubmissionsCount(
            subRes.items.filter((s) => s.status === 'pending_review').length,
          );
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'خطا در دریافت اطلاعات بلوک.',
      });
    }
  }, [currentUser.blockId, currentUser.role, newRole, selectedBlockId, shareTargetUserId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const isComplexScope = ROLE_DEFINITIONS[currentUser.role].scopeLevel === 'complex';
  const activeBlock = useMemo(
    () => blocks.find((b) => b.id === selectedBlockId) ?? blocks[0] ?? null,
    [blocks, selectedBlockId],
  );

  const blockUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          !selectedBlockId ||
          u.blockId === selectedBlockId ||
          canAccessBlock(u, selectedBlockId) ||
          (isComplexScope && u.blockId === null),
      ),
    [users, selectedBlockId, isComplexScope],
  );

  const allCaretakersCount = useMemo(
    () =>
      users.filter((u) => u.role === 'block_caretaker' || u.role === 'temp_caretaker').length,
    [users],
  );

  const blockCaretakers = useMemo(
    () =>
      users.filter(
        (u) =>
          (u.role === 'block_caretaker' || u.role === 'temp_caretaker') &&
          (!selectedBlockId || canAccessBlock(u, selectedBlockId)),
      ),
    [users, selectedBlockId],
  );

  const blockUnits = useMemo(
    () => units.filter((u) => !selectedBlockId || u.blockId === selectedBlockId),
    [units, selectedBlockId],
  );

  const blockTasks = useMemo(
    () => tasks.filter((t) => !selectedBlockId || t.blockId === selectedBlockId),
    [tasks, selectedBlockId],
  );

  const blockRequests = useMemo(
    () => requests.filter((r) => !selectedBlockId || r.blockId === selectedBlockId),
    [requests, selectedBlockId],
  );

  const blockNotices = useMemo(
    () => notices.filter((n) => n.blockId === 'ALL' || n.blockId === selectedBlockId),
    [notices, selectedBlockId],
  );

  const pendingReviewCount = blockTasks.filter((t) => t.status === 'done_pending_review').length;
  const openReqCount = blockRequests.filter((r) => r.status !== 'resolved').length;

  useEffect(() => {
    if (!taskAssigneeId && blockCaretakers.length > 0) {
      setTaskAssigneeId(blockCaretakers[0].id);
    }
  }, [blockCaretakers, taskAssigneeId]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const effectiveTemp = newRole === 'temp_caretaker' ? true : isTempFlag;
      const fromEpoch =
        durationPreset === 'custom'
          ? customFromMs || jalaliDateTimeToMs(getTodayJalali())
          : undefined;
      const untilEpoch =
        durationPreset === 'custom'
          ? customUntilMs || Date.now() + 12 * 3600 * 1000
          : undefined;
      const res = await rbacApi.createUser({
        username: newUsername.trim(),
        password: newPassword || '1234',
        displayName: newDisplayName.trim(),
        role: newRole,
        blockId:
          ROLE_DEFINITIONS[newRole].scopeLevel === 'complex'
            ? null
            : currentUser.blockId || newBlockId,
        unitCode: newRole === 'resident' ? newUnitCode.trim() || `${selectedBlockId}-305` : null,
        phone: newPhone.trim(),
        isTemporary: effectiveTemp,
        durationPreset: effectiveTemp ? durationPreset : undefined,
        customFromMs: fromEpoch,
        customUntilMs: untilEpoch,
      });
      setShowCreateUser(false);
      setNewUsername('');
      setNewDisplayName('');
      setNewPhone('');
      setNewUnitCode('');
      setFeedback({
        tone: 'success',
        text: `حساب «${res.user.displayName}» با نام کاربری ${res.user.username} در دیتابیس NoSQL ثبت شد و اکنون می‌تواند وارد سامانه شود.`,
      });
      await loadAll();
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت کاربر جدید انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleExtendOrToggleUser = async (
    u: ListedUserDoc,
    patch: { active?: boolean; extendHours?: number },
  ) => {
    setBusy(true);
    try {
      await rbacApi.updateUser(u.id, patch);
      setFeedback({
        tone: 'success',
        text: patch.extendHours
          ? `مهلت دسترسی «${u.displayName}» به مدت ${patch.extendHours.toLocaleString('fa-IR')} ساعت تمدید شد.`
          : patch.active
            ? `دسترسی «${u.displayName}» مجدداً فعال شد.`
            : `دسترسی «${u.displayName}» غیرفعال شد.`,
      });
      await loadAll();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'به‌روزرسانی وضعیت دسترسی انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const openEditCredentials = (u: ListedUserDoc) => {
    setEditingCredUser(u);
    setEditUsername(u.username);
    setEditPassword('');
    setEditDisplayName(u.displayName);
    setEditPhone(u.phone || '');
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCredUser) return;
    setBusy(true);
    setFeedback(null);
    try {
      await rbacApi.updateUser(editingCredUser.id, {
        username: editUsername.trim(),
        password: editPassword.trim() ? editPassword.trim() : undefined,
        displayName: editDisplayName.trim(),
        phone: editPhone.trim(),
      });
      setEditingCredUser(null);
      setEditPassword('');
      setFeedback({
        tone: 'success',
        text: `نام کاربری و رمز عبور حساب «${editDisplayName.trim()}» با موفقیت به‌روزرسانی شد.`,
      });
      await loadAll();
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'به‌روزرسانی نام کاربری و رمز عبور انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskAssigneeId) return;
    setBusy(true);
    try {
      const res = await rbacApi.createTask({
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        category: taskCategory,
        priority: taskPriority,
        assignedToUserId: taskAssigneeId,
        dueLabel: taskDue.trim() || 'امروز',
        blockId: selectedBlockId,
      });
      setShowCreateTask(false);
      setTaskTitle('');
      setTaskDesc('');
      setFeedback({
        tone: 'success',
        text: `وظیفه «${res.task.title}» به ${res.task.assignedToName} ابلاغ شد.`,
      });
      await loadAll();
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ابلاغ وظیفه انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReviewTask = async (status: 'approved' | 'needs_fix') => {
    if (!reviewingTask) return;
    setBusy(true);
    try {
      await rbacApi.updateTask(reviewingTask.id, {
        status,
        reviewNote: reviewNote.trim() || (status === 'approved' ? 'تایید شد، خسته نباشید.' : 'لطفاً مجدداً بررسی شود.'),
      });
      setReviewingTask(null);
      setReviewNote('');
      setFeedback({
        tone: 'success',
        text: status === 'approved' ? 'انجام وظیفه سرایدار تایید نهایی شد.' : 'وظیفه جهت اصلاح به سرایدار بازگردانده شد.',
      });
      await loadAll();
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ثبت بررسی وظیفه انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await rbacApi.createNotice({
        blockId: selectedBlockId,
        targetUnitCode: noticeTargetUnit,
        title: noticeTitle.trim(),
        body: noticeBody.trim(),
        severity: noticeSeverity,
      });
      setShowCreateNotice(false);
      setNoticeTitle('');
      setNoticeBody('');
      setFeedback({
        tone: 'success',
        text: 'اعلان با موفقیت ثبت شد و در پنل ساکنین بلوک نمایش داده می‌شود.',
      });
      await loadAll();
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'ارسال اعلان انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingReq) return;
    setBusy(true);
    try {
      await rbacApi.updateResidentRequest(replyingReq.id, {
        status: reqNextStatus,
        managerReply: reqReplyText.trim(),
      });
      setReplyingReq(null);
      setReqReplyText('');
      setFeedback({
        tone: 'success',
        text: 'وضعیت و پاسخ خرابی واحد ثبت شد و به ساکن اطلاع‌رسانی گردید.',
      });
      await loadAll();
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'به‌روزرسانی درخواست انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleShareBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareTargetUserId) return;
    setBusy(true);
    try {
      const res = await rbacApi.shareBlockWithStaff(selectedBlockId, {
        userId: shareTargetUserId,
        permissions: sharePerms.length > 0 ? sharePerms : ['finance', 'excel_import'],
      });
      setShowShareModal(false);
      setFeedback({
        tone: 'success',
        text: `دسترسی بلوک ${selectedBlockId} با حساب «${res.user?.displayName || 'کاربر'}» به اشتراک گذاشته شد.`,
      });
      await loadAll();
      onSyncChanged?.();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'اشتراک‌گذاری دسترسی بلوک ناموفق بود.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeShare = async (staff: RbacUserRecord) => {
    setBusy(true);
    try {
      await rbacApi.revokeBlockShare(selectedBlockId, staff.id);
      setFeedback({
        tone: 'info',
        text: `دسترسی مشترک «${staff.displayName}» به بلوک ${selectedBlockId} لغو شد.`,
      });
      await loadAll();
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text: err instanceof Error ? err.message : 'لغو اشتراک انجام نشد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const canManageBlock =
    currentUser.role === 'complex_manager' || currentUser.role === 'block_manager';

  const sharedWithThisBlock = useMemo(
    () =>
      shareableStaff.filter((s) =>
        (s.assignedBlocks || []).some((g) => g.blockId === selectedBlockId),
      ),
    [shareableStaff, selectedBlockId],
  );

  return (
    <div className="flex flex-col gap-3.5 pb-4" dir="rtl">
      {/* Multi-Block Selector Bar (Complex scope OR Shared Multi-Block Accountant / Facilities) */}
      {blocks.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {blocks.map((blk) => (
            <button
              key={blk.id}
              type="button"
              onClick={() => {
                setSelectedBlockId(blk.id);
                setNewBlockId(blk.id);
              }}
              className={`h-9 px-3.5 rounded-[var(--ui-btn-radius)] border text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                selectedBlockId === blk.id
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container-lowest text-on-surface border-outline-variant/60 hover:border-primary/60'
              }`}
            >
              {blk.name}
            </button>
          ))}
        </div>
      )}

      <HeroSummaryCard
        title={activeBlock ? `پنل مدیریت ${activeBlock.name}` : 'پنل مدیریت بلوک'}
        subtitle={
          activeBlock
            ? `مدیر بلوک: ${activeBlock.managerName} • ${activeBlock.floors.toLocaleString('fa-IR')} طبقه • ${activeBlock.unitsCount.toLocaleString('fa-IR')} واحد`
            : 'مدیریت کادر، سرایداران و ساکنین'
        }
        badge={`بلوک ${selectedBlockId}`}
        stats={[
          {
            label: 'پرسنل و کادر',
            value: (activeBlock?.staffCount ?? blockUsers.length).toLocaleString('fa-IR'),
          },
          {
            label: 'تسک باز سرایدار',
            value: blockTasks.filter((t) => t.status !== 'approved').length.toLocaleString('fa-IR'),
            accent: pendingReviewCount > 0 ? 'danger' : 'positive',
          },
          {
            label: 'خرابی باز واحدها',
            value: openReqCount.toLocaleString('fa-IR'),
            accent: openReqCount > 0 ? 'danger' : 'positive',
          },
        ]}
      />

      <SubMenuTabs
        active={tab}
        onChange={(id) => switchTab(id as BlockTab)}
        items={[
          { id: 'overview', label: 'نمای بلوک و اعلان', icon: 'apartment' },
          ...(canManageBlock
            ? [
                {
                  id: 'caretakers',
                  label: 'مدیریت سرایداران',
                  icon: 'cleaning_services',
                  badge: allCaretakersCount > 0 ? allCaretakersCount : undefined,
                },
                {
                  id: 'excel',
                  label: 'مدیریت اکسل بانکی',
                  icon: 'table_view',
                },
                {
                  id: 'qr_onboarding',
                  label: 'QR ثبت‌نام ساکنین',
                  icon: 'qr_code_2',
                  badge: pendingSubmissionsCount > 0 ? pendingSubmissionsCount : undefined,
                },
              ]
            : []),
          { id: 'staff', label: 'کادر و پرسنل', icon: 'group_add', badge: blockUsers.length },
          { id: 'tasks', label: 'وظایف سرایدار', icon: 'checklist', badge: pendingReviewCount },
          { id: 'requests', label: 'درخواست‌ها و خرابی', icon: 'build', badge: openReqCount },
        ]}
      />

      {feedback && (
        <NoticeBanner
          message={feedback.text}
          tone={feedback.tone}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* ==================== TAB 1: OVERVIEW & NOTICES ==================== */}
      {tab === 'overview' && (
        <div className="space-y-3.5 m-panel-in lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
          <SurfaceCard className="space-y-3">
            <SectionHeader
              title={`اطلاعیه‌های بلوک ${selectedBlockId}`}
              icon="campaign"
              action={
                canManageBlock && (
                  <StitchButton
                    size="sm"
                    icon="add"
                    onClick={() => setShowCreateNotice(true)}
                    className="rounded-[var(--ui-btn-radius)]"
                  >
                    ارسال اعلان
                  </StitchButton>
                )
              }
            />
            {blockNotices.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant text-center py-5 mb-0">
                هنوز اعلانی برای این بلوک ثبت نشده است.
              </p>
            ) : (
              <div className="space-y-2">
                {blockNotices.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low/80 border border-outline-variant/45 space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-[13.5px] font-bold text-on-surface">
                        {n.title}
                      </strong>
                      <StatusPill
                        label={
                          n.targetUnitCode === 'ALL'
                            ? `همه بلوک ${n.blockId === 'ALL' ? 'ها' : n.blockId}`
                            : `واحد ${n.targetUnitCode}`
                        }
                        tone={n.severity === 'urgent' ? 'danger' : n.severity === 'warning' ? 'primary' : 'neutral'}
                      />
                    </div>
                    <p className="text-[12.5px] text-on-surface-variant mb-0 leading-relaxed">
                      {n.body}
                    </p>
                    <span className="text-[11px] text-on-surface-variant block pt-1">
                      فرستنده: {n.senderName} ({n.senderRoleTitle})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard className="space-y-3">
            <SectionHeader title={`واحدهای ثبت‌شده بلوک ${selectedBlockId}`} icon="domain" />
            <div className="divide-y divide-outline-variant/35">
              {blockUnits.map((u) => (
                <div key={u.id} className="py-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-[13.5px] font-bold text-on-surface truncate">
                        واحد {u.unitCode} — {u.residentName}
                      </strong>
                      {u.onboardingVerified && (
                        <span className="px-1.5 py-0.5 rounded-[var(--ui-btn-radius)] bg-secondary-container/70 text-on-secondary-container text-[10.5px] font-bold">
                          تایید QR
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] text-on-surface-variant block truncate">
                      {u.occupancyType}
                      {u.householdCount ? ` (${u.householdCount.toLocaleString('fa-IR')} نفر)` : ''}
                      {' • '}پارکینگ {u.parkingCode} • انباری {u.storageCode}
                    </span>
                    {(u.landlordName || (u.vehicles && u.vehicles.length > 0)) && (
                      <span className="text-[11.5px] text-on-surface-variant block truncate">
                        {u.landlordName
                          ? `مالک: ${u.landlordName}${u.leaseEndJalali ? ` (اجاره تا ${u.leaseEndJalali})` : ''}`
                          : ''}
                        {u.landlordName && u.vehicles && u.vehicles.length > 0 ? ' • ' : ''}
                        {u.vehicles && u.vehicles.length > 0
                          ? `${u.vehicles.length.toLocaleString('fa-IR')} خودرو مجاز گیت`
                          : ''}
                      </span>
                    )}
                  </div>
                  <StatusPill
                    label={u.debtTomans > 0 ? `بدهی ${fmtT(u.debtTomans)} ت` : 'تسویه'}
                    tone={u.debtTomans > 0 ? 'danger' : 'positive'}
                  />
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* ==================== TAB 1A: DEDICATED CARETAKER ACCOUNTS & BLOCK ACCESS ==================== */}
      {tab === 'caretakers' && canManageBlock && (
        <CaretakerManagementTab
          currentUser={currentUser}
          selectedBlockId={selectedBlockId}
          onDataChanged={() => {
            void loadAll();
            onSyncChanged?.();
          }}
        />
      )}

      {/* ==================== TAB 1A-2: BANK EXCEL PATTERNS & AUTO PAYMENT RECONCILIATION ==================== */}
      {tab === 'excel' && canManageBlock && (
        <FinanceBankExcelTab
          selectedBlockId={selectedBlockId}
          accessibleBlocks={blocks}
          units={units}
          onCommitted={async () => {
            await loadAll();
            onSyncChanged?.();
          }}
          onFeedback={(msg) => setFeedback({ tone: 'success', text: msg })}
        />
      )}

      {/* ==================== TAB 1B: LOBBY QR CODE & RESIDENT SELF-ONBOARDING ==================== */}
      {tab === 'qr_onboarding' && canManageBlock && (
        <div className="m-panel-in">
          <BlockResidentQrTab
            blockId={selectedBlockId}
            blockName={activeBlock?.name || `بلوک ${selectedBlockId}`}
            managerName={activeBlock?.managerName || currentUser.displayName}
            currentUser={currentUser}
            onApprovedChanged={() => {
              void loadAll();
              onSyncChanged?.();
            }}
          />
        </div>
      )}

      {/* ==================== TAB 2: BLOCK STAFF, TEMP CARETAKER & MULTI-BLOCK SHARING ==================== */}
      {tab === 'staff' && (
        <div className="space-y-3 m-panel-in">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <SectionHeader
              title={`کادر و کاربران بلوک ${selectedBlockId}`}
              icon="badge"
            />
            <div className="flex items-center gap-2 flex-wrap">
              {canManageBlock && shareableStaff.length > 0 && (
                <StitchButton
                  variant="secondary"
                  icon="share"
                  onClick={() => setShowShareModal(true)}
                >
                  اشتراک بلوک با حسابدار / تاسیساتی
                </StitchButton>
              )}
              {creatableRoles.length > 0 && (
                <StitchButton
                  icon="person_add"
                  onClick={() => setShowCreateUser(true)}
                >
                  تعریف پرسنل / سرایدار موقت
                </StitchButton>
              )}
            </div>
          </div>

          {/* Shared Multi-Block Staff Section */}
          {sharedWithThisBlock.length > 0 && (
            <SurfaceCard className="p-3.5 space-y-2.5 bg-primary-container/20 border-primary/30">
              <SectionHeader
                title={`حسابداران و تاسیساتی‌های مشترک مجاز در بلوک ${selectedBlockId}`}
                icon="hub"
                action={
                  <StatusPill
                    label={`${sharedWithThisBlock.length.toLocaleString('fa-IR')} نفر مشترک`}
                    tone="primary"
                  />
                }
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sharedWithThisBlock.map((st) => {
                  const grant = (st.assignedBlocks || []).find((g) => g.blockId === selectedBlockId);
                  return (
                    <div
                      key={st.id}
                      className="p-2.5 rounded-[var(--ui-card-radius)] bg-surface-container-lowest border border-outline-variant/55 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <strong className="text-[13px] font-bold text-on-surface block truncate">
                          {st.displayName}{' '}
                          <span className="text-[11px] font-mono text-primary" dir="ltr">
                            @{st.username}
                          </span>
                        </strong>
                        <span className="text-[11px] text-on-surface-variant block truncate">
                          {ROLE_DEFINITIONS[st.role].title} • مجوز:{' '}
                          {(grant?.permissions || [])
                            .map((p) =>
                              p === 'finance'
                                ? 'مالی و شارژ'
                                : p === 'excel_import'
                                  ? 'اکسل بانکی'
                                  : p === 'facilities'
                                    ? 'تاسیسات'
                                    : 'عمومی',
                            )
                            .join('، ')}
                        </span>
                      </div>
                      {canManageBlock && (
                        <StitchButton
                          variant="danger"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleRevokeShare(st)}
                        >
                          لغو اشتراک
                        </StitchButton>
                      )}
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>
          )}

          <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {blockUsers.map((u) => {
              const rDef = ROLE_DEFINITIONS[u.role];
              return (
                <SurfaceCard key={u.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-[14px] font-bold text-on-surface">
                          {u.displayName}
                        </strong>
                        <span className="text-[11.5px] font-mono text-primary" dir="ltr">
                          @{u.username}
                        </span>
                      </div>
                      <span className="text-[12px] text-on-surface-variant block mt-0.5">
                        {rDef.title}
                        {u.unitCode ? ` • واحد ${u.unitCode}` : u.blockId ? ` • بلوک ${u.blockId}` : ' • کل شهرک'}
                      </span>
                      {u.createdByName && (
                        <span className="text-[11px] text-on-surface-variant block">
                          تعریف‌شده توسط: {u.createdByName}
                        </span>
                      )}
                    </div>

                    <StatusPill
                      label={
                        !u.isCurrentlyActive
                          ? u.isTemporary
                            ? 'منقضی / غیرفعال'
                            : 'غیرفعال'
                          : u.isTemporary && typeof u.remainingMs === 'number'
                            ? `موقت • ${formatRemainingDurationFa(u.remainingMs)}`
                            : 'فعال دائم'
                      }
                      tone={
                        !u.isCurrentlyActive
                          ? 'danger'
                          : u.isTemporary
                            ? 'primary'
                            : 'positive'
                      }
                    />
                  </div>

                  {u.isTemporary && u.accessDurationLabel && (
                    <div className="px-2.5 py-1.5 rounded-[var(--ui-btn-radius)] bg-primary-container/35 border border-primary/20 text-[11.5px] text-on-primary-container flex items-center justify-between gap-2">
                      <span>مدت دسترسی: {u.accessDurationLabel}</span>
                      {u.validUntilMs && (
                        <span className="font-numeric-stat">
                          پایان:{' '}
                          {new Date(u.validUntilMs).toLocaleTimeString('fa-IR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  )}

                  {canManageBlock && u.id !== currentUser.id && (
                    <div className="pt-2 border-t border-outline-variant/35 flex items-center justify-end gap-1.5 flex-wrap">
                      <StitchButton
                        variant="secondary"
                        size="sm"
                        icon="key"
                        disabled={busy}
                        onClick={() => openEditCredentials(u)}
                        className="rounded-[var(--ui-btn-radius)]"
                      >
                        نام کاربری و رمز
                      </StitchButton>
                      {u.isTemporary && (
                        <>
                          <StitchButton
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleExtendOrToggleUser(u, { extendHours: 12 })}
                            className="rounded-[var(--ui-btn-radius)]"
                          >
                            +۱۲ ساعت
                          </StitchButton>
                          <StitchButton
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleExtendOrToggleUser(u, { extendHours: 24 })}
                            className="rounded-[var(--ui-btn-radius)]"
                          >
                            +۱ روز
                          </StitchButton>
                        </>
                      )}
                      <StitchButton
                        variant={u.active ? 'danger' : 'primary'}
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleExtendOrToggleUser(u, { active: !u.active })}
                        className="rounded-[var(--ui-btn-radius)]"
                      >
                        {u.active ? 'لغو دسترسی' : 'فعال‌سازی'}
                      </StitchButton>
                    </div>
                  )}
                </SurfaceCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: CARETAKER TASKS ASSIGNMENT & REVIEW ==================== */}
      {tab === 'tasks' && (
        <div className="space-y-3 m-panel-in">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <SectionHeader title="کارتابل وظایف سرایداران بلوک" icon="assignment" />
            {canManageBlock && (
              <StitchButton
                icon="add_task"
                onClick={() => setShowCreateTask(true)}
                className="rounded-[var(--ui-btn-radius)]"
              >
                ابلاغ وظیفه جدید
              </StitchButton>
            )}
          </div>

          {blockTasks.length === 0 ? (
            <EmptyState
              icon="checklist"
              title="وظیفه‌ای برای سرایداران این بلوک ثبت نشده است"
              actionLabel={canManageBlock ? 'ابلاغ اولین وظیفه' : undefined}
              onAction={canManageBlock ? () => setShowCreateTask(true) : undefined}
            />
          ) : (
            <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
              {blockTasks.map((t) => {
                const st = TASK_STATUS_LABEL[t.status];
                return (
                  <SurfaceCard key={t.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {t.priority === 'urgent' && (
                            <span className="px-1.5 py-0.5 rounded-[var(--ui-btn-radius)] bg-error-container text-on-error-container text-[10.5px] font-bold">
                              فوری
                            </span>
                          )}
                          <span className="text-[11.5px] text-primary font-semibold">
                            {t.category}
                          </span>
                        </div>
                        <h3 className="text-[14px] font-bold text-on-surface mb-0 mt-0.5">
                          {t.title}
                        </h3>
                      </div>
                      <StatusPill label={st.label} tone={st.tone} />
                    </div>

                    {t.description && (
                      <p className="text-[12.5px] text-on-surface-variant mb-0 leading-relaxed">
                        {t.description}
                      </p>
                    )}

                    <div className="text-[12px] text-on-surface-variant flex items-center justify-between gap-2 flex-wrap">
                      <span>سرایدار: <strong className="text-on-surface">{t.assignedToName}</strong></span>
                      <span>مهلت: {t.dueLabel}</span>
                    </div>

                    {(t.completionNote || t.completionPhoto) && (
                      <div className="p-2.5 rounded-[var(--ui-btn-radius)] bg-secondary-container/35 border border-secondary/25 space-y-2">
                        {t.completionNote && (
                          <p className="text-[12px] text-on-surface mb-0">
                            <strong>گزارش سرایدار:</strong> {t.completionNote}
                          </p>
                        )}
                        {t.completionPhoto && (
                          <button
                            type="button"
                            onClick={() => setPreviewPhoto(t.completionPhoto!)}
                            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary underline"
                          >
                            <span className="material-symbols-outlined text-[16px]">image</span>
                            <span>مشاهده تصویر انجام کار</span>
                          </button>
                        )}
                      </div>
                    )}

                    {t.reviewNote && (
                      <p className="text-[11.5px] text-on-surface-variant mb-0">
                        نظر مدیر: {t.reviewNote}
                      </p>
                    )}

                    {canManageBlock && t.status === 'done_pending_review' && (
                      <div className="pt-2 border-t border-outline-variant/35 flex items-center justify-end gap-2">
                        <StitchButton
                          size="sm"
                          icon="fact_check"
                          onClick={() => {
                            setReviewingTask(t);
                            setReviewNote('');
                          }}
                          className="rounded-[var(--ui-btn-radius)]"
                        >
                          بررسی و تایید انجام کار
                        </StitchButton>
                      </div>
                    )}
                  </SurfaceCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 4: RESIDENT REQUESTS (WITH CHAT REDIRECT) ==================== */}
      {tab === 'requests' && (
        <div className="space-y-3.5 m-panel-in">
          <SurfaceCard className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <strong className="text-[13.5px] font-bold text-on-surface block">
                مکالمات و پیام‌رسان با ساکنین و مدیران به صفحه مجزا منتقل شد
              </strong>
              <span className="text-[12px] text-on-surface-variant block mt-0.5">
                برای گفتگوی مستقیم با ساکنین، سایر مدیران بلوک و گروه‌ها وارد پیام‌رسان شوید.
              </span>
            </div>
            <StitchButton
              icon="forum"
              onClick={() => navigate('/m/chat')}
              className="rounded-[var(--ui-btn-radius)] shrink-0"
            >
              ورود به صفحه چت با ساکنین و مدیران
            </StitchButton>
          </SurfaceCard>

          <SurfaceCard className="space-y-3">
            <SectionHeader title="خرابی‌ها و درخواست‌های ساکنین" icon="build" />
            {blockRequests.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant text-center py-5 mb-0">
                درخواست خرابی ثبت‌شده‌ای وجود ندارد.
              </p>
            ) : (
              <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                {blockRequests.map((req) => {
                  const st = REQ_STATUS_LABEL[req.status];
                  return (
                    <div
                      key={req.id}
                      className="p-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low/80 border border-outline-variant/45 space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[11.5px] font-bold text-primary">
                              واحد {req.unitCode} ({req.residentName}) • {req.category}
                            </span>
                            <h4 className="text-[13.5px] font-bold text-on-surface mb-0 mt-0.5">
                              {req.title}
                            </h4>
                          </div>
                          <StatusPill label={st.label} tone={st.tone} />
                        </div>
                        <p className="text-[12.5px] text-on-surface-variant mb-0 leading-relaxed">
                          {req.description}
                        </p>
                        {req.photoDataUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewPhoto(req.photoDataUrl!)}
                            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary underline"
                          >
                            <span className="material-symbols-outlined text-[16px]">photo</span>
                            <span>مشاهده عکس ارسالی ساکن</span>
                          </button>
                        )}
                        {req.managerReply && (
                          <div className="p-2 rounded-[var(--ui-btn-radius)] bg-surface-container-lowest border border-outline-variant/35 text-[12px]">
                            <strong>پاسخ مدیریت/تاسیسات:</strong> {req.managerReply}
                          </div>
                        )}
                      </div>
                      <div className="pt-2 border-t border-outline-variant/35 flex items-center justify-end gap-2 flex-wrap">
                        <StitchButton
                          variant="secondary"
                          size="sm"
                          icon="chat"
                          onClick={() => navigate(`/m/chat?unit=${encodeURIComponent(req.unitCode)}`)}
                          className="rounded-[var(--ui-btn-radius)]"
                        >
                          پیام در چت
                        </StitchButton>
                        <StitchButton
                          variant="secondary"
                          size="sm"
                          icon="reply"
                          onClick={() => {
                            setReplyingReq(req);
                            setReqReplyText(req.managerReply || '');
                            setReqNextStatus(req.status === 'open' ? 'in_progress' : 'resolved');
                          }}
                          className="rounded-[var(--ui-btn-radius)]"
                        >
                          پاسخ و تغییر وضعیت
                        </StitchButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SurfaceCard>
        </div>
      )}

      {/* ==================== MODAL: CREATE USER / TEMP CARETAKER ==================== */}
      <StitchModal
        open={showCreateUser}
        onClose={() => setShowCreateUser(false)}
        title="تعریف پرسنل، سرایدار موقت یا ساکن"
        subtitle="حساب جدید بلافاصله در دیتابیس NoSQL ثبت و قابل ورود خواهد بود"
      >
        <form onSubmit={handleCreateUser} className="space-y-3">
          <div>
            <label htmlFor="cu-role" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
              نقش کاربری
            </label>
            <select
              id="cu-role"
              value={newRole}
              onChange={(e) => {
                const r = e.target.value as UserRoleId;
                setNewRole(r);
                setIsTempFlag(r === 'temp_caretaker');
              }}
              className="w-full h-10 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
            >
              {creatableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_DEFINITIONS[r].title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="cu-name" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                نام و نام خانوادگی
              </label>
              <input
                id="cu-name"
                type="text"
                required
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="مثلاً: علی رضایی"
                className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
              />
            </div>
            <div>
              <label htmlFor="cu-username" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                نام کاربری (انگلیسی)
              </label>
              <input
                id="cu-username"
                type="text"
                required
                dir="ltr"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="ali_temp"
                className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="cu-pass" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                رمز عبور اولیه
              </label>
              <input
                id="cu-pass"
                type="text"
                required
                dir="ltr"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
              />
            </div>
            <div>
              <label htmlFor="cu-phone" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                شماره تماس
              </label>
              <input
                id="cu-phone"
                type="text"
                dir="ltr"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="0912..."
                className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
              />
            </div>
          </div>

          {ROLE_DEFINITIONS[newRole].scopeLevel !== 'complex' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="cu-block" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                  بلوک
                </label>
                <select
                  id="cu-block"
                  disabled={Boolean(currentUser.blockId)}
                  value={currentUser.blockId || newBlockId}
                  onChange={(e) => setNewBlockId(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
                >
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              {newRole === 'resident' && (
                <div>
                  <label htmlFor="cu-unit" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                    کد واحد
                  </label>
                  <input
                    id="cu-unit"
                    type="text"
                    dir="ltr"
                    value={newUnitCode}
                    onChange={(e) => setNewUnitCode(e.target.value)}
                    placeholder={`${selectedBlockId}-305`}
                    className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
                  />
                </div>
              )}
            </div>
          )}

          {/* Temporary / Relief Caretaker Time Window */}
          {(newRole === 'temp_caretaker' || newRole === 'block_caretaker') && (
            <div className="p-3 rounded-[var(--ui-btn-radius)] bg-primary-container/30 border border-primary/25 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-bold text-on-surface">
                  تعیین مدت دسترسی زمان‌دار (سرایدار موقت / کمکی)
                </span>
                {newRole !== 'temp_caretaker' && (
                  <label className="inline-flex items-center gap-1.5 text-[12px]">
                    <input
                      type="checkbox"
                      checked={isTempFlag}
                      onChange={(e) => setIsTempFlag(e.target.checked)}
                    />
                    <span>دسترسی موقت</span>
                  </label>
                )}
              </div>

              {(newRole === 'temp_caretaker' || isTempFlag) && (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'half_day', label: 'نصف روز (۱۲ ساعت)' },
                        { id: 'one_day', label: '۱ روز (۲۴ ساعت)' },
                        { id: 'two_days', label: '۲ روز (۴۸ ساعت)' },
                        { id: 'custom', label: 'بازه تاریخ دلخواه' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDurationPreset(opt.id)}
                        className={`h-9 px-2 rounded-[var(--ui-btn-radius)] border text-[12px] font-semibold transition-colors ${
                          durationPreset === opt.id
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface-container-lowest text-on-surface border-outline-variant/55'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {durationPreset === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <JalaliDateTimePicker
                        id="cu-from"
                        label="شروع بازه (تاریخ شمسی و ساعت)"
                        mode="datetime"
                        value={customFrom}
                        valueMs={customFromMs}
                        onChange={(formatted, ms) => {
                          setCustomFrom(formatted);
                          setCustomFromMs(ms);
                        }}
                      />
                      <JalaliDateTimePicker
                        id="cu-until"
                        label="پایان بازه (تاریخ شمسی و ساعت)"
                        mode="datetime"
                        value={customUntil}
                        valueMs={customUntilMs}
                        onChange={(formatted, ms) => {
                          setCustomUntil(formatted);
                          setCustomUntilMs(ms);
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <StitchButton type="submit" disabled={busy} icon="person_add" className="w-full">
            {busy ? 'در حال ثبت...' : 'ایجاد حساب در دیتابیس NoSQL'}
          </StitchButton>
        </form>
      </StitchModal>

      {/* ==================== MODAL: ASSIGN TASK TO CARETAKER ==================== */}
      <StitchModal
        open={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        title="ابلاغ وظیفه جدید به سرایدار"
        subtitle={`بلوک ${selectedBlockId} • بلافاصله در پنل سرایدار نمایش داده می‌شود`}
      >
        <form onSubmit={handleCreateTask} className="space-y-3">
          <div>
            <label htmlFor="tk-assignee" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
              انتخاب سرایدار (دائم یا موقت)
            </label>
            <select
              id="tk-assignee"
              required
              value={taskAssigneeId}
              onChange={(e) => setTaskAssigneeId(e.target.value)}
              className="w-full h-10 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
            >
              {blockCaretakers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName} ({c.isTemporary ? 'سرایدار موقت' : 'سرایدار دائم'}) — @{c.username}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tk-title" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
              عنوان وظیفه
            </label>
            <input
              id="tk-title"
              type="text"
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="مثلاً: شستشوی رمپ پارکینگ و بررسی لامپ‌ها"
              className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="tk-cat" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                دسته‌بندی
              </label>
              <select
                id="tk-cat"
                value={taskCategory}
                onChange={(e) => setTaskCategory(e.target.value as CaretakerTaskDoc['category'])}
                className="w-full h-10 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
              >
                <option value="نظافت">نظافت</option>
                <option value="تاسیسات سبک">تاسیسات سبک</option>
                <option value="باغبانی و محوطه">باغبانی و محوطه</option>
                <option value="بازرسی ایمنی">بازرسی ایمنی</option>
                <option value="تحویل و هماهنگی">تحویل و هماهنگی</option>
              </select>
            </div>
            <div>
              <label htmlFor="tk-pri" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                اولویت
              </label>
              <select
                id="tk-pri"
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as 'normal' | 'urgent')}
                className="w-full h-10 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
              >
                <option value="normal">عادی</option>
                <option value="urgent">فوری</option>
              </select>
            </div>
          </div>
          <JalaliDateTimePicker
            id="tk-due"
            label="مهلت انجام (تاریخ شمسی و ساعت)"
            mode="datetime"
            value={taskDue}
            onChange={(formatted) => setTaskDue(formatted)}
          />
          <div>
            <label htmlFor="tk-desc" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
              توضیحات اجرایی
            </label>
            <textarea
              id="tk-desc"
              rows={2}
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              placeholder="جزئیات محل و نکات مورد انتظار..."
              className="w-full p-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
            />
          </div>
          <StitchButton type="submit" disabled={busy} icon="send" className="w-full">
            ثبت و ارسال به سرایدار
          </StitchButton>
        </form>
      </StitchModal>

      {/* ==================== MODAL: REVIEW CARETAKER TASK ==================== */}
      <StitchModal
        open={Boolean(reviewingTask)}
        onClose={() => setReviewingTask(null)}
        title="بررسی و تایید انجام کار سرایدار"
        subtitle={reviewingTask ? `${reviewingTask.title} • ${reviewingTask.assignedToName}` : undefined}
      >
        {reviewingTask && (
          <div className="space-y-3">
            {reviewingTask.completionNote && (
              <div className="p-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low border border-outline-variant/45 text-[12.5px]">
                <strong>گزارش سرایدار:</strong> {reviewingTask.completionNote}
              </div>
            )}
            {reviewingTask.completionPhoto && (
              <img
                src={reviewingTask.completionPhoto}
                alt="تصویر انجام وظیفه"
                className="w-full max-h-56 object-contain rounded-[var(--ui-btn-radius)] border border-outline-variant/50 bg-surface-container-low"
              />
            )}
            <div>
              <label htmlFor="rv-note" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                یادداشت مدیر بلوک
              </label>
              <input
                id="rv-note"
                type="text"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="تایید شد یا علت نیاز به اصلاح..."
                className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StitchButton
                disabled={busy}
                icon="check_circle"
                onClick={() => void handleReviewTask('approved')}
                className="rounded-[var(--ui-btn-radius)]"
              >
                تایید نهایی
              </StitchButton>
              <StitchButton
                variant="danger"
                disabled={busy}
                icon="undo"
                onClick={() => void handleReviewTask('needs_fix')}
                className="rounded-[var(--ui-btn-radius)]"
              >
                بازگشت جهت اصلاح
              </StitchButton>
            </div>
          </div>
        )}
      </StitchModal>

      {/* ==================== MODAL: BROADCAST BLOCK NOTICE ==================== */}
      <StitchModal
        open={showCreateNotice}
        onClose={() => setShowCreateNotice(false)}
        title={`ارسال اطلاعیه به ساکنین بلوک ${selectedBlockId}`}
        subtitle="در پنل ساکنین و نوار هشدار بالای داک نمایش داده می‌شود"
      >
        <form onSubmit={handleCreateNotice} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="nt-target" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                مخاطب
              </label>
              <select
                id="nt-target"
                value={noticeTargetUnit}
                onChange={(e) => setNoticeTargetUnit(e.target.value)}
                className="w-full h-10 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
              >
                <option value="ALL">همه واحدهای بلوک {selectedBlockId}</option>
                {blockUnits.map((u) => (
                  <option key={u.id} value={u.unitCode}>
                    فقط واحد {u.unitCode} ({u.residentName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nt-sev" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                سطح اهمیت
              </label>
              <select
                id="nt-sev"
                value={noticeSeverity}
                onChange={(e) => setNoticeSeverity(e.target.value as typeof noticeSeverity)}
                className="w-full h-10 px-2 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] border border-outline-variant/55"
              >
                <option value="info">اطلاعیه عادی</option>
                <option value="warning">هشدار مهم</option>
                <option value="urgent">اضطراری</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="nt-title" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
              عنوان اعلان
            </label>
            <input
              id="nt-title"
              type="text"
              required
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
              placeholder="مثلاً: سرویس دوره‌ای آسانسور فردا ساعت ۱۰"
              className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
            />
          </div>
          <div>
            <label htmlFor="nt-body" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
              متن اطلاعیه
            </label>
            <textarea
              id="nt-body"
              rows={3}
              required
              value={noticeBody}
              onChange={(e) => setNoticeBody(e.target.value)}
              className="w-full p-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
            />
          </div>
          <StitchButton type="submit" disabled={busy} icon="campaign" className="w-full">
            انتشار اعلان برای ساکنین
          </StitchButton>
        </form>
      </StitchModal>

      {/* ==================== MODAL: REPLY TO RESIDENT REQUEST ==================== */}
      <StitchModal
        open={Boolean(replyingReq)}
        onClose={() => setReplyingReq(null)}
        title="رسیدگی به خرابی واحد"
        subtitle={replyingReq ? `واحد ${replyingReq.unitCode} • ${replyingReq.title}` : undefined}
      >
        {replyingReq && (
          <form onSubmit={handleUpdateRequest} className="space-y-3">
            <div>
              <label htmlFor="rq-st" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                وضعیت جدید
              </label>
              <select
                id="rq-st"
                value={reqNextStatus}
                onChange={(e) => setReqNextStatus(e.target.value as ResidentRequestDoc['status'])}
                className="w-full h-10 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
              >
                <option value="assigned">ارجاع به تاسیسات</option>
                <option value="in_progress">در حال تعمیر</option>
                <option value="resolved">حل و بسته شد</option>
              </select>
            </div>
            <div>
              <label htmlFor="rq-reply" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
                پاسخ به ساکن
              </label>
              <textarea
                id="rq-reply"
                rows={3}
                required
                value={reqReplyText}
                onChange={(e) => setReqReplyText(e.target.value)}
                placeholder="زمان اعزام تکنسین یا نتیجه بررسی..."
                className="w-full p-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
              />
            </div>
            <StitchButton type="submit" disabled={busy} icon="check" className="w-full">
              ثبت پاسخ و به‌روزرسانی
            </StitchButton>
          </form>
        )}
      </StitchModal>

      {/* ==================== MODAL: SHARE BLOCK WITH ACCOUNTANT / FACILITIES ==================== */}
      <StitchModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={`اشتراک‌گذاری دسترسی بلوک ${selectedBlockId}`}
        subtitle="حسابدار یا مسئول تاسیساتی مشترک می‌تواند کارهای بلوک شما را در پنل خود انجام دهد"
      >
        <form onSubmit={handleShareBlock} className="space-y-3">
          <div>
            <label htmlFor="sh-user" className="block text-[12px] font-semibold text-on-surface-variant mb-1">
              انتخاب حسابدار یا مسئول تاسیسات
            </label>
            <select
              id="sh-user"
              required
              value={shareTargetUserId}
              onChange={(e) => {
                const uid = e.target.value;
                setShareTargetUserId(uid);
                const found = shareableStaff.find((x) => x.id === uid);
                if (found?.role.includes('accountant')) {
                  setSharePerms(['finance', 'excel_import']);
                } else {
                  setSharePerms(['facilities']);
                }
              }}
              className="w-full h-10 px-2.5 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
            >
              {shareableStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} ({ROLE_DEFINITIONS[s.role].title}) — @{s.username}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[12px] font-semibold text-on-surface-variant">
              سطح مجوزهای اشتراکی روی بلوک {selectedBlockId}:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {(
                [
                  { id: 'finance', label: 'حسابداری و شارژ بلوک' },
                  { id: 'excel_import', label: 'تطبیق اکسل بانکی' },
                  { id: 'facilities', label: 'تاسیسات و تعمیرات بلوک' },
                ] as const
              ).map((perm) => {
                const checked = sharePerms.includes(perm.id);
                return (
                  <button
                    key={perm.id}
                    type="button"
                    onClick={() =>
                      setSharePerms((prev) =>
                        prev.includes(perm.id)
                          ? prev.filter((x) => x !== perm.id)
                          : [...prev, perm.id],
                      )
                    }
                    className={`px-3 py-1.5 rounded-[var(--ui-btn-radius)] border text-[12px] font-semibold transition-colors ${
                      checked
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container-low text-on-surface border-outline-variant/55'
                    }`}
                  >
                    {checked ? '✓ ' : ''}
                    {perm.label}
                  </button>
                );
              })}
            </div>
          </div>

          <StitchButton type="submit" disabled={busy} icon="share" className="w-full">
            {busy ? 'در حال ثبت...' : `اعطای دسترسی بلوک ${selectedBlockId}`}
          </StitchButton>
        </form>
      </StitchModal>

      {/* ==================== MODAL: EDIT CARETAKER / STAFF USERNAME & PASSWORD ==================== */}
      <StitchModal
        open={Boolean(editingCredUser)}
        onClose={() => setEditingCredUser(null)}
        title="تنظیم نام کاربری و رمز عبور پرسنل / سرایدار"
        subtitle={
          editingCredUser
            ? `${editingCredUser.displayName} (${ROLE_DEFINITIONS[editingCredUser.role].title})`
            : undefined
        }
      >
        {editingCredUser && (
          <form onSubmit={handleSaveCredentials} className="space-y-3">
            <div>
              <label
                htmlFor="ec-name"
                className="block text-[12px] font-semibold text-on-surface-variant mb-1"
              >
                نام و نام خانوادگی
              </label>
              <input
                id="ec-name"
                type="text"
                required
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="ec-user"
                  className="block text-[12px] font-semibold text-on-surface-variant mb-1"
                >
                  نام کاربری ورود (انگلیسی)
                </label>
                <input
                  id="ec-user"
                  type="text"
                  required
                  dir="ltr"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="caretaker_b"
                  className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] font-mono border border-outline-variant/55"
                />
              </div>
              <div>
                <label
                  htmlFor="ec-pass"
                  className="block text-[12px] font-semibold text-on-surface-variant mb-1"
                >
                  رمز عبور جدید (خالی = بدون تغییر)
                </label>
                <input
                  id="ec-pass"
                  type="text"
                  dir="ltr"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="مثلاً: Niloofar@1405"
                  className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] font-mono border border-outline-variant/55"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="ec-phone"
                className="block text-[12px] font-semibold text-on-surface-variant mb-1"
              >
                شماره تماس
              </label>
              <input
                id="ec-phone"
                type="text"
                dir="ltr"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="0912..."
                className="w-full h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
              />
            </div>

            <StitchButton type="submit" disabled={busy} icon="key" className="w-full">
              {busy ? 'در حال ذخیره...' : 'ذخیره نام کاربری و رمز جدید در دیتابیس'}
            </StitchButton>
          </form>
        )}
      </StitchModal>

      {/* ==================== MODAL: PHOTO PREVIEW ==================== */}
      <StitchModal
        open={Boolean(previewPhoto)}
        onClose={() => setPreviewPhoto(null)}
        title="تصویر پیوست‌شده"
      >
        {previewPhoto && (
          <img
            src={previewPhoto}
            alt="تصویر پیوست"
            className="w-full max-h-[60vh] object-contain rounded-[var(--ui-card-radius)] border border-outline-variant/45 bg-surface-container-low"
          />
        )}
      </StitchModal>
    </div>
  );
};
