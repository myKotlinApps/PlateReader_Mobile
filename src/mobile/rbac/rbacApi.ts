import { beginNetworkFetch, endNetworkFetch } from '../ui/ComplexSpinner';
import type {
  BlockSharePermission,
  RbacUserRecord,
  RoleDefinition,
  TempDurationPreset,
  UserRoleId,
} from './roles';
import type { JournalEntry, SayadiCheck } from '../accounting/accountingEngine';
import type {
  BlockDoc,
  BlockNoticeDoc,
  CaretakerTaskDoc,
  ExcelBankPatternDoc,
  ExcelImportBatchDoc,
  GuestPermitDoc,
  PaymentReceiptDoc,
  ResidentMessageDoc,
  ResidentRequestDoc,
  UnitDoc,
} from '../../server/nosqlStore';
import type {
  ApprovedVehicleDoc,
  ResidentOnboardingPayload,
  ResidentSubmissionDoc,
  UnitInviteCodeDoc,
} from '../utils/residentOnboarding';

export interface RoleDirectoryCard {
  roleId: UserRoleId;
  title: string;
  shortTitle: string;
  group: 'complex' | 'block' | 'security' | 'resident';
  groupLabel: string;
  description: string;
  icon: string;
  dockLabels: string[];
  canCreateCount: number;
  sampleUsername: string;
  sampleDisplayName: string;
  blockId: string | null;
  unitCode: string | null;
  isTemporary: boolean;
  accessDurationLabel: string | null;
  remainingMs: number | null;
}

export interface RbacSessionState {
  token: string;
  user: RbacUserRecord;
  roleDef: RoleDefinition;
  remainingMs: number | null;
}

export interface EnrichedBlockDoc extends BlockDoc {
  registeredUnits: number;
  settledUnits: number;
  totalDebtTomans: number;
  staffCount: number;
  openTasksCount: number;
  openRequestsCount: number;
}

export interface ListedUserDoc extends RbacUserRecord {
  isCurrentlyActive: boolean;
  remainingMs: number | null;
}

export interface RbacCounters {
  pendingTasks: number;
  openRequests: number;
  pendingReceipts: number;
  pendingPermits: number;
  noticesCount: number;
}

// Session Bearer token held strictly in memory (SPA navigation preserves it without localStorage exposure)
let memorySessionToken = '';

export function setRbacToken(token: string): void {
  memorySessionToken = token;
}

export function getRbacToken(): string {
  return memorySessionToken;
}

export function clearRbacToken(): void {
  memorySessionToken = '';
}

async function rbacRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  beginNetworkFetch();
  try {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (memorySessionToken) {
      headers.set('Authorization', `Bearer ${memorySessionToken}`);
    }
    const resp = await fetch(path, {
      ...init,
      headers,
      cache: 'no-store',
    });
    const data = (await resp.json().catch(() => ({}))) as T & {
      error?: { message?: string; code?: string };
    };
    if (!resp.ok) {
      throw new Error(data?.error?.message || `خطای سرور (${resp.status})`);
    }
    return data;
  } finally {
    endNetworkFetch();
  }
}

