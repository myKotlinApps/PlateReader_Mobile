import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CheckCheck,
  ImagePlus,
  MessageSquarePlus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
import { rbacApi, readFileAsDataUrl } from '../rbac/rbacApi';
import { ROLE_DEFINITIONS, type RbacUserRecord } from '../rbac/roles';
import {
  buildChatThreadList,
  filterChatThreads,
  getChatInitials,
  getMessageDeliveryState,
  type ChatContactSummary,
  type ChatConversationCategory,
  type ChatGroupDefinition,
  type ChatMessageDoc,
  type ChatThreadSummary,
} from '../utils/chatConversations';
import { formatJalaliDate, formatJalaliTime, msToJalaliDateTime } from '../utils/jalaliDate';
import { NoticeBanner, StitchModal } from '../ui/StitchKit';

interface Props {
  currentUser: RbacUserRecord;
  onSyncChanged?: () => void;
}

const CATEGORY_TABS: Array<{ id: ChatConversationCategory; label: string }> = [
  { id: 'all', label: 'همه' },
  { id: 'managers', label: 'مدیران و کادر' },
  { id: 'residents', label: 'ساکنین' },
  { id: 'groups', label: 'گروه‌ها' },
];

const QUICK_REPLIES_MANAGER = [
  'پیام شما دریافت شد، پیگیری می‌کنیم.',
  'تیم تاسیسات برای بررسی اعزام شد.',
  'انجام شد و در سیستم ثبت گردید.',
];

const QUICK_REPLIES_RESIDENT = [
  'فیش شارژ این ماه ارسال شد.',
  'لطفاً زمان حضور تکنسین را هماهنگ بفرمایید.',
  'با تشکر از پیگیری شما.',
];

function formatThreadTimeLabel(ms: number): string {
  const dt = msToJalaliDateTime(ms);
  const nowDt = msToJalaliDateTime(Date.now());
  if (dt.jy === nowDt.jy && dt.jm === nowDt.jm && dt.jd === nowDt.jd) {
    return formatJalaliTime(dt.hour, dt.minute);
  }
  return formatJalaliDate(dt);
}

