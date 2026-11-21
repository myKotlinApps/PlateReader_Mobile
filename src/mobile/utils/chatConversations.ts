import {
  canAccessBlock,
  ROLE_DEFINITIONS,
  type RbacUserRecord,
  type UserRoleId,
} from '../rbac/roles.ts';

export type ChatConversationKind = 'direct' | 'group';
export type ChatConversationCategory = 'all' | 'managers' | 'residents' | 'groups';

export interface ChatGroupDefinition {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  blockId?: string | null;
  allowedRoles: UserRoleId[];
}

export interface ChatMessageDoc {
  id: string;
  conversationId: string;
  kind: ChatConversationKind;
  senderUserId: string;
  senderName: string;
  senderRole: UserRoleId;
  senderUnitCode?: string | null;
  recipientUserId?: string | null;
  recipientName?: string | null;
  blockId?: string | null;
  unitCode?: string | null;
  body: string;
  attachmentDataUrl?: string;
  replyToId?: string;
  replyToSender?: string;
  replyToSnippet?: string;
  readByUserIds: string[];
  createdAtMs: number;
}

export interface ChatContactSummary {
  userId: string;
  displayName: string;
  role: UserRoleId;
  roleTitle: string;
  blockId: string | null;
  unitCode: string | null;
  avatarDataUrl?: string;
  category: 'managers' | 'residents';
  conversationId: string;
}

export interface ChatThreadSummary {
  conversationId: string;
  kind: ChatConversationKind;
  category: 'managers' | 'residents' | 'groups';
  title: string;
  subtitle: string;
  avatarText: string;
  avatarDataUrl?: string;
  role?: UserRoleId;
  blockId?: string | null;
  unitCode?: string | null;
  targetUserId?: string;
  groupId?: string;
  memberCount?: number;
  lastMessage: ChatMessageDoc | null;
  unreadCount: number;
}

export const CHAT_GROUPS: ChatGroupDefinition[] = [
  {
    id: 'grp_managers',
    title: 'گروه هماهنگی مدیران شهرک',
    subtitle: 'مدیر کل شهرک، مدیران بلوک‌ها، حسابداری و سرپرست تاسیسات',
    icon: 'corporate_fare',
    blockId: null,
    allowedRoles: [
      'complex_manager',
      'complex_accountant',
      'facilities_chief',
      'block_manager',
      'block_accountant',
    ],
  },
  {
    id: 'grp_operations',
    title: 'گروه عملیات، تاسیسات و انتظامات',
    subtitle: 'هماهنگی فوری گیت پلاک‌خوان، تاسیسات و سرایداران',
    icon: 'shield',
    blockId: null,
    allowedRoles: [
      'complex_manager',
      'facilities_chief',
      'block_manager',
      'block_facilities',
      'block_caretaker',
      'temp_caretaker',
      'gate_guard',
    ],
  },
  {
    id: 'grp_block_A',
    title: 'گروه ساکنین و مدیریت بلوک A',
    subtitle: 'اطلاع‌رسانی و همفکری اهالی و کادر بلوک A',
    icon: 'apartment',
    blockId: 'A',
    allowedRoles: [
      'complex_manager',
      'block_manager',
      'block_facilities',
      'block_caretaker',
      'resident',
    ],
  },
  {
    id: 'grp_block_B',
    title: 'گروه ساکنین و مدیریت بلوک B',
    subtitle: 'اطلاع‌رسانی و همفکری اهالی و کادر بلوک B',
    icon: 'apartment',
    blockId: 'B',
    allowedRoles: [
      'complex_manager',
      'block_manager',
      'block_facilities',
      'block_caretaker',
      'resident',
    ],
  },
  {
    id: 'grp_block_C',
    title: 'گروه ساکنین و مدیریت بلوک C',
    subtitle: 'اطلاع‌رسانی و همفکری اهالی و کادر بلوک C',
    icon: 'apartment',
    blockId: 'C',
    allowedRoles: [
      'complex_manager',
      'block_manager',
      'block_facilities',
      'block_caretaker',
      'resident',
    ],
  },
];

export function buildDirectConversationId(userIdA: string, userIdB: string): string {
  const [first, second] = [String(userIdA || '').trim(), String(userIdB || '').trim()].sort();
  return `dm:${first}__${second}`;
}

export function buildGroupConversationId(groupId: string): string {
  return `grp:${String(groupId || '').trim()}`;
}

export function canUserAccessGroup(
  user: Pick<RbacUserRecord, 'role' | 'blockId' | 'assignedBlocks' | 'caretakerBlockIds'>,
  group: ChatGroupDefinition,
): boolean {
  if (!group.allowedRoles.includes(user.role)) return false;
  if (!group.blockId) return true;
  if (ROLE_DEFINITIONS[user.role]?.scopeLevel === 'complex') return true;
  return canAccessBlock(user, group.blockId);
}

export function canUsersDirectChat(
  viewer: Pick<RbacUserRecord, 'id' | 'role' | 'blockId' | 'assignedBlocks' | 'caretakerBlockIds'>,
  target: Pick<RbacUserRecord, 'id' | 'role' | 'blockId' | 'assignedBlocks' | 'caretakerBlockIds' | 'active'>,
): boolean {
  if (!target.active || viewer.id === target.id) return false;

  const viewerScope = ROLE_DEFINITIONS[viewer.role]?.scopeLevel;
  const targetScope = ROLE_DEFINITIONS[target.role]?.scopeLevel;

  if (viewerScope === 'complex' || viewer.role === 'gate_guard') {
    return true;
  }

  if (viewer.role === 'resident') {
    if (target.role === 'resident') return false;
    if (targetScope === 'complex' || target.role === 'gate_guard') return true;
    return Boolean(viewer.blockId && canAccessBlock(target, viewer.blockId));
  }

  // Block-level staff & managers:
  // 1) Can talk to complex-level roles and gate guards
  if (targetScope === 'complex' || target.role === 'gate_guard') return true;
  // 2) Managers can talk directly with other block managers across blocks
  if (viewer.role === 'block_manager' && target.role === 'block_manager') return true;
  // 3) Can talk to staff and residents in blocks they have access to
  if (target.blockId && canAccessBlock(viewer, target.blockId)) return true;
  if (viewer.blockId && canAccessBlock(target, viewer.blockId)) return true;

  return false;
}