export const rbacApi = {
  getRolesDirectory: () =>
    rbacRequest<{
      ok: boolean;
      storageEngine: string;
      totalUsers: number;
      blocks: BlockDoc[];
      cards: RoleDirectoryCard[];
    }>('/api/v1/rbac/roles-directory'),

  loginWithPassword: async (username: string, password: string): Promise<RbacSessionState> => {
    const res = await rbacRequest<RbacSessionState & { ok: boolean }>('/api/v1/rbac/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setRbacToken(res.token);
    return res;
  },

  loginQuickRole: async (quickRoleId: UserRoleId): Promise<RbacSessionState> => {
    const res = await rbacRequest<RbacSessionState & { ok: boolean }>('/api/v1/rbac/login', {
      method: 'POST',
      body: JSON.stringify({ quickRoleId }),
    });
    setRbacToken(res.token);
    return res;
  },

  getMe: () =>
    rbacRequest<{
      ok: boolean;
      user: RbacUserRecord;
      roleDef: RoleDefinition;
      remainingMs: number | null;
      counters: RbacCounters;
      latestNotice: BlockNoticeDoc | null;
    }>('/api/v1/rbac/me'),

  getBlocks: () =>
    rbacRequest<{
      ok: boolean;
      blocks: EnrichedBlockDoc[];
      units: UnitDoc[];
    }>('/api/v1/rbac/blocks'),

  listUsers: () =>
    rbacRequest<{
      ok: boolean;
      items: ListedUserDoc[];
      creatableRoles: UserRoleId[];
    }>('/api/v1/rbac/users'),

  createUser: (payload: {
    username: string;
    password: string;
    displayName: string;
    role: UserRoleId;
    blockId?: string | null;
    unitCode?: string | null;
    phone?: string;
    isTemporary?: boolean;
    durationPreset?: TempDurationPreset;
    customFromMs?: number;
    customUntilMs?: number;
  }) =>
    rbacRequest<{ ok: boolean; user: RbacUserRecord }>('/api/v1/rbac/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUser: (
    id: string,
    payload: {
      active?: boolean;
      username?: string;
      password?: string;
      displayName?: string;
      phone?: string;
      extendHours?: number;
      durationPreset?: TempDurationPreset;
      customFromMs?: number;
      customUntilMs?: number;
    },
  ) =>
    rbacRequest<{ ok: boolean; user: RbacUserRecord | null }>(
      `/api/v1/rbac/users/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),

  listTasks: () =>
    rbacRequest<{ ok: boolean; items: CaretakerTaskDoc[] }>('/api/v1/rbac/tasks'),

  createTask: (payload: {
    title: string;
    description?: string;
    category?: CaretakerTaskDoc['category'];
    priority?: 'normal' | 'urgent';
    assignedToUserId: string;
    dueLabel?: string;
    blockId?: string;
  }) =>
    rbacRequest<{ ok: boolean; task: CaretakerTaskDoc }>('/api/v1/rbac/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTask: (
    id: string,
    payload: {
      status?: CaretakerTaskDoc['status'];
      completionNote?: string;
      completionPhoto?: string;
      reviewNote?: string;
    },
  ) =>
    rbacRequest<{ ok: boolean; task: CaretakerTaskDoc }>(
      `/api/v1/rbac/tasks/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),

  listResidentRequests: () =>
    rbacRequest<{ ok: boolean; items: ResidentRequestDoc[] }>('/api/v1/rbac/resident-requests'),

  createResidentRequest: (payload: {
    type?: 'maintenance' | 'common_area' | 'complaint';
    category?: string;
    title: string;
    description?: string;
    photoDataUrl?: string;
    unitCode?: string;
  }) =>
    rbacRequest<{ ok: boolean; request: ResidentRequestDoc }>('/api/v1/rbac/resident-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateResidentRequest: (
    id: string,
    payload: {
      status?: 'open' | 'assigned' | 'in_progress' | 'resolved';
      assignedToUserId?: string;
      managerReply?: string;
    },
  ) =>
    rbacRequest<{ ok: boolean; request: ResidentRequestDoc }>(
      `/api/v1/rbac/resident-requests/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    ),

  listMessages: () =>
    rbacRequest<{ ok: boolean; items: ResidentMessageDoc[] }>('/api/v1/rbac/resident-messages'),

  sendMessage: (payload: { body: string; unitCode?: string; residentUserId?: string }) =>
    rbacRequest<{ ok: boolean; message: ResidentMessageDoc }>('/api/v1/rbac/resident-messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  markMessagesRead: (unitCode?: string) =>
    rbacRequest<{ ok: boolean; updatedCount: number }>('/api/v1/rbac/resident-messages/mark-read', {
      method: 'POST',
      body: JSON.stringify({ unitCode }),
    }),

  listGuestPermits: () =>
    rbacRequest<{ ok: boolean; items: GuestPermitDoc[] }>('/api/v1/rbac/guest-permits'),

  createGuestPermit: (payload: {
    guestName: string;
    plateText: string;
    visitDateLabel?: string;
    validHours?: number;
    note?: string;
    unitCode?: string;
  }) =>
    rbacRequest<{ ok: boolean; permit: GuestPermitDoc }>('/api/v1/rbac/guest-permits', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateGuestPermit: (id: string, status: 'entered' | 'exited' | 'cancelled') =>
    rbacRequest<{ ok: boolean; permit: GuestPermitDoc }>(
      `/api/v1/rbac/guest-permits/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    ),

  listReceipts: () =>
    rbacRequest<{ ok: boolean; items: PaymentReceiptDoc[] }>('/api/v1/rbac/receipts'),

  createReceipt: (payload: {
    amountTomans: number;
    traceCode: string;
    channel?: PaymentReceiptDoc['channel'];
    bankAccountCode?: '1102' | '1103';
    note?: string;
    receiptPhotoDataUrl?: string;
    unitCode?: string;
  }) =>
    rbacRequest<{ ok: boolean; receipt: PaymentReceiptDoc }>('/api/v1/rbac/receipts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reviewReceipt: (id: string, decision: 'approved' | 'rejected', reviewNote?: string) =>
    rbacRequest<{ ok: boolean; receipt: PaymentReceiptDoc; voucher: JournalEntry | null }>(
      `/api/v1/rbac/receipts/${encodeURIComponent(id)}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ decision, reviewNote }),
      },
    ),

  listNotices: () =>
    rbacRequest<{ ok: boolean; items: BlockNoticeDoc[] }>('/api/v1/rbac/notices'),

  createNotice: (payload: {
    blockId?: string;
    targetUnitCode?: string;
    title: string;
    body: string;
    severity?: 'info' | 'warning' | 'urgent';
  }) =>
    rbacRequest<{ ok: boolean; notice: BlockNoticeDoc }>('/api/v1/rbac/notices', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAccounting: (blockId?: string) =>
    rbacRequest<{
      ok: boolean;
      accessibleBlocks: BlockDoc[];
      entries: JournalEntry[];
      checks: SayadiCheck[];
      receipts: PaymentReceiptDoc[];
      units: UnitDoc[];
    }>(blockId ? `/api/v1/rbac/accounting?blockId=${encodeURIComponent(blockId)}` : '/api/v1/rbac/accounting'),

  createJournalEntry: (entry: Omit<JournalEntry, 'id' | 'voucherNo'>) =>
    rbacRequest<{ ok: boolean; entry: JournalEntry }>('/api/v1/rbac/accounting/entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),

  finalizeJournalEntry: (id: string) =>
    rbacRequest<{ ok: boolean; entry: JournalEntry }>(
      `/api/v1/rbac/accounting/entries/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'final' }),
      },
    ),

  createSayadiCheck: (payload: {
    sayadiId?: string;
    payee: string;
    bankName?: string;
    dueDate?: string;
    amountTomans: number;
    expenseAccountCode?: string;
  }) =>
    rbacRequest<{ ok: boolean; check: SayadiCheck; voucher: JournalEntry }>(
      '/api/v1/rbac/accounting/checks',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  clearSayadiCheck: (id: string) =>
    rbacRequest<{ ok: boolean; check: SayadiCheck; voucher: JournalEntry }>(
      `/api/v1/rbac/accounting/checks/${encodeURIComponent(id)}/clear`,
      {
        method: 'POST',
      },
    ),

  listShareableStaff: () =>
    rbacRequest<{ ok: boolean; items: RbacUserRecord[] }>('/api/v1/rbac/shareable-staff'),

  shareBlockWithStaff: (
    blockId: string,
    payload: { userId: string; permissions: BlockSharePermission[] },
  ) =>
    rbacRequest<{ ok: boolean; user: RbacUserRecord | null }>(
      `/api/v1/rbac/blocks/${encodeURIComponent(blockId)}/share`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  revokeBlockShare: (blockId: string, userId: string) =>
    rbacRequest<{ ok: boolean; user: RbacUserRecord | null }>(
      `/api/v1/rbac/blocks/${encodeURIComponent(blockId)}/share/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      },
    ),

  listExcelPatterns: () =>
    rbacRequest<{ ok: boolean; items: ExcelBankPatternDoc[] }>('/api/v1/rbac/excel-patterns'),

  createExcelPattern: (payload: Omit<ExcelBankPatternDoc, 'id' | 'createdByUserId' | 'createdByName' | 'createdAtMs'>) =>
    rbacRequest<{ ok: boolean; pattern: ExcelBankPatternDoc }>('/api/v1/rbac/excel-patterns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteExcelPattern: (id: string) =>
    rbacRequest<{ ok: boolean }>(`/api/v1/rbac/excel-patterns/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  listExcelImports: (blockId?: string) =>
    rbacRequest<{ ok: boolean; items: ExcelImportBatchDoc[] }>(
      blockId ? `/api/v1/rbac/excel-imports?blockId=${encodeURIComponent(blockId)}` : '/api/v1/rbac/excel-imports',
    ),

  commitExcelImport: (payload: {
    blockId: string;
    periodLabel: string;
    patternName: string;
    fileName: string;
    bankAccountCode: '1102' | '1103';
    matchedRows: Array<{
      unitId: string;
      unitCode: string;
      residentName: string;
      amountTomans: number;
      depositDate: string;
      traceCode: string;
      statusLabel: string;
      customRecord?: Record<string, string>;
    }>;
  }) =>
    rbacRequest<{ ok: boolean; batch: ExcelImportBatchDoc; voucher: JournalEntry }>(
      '/api/v1/rbac/excel-imports/commit',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  updatePreferences: (payload: {
    cornerStyle?: 'sharp' | 'curved';
    paletteId?:
      | 'niloofar_default'
      | 'emerald_atelier'
      | 'terracotta_sand'
      | 'nordic_indigo'
      | 'velvet_burgundy'
      | 'graphite_cobalt';
  }) =>
    rbacRequest<{
      ok: boolean;
      preferences: {
        cornerStyle: 'sharp' | 'curved';
        paletteId:
          | 'niloofar_default'
          | 'emerald_atelier'
          | 'terracotta_sand'
          | 'nordic_indigo'
          | 'velvet_burgundy'
          | 'graphite_cobalt';
      };
      user: RbacUserRecord;
    }>('/api/v1/rbac/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateMyProfile: (payload: {
    displayName?: string;
    phone?: string;
    bio?: string;
    avatarDataUrl?: string | null;
  }) =>
    rbacRequest<{
      ok: boolean;
      user: RbacUserRecord;
    }>('/api/v1/rbac/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Standalone Resident App Onboarding (Public, gated by Manager-Issued Unit Code)
  getResidentOnboardingInfo: (block?: string) =>
    rbacRequest<{
      ok: boolean;
      complexName: string;
      appVersion: string;
      selectedBlock: { id: string; name: string; managerName: string } | null;
      blocks: Array<{ id: string; name: string; managerName: string }>;
    }>(
      block
        ? `/api/v1/resident-onboarding/info?block=${encodeURIComponent(block)}`
        : '/api/v1/resident-onboarding/info',
    ),

  verifyUnitInviteCode: (code: string) =>
    rbacRequest<{
      ok: boolean;
      invite: {
        code: string;
        blockId: string;
        blockName: string;
        managerName: string;
        unitCode: string;
        existingParkingCode: string;
        existingStorageCode: string;
      };
    }>('/api/v1/resident-onboarding/verify-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  submitResidentOnboarding: (payload: ResidentOnboardingPayload) =>
    rbacRequest<{
      ok: boolean;
      trackingCode: string;
      submission: ResidentSubmissionDoc;
    }>('/api/v1/resident-onboarding/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Manager Unit Invite Codes & Submission Review Pipeline
  listUnitInviteCodes: (blockId?: string) =>
    rbacRequest<{ ok: boolean; items: UnitInviteCodeDoc[] }>(
      blockId
        ? `/api/v1/rbac/unit-invite-codes?blockId=${encodeURIComponent(blockId)}`
        : '/api/v1/rbac/unit-invite-codes',
    ),

  createUnitInviteCode: (payload: {
    blockId?: string;
    unitCode?: string;
    batchAllUnits?: boolean;
  }) =>
    rbacRequest<{
      ok: boolean;
      invite?: UnitInviteCodeDoc;
      createdCount?: number;
      items?: UnitInviteCodeDoc[];
    }>('/api/v1/rbac/unit-invite-codes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUnitInviteCode: (id: string, status: 'active' | 'revoked') =>
    rbacRequest<{ ok: boolean; invite: UnitInviteCodeDoc }>(
      `/api/v1/rbac/unit-invite-codes/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    ),

  listResidentSubmissions: (blockId?: string) =>
    rbacRequest<{ ok: boolean; items: ResidentSubmissionDoc[] }>(
      blockId
        ? `/api/v1/rbac/resident-submissions?blockId=${encodeURIComponent(blockId)}`
        : '/api/v1/rbac/resident-submissions',
    ),

  reviewResidentSubmission: (
    id: string,
    decision: 'approved' | 'rejected',
    reviewNote?: string,
  ) =>
    rbacRequest<{
      ok: boolean;
      submission: ResidentSubmissionDoc;
      approvedVehiclesCount: number;
    }>(`/api/v1/rbac/resident-submissions/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, reviewNote }),
    }),

  listApprovedVehicles: (blockId?: string) =>
    rbacRequest<{ ok: boolean; items: ApprovedVehicleDoc[] }>(
      blockId
        ? `/api/v1/rbac/approved-vehicles?blockId=${encodeURIComponent(blockId)}`
        : '/api/v1/rbac/approved-vehicles',
    ),

  updateApprovedVehicle: (id: string, gateAccessEnabled: boolean) =>
    rbacRequest<{ ok: boolean; vehicle: ApprovedVehicleDoc }>(
      `/api/v1/rbac/approved-vehicles/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ gateAccessEnabled }),
      },
    ),
};

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('خواندن تصویر انجام نشد.'));
    reader.readAsDataURL(file);
  });
}