export const ChatPage: React.FC<Props> = ({ currentUser, onSyncChanged }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [contacts, setContacts] = useState<ChatContactSummary[]>([]);
  const [groups, setGroups] = useState<Array<ChatGroupDefinition & { memberCount: number }>>([]);
  const [messages, setMessages] = useState<ChatMessageDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [category, setCategory] = useState<ChatConversationCategory>('all');
  const [query, setQuery] = useState('');
  const [selectedConvId, setSelectedConvId] = useState<string>('');
  const [mobilePane, setMobilePane] = useState<'list' | 'thread'>('list');

  const [draft, setDraft] = useState('');
  const [attachmentDataUrl, setAttachmentDataUrl] = useState<string>('');
  const [replyToMsg, setReplyToMsg] = useState<ChatMessageDoc | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const deepLinkAppliedRef = useRef(false);
  const markingConvRef = useRef<string>('');

  const loadChat = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setRefreshing(true);
    try {
      const data = await rbacApi.getChatBootstrap();
      setContacts(data.contacts);
      setGroups(data.groups);
      setMessages(data.messages);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'دریافت گفتگوها انجام نشد.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    deepLinkAppliedRef.current = false;
    void loadChat();
  }, [currentUser.id, loadChat]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadChat({ silent: true });
    }, 6000);
    return () => window.clearInterval(timer);
  }, [loadChat]);

  const threads = useMemo(
    () =>
      buildChatThreadList({
        currentUser,
        contacts,
        groups,
        messages,
      }),
    [currentUser, contacts, groups, messages],
  );

  const hasResidentThreads = useMemo(
    () => threads.some((t) => t.category === 'residents'),
    [threads],
  );

  const visibleTabs = useMemo(
    () =>
      hasResidentThreads
        ? CATEGORY_TABS
        : CATEGORY_TABS.filter((t) => t.id !== 'residents'),
    [hasResidentThreads],
  );

  const filteredThreads = useMemo(
    () => filterChatThreads(threads, { category, query }),
    [threads, category, query],
  );

  // Resolve initial selection & optional ?conv= / ?unit= / ?user= deep-links
  useEffect(() => {
    if (threads.length === 0) return;
    const paramConv = searchParams.get('conv');
    const paramUnit = searchParams.get('unit');
    const paramUser = searchParams.get('user');

    if (!deepLinkAppliedRef.current && (paramConv || paramUnit || paramUser)) {
      const matched =
        (paramConv ? threads.find((t) => t.conversationId === paramConv) : undefined) ||
        (paramUnit ? threads.find((t) => t.unitCode === paramUnit) : undefined) ||
        (paramUser ? threads.find((t) => t.targetUserId === paramUser) : undefined);

      deepLinkAppliedRef.current = true;
      if (matched) {
        setSelectedConvId(matched.conversationId);
        setMobilePane('thread');
        return;
      }
    }

    if (!selectedConvId || !threads.some((t) => t.conversationId === selectedConvId)) {
      setSelectedConvId(threads[0].conversationId);
    }
  }, [threads, selectedConvId, searchParams]);

  const activeThread: ChatThreadSummary | null = useMemo(
    () =>
      threads.find((t) => t.conversationId === selectedConvId) ??
      threads[0] ??
      null,
    [threads, selectedConvId],
  );

  const activeMessages = useMemo(() => {
    if (!activeThread) return [];
    return messages
      .filter((m) => m.conversationId === activeThread.conversationId)
      .sort((a, b) => a.createdAtMs - b.createdAtMs);
  }, [messages, activeThread]);

  // Mark messages in currently open conversation as read (desktop always visible, mobile only when inside thread pane)
  useEffect(() => {
    if (!activeThread) return;
    const isThreadVisible =
      typeof window === 'undefined' ||
      window.innerWidth >= 768 ||
      mobilePane === 'thread';
    if (!isThreadVisible) return;

    const hasUnread = activeMessages.some(
      (m) =>
        m.senderUserId !== currentUser.id &&
        !(m.readByUserIds || []).includes(currentUser.id),
    );
    if (!hasUnread) return;
    if (markingConvRef.current === activeThread.conversationId) return;

    markingConvRef.current = activeThread.conversationId;
    void rbacApi
      .markChatRead(activeThread.conversationId)
      .then((res) => {
        if (res.updatedCount > 0) {
          setMessages((prev) =>
            prev.map((m) =>
              m.conversationId === activeThread.conversationId &&
              !(m.readByUserIds || []).includes(currentUser.id)
                ? { ...m, readByUserIds: [...(m.readByUserIds || []), currentUser.id] }
                : m,
            ),
          );
          onSyncChanged?.();
        }
      })
      .finally(() => {
        markingConvRef.current = '';
      });
  }, [activeThread, activeMessages, currentUser.id, mobilePane, onSyncChanged]);

  // Scroll to bottom when active conversation or message count changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeThread?.conversationId, activeMessages.length, mobilePane]);

  const selectConversation = (convId: string) => {
    setSelectedConvId(convId);
    setMobilePane('thread');
    setReplyToMsg(null);
    setAttachmentDataUrl('');
    setSearchParams({ conv: convId }, { replace: true });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || sending) return;
    const trimmed = draft.trim();
    if (!trimmed && !attachmentDataUrl) return;

    setSending(true);
    setErrorMsg('');
    try {
      const res = await rbacApi.sendChatMessage({
        conversationId: activeThread.conversationId,
        targetUserId: activeThread.targetUserId,
        groupId: activeThread.groupId,
        body: trimmed,
        attachmentDataUrl: attachmentDataUrl || undefined,
        replyToId: replyToMsg?.id,
      });
      setDraft('');
      setAttachmentDataUrl('');
      setReplyToMsg(null);
      setMessages((prev) => [...prev, res.message]);
      onSyncChanged?.();
      window.setTimeout(() => inputRef.current?.focus(), 20);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ارسال پیام ناموفق بود.');
    } finally {
      setSending(false);
    }
  };

  const handlePickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAttachmentDataUrl(dataUrl);
    } catch {
      setErrorMsg('خواندن تصویر پیوست ناموفق بود.');
    }
  };

  const quickReplies =
    currentUser.role === 'resident' ? QUICK_REPLIES_RESIDENT : QUICK_REPLIES_MANAGER;

  const filteredModalContacts = useMemo(() => {
    const q = newChatSearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      `${c.displayName} ${c.roleTitle} ${c.unitCode || ''} ${c.blockId || ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [contacts, newChatSearch]);

  const totalUnread = useMemo(
    () => threads.reduce((acc, t) => acc + t.unreadCount, 0),
    [threads],
  );

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden" dir="rtl">
      {errorMsg && (
        <div className="px-3 pt-2 shrink-0">
          <NoticeBanner message={errorMsg} tone="danger" onClose={() => setErrorMsg('')} />
        </div>
      )}

      {/* Full-Screen Edge-to-Edge Telegram/WhatsApp Messenger — extends behind translucent dock */}
      <section
        aria-label="صفحه گفتگو و پیام‌رسان"
        className="flex-1 min-h-0 w-full flex flex-col md:flex-row bg-transparent overflow-hidden"
      >
        {/* ==================== RIGHT PANE (RTL): CONVERSATION LIST SIDEBAR ==================== */}
        <aside
          aria-label="فهرست گفتگوها"
          className={`${
            mobilePane === 'list' ? 'flex' : 'hidden'
          } md:flex flex-col w-full md:w-[340px] lg:w-[380px] shrink-0 h-full min-h-0 bg-surface-container-lowest md:border-l border-outline-variant/55`}
        >
          {/* Sidebar Header */}
          <div className="px-3.5 py-2.5 border-b border-outline-variant/50 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] font-extrabold text-on-surface mb-0 truncate">
                  پیام‌رسان شهرک
                </h1>
                {totalUnread > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-on-primary text-[11px] font-bold font-numeric-stat inline-flex items-center justify-center">
                    {totalUnread.toLocaleString('fa-IR')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-on-surface-variant mb-0 truncate">
                {ROLE_DEFINITIONS[currentUser.role].shortTitle} · {threads.length.toLocaleString('fa-IR')} گفتگو
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void loadChat()}
                disabled={refreshing}
                aria-label="بروزرسانی گفتگوها"
                className="w-10 h-10 rounded-[var(--ui-btn-radius)] bg-surface-container-low hover:bg-surface-container text-on-surface-variant inline-flex items-center justify-center border border-outline-variant/45 transition-colors"
              >
                <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewChatSearch('');
                  setNewChatOpen(true);
                }}
                aria-label="شروع گفتگوی جدید"
                className="h-10 px-2.5 rounded-[var(--ui-btn-radius)] bg-primary text-on-primary text-[12px] font-bold inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
              >
                <MessageSquarePlus size={16} />
                <span>جدید</span>
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="px-3 pt-2.5 pb-2">
            <div className="relative flex items-center">
              <Search
                size={15}
                className="text-on-surface-variant absolute right-3 pointer-events-none"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجو در نام، واحد یا متن پیام..."
                aria-label="جستجو در گفتگوها"
                className="w-full h-10 pr-9 pl-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[12.5px] text-on-surface border border-outline-variant/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
            </div>
          </div>

          {/* Segmented Category Tabs */}
          <div
            role="tablist"
            aria-label="فیلتر دسته‌بندی گفتگوها"
            className="px-3 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-outline-variant/45"
          >
            {visibleTabs.map((t) => {
              const isAct = category === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={isAct}
                  onClick={() => setCategory(t.id)}
                  className={`h-8 px-2.5 rounded-[var(--ui-btn-radius)] text-[11.5px] font-bold whitespace-nowrap shrink-0 transition-colors border ${
                    isAct
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container-low text-on-surface-variant border-outline-variant/45 hover:text-on-surface'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Scrollable Thread List — reaches full bottom of viewport */}
          <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/30 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
            {loading && threads.length === 0 ? (
              <div className="p-6 text-center text-[12.5px] text-on-surface-variant">
                در حال بارگذاری گفتگوها...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <p className="text-[12.5px] font-semibold text-on-surface mb-0">
                  گفتگویی با این فیلتر پیدا نشد
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCategory('all');
                    setQuery('');
                  }}
                  className="text-[12px] font-bold text-primary hover:underline"
                >
                  نمایش همه گفتگوها
                </button>
              </div>
            ) : (
              filteredThreads.map((th) => {
                const isSelected = activeThread?.conversationId === th.conversationId;
                const lastSenderPrefix =
                  th.lastMessage && th.kind === 'group'
                    ? th.lastMessage.senderUserId === currentUser.id
                      ? 'شما: '
                      : `${th.lastMessage.senderName.split(' ')[0]}: `
                    : th.lastMessage?.senderUserId === currentUser.id
                      ? 'شما: '
                      : '';

                return (
                  <button
                    key={th.conversationId}
                    type="button"
                    onClick={() => selectConversation(th.conversationId)}
                    className={`w-full min-h-[68px] px-3 py-2.5 text-right flex items-center gap-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 ${
                      isSelected
                        ? 'bg-primary-container/45'
                        : 'hover:bg-surface-container-low/80'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {th.avatarDataUrl ? (
                        <img
                          src={th.avatarDataUrl}
                          alt={th.title}
                          className="w-11 h-11 rounded-full object-cover border border-outline-variant/60"
                        />
                      ) : (
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center font-extrabold text-[13.5px] ${
                            th.kind === 'group'
                              ? 'bg-secondary text-on-secondary'
                              : isSelected
                                ? 'bg-primary text-on-primary'
                                : 'bg-primary-container text-on-primary-container'
                          }`}
                        >
                          {th.kind === 'group' ? <Users size={18} /> : th.avatarText}
                        </div>
                      )}
                    </div>

                    {/* Title + Preview */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-[13px] font-bold text-on-surface truncate">
                          {th.title}
                        </strong>
                        {th.lastMessage && (
                          <span className="text-[10.5px] text-on-surface-variant font-numeric-stat shrink-0">
                            {formatThreadTimeLabel(th.lastMessage.createdAtMs)}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-primary font-medium block truncate">
                        {th.kind === 'group' && th.memberCount
                          ? `گروه · ${th.memberCount.toLocaleString('fa-IR')} عضو`
                          : th.subtitle}
                      </span>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11.5px] text-on-surface-variant truncate">
                          {th.lastMessage
                            ? `${lastSenderPrefix}${th.lastMessage.body}`
                            : 'شروع گفتگوی جدید...'}
                        </span>
                        {th.unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-on-primary text-[10.5px] font-bold font-numeric-stat inline-flex items-center justify-center shrink-0">
                            {th.unreadCount.toLocaleString('fa-IR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ==================== LEFT PANE (RTL): ACTIVE THREAD CANVAS & COMPOSER ==================== */}
        <div
          className={`${
            mobilePane === 'thread' ? 'flex' : 'hidden'
          } md:flex flex-col flex-1 min-w-0 h-full min-h-0 relative overflow-hidden`}
          style={{
            backgroundColor: 'var(--color-surface-container-low)',
            backgroundImage:
              'radial-gradient(color-mix(in srgb, var(--color-primary) 9%, transparent) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          {!activeThread ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 pb-8 text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-surface-container-lowest border border-outline-variant/55 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[28px]">forum</span>
              </div>
              <p className="text-[14px] font-bold text-on-surface mb-0">
                یک گفتگو را از فهرست انتخاب کنید
              </p>
              <p className="text-[12px] text-on-surface-variant mb-0 max-w-xs">
                ارتباط مستقیم با ساکنین، هماهنگی بین مدیران بلوک‌ها و گروه‌های عملیاتی در یک محیط یکپارچه.
              </p>
            </div>
          ) : (
            <>
              {/* Active Thread Header */}
              <header className="relative z-10 px-3 py-2.5 bg-surface-container-lowest/92 backdrop-blur-md border-b border-outline-variant/55 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobilePane('list')}
                    aria-label="بازگشت به لیست گفتگوها"
                    className="md:hidden w-11 h-11 rounded-[var(--ui-btn-radius)] hover:bg-surface-container-low text-on-surface inline-flex items-center justify-center shrink-0"
                  >
                    <ArrowRight size={20} />
                  </button>

                  {activeThread.avatarDataUrl ? (
                    <img
                      src={activeThread.avatarDataUrl}
                      alt={activeThread.title}
                      className="w-10 h-10 rounded-full object-cover border border-outline-variant/60 shrink-0"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-[13px] shrink-0 ${
                        activeThread.kind === 'group'
                          ? 'bg-secondary text-on-secondary'
                          : 'bg-primary text-on-primary'
                      }`}
                    >
                      {activeThread.kind === 'group' ? (
                        <Users size={18} />
                      ) : (
                        activeThread.avatarText
                      )}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h2 className="text-[14px] font-extrabold text-on-surface mb-0 truncate">
                      {activeThread.title}
                    </h2>
                    <p className="text-[11px] text-on-surface-variant mb-0 truncate">
                      {activeThread.kind === 'group'
                        ? `${activeThread.subtitle}${
                            activeThread.memberCount
                              ? ` · ${activeThread.memberCount.toLocaleString('fa-IR')} عضو`
                              : ''
                          }`
                        : activeThread.subtitle}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-semibold text-on-surface-variant font-numeric-stat shrink-0 px-2">
                  {activeMessages.length.toLocaleString('fa-IR')} پیام
                </span>
              </header>

              {/* Scrollable Patterned Message Canvas — extends cleanly all the way to the bottom composer */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-3 sm:px-4 pt-3.5 pb-[118px] space-y-2.5"
              >
                {activeMessages.length === 0 ? (
                  <div className="py-12 text-center space-y-1.5">
                    <div className="w-12 h-12 mx-auto rounded-full bg-surface-container-lowest border border-outline-variant/55 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[24px]">chat</span>
                    </div>
                    <p className="text-[13px] font-bold text-on-surface mb-0">
                      هنوز پیامی در این مکالمه ثبت نشده است
                    </p>
                    <p className="text-[11.5px] text-on-surface-variant mb-0">
                      اولین پیام را بنویسید؛ پاسخ‌ها و تیک‌های خوانده‌شدن به‌صورت زنده ثبت می‌شوند.
                    </p>
                  </div>
                ) : (
                  activeMessages.map((m, idx) => {
                    const isMine = m.senderUserId === currentUser.id;
                    const dt = msToJalaliDateTime(m.createdAtMs);
                    const dateStr = formatJalaliDate(dt);
                    const timeStr = formatJalaliTime(dt.hour, dt.minute);
                    const prevDt =
                      idx > 0 ? msToJalaliDateTime(activeMessages[idx - 1].createdAtMs) : null;
                    const showDateChip = !prevDt || formatJalaliDate(prevDt) !== dateStr;
                    const senderRoleTitle = ROLE_DEFINITIONS[m.senderRole]?.shortTitle || 'کاربر';
                    const deliveryState = getMessageDeliveryState(m, currentUser.id);

                    return (
                      <React.Fragment key={m.id}>
                        {showDateChip && (
                          <div className="flex justify-center my-2">
                            <span className="px-3 py-0.5 rounded-full bg-surface-container-lowest/90 border border-outline-variant/50 text-[10.5px] font-semibold text-on-surface-variant font-numeric-stat">
                              {dateStr}
                            </span>
                          </div>
                        )}

                        {/* In RTL: justify-start pushes outgoing (mine) to the RIGHT; justify-end pushes incoming to the LEFT */}
                        <div
                          className={`group flex items-end gap-1.5 ${
                            isMine ? 'justify-start' : 'justify-end'
                          }`}
                        >
                          <div
                            className={`max-w-[85%] sm:max-w-[74%] px-3 py-2 border shadow-xs ${
                              isMine
                                ? 'bg-primary text-on-primary border-primary rounded-t-[14px] rounded-bl-[14px] rounded-br-[4px]'
                                : 'bg-surface-container-lowest text-on-surface border-outline-variant/60 rounded-t-[14px] rounded-br-[14px] rounded-bl-[4px]'
                            }`}
                          >
                            {/* Sender Attribution (shown on incoming messages or inside group threads) */}
                            {(!isMine || activeThread.kind === 'group') && (
                              <div className="flex items-center justify-between gap-3 mb-1">
                                <span
                                  className={`text-[11px] font-bold truncate ${
                                    isMine ? 'text-on-primary/90' : 'text-primary'
                                  }`}
                                >
                                  {isMine
                                    ? 'شما'
                                    : `${m.senderName} · ${senderRoleTitle}${
                                        m.senderUnitCode ? ` · واحد ${m.senderUnitCode}` : ''
                                      }`}
                                </span>
                              </div>
                            )}

                            {/* Quoted Reply Preview */}
                            {m.replyToSnippet && (
                              <div
                                className={`mb-1.5 px-2 py-1 rounded-[var(--ui-btn-radius)] border-r-2 text-[11px] ${
                                  isMine
                                    ? 'bg-white/15 border-white/75 text-on-primary/90'
                                    : 'bg-surface-container-low border-primary text-on-surface-variant'
                                }`}
                              >
                                <strong className="block text-[10.5px] font-bold">
                                  {m.replyToSender || 'پاسخ'}
                                </strong>
                                <span className="block truncate">{m.replyToSnippet}</span>
                              </div>
                            )}

                            {/* Attachment Thumbnail */}
                            {m.attachmentDataUrl && (
                              <button
                                type="button"
                                onClick={() => setZoomImage(m.attachmentDataUrl!)}
                                className="block mb-1.5 rounded-[var(--ui-btn-radius)] overflow-hidden border border-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                aria-label="بزرگنمایی تصویر پیوست"
                              >
                                <img
                                  src={m.attachmentDataUrl}
                                  alt="پیوست پیام"
                                  className="max-h-52 w-auto object-cover"
                                />
                              </button>
                            )}

                            {/* Message Body */}
                            <p
                              className={`text-[13px] leading-relaxed mb-1 whitespace-pre-wrap break-words ${
                                isMine ? 'text-on-primary' : 'text-on-surface'
                              }`}
                            >
                              {m.body}
                            </p>

                            {/* Footer: Reply shortcut + Time + Delivery/Read ticks */}
                            <div
                              className={`flex items-center justify-between gap-3 text-[10.5px] font-numeric-stat ${
                                isMine ? 'text-on-primary/80' : 'text-on-surface-variant'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyToMsg(m);
                                  window.setTimeout(() => inputRef.current?.focus(), 20);
                                }}
                                aria-label={`پاسخ به پیام ${m.senderName}`}
                                className={`inline-flex items-center gap-0.5 text-[10.5px] font-semibold hover:underline ${
                                  isMine ? 'text-on-primary/85' : 'text-primary'
                                }`}
                              >
                                <Reply size={12} />
                                <span>پاسخ</span>
                              </button>

                              <div className="flex items-center gap-1">
                                <span>{timeStr}</span>
                                {isMine && (
                                  <span
                                    title={deliveryState === 'read' ? 'خوانده شد' : 'تحویل داده شد'}
                                    className="inline-flex items-center"
                                  >
                                    {deliveryState === 'read' ? (
                                      <CheckCheck
                                        size={14}
                                        className="text-sky-200"
                                        strokeWidth={2.4}
                                      />
                                    ) : deliveryState === 'delivered' ? (
                                      <CheckCheck
                                        size={14}
                                        className="text-on-primary/80"
                                        strokeWidth={2.1}
                                      />
                                    ) : (
                                      <Check
                                        size={13}
                                        className="text-on-primary/75"
                                        strokeWidth={2.1}
                                      />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>

              {/* Floating Frosted Composer sitting above transparent dock strip */}
              <div className="chat-composer-dock pointer-events-none absolute inset-x-0 bottom-0 z-10 px-2.5 sm:px-3.5 pt-1">
                <div className="pointer-events-auto rounded-[var(--ui-card-radius)] border border-outline-variant/65 bg-surface-container-lowest/92 backdrop-blur-xl shadow-floating overflow-hidden">
                  {/* Quick Reply Strip */}
                  <div className="px-2.5 py-1.5 border-b border-outline-variant/35 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {quickReplies.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setDraft(q);
                          inputRef.current?.focus();
                        }}
                        className="px-2.5 py-1 rounded-[var(--ui-btn-radius)] bg-surface-container-low/85 hover:bg-primary-container/50 text-[11px] font-medium text-on-surface-variant hover:text-on-surface border border-outline-variant/45 whitespace-nowrap shrink-0 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  {/* Active Reply / Attachment Preview Banner */}
                  {(replyToMsg || attachmentDataUrl) && (
                    <div className="px-3 py-2 bg-surface-container-low/85 border-b border-outline-variant/40 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {attachmentDataUrl && (
                          <img
                            src={attachmentDataUrl}
                            alt="پیش‌نمایش پیوست"
                            className="w-10 h-10 rounded-[var(--ui-btn-radius)] object-cover border border-outline-variant/55 shrink-0"
                          />
                        )}
                        {replyToMsg && (
                          <div className="min-w-0 border-r-2 border-primary pr-2">
                            <strong className="text-[11px] font-bold text-primary block truncate">
                              پاسخ به {replyToMsg.senderName}
                            </strong>
                            <span className="text-[11px] text-on-surface-variant block truncate">
                              {replyToMsg.body}
                            </span>
                          </div>
                        )}
                        {!replyToMsg && attachmentDataUrl && (
                          <span className="text-[11.5px] font-semibold text-primary">
                            تصویر آماده ارسال به همراه پیام
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label="لغو پاسخ یا پیوست"
                        onClick={() => {
                          setReplyToMsg(null);
                          setAttachmentDataUrl('');
                        }}
                        className="w-8 h-8 rounded-[var(--ui-btn-radius)] hover:bg-surface-container text-on-surface-variant inline-flex items-center justify-center shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* Composer Bar */}
                  <form
                    onSubmit={handleSend}
                    className="p-2 flex items-center gap-2"
                  >
                    <label
                      aria-label="پیوست تصویر"
                      title="ارسال تصویر در گفتگو"
                      className="w-11 h-11 rounded-[var(--ui-btn-radius)] bg-surface-container-low/90 hover:bg-surface-container text-primary border border-outline-variant/50 inline-flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                    >
                      <ImagePlus size={18} />
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => void handlePickPhoto(e)}
                      />
                    </label>

                    <input
                      ref={inputRef}
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={`نوشتن پیام در ${activeThread.title}...`}
                      aria-label="متن پیام"
                      className="flex-1 min-w-0 h-11 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low/90 text-[13px] text-on-surface border border-outline-variant/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    />

                    <button
                      type="submit"
                      disabled={sending || (!draft.trim() && !attachmentDataUrl)}
                      aria-label="ارسال پیام"
                      className="h-11 px-4 rounded-[var(--ui-btn-radius)] bg-primary text-on-primary font-bold text-[12.5px] inline-flex items-center gap-1.5 hover:opacity-95 disabled:opacity-45 transition-opacity whitespace-nowrap shrink-0"
                    >
                      <Send size={15} className="rotate-180" />
                      <span>{sending ? '...' : 'ارسال'}</span>
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ==================== MODAL: START NEW DIRECT CHAT ==================== */}
      <StitchModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        title="شروع گفتگوی جدید"
        subtitle="مخاطب مجاز (مدیر، کادر یا ساکن) را برای ارسال پیام انتخاب کنید"
      >
        <div className="space-y-3">
          <div className="relative flex items-center">
            <Search
              size={15}
              className="text-on-surface-variant absolute right-3 pointer-events-none"
            />
            <input
              type="search"
              value={newChatSearch}
              onChange={(e) => setNewChatSearch(e.target.value)}
              placeholder="نام شخص، نقش یا شماره واحد..."
              className="w-full h-10 pr-9 pl-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] border border-outline-variant/55"
            />
          </div>

          <div className="max-h-[340px] overflow-y-auto divide-y divide-outline-variant/35">
            {filteredModalContacts.length === 0 ? (
              <p className="text-[12.5px] text-on-surface-variant text-center py-6 mb-0">
                مخاطبی با این عبارت یافت نشد.
              </p>
            ) : (
              filteredModalContacts.map((c) => (
                <button
                  key={c.userId}
                  type="button"
                  onClick={() => {
                    setNewChatOpen(false);
                    selectConversation(c.conversationId);
                  }}
                  className="w-full py-2.5 px-2 text-right flex items-center justify-between gap-2.5 hover:bg-surface-container-low rounded-[var(--ui-btn-radius)] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {c.avatarDataUrl ? (
                      <img
                        src={c.avatarDataUrl}
                        alt={c.displayName}
                        className="w-10 h-10 rounded-full object-cover border border-outline-variant/55 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container font-bold text-[12.5px] flex items-center justify-center shrink-0">
                        {getChatInitials(c.displayName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <strong className="text-[13px] font-bold text-on-surface block truncate">
                        {c.displayName}
                      </strong>
                      <span className="text-[11px] text-on-surface-variant block truncate">
                        {c.roleTitle}
                        {c.unitCode
                          ? ` · واحد ${c.unitCode}`
                          : c.blockId
                            ? ` · بلوک ${c.blockId}`
                            : ' · کل شهرک'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11.5px] font-bold text-primary shrink-0">
                    گفتگو
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </StitchModal>

      {/* ==================== MODAL: IMAGE ATTACHMENT LIGHTBOX ==================== */}
      <StitchModal
        open={Boolean(zoomImage)}
        onClose={() => setZoomImage(null)}
        title="تصویر پیوست گفتگو"
      >
        {zoomImage && (
          <img
            src={zoomImage}
            alt="بزرگنمایی تصویر پیوست"
            className="w-full max-h-[70vh] object-contain rounded-[var(--ui-btn-radius)] bg-surface-container-low"
          />
        )}
      </StitchModal>
    </div>
  );
};

export default ChatPage;
