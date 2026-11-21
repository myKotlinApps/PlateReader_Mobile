import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChatThreadList,
  buildDirectConversationId,
  buildGroupConversationId,
  canUserAccessGroup,
  canUserAccessMessage,
  canUsersDirectChat,
  CHAT_GROUPS,
  filterChatThreads,
  getMessageDeliveryState,
  type ChatContactSummary,
  type ChatMessageDoc,
} from './chatConversations';
import type { RbacUserRecord } from '../rbac/roles';

function makeUser(overrides: Partial<RbacUserRecord>): RbacUserRecord {
  return {
    id: 'u_test',
    username: 'test',
    displayName: 'کاربر تست',
    role: 'block_manager',
    blockId: 'B',
    unitCode: null,
    createdByUserId: null,
    isTemporary: false,
    validFromMs: null,
    validUntilMs: null,
    active: true,
    createdAtMs: 1000,
    ...overrides,
  };
}

test('buildDirectConversationId is symmetric regardless of argument order', () => {
  assert.equal(
    buildDirectConversationId('u_admin', 'u_block_b_mgr'),
    buildDirectConversationId('u_block_b_mgr', 'u_admin'),
  );
  assert.equal(buildDirectConversationId('u_b', 'u_a'), 'dm:u_a__u_b');
});

test('canUsersDirectChat allows managers to chat with each other and residents, while scoping residents safely', () => {
  const complexMgr = makeUser({ id: 'u_admin', role: 'complex_manager', blockId: null });
  const blockMgrB = makeUser({ id: 'u_bm_b', role: 'block_manager', blockId: 'B' });
  const blockMgrA = makeUser({ id: 'u_bm_a', role: 'block_manager', blockId: 'A' });
  const residentB = makeUser({ id: 'u_res_b', role: 'resident', blockId: 'B', unitCode: 'B-208' });
  const residentB2 = makeUser({ id: 'u_res_b2', role: 'resident', blockId: 'B', unitCode: 'B-302' });
  const residentA = makeUser({ id: 'u_res_a', role: 'resident', blockId: 'A', unitCode: 'A-101' });

  // Managers can chat with each other across blocks and with complex manager
  assert.equal(canUsersDirectChat(complexMgr, blockMgrB), true);
  assert.equal(canUsersDirectChat(blockMgrB, blockMgrA), true);
  assert.equal(canUsersDirectChat(blockMgrB, complexMgr), true);

  // Block B manager can chat with Block B resident, not Block A resident
  assert.equal(canUsersDirectChat(blockMgrB, residentB), true);
  assert.equal(canUsersDirectChat(blockMgrB, residentA), false);

  // Resident B can chat with Block B manager and Complex Manager, NOT other residents or Block A manager
  assert.equal(canUsersDirectChat(residentB, blockMgrB), true);
  assert.equal(canUsersDirectChat(residentB, complexMgr), true);
  assert.equal(canUsersDirectChat(residentB, residentB2), false);
  assert.equal(canUsersDirectChat(residentB, blockMgrA), false);
});

test('canUserAccessGroup scopes manager group and block groups accurately', () => {
  const mgrGroup = CHAT_GROUPS.find((g) => g.id === 'grp_managers')!;
  const blockBGroup = CHAT_GROUPS.find((g) => g.id === 'grp_block_B')!;

  const blockMgrB = makeUser({ id: 'u_bm_b', role: 'block_manager', blockId: 'B' });
  const residentB = makeUser({ id: 'u_res_b', role: 'resident', blockId: 'B', unitCode: 'B-208' });
  const residentA = makeUser({ id: 'u_res_a', role: 'resident', blockId: 'A', unitCode: 'A-101' });

  assert.equal(canUserAccessGroup(blockMgrB, mgrGroup), true);
  assert.equal(canUserAccessGroup(residentB, mgrGroup), false);
  assert.equal(canUserAccessGroup(residentB, blockBGroup), true);
  assert.equal(canUserAccessGroup(residentA, blockBGroup), false);
});

test('buildChatThreadList sorts latest messages first and calculates unread counts per user', () => {
  const currentUser = makeUser({ id: 'u_bm_b', role: 'block_manager', blockId: 'B' });
  const contacts: ChatContactSummary[] = [
    {
      userId: 'u_admin',
      displayName: 'مهندس شریفی',
      role: 'complex_manager',
      roleTitle: 'مدیر کل شهرک',
      blockId: null,
      unitCode: null,
      category: 'managers',
      conversationId: buildDirectConversationId('u_bm_b', 'u_admin'),
    },
    {
      userId: 'u_res_b208',
      displayName: 'آقای حسینی',
      role: 'resident',
      roleTitle: 'ساکن واحد',
      blockId: 'B',
      unitCode: 'B-208',
      category: 'residents',
      conversationId: buildDirectConversationId('u_bm_b', 'u_res_b208'),
    },
  ];
  const groups = [CHAT_GROUPS.find((g) => g.id === 'grp_managers')!];
  const messages: ChatMessageDoc[] = [
    {
      id: 'm1',
      conversationId: buildDirectConversationId('u_bm_b', 'u_admin'),
      kind: 'direct',
      senderUserId: 'u_admin',
      senderName: 'مهندس شریفی',
      senderRole: 'complex_manager',
      recipientUserId: 'u_bm_b',
      body: 'گزارش بلوک B آماده است؟',
      readByUserIds: ['u_admin'],
      createdAtMs: 2000,
    },
    {
      id: 'm2',
      conversationId: buildGroupConversationId('grp_managers'),
      kind: 'group',
      senderUserId: 'u_bm_b',
      senderName: 'دکتر فراهانی',
      senderRole: 'block_manager',
      body: 'بله ارسال شد.',
      readByUserIds: ['u_bm_b', 'u_admin'],
      createdAtMs: 5000,
    },
  ];

  const list = buildChatThreadList({ currentUser, contacts, groups, messages });
  assert.equal(list[0].conversationId, 'grp:grp_managers');
  assert.equal(list[0].unreadCount, 0);
  assert.equal(list[1].conversationId, buildDirectConversationId('u_bm_b', 'u_admin'));
  assert.equal(list[1].unreadCount, 1);
  assert.equal(list[2].conversationId, buildDirectConversationId('u_bm_b', 'u_res_b208'));
  assert.equal(list[2].unreadCount, 0);

  // Delivery tick state for outgoing message read by u_admin
  assert.equal(getMessageDeliveryState(messages[1], 'u_bm_b'), 'read');
  // Filter by category and Persian/digit query
  assert.equal(filterChatThreads(list, { category: 'managers', query: '' }).length, 1);
  assert.equal(filterChatThreads(list, { category: 'all', query: '۲۰۸' }).length, 1);
});

test('canUserAccessMessage blocks unauthorized users from private DMs', () => {
  const outsider = makeUser({ id: 'u_other', role: 'resident', blockId: 'B' });
  const dm: ChatMessageDoc = {
    id: 'dm1',
    conversationId: buildDirectConversationId('u_admin', 'u_bm_b'),
    kind: 'direct',
    senderUserId: 'u_admin',
    senderName: 'مدیر کل',
    senderRole: 'complex_manager',
    recipientUserId: 'u_bm_b',
    body: 'مذاکره داخلی مدیران',
    readByUserIds: ['u_admin'],
    createdAtMs: 1000,
  };
  assert.equal(canUserAccessMessage(outsider, dm), false);
});
