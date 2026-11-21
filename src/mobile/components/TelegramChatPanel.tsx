import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, Send } from 'lucide-react';
import type { ResidentMessageDoc, UnitDoc } from '../../server/nosqlStore';
import { ROLE_DEFINITIONS, type RbacUserRecord } from '../rbac/roles';
import { formatJalaliDate, formatJalaliTime, msToJalaliDateTime } from '../utils/jalaliDate';

interface Props {
  currentUser: RbacUserRecord;
  messages: ResidentMessageDoc[];
  /** Resident mode = 1-on-1 chat with Block Manager; Manager mode = multi-unit Telegram conversations */
  mode: 'resident' | 'manager';
  counterpartTitle?: string;
  counterpartSubtitle?: string;
  /** Units available for Manager mode conversation switcher */
  units?: UnitDoc[];
  selectedUnitCode?: string;
  onSelectUnitCode?: (unitCode: string) => void;
  onSendMessage: (body: string, unitCode?: string) => Promise<void>;
  onMarkRead?: (unitCode?: string) => void;
  sending?: boolean;
}

function getInitials(name: string): string {
  const parts = String(name || '?').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`;
  return (parts[0] || '?').slice(0, 2);
}

const QUICK_REPLIES_RESIDENT = [
  'فیش شارژ این ماه ارسال شد.',
  'لطفاً زمان حضور تکنسین را هماهنگ بفرمایید.',
  'با تشکر از پیگیری شما.',
];

const QUICK_REPLIES_MANAGER = [
  'پیام شما دریافت شد، پیگیری می‌کنیم.',
  'سرایدار بلوک برای بررسی اعزام شد.',
  'انجام شد و در سیستم ثبت گردید.',
];

export const TelegramChatPanel: React.FC<Props> = ({
  currentUser,
  messages,
  mode,
  counterpartTitle,
  counterpartSubtitle,
  units = [],
  selectedUnitCode,
  onSelectUnitCode,
  onSendMessage,
  onMarkRead,
  sending = false,
}) => {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Build clean per-unit conversation list for Manager mode
  const threads = useMemo(() => {
    if (mode !== 'manager') return [];
    const map = new Map<
      string,
      {
        unitCode: string;
        residentName: string;
        lastMsg: ResidentMessageDoc | null;
        unreadCount: number;
      }
    >();

    for (const u of units) {
      map.set(u.unitCode, {
        unitCode: u.unitCode,
        residentName: u.residentName,
        lastMsg: null,
        unreadCount: 0,
      });
    }

    for (const m of messages) {
      const existing = map.get(m.unitCode) ?? {
        unitCode: m.unitCode,
        residentName: m.residentName,
        lastMsg: null,
        unreadCount: 0,
      };
      if (!existing.lastMsg || m.createdAtMs >= existing.lastMsg.createdAtMs) {
        existing.lastMsg = m;
      }
      if (m.senderUserId !== currentUser.id && m.deliveryStatus !== 'read') {
        existing.unreadCount += 1;
      }
      map.set(m.unitCode, existing);
    }

    return Array.from(map.values()).sort((a, b) => {
      const ta = a.lastMsg?.createdAtMs ?? 0;
      const tb = b.lastMsg?.createdAtMs ?? 0;
      return tb - ta;
    });
  }, [mode, units, messages, currentUser.id]);

  const activeUnit =
    mode === 'manager'
      ? selectedUnitCode || threads[0]?.unitCode || units[0]?.unitCode || 'B-208'
      : currentUser.unitCode || 'B-208';

  const activeThreadInfo = useMemo(
    () => threads.find((t) => t.unitCode === activeUnit),
    [threads, activeUnit],
  );

  const visibleMessages = useMemo(() => {
    const filtered =
      mode === 'manager'
        ? messages.filter((m) => m.unitCode === activeUnit)
        : messages;
    return [...filtered].sort((a, b) => a.createdAtMs - b.createdAtMs);
  }, [messages, mode, activeUnit]);

  // Mark incoming messages as read when opening/switching thread
  useEffect(() => {
    const hasUnread = visibleMessages.some(
      (m) => m.senderUserId !== currentUser.id && m.deliveryStatus !== 'read',
    );
    if (hasUnread && onMarkRead) {
      onMarkRead(mode === 'manager' ? activeUnit : undefined);
    }
  }, [visibleMessages, currentUser.id, mode, activeUnit, onMarkRead]);

  // Auto-scroll to newest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleMessages.length, activeUnit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    await onSendMessage(text, mode === 'manager' ? activeUnit : undefined);
  };

  const headerName =
    mode === 'manager'
      ? activeThreadInfo
        ? `واحد ${activeThreadInfo.unitCode} — ${activeThreadInfo.residentName}`
        : `واحد ${activeUnit}`
      : counterpartTitle || `مدیر بلوک ${currentUser.blockId || 'B'}`;

  const headerSub =
    mode === 'manager'
      ? `گفتگوی مستقیم با ساکن واحد ${activeUnit} • پاسخ‌گویی رسمی`
      : counterpartSubtitle || `کانال ارتباط مستقیم واحد ${currentUser.unitCode || ''} با مدیریت بلوک`;

  const quickReplies = mode === 'manager' ? QUICK_REPLIES_MANAGER : QUICK_REPLIES_RESIDENT;

  return (
    <div
      className="rounded-[var(--ui-card-radius)] border border-outline-variant/65 bg-surface-container-lowest overflow-hidden shadow-card"
      dir="rtl"
    >
      {/* Manager Mode: Horizontal Telegram-style Thread Selector */}
      {mode === 'manager' && threads.length > 0 && (
        <div className="bg-surface-container-low/90 border-b border-outline-variant/50 px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-on-surface-variant shrink-0">
            گفتگوها:
          </span>
          {threads.map((th) => {
            const isSel = th.unitCode === activeUnit;
            return (
              <button
                key={th.unitCode}
                type="button"
                onClick={() => onSelectUnitCode?.(th.unitCode)}
                className={`px-2.5 py-1.5 rounded-[var(--ui-btn-radius)] border text-right flex items-center gap-2 shrink-0 transition-colors ${
                  isSel
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-lowest text-on-surface border-outline-variant/55 hover:border-primary/60'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full text-[10.5px] font-extrabold flex items-center justify-center shrink-0 ${
                    isSel ? 'bg-white/20 text-on-primary' : 'bg-primary-container text-on-primary-container'
                  }`}
                >
                  {getInitials(th.residentName)}
                </span>
                <div className="min-w-0">
                  <strong className="text-[11.5px] font-bold block leading-tight">
                    واحد {th.unitCode}
                  </strong>
                  <span
                    className={`text-[10px] block truncate max-w-[92px] ${
                      isSel ? 'text-on-primary/85' : 'text-on-surface-variant'
                    }`}
                  >
                    {th.residentName}
                  </span>
                </div>
                {th.unreadCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-bold inline-flex items-center justify-center">
                    {th.unreadCount.toLocaleString('fa-IR')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Telegram-Style Chat Header */}
      <div className="px-3.5 py-2.5 bg-surface-container-lowest border-b border-outline-variant/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-primary text-on-primary font-extrabold text-[13.5px] flex items-center justify-center shadow-sm">
              {getInitials(headerName)}
            </div>
            <span
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface-container-lowest absolute bottom-0 left-0"
              title="آنلاین"
            />
          </div>
          <div className="min-w-0">
            <strong className="text-[13.5px] font-bold text-on-surface block truncate">
              {headerName}
            </strong>
            <span className="text-[11px] text-secondary font-medium block truncate">
              آنلاین • {headerSub}
            </span>
          </div>
        </div>

        <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container-low px-2 py-1 rounded-[var(--ui-btn-radius)] border border-outline-variant/45 shrink-0">
          {visibleMessages.length.toLocaleString('fa-IR')} پیام
        </span>
      </div>

      {/* Telegram-Style Patterned Chat Canvas */}
      <div
        ref={scrollRef}
        className="px-3 py-3.5 space-y-2.5 max-h-[380px] min-h-[240px] overflow-y-auto"
        style={{
          backgroundColor: 'var(--color-surface-container-low)',
          backgroundImage:
            'radial-gradient(color-mix(in srgb, var(--color-primary) 9%, transparent) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        {visibleMessages.length === 0 ? (
          <div className="py-10 text-center space-y-1.5">
            <div className="w-11 h-11 mx-auto rounded-full bg-surface-container-lowest border border-outline-variant/55 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">forum</span>
            </div>
            <p className="text-[12.5px] font-semibold text-on-surface mb-0">
              گفتگویی در این مکالمه ثبت نشده است
            </p>
            <p className="text-[11.5px] text-on-surface-variant mb-0">
              اولین پیام را بنویسید؛ وضعیت تحویل و خوانده‌شدن (تیک دلیور) به‌صورت زنده نمایش داده می‌شود.
            </p>
          </div>
        ) : (
          visibleMessages.map((m, idx) => {
            const isMine = m.senderUserId === currentUser.id;
            const dt = msToJalaliDateTime(m.createdAtMs);
            const dateStr = formatJalaliDate(dt);
            const timeStr = formatJalaliTime(dt.hour, dt.minute);
            const prevDt = idx > 0 ? msToJalaliDateTime(visibleMessages[idx - 1].createdAtMs) : null;
            const showDateChip = !prevDt || formatJalaliDate(prevDt) !== dateStr;
            const roleTitle = ROLE_DEFINITIONS[m.senderRole]?.shortTitle || 'کاربر';
            const status = m.deliveryStatus || 'delivered';

            return (
              <React.Fragment key={m.id}>
                {showDateChip && (
                  <div className="flex justify-center my-1.5">
                    <span className="px-3 py-0.5 rounded-full bg-surface-container-lowest/90 border border-outline-variant/50 text-[10.5px] font-semibold text-on-surface-variant font-numeric-stat shadow-xs">
                      {dateStr}
                    </span>
                  </div>
                )}

                <div className={`flex items-end gap-2 ${isMine ? 'justify-start' : 'justify-end'}`}>
                  {/* Incoming Avatar (on left in RTL, so rendered when !isMine on the end side? Wait: in RTL justify-start = RIGHT side! Outgoing = RIGHT (justify-start), Incoming = LEFT (justify-end)!) */}
                  <div
                    className={`max-w-[84%] sm:max-w-[76%] px-3 py-2 border shadow-xs ${
                      isMine
                        ? 'bg-primary text-on-primary border-primary rounded-t-[12px] rounded-bl-[12px] rounded-br-[2px]'
                        : 'bg-surface-container-lowest text-on-surface border-outline-variant/60 rounded-t-[12px] rounded-br-[12px] rounded-bl-[2px]'
                    }`}
                  >
                    {/* Explicit Sender -> Recipient Identification Header */}
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span
                        className={`text-[11px] font-bold truncate ${
                          isMine ? 'text-on-primary/95' : 'text-primary'
                        }`}
                      >
                        {isMine
                          ? `شما (${roleTitle})`
                          : `${m.senderName} • ${roleTitle}`}
                      </span>
                      <span
                        className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded-[var(--ui-btn-radius)] ${
                          isMine
                            ? 'bg-white/15 text-on-primary/90'
                            : 'bg-surface-container-low text-on-surface-variant'
                        }`}
                      >
                        {isMine
                          ? `به: ${m.recipientName || (mode === 'resident' ? 'مدیر بلوک' : `واحد ${m.unitCode}`)}`
                          : `واحد ${m.unitCode}`}
                      </span>
                    </div>

                    {/* Message Body */}
                    <p
                      className={`text-[13px] leading-relaxed mb-1 whitespace-pre-wrap break-words ${
                        isMine ? 'text-on-primary' : 'text-on-surface'
                      }`}
                    >
                      {m.body}
                    </p>

                    {/* Timestamp + Telegram Delivery / Read Ticks */}
                    <div
                      className={`flex items-center justify-end gap-1.5 text-[10.5px] font-numeric-stat ${
                        isMine ? 'text-on-primary/80' : 'text-on-surface-variant'
                      }`}
                    >
                      <span>{timeStr}</span>
                      {isMine && (
                        <span
                          className="inline-flex items-center gap-0.5"
                          title={
                            status === 'read'
                              ? 'خوانده شد'
                              : status === 'delivered'
                                ? 'تحویل داده شد'
                                : 'ارسال شد'
                          }
                        >
                          {status === 'read' ? (
                            <>
                              <CheckCheck size={14} className="text-sky-200" strokeWidth={2.4} />
                              <span className="text-[9.5px] text-sky-100 font-semibold">خوانده شد</span>
                            </>
                          ) : status === 'delivered' ? (
                            <>
                              <CheckCheck size={14} className="text-on-primary/80" strokeWidth={2.2} />
                              <span className="text-[9.5px]">تحویل شد</span>
                            </>
                          ) : (
                            <>
                              <Check size={13} className="text-on-primary/75" strokeWidth={2.2} />
                              <span className="text-[9.5px]">ارسال شد</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Quick Reply Chips */}
      <div className="px-3 py-1.5 bg-surface-container-lowest border-t border-outline-variant/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {quickReplies.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setDraft(q)}
            className="px-2.5 py-1 rounded-[var(--ui-btn-radius)] bg-surface-container-low hover:bg-primary-container/50 text-[11px] font-medium text-on-surface-variant hover:text-on-surface border border-outline-variant/45 whitespace-nowrap transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Telegram-Style Composer Bar */}
      <form
        onSubmit={handleSubmit}
        className="p-2.5 bg-surface-container-lowest border-t border-outline-variant/50 flex items-center gap-2"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            mode === 'manager'
              ? `نوشتن پاسخ برای واحد ${activeUnit}...`
              : 'پیام خود را بنویسید...'
          }
          className="flex-1 h-10 px-3 rounded-[var(--ui-btn-radius)] bg-surface-container-low text-[13px] text-on-surface border border-outline-variant/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label="ارسال پیام"
          className="h-10 px-3.5 rounded-[var(--ui-btn-radius)] bg-primary text-on-primary font-bold text-[12.5px] inline-flex items-center gap-1.5 hover:opacity-95 disabled:opacity-45 transition-opacity shrink-0"
        >
          <Send size={15} className="rotate-180" />
          <span>{sending ? '...' : 'ارسال'}</span>
        </button>
      </form>
    </div>
  );
};