export function canUserAccessMessage(
  user: Pick<RbacUserRecord, 'id' | 'role' | 'blockId' | 'assignedBlocks' | 'caretakerBlockIds'>,
  msg: ChatMessageDoc,
  groups: ChatGroupDefinition[] = CHAT_GROUPS,
): boolean {
  if (msg.kind === 'direct') {
    return msg.senderUserId === user.id || msg.recipientUserId === user.id;
  }
  const grpId = msg.conversationId.replace(/^grp:/, '');
  const group = groups.find((g) => g.id === grpId);
  if (!group) return false;
  return canUserAccessGroup(user, group);
}

export function getChatInitials(name: string): string {
  const clean = String(name || '?')
    .replace(/\(.*?\)/g, '')
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`;
  return (parts[0] || '?').slice(0, 2);
}

export function getMessageDeliveryState(
  msg: Pick<ChatMessageDoc, 'senderUserId' | 'recipientUserId' | 'readByUserIds'>,
  currentUserId: string,
): 'read' | 'delivered' | 'sent' {
  if (msg.senderUserId !== currentUserId) return 'read';
  const readers = (msg.readByUserIds || []).filter((id) => id !== currentUserId);
  if (readers.length > 0) return 'read';
  return 'delivered';
}

export function buildChatThreadList(params: {
  currentUser: Pick<RbacUserRecord, 'id' | 'role' | 'blockId' | 'assignedBlocks' | 'caretakerBlockIds'>;
  contacts: ChatContactSummary[];
  groups: Array<ChatGroupDefinition & { memberCount?: number }>;
  messages: ChatMessageDoc[];
}): ChatThreadSummary[] {
  const { currentUser, contacts, groups, messages } = params;
  const byConv = new Map<string, ChatMessageDoc[]>();

  for (const m of messages) {
    const arr = byConv.get(m.conversationId) ?? [];
    arr.push(m);
    byConv.set(m.conversationId, arr);
  }

  const threads: ChatThreadSummary[] = [];

  for (const g of groups) {
    const convId = buildGroupConversationId(g.id);
    const msgs = [...(byConv.get(convId) ?? [])].sort((a, b) => a.createdAtMs - b.createdAtMs);
    const lastMessage = msgs[msgs.length - 1] ?? null;
    const unreadCount = msgs.filter(
      (m) => m.senderUserId !== currentUser.id && !(m.readByUserIds || []).includes(currentUser.id),
    ).length;

    threads.push({
      conversationId: convId,
      kind: 'group',
      category: 'groups',
      title: g.title,
      subtitle: g.subtitle,
      avatarText: g.blockId ? `ب${g.blockId}` : 'گ',
      blockId: g.blockId ?? null,
      groupId: g.id,
      memberCount: g.memberCount,
      lastMessage,
      unreadCount,
    });
  }

  for (const c of contacts) {
    const msgs = [...(byConv.get(c.conversationId) ?? [])].sort(
      (a, b) => a.createdAtMs - b.createdAtMs,
    );
    const lastMessage = msgs[msgs.length - 1] ?? null;
    const unreadCount = msgs.filter(
      (m) => m.senderUserId !== currentUser.id && !(m.readByUserIds || []).includes(currentUser.id),
    ).length;

    const unitSuffix = c.unitCode ? ` • واحد ${c.unitCode}` : c.blockId ? ` • بلوک ${c.blockId}` : '';

    threads.push({
      conversationId: c.conversationId,
      kind: 'direct',
      category: c.category,
      title: c.displayName,
      subtitle: `${c.roleTitle}${unitSuffix}`,
      avatarText: getChatInitials(c.displayName),
      avatarDataUrl: c.avatarDataUrl,
      role: c.role,
      blockId: c.blockId,
      unitCode: c.unitCode,
      targetUserId: c.userId,
      lastMessage,
      unreadCount,
    });
  }

  // Sort: threads with messages first (newest on top), then groups, then managers, then residents
  return threads.sort((a, b) => {
    const ta = a.lastMessage?.createdAtMs ?? 0;
    const tb = b.lastMessage?.createdAtMs ?? 0;
    if (ta !== tb) return tb - ta;
    const rank = (t: ChatThreadSummary) =>
      t.kind === 'group' ? 0 : t.category === 'managers' ? 1 : 2;
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.title.localeCompare(b.title, 'fa');
  });
}

function normalizeSearchText(raw: string): string {
  return String(raw || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .trim()
    .toLowerCase();
}

export function filterChatThreads(
  threads: ChatThreadSummary[],
  opts: { category: ChatConversationCategory; query: string },
): ChatThreadSummary[] {
  const q = normalizeSearchText(opts.query);
  return threads.filter((t) => {
    if (opts.category !== 'all' && t.category !== opts.category) {
      return false;
    }
    if (!q) return true;
    const hay = normalizeSearchText(
      `${t.title} ${t.subtitle} ${t.unitCode || ''} ${t.lastMessage?.body || ''}`,
    );
    return hay.includes(q);
  });
}
