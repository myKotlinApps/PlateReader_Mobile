import type { Express, NextFunction, Request, Response } from 'express';
import {
  canAccessBlock,
  canCreateRole,
  computeTempWindow,
  getUserAccessibleBlockIds,
  isUserAccessActive,
  ROLE_DEFINITIONS,
  ROLE_ORDER,
  type BlockSharePermission,
  type TempDurationPreset,
  type UserRoleId,
} from '../mobile/rbac/roles';
import { validateJournalEntry, type JournalEntry } from '../mobile/accounting/accountingEngine';
import {
  hashPassword,
  nosql,
  signSessionToken,
  stripUserSecrets,
  verifyPassword,
  verifySessionToken,
  type CaretakerTaskDoc,
  type StoredUserDoc,
} from './nosqlStore';
import {
  buildUnitInviteCode,
  normalizeInviteCode,
  normalizePlateForMatch,
  validateResidentOnboarding,
  type ResidentOnboardingPayload,
  type ResidentVehicleEntry,
} from '../mobile/utils/residentOnboarding';
import {
  buildCaretakerBlockGrants,
  getCaretakerBlockIds,
  isCaretakerRole,
  normalizeCaretakerBlockIds,
  validateCaretakerAccountInput,
  type CaretakerRoleId,
} from '../mobile/utils/caretakerAccess';

interface AuthedRequest extends Request {
  authUser?: StoredUserDoc;
}

interface LegacyBridge {
  putDomainDoc: (collection: string, id: string, data: Record<string, unknown>) => void;
}

function sanitizeImageDataUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  // Only permit safe raster image data URLs under 1.8MB
  if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return undefined;
  }
  if (trimmed.length > 2_400_000) {
    return undefined;
  }
  return trimmed;
}

function sanitizeDocumentDataUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  // Permit safe raster images or PDF lease attachments under 2.4MB
  if (!/^data:(image\/(png|jpeg|jpg|webp|gif)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return undefined;
  }
  if (trimmed.length > 3_200_000) {
    return undefined;
  }
  return trimmed;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const claims = verifySessionToken(token);
  if (!claims) {
    res.status(401).json({ error: { message: 'نشست شما معتبر نیست؛ لطفاً مجدداً وارد شوید.' } });
    return;
  }
  const user = nosql.findById('users', claims.uid);
  if (!user) {
    res.status(401).json({ error: { message: 'حساب کاربری یافت نشد.' } });
    return;
  }
  const access = isUserAccessActive(user, Date.now());
  if (!access.active) {
    res.status(403).json({
      error: {
        code: 'ACCESS_EXPIRED_OR_DISABLED',
        message: access.reason || 'دسترسی حساب شما غیرفعال یا منقضی شده است.',
      },
    });
    return;
  }
  req.authUser = user;
  next();
}

function todayJalaliFallback(): string {
  return '۱۴۰۵/۰۸/۳۰';
}

export function registerRbacRoutes(app: Express, bridge: LegacyBridge): void {
  // 1. Public Role Portal Directory (safe metadata only, never passwordHash)
  app.get('/api/v1/rbac/roles-directory', (_req, res) => {
    const users = nosql.list('users');
    const blocks = nosql.list('blocks');
    const now = Date.now();

    const cards = ROLE_ORDER.map((roleId) => {
      const def = ROLE_DEFINITIONS[roleId];
      const sampleUser = users.find((u) => u.role === roleId && u.active) || users.find((u) => u.role === roleId);
      const access = sampleUser ? isUserAccessActive(sampleUser, now) : { active: false };
      return {
        roleId,
        title: def.title,
        shortTitle: def.shortTitle,
        group: def.group,
        groupLabel: def.groupLabel,
        description: def.description,
        icon: def.icon,
        dockLabels: def.dockTabs.map((t) => t.label),
        canCreateCount: def.canCreateRoles.length,
        sampleUsername: sampleUser?.username ?? '',
        sampleDisplayName: sampleUser?.displayName ?? def.title,
        blockId: sampleUser?.blockId ?? null,
        unitCode: sampleUser?.unitCode ?? null,
        isTemporary: sampleUser?.isTemporary ?? false,
        accessDurationLabel: sampleUser?.accessDurationLabel ?? null,
        remainingMs: access.remainingMs ?? null,
      };
    });

    res.json({
      ok: true,
      storageEngine: 'Server-Side NoSQL Document Store',
      totalUsers: users.length,
      blocks,
      cards,
    });
  });

  // 2. Login by Username & Password OR Quick Role Preview Switch
  app.post('/api/v1/rbac/login', (req, res) => {
    const body = (req.body || {}) as {
      username?: string;
      password?: string;
      quickRoleId?: UserRoleId;
    };
    const now = Date.now();
    let user: StoredUserDoc | undefined;

    if (body.quickRoleId && ROLE_DEFINITIONS[body.quickRoleId]) {
      user =
        nosql.list('users').find((u) => u.role === body.quickRoleId && u.active) ||
        nosql.list('users').find((u) => u.role === body.quickRoleId);
      if (!user) {
        res.status(404).json({ error: { message: 'کاربر نمونه‌ای برای این نقش در دیتابیس یافت نشد.' } });
        return;
      }
      // If demo temp caretaker expired during long test session, refresh its demo window cleanly only on explicit quickRoleId preview
      if (user.id === 'u_temp_caretaker_b' && user.validUntilMs && now > user.validUntilMs) {
        const refreshed = nosql.updateById('users', user.id, (prev) => ({
          ...prev,
          active: true,
          validFromMs: now - 3600_000,
          validUntilMs: now + 23 * 3600_000,
        }));
        if (refreshed) user = refreshed;
      }
    } else {
      const uname = String(body.username || '').trim().toLowerCase();
      const pass = String(body.password || '');
      if (!uname || !pass) {
        res.status(400).json({ error: { message: 'لطفاً نام‌کاربری و رمز عبور را وارد کنید.' } });
        return;
      }
      user = nosql.list('users').find((u) => u.username.toLowerCase() === uname);
      if (!user || !verifyPassword(pass, user.passwordHash)) {
        res.status(401).json({ error: { message: 'نام‌کاربری یا رمز عبور نادرست است.' } });
        return;
      }
    }

    const access = isUserAccessActive(user, now);
    if (!access.active) {
      res.status(403).json({
        error: {
          code: 'ACCESS_EXPIRED_OR_DISABLED',
          message: access.reason || 'دسترسی این حساب غیرفعال یا منقضی شده است.',
        },
      });
      return;
    }

    const exp =
      user.isTemporary && user.validUntilMs
        ? Math.min(user.validUntilMs, now + 7 * 86400_000)
        : now + 7 * 86400_000;
    const token = signSessionToken({ uid: user.id, role: user.role, exp });

    res.json({
      ok: true,
      token,
      user: stripUserSecrets(user),
      roleDef: ROLE_DEFINITIONS[user.role],
      remainingMs: access.remainingMs ?? null,
    });
  });

  // 3. Session Introspection + Role-Scoped Counters
  app.get('/api/v1/rbac/me', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const now = Date.now();
    const access = isUserAccessActive(user, now);
    const blockFilter = (bId: string | null) => canAccessBlock(user, bId);

    const pendingTasks = nosql.find(
      'caretaker_tasks',
      (t) =>
        blockFilter(t.blockId) &&
        (user.role === 'block_caretaker' || user.role === 'temp_caretaker'
          ? t.assignedToUserId === user.id && (t.status === 'todo' || t.status === 'in_progress' || t.status === 'needs_fix')
          : t.status === 'done_pending_review'),
    ).length;

    const openRequests = nosql.find(
      'resident_requests',
      (r) =>
        blockFilter(r.blockId) &&
        (user.role === 'resident' ? r.unitCode === user.unitCode : r.status !== 'resolved'),
    ).length;

    const pendingReceipts = nosql.find(
      'payment_receipts',
      (r) => blockFilter(r.blockId) && r.status === 'pending',
    ).length;

    const pendingPermits = nosql.find(
      'guest_permits',
      (p) =>
        (user.role === 'resident' ? p.unitCode === user.unitCode : blockFilter(p.blockId)) &&
        p.status === 'pending_gate',
    ).length;

    const notices = nosql.find(
      'block_notices',
      (n) =>
        (n.blockId === 'ALL' || n.blockId === user.blockId) &&
        (n.targetUnitCode === 'ALL' || n.targetUnitCode === user.unitCode),
    );

    res.json({
      ok: true,
      user: stripUserSecrets(user),
      roleDef: ROLE_DEFINITIONS[user.role],
      remainingMs: access.remainingMs ?? null,
      counters: {
        pendingTasks,
        openRequests,
        pendingReceipts,
        pendingPermits,
        noticesCount: notices.length,
      },
      latestNotice: notices[0] ?? null,
    });
  });

  // 4. Blocks & Units Overview
  app.get('/api/v1/rbac/blocks', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const blocks = nosql.list('blocks').filter((b) => canAccessBlock(user, b.id));
    const units = nosql.list('units').filter((u) =>
      user.role === 'resident' ? u.unitCode === user.unitCode : canAccessBlock(user, u.blockId),
    );
    const enrichedBlocks = blocks.map((b) => {
      const bUnits = nosql.find('units', (u) => u.blockId === b.id);
      const bStaff = nosql.find('users', (u) => u.blockId === b.id && u.role !== 'resident');
      const bTasks = nosql.find('caretaker_tasks', (t) => t.blockId === b.id);
      const bReqs = nosql.find('resident_requests', (r) => r.blockId === b.id && r.status !== 'resolved');
      const totalDebt = bUnits.reduce((s, u) => s + u.debtTomans, 0);
      const settledCount = bUnits.filter((u) => u.debtTomans === 0).length;
      return {
        ...b,
        registeredUnits: bUnits.length,
        settledUnits: settledCount,
        totalDebtTomans: totalDebt,
        staffCount: bStaff.length,
        openTasksCount: bTasks.filter((t) => t.status !== 'approved').length,
        openRequestsCount: bReqs.length,
      };
    });
    res.json({ ok: true, blocks: enrichedBlocks, units });
  });

  // 5. Hierarchical User Management (List / Create Permanent & Temporary / Extend / Suspend)
  app.get('/api/v1/rbac/users', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const def = ROLE_DEFINITIONS[user.role];
    const now = Date.now();
    const visible = nosql
      .list('users')
      .filter((u) => {
        if (def.scopeLevel === 'complex') return true;
        if (def.scopeLevel === 'block') {
          return u.blockId === user.blockId || (user.blockId ? canAccessBlock(u, user.blockId) : false);
        }
        return u.id === user.id;
      })
      .map((u) => {
        const access = isUserAccessActive(u, now);
        return {
          ...stripUserSecrets(u),
          isCurrentlyActive: access.active,
          remainingMs: access.remainingMs ?? null,
        };
      });

    res.json({ ok: true, items: visible, creatableRoles: def.canCreateRoles });
  });

  app.post('/api/v1/rbac/users', requireAuth, (req: AuthedRequest, res) => {
    const creator = req.authUser!;
    const body = (req.body || {}) as {
      username?: string;
      password?: string;
      displayName?: string;
      role?: UserRoleId;
      blockId?: string | null;
      unitCode?: string | null;
      phone?: string;
      isTemporary?: boolean;
      durationPreset?: TempDurationPreset;
      customFromMs?: number;
      customUntilMs?: number;
    };

    const targetRole = body.role;
    if (!targetRole || !ROLE_DEFINITIONS[targetRole]) {
      res.status(400).json({ error: { message: 'نقش انتخاب‌شده معتبر نیست.' } });
      return;
    }

    const targetBlockId =
      ROLE_DEFINITIONS[creator.role].scopeLevel === 'block'
        ? creator.blockId
        : ROLE_DEFINITIONS[targetRole].scopeLevel === 'complex'
          ? null
          : String(body.blockId || 'B').trim();

    const authz = canCreateRole(creator.role, targetRole, creator.blockId, targetBlockId);
    if (!authz.ok) {
      res.status(403).json({ error: { message: authz.reason || 'شما مجاز به ساخت این نقش نیستید.' } });
      return;
    }

    const username = String(body.username || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    const password = String(body.password || '1234').trim();

    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
      res.status(400).json({
        error: { message: 'نام‌کاربری باید ۳ تا ۳۲ کاراکتر لاتین، عدد یا زیرخط (_) باشد.' },
      });
      return;
    }
    if (!displayName || displayName.length < 2) {
      res.status(400).json({ error: { message: 'نام و نام خانوادگی کاربر الزامی است.' } });
      return;
    }
    if (password.length < 4) {
      res.status(400).json({ error: { message: 'رمز عبور باید حداقل ۴ کاراکتر باشد.' } });
      return;
    }
    if (nosql.list('users').some((u) => u.username.toLowerCase() === username)) {
      res.status(409).json({ error: { message: `نام‌کاربری «${username}» قبلاً ثبت شده است.` } });
      return;
    }

    const now = Date.now();
    const isTemporary = targetRole === 'temp_caretaker' || Boolean(body.isTemporary);
    let validFromMs: number | null = null;
    let validUntilMs: number | null = null;
    let accessDurationLabel: string | undefined;

    if (isTemporary) {
      const win = computeTempWindow(
        body.durationPreset || 'one_day',
        now,
        body.customFromMs,
        body.customUntilMs,
      );
      validFromMs = win.validFromMs;
      validUntilMs = win.validUntilMs;
      accessDurationLabel = win.label;
    }

    const created: StoredUserDoc = {
      id: `u_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
      username,
      passwordHash: hashPassword(password),
      displayName,
      role: targetRole,
      blockId: targetBlockId,
      unitCode: body.unitCode ? String(body.unitCode).trim() : null,
      phone: body.phone ? String(body.phone).trim() : '',
      createdByUserId: creator.id,
      createdByName: creator.displayName,
      isTemporary,
      accessDurationLabel,
      validFromMs,
      validUntilMs,
      active: true,
      createdAtMs: now,
    };

    nosql.insert('users', created, true);

    res.status(201).json({
      ok: true,
      user: stripUserSecrets(created),
    });
  });

  app.patch('/api/v1/rbac/users/:id', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const target = nosql.findById('users', req.params.id);
    if (!target) {
      res.status(404).json({ error: { message: 'کاربر مورد نظر یافت نشد.' } });
      return;
    }
    const authz = canCreateRole(actor.role, target.role, actor.blockId, target.blockId);
    if (!authz.ok) {
      res.status(403).json({ error: { message: authz.reason || 'شما مجاز به ویرایش این کاربر نیستید.' } });
      return;
    }

    const body = (req.body || {}) as {
      active?: boolean;
      username?: string;
      password?: string;
      displayName?: string;
      phone?: string;
      extendHours?: number;
      durationPreset?: TempDurationPreset;
      customFromMs?: number;
      customUntilMs?: number;
    };

    let nextUsername: string | undefined;
    if (typeof body.username === 'string' && body.username.trim()) {
      const cleaned = body.username.trim().toLowerCase();
      if (!/^[a-z0-9_.-]{3,32}$/.test(cleaned)) {
        res.status(400).json({
          error: { message: 'نام کاربری باید ۳ تا ۳۲ کاراکتر لاتین، عدد یا زیرخط (_) باشد.' },
        });
        return;
      }
      if (
        cleaned !== target.username.toLowerCase() &&
        nosql.list('users').some((u) => u.id !== target.id && u.username.toLowerCase() === cleaned)
      ) {
        res.status(409).json({
          error: { message: `نام کاربری «${cleaned}» قبلاً برای حساب دیگری ثبت شده است.` },
        });
        return;
      }
      nextUsername = cleaned;
    }

    let nextPasswordHash: string | undefined;
    if (typeof body.password === 'string' && body.password.trim()) {
      const trimmedPass = body.password.trim();
      if (trimmedPass.length < 4) {
        res.status(400).json({ error: { message: 'رمز عبور باید حداقل ۴ کاراکتر باشد.' } });
        return;
      }
      nextPasswordHash = hashPassword(trimmedPass);
    }

    const updated = nosql.updateById('users', target.id, (prev) => {
      const next = { ...prev };
      if (typeof body.active === 'boolean') next.active = body.active;
      if (nextUsername) next.username = nextUsername;
      if (nextPasswordHash) next.passwordHash = nextPasswordHash;
      if (typeof body.displayName === 'string' && body.displayName.trim().length >= 2) {
        next.displayName = body.displayName.trim();
      }
      if (typeof body.phone === 'string') {
        next.phone = body.phone.trim();
      }
      if (typeof body.extendHours === 'number' && body.extendHours > 0) {
        const base = Math.max(Date.now(), prev.validUntilMs || Date.now());
        next.isTemporary = true;
        next.active = true;
        next.validFromMs = prev.validFromMs || Date.now();
        next.validUntilMs = base + body.extendHours * 3600_000;
        next.accessDurationLabel = `تمدید شده (+${body.extendHours.toLocaleString('fa-IR')} ساعت)`;
      } else if (body.durationPreset) {
        const win = computeTempWindow(body.durationPreset, Date.now(), body.customFromMs, body.customUntilMs);
        next.isTemporary = true;
        next.active = true;
        next.validFromMs = win.validFromMs;
        next.validUntilMs = win.validUntilMs;
        next.accessDurationLabel = win.label;
      }
      return next;
    });

    res.json({ ok: true, user: updated ? stripUserSecrets(updated) : null });
  });

  // 5b. Dedicated Caretaker Account Management (Username, Password, Specific Multi-Block Access -> Persisted in NoSQL)
  app.get('/api/v1/rbac/caretakers', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (actor.role !== 'complex_manager' && actor.role !== 'block_manager') {
      res.status(403).json({
        error: { message: 'فقط مدیر کل ساختمان/شهرک یا مدیر بلوک مجاز به مدیریت اکانت‌های سرایدار است.' },
      });
      return;
    }

    const now = Date.now();
    const allBlocks = nosql.list('blocks');
    const manageableBlockIds =
      actor.role === 'complex_manager'
        ? allBlocks.map((b) => b.id)
        : actor.blockId
          ? [actor.blockId]
          : [];

    const items = nosql
      .list('users')
      .filter((u) => {
        if (!isCaretakerRole(u.role)) return false;
        if (actor.role === 'complex_manager') return true;
        return actor.blockId ? canAccessBlock(u, actor.blockId) : false;
      })
      .map((u) => {
        const access = isUserAccessActive(u, now);
        const blockIds = getCaretakerBlockIds(u);
        return {
          ...stripUserSecrets(u),
          caretakerBlockIds: blockIds,
          isCurrentlyActive: access.active,
          remainingMs: access.remainingMs ?? null,
        };
      });

    res.json({
      ok: true,
      items,
      blocks: allBlocks,
      manageableBlockIds,
    });
  });

  app.post('/api/v1/rbac/caretakers', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (actor.role !== 'complex_manager' && actor.role !== 'block_manager') {
      res.status(403).json({
        error: { message: 'فقط مدیر کل ساختمان/شهرک یا مدیر بلوک مجاز به تعریف سرایدار است.' },
      });
      return;
    }

    const body = (req.body || {}) as {
      displayName?: string;
      username?: string;
      password?: string;
      phone?: string;
      role?: CaretakerRoleId;
      blockIds?: string[];
      durationPreset?: TempDurationPreset;
      customFromMs?: number;
      customUntilMs?: number;
    };

    const role: CaretakerRoleId = body.role === 'temp_caretaker' ? 'temp_caretaker' : 'block_caretaker';
    const validBlockIds = nosql.list('blocks').map((b) => b.id);
    const requestedBlockIds = Array.isArray(body.blockIds)
      ? body.blockIds.map((b) => String(b || '').trim()).filter(Boolean)
      : actor.blockId
        ? [actor.blockId]
        : [];

    const blockCheck = normalizeCaretakerBlockIds({
      requestedBlockIds,
      validBlockIds,
      actorRole: actor.role,
      actorBlockId: actor.blockId,
    });
    if (!blockCheck.ok) {
      res.status(403).json({ error: { message: blockCheck.reason || 'دسترسی بلوک‌های انتخابی مجاز نیست.' } });
      return;
    }

    const validation = validateCaretakerAccountInput(
      {
        displayName: String(body.displayName || ''),
        username: String(body.username || ''),
        password: String(body.password || ''),
        phone: String(body.phone || ''),
        role,
        blockIds: blockCheck.blockIds,
      },
      'create',
    );
    if (!validation.ok || !validation.cleaned) {
      res.status(400).json({ error: { message: validation.errors[0] || 'اطلاعات سرایدار معتبر نیست.' } });
      return;
    }

    const { displayName, username, password, phone, blockIds } = validation.cleaned;
    if (nosql.list('users').some((u) => u.username.toLowerCase() === username)) {
      res.status(409).json({ error: { message: `نام کاربری «${username}» قبلاً در سامانه ثبت شده است.` } });
      return;
    }

    const now = Date.now();
    const grants = buildCaretakerBlockGrants(blockIds, { id: actor.id, displayName: actor.displayName }, now);
    const isTemporary = role === 'temp_caretaker';
    let validFromMs: number | null = null;
    let validUntilMs: number | null = null;
    let accessDurationLabel: string | undefined;

    if (isTemporary) {
      const win = computeTempWindow(
        body.durationPreset || 'one_day',
        now,
        body.customFromMs,
        body.customUntilMs,
      );
      validFromMs = win.validFromMs;
      validUntilMs = win.validUntilMs;
      accessDurationLabel = win.label;
    }

    const created: StoredUserDoc = {
      id: `u_ct_${now}_${Math.random().toString(16).slice(2, 6)}`,
      username,
      passwordHash: hashPassword(password!),
      displayName,
      role,
      blockId: grants.primaryBlockId,
      caretakerBlockIds: grants.caretakerBlockIds,
      assignedBlocks: grants.assignedBlocks,
      unitCode: null,
      phone,
      createdByUserId: actor.id,
      createdByName: actor.displayName,
      isTemporary,
      accessDurationLabel,
      validFromMs,
      validUntilMs,
      active: true,
      createdAtMs: now,
    };

    nosql.insert('users', created, true);
    const access = isUserAccessActive(created, now);
    res.status(201).json({
      ok: true,
      caretaker: {
        ...stripUserSecrets(created),
        caretakerBlockIds: grants.caretakerBlockIds,
        isCurrentlyActive: access.active,
        remainingMs: access.remainingMs ?? null,
      },
    });
  });

  app.patch('/api/v1/rbac/caretakers/:id', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (actor.role !== 'complex_manager' && actor.role !== 'block_manager') {
      res.status(403).json({
        error: { message: 'فقط مدیر کل ساختمان/شهرک یا مدیر بلوک مجاز به ویرایش اکانت سرایدار است.' },
      });
      return;
    }

    const target = nosql.findById('users', req.params.id);
    if (!target || !isCaretakerRole(target.role)) {
      res.status(404).json({ error: { message: 'اکانت سرایدار مورد نظر یافت نشد.' } });
      return;
    }

    if (actor.role === 'block_manager' && (!actor.blockId || !canAccessBlock(target, actor.blockId))) {
      res.status(403).json({ error: { message: 'شما فقط مجاز به مدیریت سرایداران بلوک خود هستید.' } });
      return;
    }

    const body = (req.body || {}) as {
      displayName?: string;
      username?: string;
      password?: string;
      phone?: string;
      role?: CaretakerRoleId;
      blockIds?: string[];
      active?: boolean;
      extendHours?: number;
      durationPreset?: TempDurationPreset;
      customFromMs?: number;
      customUntilMs?: number;
    };

    const existingBlockIds = getCaretakerBlockIds(target);
    const validBlockIds = nosql.list('blocks').map((b) => b.id);
    let nextBlockIds = existingBlockIds;

    if (Array.isArray(body.blockIds)) {
      const blockCheck = normalizeCaretakerBlockIds({
        requestedBlockIds: body.blockIds.map((b) => String(b || '').trim()).filter(Boolean),
        validBlockIds,
        actorRole: actor.role,
        actorBlockId: actor.blockId,
        existingBlockIds,
      });
      if (!blockCheck.ok) {
        res.status(403).json({ error: { message: blockCheck.reason || 'دسترسی بلوک‌های انتخابی مجاز نیست.' } });
        return;
      }
      nextBlockIds = blockCheck.blockIds;
    }

    const nextRole: CaretakerRoleId =
      body.role && isCaretakerRole(body.role) ? body.role : (target.role as CaretakerRoleId);
    const nextDisplayName =
      typeof body.displayName === 'string' ? body.displayName : target.displayName;
    const nextUsernameRaw =
      typeof body.username === 'string' && body.username.trim() ? body.username : target.username;
    const nextPasswordRaw = typeof body.password === 'string' ? body.password : '';
    const nextPhone = typeof body.phone === 'string' ? body.phone : target.phone || '';

    const validation = validateCaretakerAccountInput(
      {
        displayName: nextDisplayName,
        username: nextUsernameRaw,
        password: nextPasswordRaw,
        phone: nextPhone,
        role: nextRole,
        blockIds: nextBlockIds,
      },
      'edit',
    );
    if (!validation.ok || !validation.cleaned) {
      res.status(400).json({ error: { message: validation.errors[0] || 'اطلاعات ویرایشی معتبر نیست.' } });
      return;
    }

    const cleaned = validation.cleaned;
    if (
      cleaned.username !== target.username.toLowerCase() &&
      nosql.list('users').some((u) => u.id !== target.id && u.username.toLowerCase() === cleaned.username)
    ) {
      res.status(409).json({
        error: { message: `نام کاربری «${cleaned.username}» قبلاً برای حساب دیگری ثبت شده است.` },
      });
      return;
    }

    const now = Date.now();
    const grants = buildCaretakerBlockGrants(cleaned.blockIds, { id: actor.id, displayName: actor.displayName }, now);

    const updated = nosql.updateById('users', target.id, (prev) => {
      const next: StoredUserDoc = {
        ...prev,
        displayName: cleaned.displayName,
        username: cleaned.username,
        phone: cleaned.phone,
        role: cleaned.role,
        blockId: grants.primaryBlockId,
        caretakerBlockIds: grants.caretakerBlockIds,
        assignedBlocks: grants.assignedBlocks,
      };
      if (cleaned.password) {
        next.passwordHash = hashPassword(cleaned.password);
      }
      if (typeof body.active === 'boolean') {
        next.active = body.active;
      }
      if (cleaned.role === 'block_caretaker' && body.role === 'block_caretaker') {
        next.isTemporary = false;
        next.validFromMs = null;
        next.validUntilMs = null;
        next.accessDurationLabel = undefined;
      } else if (typeof body.extendHours === 'number' && body.extendHours > 0) {
        const base = Math.max(now, prev.validUntilMs || now);
        next.isTemporary = true;
        next.role = 'temp_caretaker';
        next.active = true;
        next.validFromMs = prev.validFromMs || now;
        next.validUntilMs = base + body.extendHours * 3600_000;
        next.accessDurationLabel = `تمدید شده (+${body.extendHours.toLocaleString('fa-IR')} ساعت)`;
      } else if (body.durationPreset || cleaned.role === 'temp_caretaker') {
        if (body.durationPreset || !prev.validUntilMs) {
          const win = computeTempWindow(
            body.durationPreset || 'one_day',
            now,
            body.customFromMs,
            body.customUntilMs,
          );
          next.isTemporary = true;
          next.validFromMs = win.validFromMs;
          next.validUntilMs = win.validUntilMs;
          next.accessDurationLabel = win.label;
        } else {
          next.isTemporary = true;
        }
      }
      return next;
    });

    if (!updated) {
      res.status(404).json({ error: { message: 'ذخیره‌سازی تغییرات انجام نشد.' } });
      return;
    }

    const access = isUserAccessActive(updated, now);
    res.json({
      ok: true,
      caretaker: {
        ...stripUserSecrets(updated),
        caretakerBlockIds: getCaretakerBlockIds(updated),
        isCurrentlyActive: access.active,
        remainingMs: access.remainingMs ?? null,
      },
    });
  });

  app.delete('/api/v1/rbac/caretakers/:id', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (actor.role !== 'complex_manager' && actor.role !== 'block_manager') {
      res.status(403).json({
        error: { message: 'فقط مدیر کل ساختمان/شهرک یا مدیر بلوک مجاز به حذف اکانت سرایدار است.' },
      });
      return;
    }

    const target = nosql.findById('users', req.params.id);
    if (!target || !isCaretakerRole(target.role)) {
      res.status(404).json({ error: { message: 'اکانت سرایدار مورد نظر یافت نشد.' } });
      return;
    }

    if (actor.role === 'block_manager') {
      const assigned = getCaretakerBlockIds(target);
      const onlyOwnBlock =
        Boolean(actor.blockId) &&
        assigned.length <= 1 &&
        assigned.every((b) => b === actor.blockId);
      if (!onlyOwnBlock) {
        res.status(403).json({
          error: {
            message:
              'این سرایدار به بلوک‌های دیگر نیز دسترسی دارد؛ فقط مدیر کل شهرک می‌تواند این اکانت را حذف کند.',
          },
        });
        return;
      }
    }

    nosql.removeById('users', target.id);
    res.json({ ok: true, deletedId: target.id });
  });

  // 6. Caretaker Tasks (Block Manager -> Caretaker / Temp Caretaker -> Review)
  app.get('/api/v1/rbac/tasks', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const items = nosql.find('caretaker_tasks', (t) => {
      if (ROLE_DEFINITIONS[user.role].scopeLevel === 'complex') return true;
      if (user.role === 'block_caretaker' || user.role === 'temp_caretaker') {
        return t.assignedToUserId === user.id || canAccessBlock(user, t.blockId);
      }
      return canAccessBlock(user, t.blockId);
    });
    res.json({ ok: true, items });
  });

  app.post('/api/v1/rbac/tasks', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'block_manager', 'facilities_chief'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'فقط مدیر بلوک، مدیر شهرک یا سرپرست تاسیسات مجاز به تعریف وظیفه هستند.' } });
      return;
    }
    const body = (req.body || {}) as {
      title?: string;
      description?: string;
      category?: CaretakerTaskDoc['category'];
      priority?: 'normal' | 'urgent';
      assignedToUserId?: string;
      dueLabel?: string;
      blockId?: string;
    };
    const title = String(body.title || '').trim();
    if (!title) {
      res.status(400).json({ error: { message: 'عنوان وظیفه الزامی است.' } });
      return;
    }
    const assignee = body.assignedToUserId ? nosql.findById('users', body.assignedToUserId) : undefined;
    if (!assignee) {
      res.status(400).json({ error: { message: 'لطفاً سرایدار یا مسئول انجام وظیفه را انتخاب کنید.' } });
      return;
    }
    const blockId = actor.blockId || assignee.blockId || String(body.blockId || 'B');
    const now = Date.now();
    const task = nosql.insert('caretaker_tasks', {
      id: `tsk_${now}`,
      blockId,
      title,
      description: String(body.description || '').trim() || 'مطابق دستور مدیر بلوک انجام و گزارش شود.',
      category: body.category || 'نظافت',
      priority: body.priority === 'urgent' ? 'urgent' : 'normal',
      assignedToUserId: assignee.id,
      assignedToName: assignee.displayName,
      assignedByUserId: actor.id,
      assignedByName: actor.displayName,
      dueLabel: String(body.dueLabel || 'امروز').trim(),
      status: 'todo',
      createdAtMs: now,
      updatedAtMs: now,
    });
    res.status(201).json({ ok: true, task });
  });

  app.patch('/api/v1/rbac/tasks/:id', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const existing = nosql.findById('caretaker_tasks', req.params.id);
    if (!existing) {
      res.status(404).json({ error: { message: 'وظیفه یافت نشد.' } });
      return;
    }
    if (!canAccessBlock(actor, existing.blockId)) {
      res.status(403).json({ error: { message: 'این وظیفه مربوط به بلوک شما نیست.' } });
      return;
    }
    const body = (req.body || {}) as {
      status?: CaretakerTaskDoc['status'];
      completionNote?: string;
      completionPhoto?: string;
      reviewNote?: string;
    };

    // Only managers can set approved / needs_fix
    if (
      (body.status === 'approved' || body.status === 'needs_fix') &&
      !['complex_manager', 'block_manager', 'facilities_chief'].includes(actor.role)
    ) {
      res.status(403).json({ error: { message: 'تایید نهایی وظیفه فقط توسط مدیر بلوک یا مدیریت مجاز است.' } });
      return;
    }

    const photo = sanitizeImageDataUrl(body.completionPhoto);
    const updated = nosql.updateById('caretaker_tasks', existing.id, (prev) => ({
      ...prev,
      status: body.status || prev.status,
      completionNote:
        typeof body.completionNote === 'string' && body.completionNote.trim()
          ? body.completionNote.trim()
          : prev.completionNote,
      completionPhoto: photo || prev.completionPhoto,
      reviewNote:
        typeof body.reviewNote === 'string' && body.reviewNote.trim()
          ? body.reviewNote.trim()
          : prev.reviewNote,
      updatedAtMs: Date.now(),
    }));
    res.json({ ok: true, task: updated });
  });

  // 7. Resident Repair / Common-Area Requests (with real photo upload)
  app.get('/api/v1/rbac/resident-requests', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const items = nosql.find('resident_requests', (r) => {
      if (ROLE_DEFINITIONS[user.role].scopeLevel === 'complex') return true;
      if (user.role === 'resident') return r.unitCode === user.unitCode || r.residentUserId === user.id;
      return canAccessBlock(user, r.blockId);
    });
    res.json({ ok: true, items });
  });

  app.post('/api/v1/rbac/resident-requests', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const body = (req.body || {}) as {
      type?: 'maintenance' | 'common_area' | 'complaint';
      category?: string;
      title?: string;
      description?: string;
      photoDataUrl?: string;
      unitCode?: string;
      blockId?: string;
    };
    const title = String(body.title || '').trim();
    if (!title) {
      res.status(400).json({ error: { message: 'عنوان درخواست یا خرابی را وارد کنید.' } });
      return;
    }
    const now = Date.now();
    const requestedBlockId = typeof body.blockId === 'string' ? body.blockId.trim() : '';
    const blockId =
      requestedBlockId && canAccessBlock(actor, requestedBlockId)
        ? requestedBlockId
        : actor.blockId || 'B';
    const unitCode = actor.unitCode || String(body.unitCode || `بلوک ${blockId}`);
    const requestDoc = nosql.insert('resident_requests', {
      id: `req_${now}`,
      blockId,
      unitCode,
      residentUserId: actor.id,
      residentName: actor.displayName,
      type: body.type || (actor.role === 'resident' ? 'maintenance' : 'common_area'),
      category: String(body.category || 'تاسیسات و تعمیرات').trim(),
      title,
      description: String(body.description || '').trim(),
      photoDataUrl: sanitizeImageDataUrl(body.photoDataUrl),
      status: 'open',
      createdAtMs: now,
      updatedAtMs: now,
    });
    res.status(201).json({ ok: true, request: requestDoc });
  });

  app.patch('/api/v1/rbac/resident-requests/:id', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (actor.role === 'resident') {
      res.status(403).json({ error: { message: 'تغییر وضعیت درخواست توسط مدیر بلوک یا تاسیسات انجام می‌شود.' } });
      return;
    }
    const existing = nosql.findById('resident_requests', req.params.id);
    if (!existing) {
      res.status(404).json({ error: { message: 'درخواست یافت نشد.' } });
      return;
    }
    if (!canAccessBlock(actor, existing.blockId)) {
      res.status(403).json({ error: { message: 'این درخواست خارج از محدوده بلوک شماست.' } });
      return;
    }
    const body = (req.body || {}) as {
      status?: 'open' | 'assigned' | 'in_progress' | 'resolved';
      assignedToUserId?: string;
      managerReply?: string;
    };
    const assignee = body.assignedToUserId ? nosql.findById('users', body.assignedToUserId) : undefined;
    const updated = nosql.updateById('resident_requests', existing.id, (prev) => ({
      ...prev,
      status: body.status || prev.status,
      assignedToUserId: assignee?.id ?? prev.assignedToUserId,
      assignedToName: assignee?.displayName ?? prev.assignedToName,
      managerReply:
        typeof body.managerReply === 'string' && body.managerReply.trim()
          ? body.managerReply.trim()
          : prev.managerReply,
      updatedAtMs: Date.now(),
    }));
    res.json({ ok: true, request: updated });
  });

  // 8. Resident <-> Block Manager Direct Messages
  app.get('/api/v1/rbac/resident-messages', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const items = nosql.find('resident_messages', (m) => {
      if (ROLE_DEFINITIONS[user.role].scopeLevel === 'complex') return true;
      if (user.role === 'resident') return m.unitCode === user.unitCode || m.residentUserId === user.id;
      return m.blockId === user.blockId;
    });
    // Chronological order for clean chat display
    res.json({ ok: true, items: [...items].sort((a, b) => a.createdAtMs - b.createdAtMs) });
  });

  app.post('/api/v1/rbac/resident-messages', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const body = (req.body || {}) as { body?: string; unitCode?: string; residentUserId?: string };
    const text = String(body.body || '').trim();
    if (!text) {
      res.status(400).json({ error: { message: 'متن پیام نمی‌تواند خالی باشد.' } });
      return;
    }
    const blockId = actor.blockId || 'B';
    const unitCode = actor.role === 'resident' ? actor.unitCode || 'B-208' : String(body.unitCode || 'B-208');
    const residentUser =
      actor.role === 'resident'
        ? actor
        : nosql.list('users').find((u) => u.role === 'resident' && u.unitCode === unitCode) ||
          nosql.findById('users', String(body.residentUserId || 'u_res_b208'));
    const blockDoc = nosql.findById('blocks', blockId);
    const recipientName =
      actor.role === 'resident'
        ? blockDoc?.managerName || `مدیر بلوک ${blockId}`
        : residentUser?.displayName || `ساکن واحد ${unitCode}`;
    const now = Date.now();

    const msg = nosql.insert(
      'resident_messages',
      {
        id: `msg_${now}`,
        blockId,
        unitCode,
        residentUserId: residentUser?.id || 'u_res_b208',
        residentName: residentUser?.displayName || `ساکن واحد ${unitCode}`,
        senderUserId: actor.id,
        senderName: actor.displayName,
        senderRole: actor.role,
        recipientName,
        deliveryStatus: 'delivered',
        deliveredAtMs: now,
        body: text,
        createdAtMs: now,
      },
      false,
    );
    res.status(201).json({ ok: true, message: msg });
  });

  app.post('/api/v1/rbac/resident-messages/mark-read', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const body = (req.body || {}) as { unitCode?: string };
    const unitFilter = body.unitCode ? String(body.unitCode).trim() : '';
    const now = Date.now();
    let updatedCount = 0;

    const all = nosql.list('resident_messages');
    for (const m of all) {
      if (m.senderUserId === actor.id) continue;
      if (m.deliveryStatus === 'read') continue;
      if (actor.role === 'resident') {
        if (m.unitCode !== actor.unitCode && m.residentUserId !== actor.id) continue;
      } else {
        if (!canAccessBlock(actor, m.blockId)) continue;
        if (unitFilter && m.unitCode !== unitFilter) continue;
      }
      nosql.updateById('resident_messages', m.id, (prev) => ({
        ...prev,
        deliveryStatus: 'read',
        deliveredAtMs: prev.deliveredAtMs || prev.createdAtMs,
        readAtMs: now,
      }));
      updatedCount += 1;
    }

    res.json({ ok: true, updatedCount });
  });

  // 9. Guest Permits (Resident -> Gate Guard Live Verification)
  app.get('/api/v1/rbac/guest-permits', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const items = nosql.find('guest_permits', (p) => {
      if (user.role === 'resident') return p.unitCode === user.unitCode || p.residentUserId === user.id;
      if (user.role === 'gate_guard' || ROLE_DEFINITIONS[user.role].scopeLevel === 'complex') return true;
      return p.blockId === user.blockId;
    });
    res.json({ ok: true, items });
  });

  app.post('/api/v1/rbac/guest-permits', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const body = (req.body || {}) as {
      guestName?: string;
      plateText?: string;
      visitDateLabel?: string;
      validHours?: number;
      note?: string;
      unitCode?: string;
    };
    const guestName = String(body.guestName || '').trim();
    const plateText = String(body.plateText || '').trim();
    if (!guestName || !plateText) {
      res.status(400).json({ error: { message: 'نام مهمان و پلاک خودرو الزامی است.' } });
      return;
    }
    const now = Date.now();
    const permit = nosql.insert('guest_permits', {
      id: `gp_${now}`,
      blockId: actor.blockId || 'B',
      unitCode: actor.unitCode || String(body.unitCode || 'B-208'),
      residentUserId: actor.id,
      residentName: actor.displayName,
      guestName,
      plateText,
      visitDateLabel: String(body.visitDateLabel || 'امروز').trim(),
      validHours: Math.max(1, Math.min(72, Number(body.validHours || 4))),
      note: String(body.note || '').trim(),
      status: 'pending_gate',
      createdAtMs: now,
      updatedAtMs: now,
    });
    res.status(201).json({ ok: true, permit });
  });

  app.patch('/api/v1/rbac/guest-permits/:id', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const existing = nosql.findById('guest_permits', req.params.id);
    if (!existing) {
      res.status(404).json({ error: { message: 'مجوز مهمان یافت نشد.' } });
      return;
    }
    const body = (req.body || {}) as { status?: 'entered' | 'exited' | 'cancelled' };
    const nextStatus = body.status || 'entered';

    if (
      nextStatus !== 'cancelled' &&
      !['gate_guard', 'complex_manager', 'block_manager'].includes(actor.role)
    ) {
      res.status(403).json({ error: { message: 'تایید ورود یا خروج مهمان فقط توسط نگهبان گیت یا مدیران مجاز است.' } });
      return;
    }

    const updated = nosql.updateById('guest_permits', existing.id, (prev) => ({
      ...prev,
      status: nextStatus,
      verifiedByGuardName: nextStatus === 'entered' || nextStatus === 'exited' ? actor.displayName : prev.verifiedByGuardName,
      updatedAtMs: Date.now(),
    }));

    // Cross-module wiring: also record an official gate entry/exit event in guard_events
    if (updated && (nextStatus === 'entered' || nextStatus === 'exited')) {
      const evId = `ev_gp_${Date.now()}`;
      bridge.putDomainDoc('guard_events', evId, {
        id: evId,
        direction: nextStatus === 'entered' ? 'entry' : 'exit',
        plate_text: updated.plateText,
        guest_name: updated.guestName,
        unit_label: `بلوک ${updated.blockId} - واحد ${updated.unitCode}`,
        note: `تایید مجوز مهمان (${updated.residentName}) توسط ${actor.displayName}`,
        created_at_ms: Date.now(),
      });
    }

    res.json({ ok: true, permit: updated });
  });

  // 10. Payment Receipts (Resident Upload -> Block/Complex Accountant Approval -> Auto Double-Entry Voucher)
  app.get('/api/v1/rbac/receipts', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const reqBlockId = typeof req.query.blockId === 'string' ? req.query.blockId.trim() : '';
    const items = nosql.find('payment_receipts', (r) => {
      if (user.role === 'resident') return r.unitCode === user.unitCode || r.residentUserId === user.id;
      if (!canAccessBlock(user, r.blockId)) return false;
      if (reqBlockId && reqBlockId !== 'ALL') return r.blockId === reqBlockId;
      return true;
    });
    res.json({ ok: true, items });
  });

  app.post('/api/v1/rbac/receipts', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const body = (req.body || {}) as {
      amountTomans?: number;
      traceCode?: string;
      channel?: 'شبا / پایا' | 'کارت‌به‌کارت' | 'درگاه پرداخت' | 'پوز مدیریت';
      bankAccountCode?: '1102' | '1103';
      note?: string;
      receiptPhotoDataUrl?: string;
      unitCode?: string;
    };
    const amountTomans = Math.round(Number(body.amountTomans || 0));
    const traceCode = String(body.traceCode || '').trim();
    if (amountTomans <= 0 || !traceCode) {
      res.status(400).json({ error: { message: 'مبلغ معتبر و کد پیگیری بانکی الزامی است.' } });
      return;
    }
    const now = Date.now();
    const receipt = nosql.insert('payment_receipts', {
      id: `rcp_${now}`,
      blockId: actor.blockId || 'B',
      unitCode: actor.unitCode || String(body.unitCode || 'B-208'),
      residentUserId: actor.id,
      residentName: actor.displayName,
      amountTomans,
      traceCode,
      channel: body.channel || 'کارت‌به‌کارت',
      bankAccountCode: body.bankAccountCode === '1103' ? '1103' : '1102',
      dateLabel: todayJalaliFallback(),
      note: String(body.note || '').trim(),
      receiptPhotoDataUrl: sanitizeImageDataUrl(body.receiptPhotoDataUrl),
      status: 'pending',
      createdAtMs: now,
      updatedAtMs: now,
    });
    res.status(201).json({ ok: true, receipt });
  });

  app.post('/api/v1/rbac/receipts/:id/review', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'complex_accountant', 'block_manager', 'block_accountant'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'فقط حسابدار یا مدیر مجاز به تایید فیش پرداختی هستند.' } });
      return;
    }
    const receipt = nosql.findById('payment_receipts', req.params.id);
    if (!receipt) {
      res.status(404).json({ error: { message: 'فیش پرداختی یافت نشد.' } });
      return;
    }
    if (!canAccessBlock(actor, receipt.blockId)) {
      res.status(403).json({ error: { message: 'این فیش مربوط به بلوک دیگری است.' } });
      return;
    }
    if (receipt.status !== 'pending') {
      res.status(409).json({ error: { message: 'این فیش قبلاً بررسی شده است.' } });
      return;
    }

    const body = (req.body || {}) as { decision?: 'approved' | 'rejected'; reviewNote?: string };
    const decision = body.decision === 'rejected' ? 'rejected' : 'approved';
    let createdVoucher: JournalEntry | null = null;

    if (decision === 'approved') {
      const entries = nosql.list('accounting_entries');
      const nextVoucherNo = entries.reduce((max, e) => Math.max(max, e.voucherNo), 100) + 1;
      createdVoucher = {
        id: `je_${nextVoucherNo}_${Date.now()}`,
        voucherNo: nextVoucherNo,
        date: receipt.dateLabel || todayJalaliFallback(),
        description: `وصول شارژ واحد ${receipt.unitCode} (${receipt.residentName}) — ${receipt.traceCode}`,
        source: 'receipt',
        status: 'final',
        refCode: receipt.traceCode,
        lines: [
          {
            accountCode: receipt.bankAccountCode,
            description: `واریز ${receipt.channel} (${receipt.traceCode})`,
            debit: receipt.amountTomans,
            credit: 0,
          },
          {
            accountCode: '1105',
            subsidiary: `واحد ${receipt.unitCode} (${receipt.residentName})`,
            description: 'تسویه بدهی شارژ ساکن',
            debit: 0,
            credit: receipt.amountTomans,
          },
        ],
      };
      nosql.insert('accounting_entries', createdVoucher, false);

      // Update matching unit balance/debt in NoSQL units collection
      const matchingUnit = nosql.list('units').find((u) => u.unitCode === receipt.unitCode);
      if (matchingUnit) {
        nosql.updateById('units', matchingUnit.id, (u) => {
          const reducedDebt = Math.max(0, u.debtTomans - receipt.amountTomans);
          const surplus = Math.max(0, receipt.amountTomans - u.debtTomans);
          return {
            ...u,
            debtTomans: reducedDebt,
            balanceTomans: u.balanceTomans + surplus,
          };
        });
      }

      // Send automatic confirmation notice to the resident
      nosql.insert('block_notices', {
        id: `ntc_rcp_${Date.now()}`,
        blockId: receipt.blockId,
        targetUnitCode: receipt.unitCode,
        title: `تایید فیش شارژ (${receipt.amountTomans.toLocaleString('fa-IR')} تومان)`,
        body: `فیش شماره پیگیری ${receipt.traceCode} توسط ${actor.displayName} تایید و با سند حسابداری #${nextVoucherNo} در دفاتر ثبت شد.`,
        severity: 'info',
        senderUserId: actor.id,
        senderName: actor.displayName,
        senderRoleTitle: ROLE_DEFINITIONS[actor.role].title,
        createdAtMs: Date.now(),
      });
    }

    const updated = nosql.updateById('payment_receipts', receipt.id, (prev) => ({
      ...prev,
      status: decision,
      voucherNo: createdVoucher?.voucherNo,
      reviewedByName: actor.displayName,
      reviewNote: body.reviewNote ? String(body.reviewNote).trim() : prev.reviewNote,
      updatedAtMs: Date.now(),
    }));

    res.json({ ok: true, receipt: updated, voucher: createdVoucher });
  });

  // 11. Block Notices (Block/Complex Manager -> Residents)
  app.get('/api/v1/rbac/notices', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const items = nosql.find('block_notices', (n) => {
      if (ROLE_DEFINITIONS[user.role].scopeLevel === 'complex') return true;
      const blockMatch = n.blockId === 'ALL' || n.blockId === user.blockId;
      if (user.role === 'resident') {
        return blockMatch && (n.targetUnitCode === 'ALL' || n.targetUnitCode === user.unitCode);
      }
      return blockMatch;
    });
    res.json({ ok: true, items });
  });

  app.post('/api/v1/rbac/notices', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'block_manager', 'facilities_chief', 'complex_accountant', 'block_accountant'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'شما مجاز به ارسال اعلان به ساکنین نیستید.' } });
      return;
    }
    const body = (req.body || {}) as {
      blockId?: string;
      targetUnitCode?: string;
      title?: string;
      body?: string;
      severity?: 'info' | 'warning' | 'urgent';
    };
    const title = String(body.title || '').trim();
    const text = String(body.body || '').trim();
    if (!title || !text) {
      res.status(400).json({ error: { message: 'عنوان و متن اطلاعیه الزامی است.' } });
      return;
    }
    const blockId =
      ROLE_DEFINITIONS[actor.role].scopeLevel === 'block'
        ? actor.blockId || 'B'
        : String(body.blockId || 'ALL');
    const notice = nosql.insert('block_notices', {
      id: `ntc_${Date.now()}`,
      blockId,
      targetUnitCode: String(body.targetUnitCode || 'ALL').trim() || 'ALL',
      title,
      body: text,
      severity: body.severity || 'info',
      senderUserId: actor.id,
      senderName: actor.displayName,
      senderRoleTitle: ROLE_DEFINITIONS[actor.role].title,
      createdAtMs: Date.now(),
    });
    res.status(201).json({ ok: true, notice });
  });

  // 12. Server-Side NoSQL Accounting Suite Persistence (multi-block aware!)
  app.get('/api/v1/rbac/accounting', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const allBlocks = nosql.list('blocks');
    const accessibleBlockIds = getUserAccessibleBlockIds(
      user,
      allBlocks.map((b) => b.id),
    );
    const reqBlockId = typeof req.query.blockId === 'string' ? req.query.blockId.trim() : '';
    const filterBlock = (bId: string) => {
      if (!canAccessBlock(user, bId)) return false;
      if (reqBlockId && reqBlockId !== 'ALL') return bId === reqBlockId;
      return true;
    };
    res.json({
      ok: true,
      accessibleBlocks: allBlocks.filter((b) => accessibleBlockIds.includes(b.id)),
      entries: nosql.list('accounting_entries'),
      checks: nosql.list('sayadi_checks'),
      receipts: nosql.find('payment_receipts', (r) => filterBlock(r.blockId)),
      units: nosql.find('units', (u) => filterBlock(u.blockId)),
    });
  });

  app.post('/api/v1/rbac/accounting/entries', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'complex_accountant', 'block_manager', 'block_accountant'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'فقط حسابدار یا مدیر مجاز به ثبت سند حسابداری هستند.' } });
      return;
    }
    const body = (req.body || {}) as Omit<JournalEntry, 'id' | 'voucherNo'>;
    const check = validateJournalEntry(body.lines || []);
    if (!check.isValid) {
      res.status(400).json({
        error: {
          message: !check.isBalanced
            ? `سند تراز نیست (اختلاف: ${check.diff.toLocaleString('fa-IR')} تومان).`
            : 'حداقل دو ردیف معتبر با مبلغ غیرصفر برای سند الزامی است.',
        },
      });
      return;
    }
    const entries = nosql.list('accounting_entries');
    const nextNo = entries.reduce((max, e) => Math.max(max, e.voucherNo), 100) + 1;
    const created: JournalEntry = {
      id: `je_${nextNo}_${Date.now()}`,
      voucherNo: nextNo,
      date: String(body.date || todayJalaliFallback()),
      description: String(body.description || 'سند حسابداری'),
      source: body.source || 'manual',
      status: body.status || 'final',
      refCode: body.refCode,
      lines: body.lines,
    };
    nosql.insert('accounting_entries', created, false);
    res.status(201).json({ ok: true, entry: created });
  });

  app.patch('/api/v1/rbac/accounting/entries/:id', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'complex_accountant', 'block_manager', 'block_accountant'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'مجوز ویرایش سند ندارید.' } });
      return;
    }
    const body = (req.body || {}) as { status?: 'draft' | 'final' };
    const updated = nosql.updateById('accounting_entries', req.params.id, (prev) => ({
      ...prev,
      status: body.status || prev.status,
    }));
    if (!updated) {
      res.status(404).json({ error: { message: 'سند یافت نشد.' } });
      return;
    }
    res.json({ ok: true, entry: updated });
  });

  app.post('/api/v1/rbac/accounting/checks', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'complex_accountant', 'block_manager', 'block_accountant'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'مجوز ثبت چک صیادی ندارید.' } });
      return;
    }
    const body = (req.body || {}) as {
      sayadiId?: string;
      payee?: string;
      bankName?: string;
      dueDate?: string;
      amountTomans?: number;
      expenseAccountCode?: string;
    };
    const amount = Math.round(Number(body.amountTomans || 0));
    const payee = String(body.payee || '').trim();
    if (!payee || amount <= 0) {
      res.status(400).json({ error: { message: 'نام ذی‌نفع و مبلغ معتبر چک الزامی است.' } });
      return;
    }
    const entries = nosql.list('accounting_entries');
    const nextNo = entries.reduce((max, e) => Math.max(max, e.voucherNo), 100) + 1;
    const sayadiId = String(body.sayadiId || '').trim() || `10405000${Math.floor(10000000 + Math.random() * 89999999)}`;
    const dueDate = String(body.dueDate || '۱۴۰۵/۰۹/۳۰').trim();

    const voucher: JournalEntry = {
      id: `je_${nextNo}_${Date.now()}`,
      voucherNo: nextNo,
      date: todayJalaliFallback(),
      description: `صدور چک صیادی به نام ${payee} (سررسید ${dueDate})`,
      source: 'check',
      status: 'final',
      refCode: sayadiId.slice(-6),
      lines: [
        {
          accountCode: body.expenseAccountCode || '5102',
          subsidiary: payee,
          description: 'شناسایی هزینه / تعهد پیمانکار',
          debit: amount,
          credit: 0,
        },
        {
          accountCode: '2102',
          subsidiary: payee,
          description: `چک صیادی ${sayadiId}`,
          debit: 0,
          credit: amount,
        },
      ],
    };
    nosql.insert('accounting_entries', voucher, false);

    const check = nosql.insert('sayadi_checks', {
      id: `chk_${Date.now()}`,
      sayadiId,
      payee,
      dueDate,
      amountTomans: amount,
      bankAccountCode: '1102',
      expenseAccountCode: body.expenseAccountCode || '5102',
      status: 'registered',
      voucherNo: nextNo,
    });

    res.status(201).json({ ok: true, check, voucher });
  });

  app.post('/api/v1/rbac/accounting/checks/:id/clear', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'complex_accountant', 'block_manager', 'block_accountant'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'مجوز پاس کردن چک ندارید.' } });
      return;
    }
    const chk = nosql.findById('sayadi_checks', req.params.id);
    if (!chk || chk.status === 'cleared') {
      res.status(404).json({ error: { message: 'چک معتبر برای پاس شدن یافت نشد.' } });
      return;
    }
    const entries = nosql.list('accounting_entries');
    const nextNo = entries.reduce((max, e) => Math.max(max, e.voucherNo), 100) + 1;
    const voucher: JournalEntry = {
      id: `je_${nextNo}_${Date.now()}`,
      voucherNo: nextNo,
      date: todayJalaliFallback(),
      description: `پاس شدن چک صیادی ${chk.sayadiId} در وجه ${chk.payee}`,
      source: 'check',
      status: 'final',
      refCode: chk.sayadiId.slice(-6),
      lines: [
        { accountCode: '2102', subsidiary: chk.payee, description: 'تسویه اسناد پرداختنی', debit: chk.amountTomans, credit: 0 },
        { accountCode: chk.bankAccountCode || '1102', description: `برداشت بانکی چک صیادی ${chk.sayadiId}`, debit: 0, credit: chk.amountTomans },
      ],
    };
    nosql.insert('accounting_entries', voucher, false);
    const updated = nosql.updateById('sayadi_checks', chk.id, (prev) => ({
      ...prev,
      status: 'cleared',
      voucherNo: nextNo,
    }));
    res.json({ ok: true, check: updated, voucher });
  });

  // 13. Multi-Block Staff Sharing (Block Manager / Complex Manager grants an Accountant or Facilities Technician access to a Block)
  app.get('/api/v1/rbac/shareable-staff', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'block_manager', 'facilities_chief'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'مجوز مشاهده فهرست اشتراک‌گذاری پرسنل ندارید.' } });
      return;
    }
    const shareableRoles: UserRoleId[] = [
      'block_accountant',
      'complex_accountant',
      'block_facilities',
      'facilities_chief',
      'block_caretaker',
    ];
    const staff = nosql
      .find('users', (u) => u.active && shareableRoles.includes(u.role))
      .map(stripUserSecrets);
    res.json({ ok: true, items: staff });
  });

  app.post('/api/v1/rbac/blocks/:blockId/share', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const blockId = String(req.params.blockId || '').trim().toUpperCase();
    if (!['complex_manager', 'block_manager'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'فقط مدیر بلوک یا مدیر کل شهرک مجاز به اشتراک‌گذاری دسترسی بلوک هستند.' } });
      return;
    }
    if (actor.role === 'block_manager' && actor.blockId !== blockId) {
      res.status(403).json({ error: { message: `شما فقط مجاز به اشتراک‌گذاری دسترسی بلوک ${actor.blockId} هستید.` } });
      return;
    }
    const block = nosql.findById('blocks', blockId);
    if (!block) {
      res.status(404).json({ error: { message: 'بلوک مورد نظر یافت نشد.' } });
      return;
    }
    const body = (req.body || {}) as {
      userId?: string;
      permissions?: BlockSharePermission[];
    };
    const targetUser = body.userId ? nosql.findById('users', body.userId) : undefined;
    if (!targetUser) {
      res.status(404).json({ error: { message: 'حساب پرسنل مورد نظر یافت نشد.' } });
      return;
    }
    const perms: BlockSharePermission[] =
      Array.isArray(body.permissions) && body.permissions.length > 0
        ? body.permissions
        : targetUser.role.includes('accountant')
          ? ['finance', 'excel_import']
          : ['facilities'];

    const updated = nosql.updateById('users', targetUser.id, (prev) => {
      const existing = (prev.assignedBlocks || []).filter((g) => g.blockId !== blockId);
      return {
        ...prev,
        assignedBlocks: [
          ...existing,
          {
            blockId,
            grantedByUserId: actor.id,
            grantedByName: actor.displayName,
            grantedAtMs: Date.now(),
            permissions: perms,
          },
        ],
      };
    });

    res.json({ ok: true, user: updated ? stripUserSecrets(updated) : null });
  });

  app.delete('/api/v1/rbac/blocks/:blockId/share/:userId', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const blockId = String(req.params.blockId || '').trim().toUpperCase();
    const userId = String(req.params.userId || '').trim();
    if (!['complex_manager', 'block_manager'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'مجوز لغو اشتراک دسترسی ندارید.' } });
      return;
    }
    if (actor.role === 'block_manager' && actor.blockId !== blockId) {
      res.status(403).json({ error: { message: 'فقط برای بلوک تحت مدیریت خود می‌توانید دسترسی را لغو کنید.' } });
      return;
    }
    const updated = nosql.updateById('users', userId, (prev) => ({
      ...prev,
      assignedBlocks: (prev.assignedBlocks || []).filter((g) => g.blockId !== blockId),
    }));
    res.json({ ok: true, user: updated ? stripUserSecrets(updated) : null });
  });

  // 14. Bank Statement Excel Patterns & Batch Reconciliation Imports (Server-Side NoSQL)
  app.get('/api/v1/rbac/excel-patterns', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const items = nosql.find(
      'excel_bank_patterns',
      (p) => p.blockId === 'ALL' || canAccessBlock(user, p.blockId),
    );
    res.json({ ok: true, items });
  });

  const canUseExcelOnBlock = (actor: StoredUserDoc, blockId: string): boolean => {
    if (['complex_manager', 'complex_accountant'].includes(actor.role)) return true;
    if (['block_manager', 'block_accountant'].includes(actor.role)) {
      return blockId === 'ALL' || canAccessBlock(actor, blockId);
    }
    return (actor.assignedBlocks || []).some(
      (g) => (blockId === 'ALL' || g.blockId === blockId) && g.permissions.includes('excel_import'),
    );
  };

  app.post('/api/v1/rbac/excel-patterns', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const body = (req.body || {}) as {
      name?: string;
      blockId?: string;
      unitColumn?: string;
      amountColumn?: string;
      dateColumn?: string;
      traceColumn?: string;
      descriptionColumn?: string;
      currencyUnit?: 'tomans' | 'rials';
      unitMatchMode?: 'unit_column' | 'last_digits' | 'last_digits_and_charge' | 'exact_charge';
      suffixDigitCount?: 1 | 2 | 3;
      chargeToleranceTomans?: number;
      customFields?: Array<{
        id: string;
        fieldLabel: string;
        sourceType: 'column' | 'unit_from_column' | 'unit_from_last_digits' | 'resident_from_unit';
        columnName?: string;
      }>;
    };
    const targetBlock = String(body.blockId || actor.blockId || 'B').trim();
    if (!canUseExcelOnBlock(actor, targetBlock)) {
      res.status(403).json({ error: { message: 'فقط مدیر بلوک، مدیر شهرک، حسابدار یا همکار دارای مجوز اکسل مجاز به ذخیره الگوی بانکی هستند.' } });
      return;
    }
    const name = String(body.name || '').trim().slice(0, 120);
    const unitColumn = String(body.unitColumn || '').trim().slice(0, 80);
    const amountColumn = String(body.amountColumn || '').trim().slice(0, 80);
    const dateColumn = String(body.dateColumn || '').trim().slice(0, 80);
    if (!name || !amountColumn || !dateColumn) {
      res.status(400).json({ error: { message: 'نام الگو، نام دقیق ستون مبلغ/واریز و ستون تاریخ الزامی است.' } });
      return;
    }
    const validModes = ['unit_column', 'last_digits', 'last_digits_and_charge', 'exact_charge'] as const;
    const unitMatchMode =
      typeof body.unitMatchMode === 'string' &&
      (validModes as readonly string[]).includes(body.unitMatchMode)
        ? (body.unitMatchMode as (typeof validModes)[number])
        : 'unit_column';
    if (unitMatchMode === 'unit_column' && !unitColumn) {
      res.status(400).json({ error: { message: 'در حالت نگاشت مستقیم، وارد کردن نام ستون «شماره واحد» الزامی است.' } });
      return;
    }
    const created = nosql.insert('excel_bank_patterns', {
      id: `pat_${Date.now()}`,
      name,
      blockId: targetBlock,
      unitColumn: unitColumn || undefined,
      amountColumn,
      dateColumn,
      traceColumn: String(body.traceColumn || '').trim().slice(0, 80) || undefined,
      descriptionColumn: String(body.descriptionColumn || '').trim().slice(0, 80) || undefined,
      currencyUnit: body.currencyUnit === 'tomans' ? 'tomans' : 'rials',
      unitMatchMode,
      suffixDigitCount: body.suffixDigitCount === 1 || body.suffixDigitCount === 3 ? body.suffixDigitCount : 2,
      chargeToleranceTomans: Math.max(0, Math.min(50_000_000, Math.round(Number(body.chargeToleranceTomans ?? 2500)))),
      customFields: Array.isArray(body.customFields) ? body.customFields.slice(0, 8) : [],
      createdByUserId: actor.id,
      createdByName: actor.displayName,
      createdAtMs: Date.now(),
    });
    res.status(201).json({ ok: true, pattern: created });
  });

  app.delete('/api/v1/rbac/excel-patterns/:id', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const existing = nosql.findById('excel_bank_patterns', req.params.id);
    if (!existing) {
      res.status(404).json({ error: { message: 'الگو یافت نشد.' } });
      return;
    }
    if (!canUseExcelOnBlock(actor, existing.blockId)) {
      res.status(403).json({ error: { message: 'مجوز حذف الگوی این بلوک را ندارید.' } });
      return;
    }
    nosql.removeById('excel_bank_patterns', existing.id);
    res.json({ ok: true });
  });

  app.get('/api/v1/rbac/excel-imports', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const reqBlockId = typeof req.query.blockId === 'string' ? req.query.blockId.trim() : '';
    const items = nosql.find('excel_import_batches', (b) => {
      if (!canAccessBlock(user, b.blockId)) return false;
      if (reqBlockId && reqBlockId !== 'ALL') return b.blockId === reqBlockId;
      return true;
    });
    res.json({ ok: true, items });
  });

  app.post('/api/v1/rbac/excel-imports/commit', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const body = (req.body || {}) as {
      blockId?: string;
      periodLabel?: string;
      patternName?: string;
      fileName?: string;
      bankAccountCode?: '1102' | '1103';
      matchedRows?: Array<{
        unitId: string;
        unitCode: string;
        residentName: string;
        amountTomans: number;
        depositDate: string;
        traceCode: string;
        statusLabel: string;
        customRecord?: Record<string, string>;
      }>;
    };
    const blockId = String(body.blockId || actor.blockId || 'B').trim();
    if (!canUseExcelOnBlock(actor, blockId)) {
      res.status(403).json({ error: { message: `شما مجوز ثبت اکسل بانکی برای بلوک ${blockId} را ندارید.` } });
      return;
    }
    const validRows = (Array.isArray(body.matchedRows) ? body.matchedRows : [])
      .slice(0, 500)
      .filter((r) => r && r.unitCode && Number.isFinite(Number(r.amountTomans)) && Number(r.amountTomans) > 0);
    if (validRows.length === 0) {
      res.status(400).json({ error: { message: 'هیچ ردیف تطبیق‌یافته‌ای برای ثبت در دیتابیس وجود ندارد.' } });
      return;
    }

    const bankCode: '1102' | '1103' = body.bankAccountCode === '1103' ? '1103' : '1102';
    const periodLabel = String(body.periodLabel || 'دوره ماهانه جاری').trim().slice(0, 100);
    const patternName = String(body.patternName || 'الگوی دستی').trim().slice(0, 120);
    const fileName = String(body.fileName || 'bank-statement.xlsx').trim().slice(0, 140);
    const now = Date.now();
    const totalTomans = validRows.reduce((s, r) => s + Math.round(Number(r.amountTomans)), 0);

    // 1. Auto-post balanced double-entry journal voucher for the entire bank Excel import batch
    const entries = nosql.list('accounting_entries');
    const nextNo = entries.reduce((max, e) => Math.max(max, e.voucherNo), 100) + 1;
    const voucher: JournalEntry = {
      id: `je_${nextNo}_${now}`,
      voucherNo: nextNo,
      date: todayJalaliFallback(),
      description: `ثبت خودکار گردش بانکی بلوک ${blockId} (${periodLabel}) — ${validRows.length.toLocaleString('fa-IR')} واحد`,
      source: 'receipt',
      status: 'final',
      refCode: `XLS-${blockId}-${nextNo}`,
      lines: [
        {
          accountCode: bankCode,
          description: `تجمیع واریزی‌های اکسل بانکی بلوک ${blockId} (${periodLabel})`,
          debit: totalTomans,
          credit: 0,
        },
        ...validRows.map((r) => ({
          accountCode: '1105',
          subsidiary: `واحد ${r.unitCode} (${r.residentName})`,
          description: `واریز شارژ ${r.depositDate} — ${r.traceCode}`,
          debit: 0,
          credit: Math.round(Number(r.amountTomans)),
        })),
      ],
    };
    nosql.insert('accounting_entries', voucher, false);

    // 2. Insert approved payment_receipts AND reduce unit debt in NoSQL units collection
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const amt = Math.round(Number(r.amountTomans));
      const unitDoc =
        (r.unitId ? nosql.findById('units', r.unitId) : undefined) ||
        nosql.list('units').find((u) => u.unitCode === r.unitCode && u.blockId === blockId);

      nosql.insert('payment_receipts', {
        id: `rcp_xls_${now}_${i}`,
        blockId,
        unitCode: r.unitCode,
        residentUserId: unitDoc?.residentUserId || 'u_excel_import',
        residentName: r.residentName || unitDoc?.residentName || `ساکن واحد ${r.unitCode}`,
        amountTomans: amt,
        traceCode: r.traceCode || `XLS-${nextNo}-${i + 1}`,
        channel: 'شبا / پایا',
        bankAccountCode: bankCode,
        dateLabel: r.depositDate || todayJalaliFallback(),
        note: `تطبیق خودکار اکسل بانکی (${periodLabel}) • ${r.statusLabel}`,
        status: 'approved',
        voucherNo: nextNo,
        reviewedByName: actor.displayName,
        reviewNote: `ثبت خودکار از فایل ${fileName}`,
        createdAtMs: now + i,
        updatedAtMs: now + i,
      });

      if (unitDoc) {
        nosql.updateById('units', unitDoc.id, (prev) => ({
          ...prev,
          debtTomans: Math.max(0, prev.debtTomans - amt),
          balanceTomans: prev.balanceTomans + Math.max(0, amt - prev.debtTomans),
        }));
      }
    }

    // 3. Persist batch audit record in excel_import_batches
    const batch = nosql.insert('excel_import_batches', {
      id: `xlsb_${now}`,
      blockId,
      periodLabel,
      patternName,
      fileName,
      bankAccountCode: bankCode,
      matchedCount: validRows.length,
      totalMatchedTomans: totalTomans,
      voucherNo: nextNo,
      importedByUserId: actor.id,
      importedByName: actor.displayName,
      createdAtMs: now,
      records: validRows.map((r) => ({
        unitCode: r.unitCode,
        residentName: r.residentName,
        amountTomans: Math.round(Number(r.amountTomans)),
        depositDate: r.depositDate,
        traceCode: r.traceCode,
        statusLabel: r.statusLabel,
        customRecord: r.customRecord || {},
      })),
    });

    res.status(201).json({ ok: true, batch, voucher });
  });

  // 15. Per-User Appearance Preferences (Corner Style: sharp/curved + 6 Modern Trend Palettes)
  app.patch('/api/v1/rbac/me/preferences', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const body = (req.body || {}) as {
      cornerStyle?: string;
      paletteId?: string;
    };
    const validPalettes = [
      'niloofar_default',
      'emerald_atelier',
      'terracotta_sand',
      'nordic_indigo',
      'velvet_burgundy',
      'graphite_cobalt',
    ] as const;

    const nextCorner: 'sharp' | 'curved' =
      body.cornerStyle === 'sharp'
        ? 'sharp'
        : body.cornerStyle === 'curved'
          ? 'curved'
          : actor.preferences?.cornerStyle || 'curved';

    const nextPalette =
      typeof body.paletteId === 'string' &&
      (validPalettes as readonly string[]).includes(body.paletteId)
        ? (body.paletteId as (typeof validPalettes)[number])
        : actor.preferences?.paletteId || 'niloofar_default';

    const updated = nosql.updateById('users', actor.id, (prev) => ({
      ...prev,
      preferences: {
        cornerStyle: nextCorner,
        paletteId: nextPalette,
      },
    }));

    res.json({
      ok: true,
      preferences: updated?.preferences ?? { cornerStyle: nextCorner, paletteId: nextPalette },
      user: updated ? stripUserSecrets(updated) : stripUserSecrets(actor),
    });
  });

  // 15b. Per-User Profile Settings (Avatar Photo Upload, Display Name, Phone, Bio) persisted in NoSQL
  app.patch('/api/v1/rbac/me/profile', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const body = (req.body || {}) as {
      displayName?: string;
      phone?: string;
      bio?: string;
      avatarDataUrl?: string | null;
    };

    const nextDisplayName =
      typeof body.displayName === 'string' && body.displayName.trim().length >= 2
        ? body.displayName.trim().slice(0, 80)
        : actor.displayName;
    const nextPhone =
      typeof body.phone === 'string' ? body.phone.trim().slice(0, 32) : actor.phone;
    const nextBio =
      typeof body.bio === 'string' ? body.bio.trim().slice(0, 180) : actor.bio;

    let nextAvatar = actor.avatarDataUrl;
    if (body.avatarDataUrl === null || body.avatarDataUrl === '') {
      nextAvatar = undefined;
    } else if (typeof body.avatarDataUrl === 'string') {
      const clean = sanitizeImageDataUrl(body.avatarDataUrl);
      if (!clean) {
        res.status(400).json({
          error: { message: 'فرمت تصویر پروفایل معتبر نیست یا حجم آن بیش از حد مجاز است.' },
        });
        return;
      }
      nextAvatar = clean;
    }

    const updated = nosql.updateById('users', actor.id, (prev) => ({
      ...prev,
      displayName: nextDisplayName,
      phone: nextPhone,
      bio: nextBio,
      avatarDataUrl: nextAvatar,
    }));

    res.json({
      ok: true,
      user: updated ? stripUserSecrets(updated) : stripUserSecrets(actor),
    });
  });

  // 16. Standalone Resident App Self-Onboarding (Public, strictly gated by Manager-Issued Unit Code)
  app.get('/api/v1/resident-onboarding/info', (req, res) => {
    const reqBlock = typeof req.query.block === 'string' ? req.query.block.trim().toUpperCase() : '';
    const blocks = nosql.list('blocks');
    const selectedBlock = reqBlock ? blocks.find((b) => b.id === reqBlock) || null : null;
    res.json({
      ok: true,
      complexName: 'مجتمع مسکونی نیلوفر',
      appVersion: 'نسخه اختصاصی ساکنین ۲.۴',
      selectedBlock: selectedBlock
        ? { id: selectedBlock.id, name: selectedBlock.name, managerName: selectedBlock.managerName }
        : null,
      blocks: blocks.map((b) => ({ id: b.id, name: b.name, managerName: b.managerName })),
    });
  });

  app.post('/api/v1/resident-onboarding/verify-code', (req, res) => {
    const body = (req.body || {}) as { code?: string };
    const normalized = normalizeInviteCode(body.code || '');
    if (!normalized) {
      res.status(400).json({ error: { message: 'لطفاً کد اختصاصی واحد دریافتی از مدیر بلوک را وارد کنید.' } });
      return;
    }
    const invite = nosql.list('unit_invite_codes').find((c) => normalizeInviteCode(c.code) === normalized);
    if (!invite) {
      res.status(404).json({
        error: { message: 'کد اختصاصی واردشده معتبر نیست. لطفاً کد واحد خود را از مدیر بلوک دریافت کنید.' },
      });
      return;
    }
    if (invite.status === 'revoked') {
      res.status(403).json({
        error: { message: 'این کد اختصاصی توسط مدیر بلوک باطل شده است. کد جدید دریافت نمایید.' },
      });
      return;
    }
    if (invite.status === 'used') {
      res.status(409).json({
        error: { message: 'این کد اختصاصی قبلاً برای ثبت اطلاعات این واحد استفاده شده است.' },
      });
      return;
    }
    const blockDoc = nosql.findById('blocks', invite.blockId);
    const unitDoc = nosql.list('units').find((u) => u.blockId === invite.blockId && u.unitCode === invite.unitCode);
    res.json({
      ok: true,
      invite: {
        code: invite.code,
        blockId: invite.blockId,
        blockName: blockDoc?.name || `بلوک ${invite.blockId}`,
        managerName: blockDoc?.managerName || 'مدیر بلوک',
        unitCode: invite.unitCode,
        existingParkingCode: unitDoc?.parkingCode || '',
        existingStorageCode: unitDoc?.storageCode || '',
      },
    });
  });

  app.post('/api/v1/resident-onboarding/submit', (req, res) => {
    const body = (req.body || {}) as Partial<ResidentOnboardingPayload>;
    const normalized = normalizeInviteCode(body.inviteCode || '');
    const invite = nosql.list('unit_invite_codes').find((c) => normalizeInviteCode(c.code) === normalized);
    if (!invite || invite.status !== 'active') {
      res.status(403).json({
        error: { message: 'کد اختصاصی واحد نامعتبر یا قبلاً استفاده شده است. امکان ثبت اطلاعات وجود ندارد.' },
      });
      return;
    }

    const sanitizedVehicles: ResidentVehicleEntry[] = Array.isArray(body.vehicles)
      ? body.vehicles.slice(0, 5).map((v, idx) => ({
          id: `veh_${Date.now()}_${idx}`,
          vehicleType:
            v.vehicleType === 'موتورسیکلت' || v.vehicleType === 'وانت / شاسی‌بلند'
              ? v.vehicleType
              : 'سواری',
          modelAndColor: String(v.modelAndColor || '').trim(),
          plateText: String(v.plateText || '').trim(),
          parkingType:
            v.parkingType === 'پارکینگ طبقاتی' || v.parkingType === 'پارکینگ اجاره‌ای'
              ? v.parkingType
              : 'اختصاصی سنددار',
          parkingNumber: String(v.parkingNumber || '').trim(),
          parkingFloorOrZone: String(v.parkingFloorOrZone || '').trim() || undefined,
          parkingProofDataUrl: sanitizeDocumentDataUrl(v.parkingProofDataUrl),
          parkingProofName: String(v.parkingProofName || '').trim() || undefined,
        }))
      : [];

    const payload: ResidentOnboardingPayload = {
      inviteCode: invite.code,
      fullName: String(body.fullName || '').trim(),
      nationalId: String(body.nationalId || '').trim() || undefined,
      phone: String(body.phone || '').trim(),
      secondaryPhone: String(body.secondaryPhone || '').trim() || undefined,
      emergencyContactName: String(body.emergencyContactName || '').trim() || undefined,
      emergencyContactPhone: String(body.emergencyContactPhone || '').trim() || undefined,
      householdCount: Math.max(1, Math.min(20, Math.round(Number(body.householdCount || 1)))),
      occupancyType: body.occupancyType === 'مستأجر' ? 'مستأجر' : 'مالک ساکن',
      landlordName: String(body.landlordName || '').trim() || undefined,
      landlordPhone: String(body.landlordPhone || '').trim() || undefined,
      leaseStartJalali: String(body.leaseStartJalali || '').trim() || undefined,
      leaseEndJalali: String(body.leaseEndJalali || '').trim() || undefined,
      leaseContractDataUrl: sanitizeDocumentDataUrl(body.leaseContractDataUrl),
      leaseContractName: String(body.leaseContractName || '').trim() || undefined,
      storageCode: String(body.storageCode || '').trim() || undefined,
      hasPets: Boolean(body.hasPets),
      specialNeedsNote: String(body.specialNeedsNote || '').trim() || undefined,
      desiredUsername: String(body.desiredUsername || '').trim().toLowerCase() || undefined,
      desiredPassword: String(body.desiredPassword || '').trim() || undefined,
      vehicles: sanitizedVehicles,
    };

    const validation = validateResidentOnboarding(payload);
    if (!validation.ok) {
      res.status(400).json({ error: { message: validation.errors[0], details: validation.errors } });
      return;
    }

    const now = Date.now();
    const trackingCode = `NF-${String(now).slice(-5)}`;

    // If resident requested a desired password, stash a hash safely? We only create the account on manager approval,
    // or if desiredUsername is free we can pre-create an inactive resident account that activates on approval.
    if (payload.desiredUsername) {
      const exists = nosql
        .list('users')
        .find((u) => u.username.toLowerCase() === payload.desiredUsername!.toLowerCase());
      if (!exists) {
        nosql.insert('users', {
          id: `u_res_${now}`,
          username: payload.desiredUsername,
          passwordHash: hashPassword(payload.desiredPassword || '1234'),
          displayName: `${payload.fullName} (ساکن واحد ${invite.unitCode})`,
          role: 'resident',
          blockId: invite.blockId,
          unitCode: invite.unitCode,
          phone: payload.phone,
          createdByUserId: invite.createdByUserId,
          createdByName: 'ثبت‌نام خودکار QR (در انتظار تایید مدیر)',
          isTemporary: false,
          validFromMs: null,
          validUntilMs: null,
          active: false, // Activated automatically once Block/Complex Manager approves!
          createdAtMs: now,
        });
      }
    }

    const submission = nosql.insert('resident_submissions', {
      id: `sub_${now}`,
      trackingCode,
      inviteCode: invite.code,
      blockId: invite.blockId,
      unitCode: invite.unitCode,
      fullName: payload.fullName,
      nationalId: payload.nationalId,
      phone: payload.phone,
      secondaryPhone: payload.secondaryPhone,
      emergencyContactName: payload.emergencyContactName,
      emergencyContactPhone: payload.emergencyContactPhone,
      householdCount: payload.householdCount,
      occupancyType: payload.occupancyType,
      landlordName: payload.landlordName,
      landlordPhone: payload.landlordPhone,
      leaseStartJalali: payload.leaseStartJalali,
      leaseEndJalali: payload.leaseEndJalali,
      leaseContractDataUrl: payload.leaseContractDataUrl,
      leaseContractName: payload.leaseContractName,
      storageCode: payload.storageCode,
      hasPets: payload.hasPets,
      specialNeedsNote: payload.specialNeedsNote,
      desiredUsername: payload.desiredUsername,
      vehicles: sanitizedVehicles,
      status: 'pending_review',
      createdAtMs: now,
      updatedAtMs: now,
    });

    nosql.updateById('unit_invite_codes', invite.id, (prev) => ({
      ...prev,
      status: 'used',
      usedAtMs: now,
      usedByName: payload.fullName,
    }));

    res.status(201).json({
      ok: true,
      trackingCode,
      submission,
    });
  });

  // 17. Manager Unit Invite Codes & Resident Onboarding Review Pipeline
  app.get('/api/v1/rbac/unit-invite-codes', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'block_manager'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'فقط مدیر بلوک یا مدیریت کل شهرک مجاز به مدیریت کدهای اختصاصی واحدها هستند.' } });
      return;
    }
    const reqBlockId = typeof req.query.blockId === 'string' ? req.query.blockId.trim().toUpperCase() : '';
    const items = nosql.find('unit_invite_codes', (c) => {
      if (!canAccessBlock(actor, c.blockId)) return false;
      if (reqBlockId && reqBlockId !== 'ALL') return c.blockId === reqBlockId;
      return true;
    });
    res.json({ ok: true, items });
  });

  app.post('/api/v1/rbac/unit-invite-codes', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'block_manager'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'فقط مدیر بلوک یا مدیریت کل شهرک مجاز به تولید کد اختصاصی واحد هستند.' } });
      return;
    }
    const body = (req.body || {}) as {
      blockId?: string;
      unitCode?: string;
      batchAllUnits?: boolean;
    };
    const blockId =
      actor.role === 'block_manager'
        ? actor.blockId || 'B'
        : String(body.blockId || 'B').trim().toUpperCase();

    if (!canAccessBlock(actor, blockId)) {
      res.status(403).json({ error: { message: `مجوز تولید کد برای بلوک ${blockId} را ندارید.` } });
      return;
    }

    const now = Date.now();
    if (body.batchAllUnits) {
      const blockUnits = nosql.find('units', (u) => u.blockId === blockId);
      const createdList = [];
      for (const u of blockUnits) {
        const hasActive = nosql
          .list('unit_invite_codes')
          .some((c) => c.blockId === blockId && c.unitCode === u.unitCode && c.status === 'active');
        if (hasActive) continue;
        const doc = nosql.insert('unit_invite_codes', {
          id: `inv_${now}_${u.unitCode}`,
          code: buildUnitInviteCode(blockId, u.unitCode),
          blockId,
          unitCode: u.unitCode,
          status: 'active',
          createdByUserId: actor.id,
          createdByName: actor.displayName,
          createdAtMs: now,
        });
        createdList.push(doc);
      }
      res.status(201).json({ ok: true, createdCount: createdList.length, items: createdList });
      return;
    }

    const rawUnit = String(body.unitCode || '').trim().toUpperCase();
    if (!rawUnit) {
      res.status(400).json({ error: { message: 'شماره واحد برای تولید کد اختصاصی الزامی است.' } });
      return;
    }
    const unitCode = rawUnit.startsWith(`${blockId}-`) ? rawUnit : `${blockId}-${rawUnit}`;

    // Revoke previous active codes for this same unit so only the latest code works
    const prevActive = nosql.find(
      'unit_invite_codes',
      (c) => c.blockId === blockId && c.unitCode === unitCode && c.status === 'active',
    );
    for (const old of prevActive) {
      nosql.updateById('unit_invite_codes', old.id, (p) => ({ ...p, status: 'revoked' }));
    }

    const created = nosql.insert('unit_invite_codes', {
      id: `inv_${now}_${Math.random().toString(16).slice(2, 6)}`,
      code: buildUnitInviteCode(blockId, unitCode),
      blockId,
      unitCode,
      status: 'active',
      createdByUserId: actor.id,
      createdByName: actor.displayName,
      createdAtMs: now,
    });

    res.status(201).json({ ok: true, invite: created });
  });

  app.patch('/api/v1/rbac/unit-invite-codes/:id', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'block_manager'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'مجوز تغییر وضعیت کد واحد ندارید.' } });
      return;
    }
    const existing = nosql.findById('unit_invite_codes', req.params.id);
    if (!existing || !canAccessBlock(actor, existing.blockId)) {
      res.status(404).json({ error: { message: 'کد اختصاصی یافت نشد.' } });
      return;
    }
    const body = (req.body || {}) as { status?: 'active' | 'revoked' };
    const nextStatus = body.status === 'active' ? 'active' : 'revoked';
    const updated = nosql.updateById('unit_invite_codes', existing.id, (prev) => ({
      ...prev,
      status: nextStatus,
    }));
    res.json({ ok: true, invite: updated });
  });

  app.get('/api/v1/rbac/resident-submissions', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'block_manager', 'complex_accountant', 'block_accountant'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'مجوز مشاهده پرونده‌های خودثبت‌نامی ساکنین ندارید.' } });
      return;
    }
    const reqBlockId = typeof req.query.blockId === 'string' ? req.query.blockId.trim().toUpperCase() : '';
    const items = nosql.find('resident_submissions', (s) => {
      if (!canAccessBlock(actor, s.blockId)) return false;
      if (reqBlockId && reqBlockId !== 'ALL') return s.blockId === reqBlockId;
      return true;
    });
    res.json({ ok: true, items });
  });

  app.post('/api/v1/rbac/resident-submissions/:id/review', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'block_manager'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'فقط مدیر بلوک یا مدیریت کل شهرک مجاز به تایید پرونده ساکنین هستند.' } });
      return;
    }
    const submission = nosql.findById('resident_submissions', req.params.id);
    if (!submission) {
      res.status(404).json({ error: { message: 'پرونده ثبت‌نام ساکن یافت نشد.' } });
      return;
    }
    if (!canAccessBlock(actor, submission.blockId)) {
      res.status(403).json({ error: { message: 'این پرونده مربوط به بلوک دیگری است.' } });
      return;
    }

    const body = (req.body || {}) as { decision?: 'approved' | 'rejected'; reviewNote?: string };
    const decision = body.decision === 'rejected' ? 'rejected' : 'approved';
    const now = Date.now();
    let approvedVehiclesCount = 0;

    if (decision === 'approved') {
      // 1. Activate resident login account if they chose a desiredUsername
      let residentUserId: string | null = null;
      if (submission.desiredUsername) {
        const resAcc = nosql
          .list('users')
          .find((u) => u.username.toLowerCase() === submission.desiredUsername!.toLowerCase());
        if (resAcc) {
          nosql.updateById('users', resAcc.id, (prev) => ({
            ...prev,
            active: true,
            displayName: `${submission.fullName} (ساکن واحد ${submission.unitCode})`,
            phone: submission.phone,
            createdByName: `${actor.displayName} (تایید QR)`,
          }));
          residentUserId = resAcc.id;
        }
      }

      // 2. Write complete verified resident dossier into the Block's `units` collection (readable by Block & Complex Manager!)
      const existingUnit = nosql
        .list('units')
        .find((u) => u.blockId === submission.blockId && u.unitCode === submission.unitCode);
      const primaryVehicle = submission.vehicles[0];
      const numericUnit = parseInt(submission.unitCode.replace(/\D/g, ''), 10) || 1;

      if (existingUnit) {
        nosql.updateById('units', existingUnit.id, (prev) => ({
          ...prev,
          residentUserId: residentUserId ?? prev.residentUserId,
          residentName: submission.fullName,
          occupancyType: submission.occupancyType,
          phone: submission.phone,
          secondaryPhone: submission.secondaryPhone,
          nationalId: submission.nationalId,
          householdCount: submission.householdCount,
          emergencyContactName: submission.emergencyContactName,
          emergencyContactPhone: submission.emergencyContactPhone,
          landlordName: submission.landlordName,
          landlordPhone: submission.landlordPhone,
          leaseStartJalali: submission.leaseStartJalali,
          leaseEndJalali: submission.leaseEndJalali,
          leaseContractDataUrl: submission.leaseContractDataUrl,
          hasPets: submission.hasPets,
          specialNeedsNote: submission.specialNeedsNote,
          vehicles: submission.vehicles,
          onboardingVerified: true,
          lastVerifiedAtMs: now,
          plateText: primaryVehicle?.plateText || prev.plateText,
          parkingCode: primaryVehicle?.parkingNumber || prev.parkingCode,
          storageCode: submission.storageCode || prev.storageCode,
        }));
      } else {
        const blockDoc = nosql.findById('blocks', submission.blockId);
        nosql.insert(
          'units',
          {
            id: `unit_${submission.blockId.toLowerCase()}_${numericUnit}_${now}`,
            blockId: submission.blockId,
            unitCode: submission.unitCode,
            unitNumber: numericUnit,
            floor: Math.max(1, Math.floor(numericUnit / 100) || 1),
            residentUserId,
            residentName: submission.fullName,
            occupancyType: submission.occupancyType,
            phone: submission.phone,
            secondaryPhone: submission.secondaryPhone,
            nationalId: submission.nationalId,
            householdCount: submission.householdCount,
            emergencyContactName: submission.emergencyContactName,
            emergencyContactPhone: submission.emergencyContactPhone,
            landlordName: submission.landlordName,
            landlordPhone: submission.landlordPhone,
            leaseStartJalali: submission.leaseStartJalali,
            leaseEndJalali: submission.leaseEndJalali,
            leaseContractDataUrl: submission.leaseContractDataUrl,
            hasPets: submission.hasPets,
            specialNeedsNote: submission.specialNeedsNote,
            vehicles: submission.vehicles,
            onboardingVerified: true,
            lastVerifiedAtMs: now,
            plateText: primaryVehicle?.plateText || 'ثبت نشده',
            parkingCode: primaryVehicle?.parkingNumber || '-',
            storageCode: submission.storageCode || '-',
            balanceTomans: 0,
            debtTomans: 0,
            expectedChargeTomans: blockDoc?.monthlyChargeBaseTomans || 1_120_000,
          },
          false,
        );
      }

      // 3. Push EVERY verified vehicle plate into `approved_vehicles` for Gate Guard (انتظامات و گیت ورودی خودرو)!
      for (let i = 0; i < submission.vehicles.length; i++) {
        const v = submission.vehicles[i];
        const norm = normalizePlateForMatch(v.plateText);
        if (!norm) continue;
        const dup = nosql
          .list('approved_vehicles')
          .find((av) => av.normalizedPlate === norm && av.unitCode === submission.unitCode);
        if (dup) {
          nosql.updateById('approved_vehicles', dup.id, (prev) => ({
            ...prev,
            residentName: submission.fullName,
            residentPhone: submission.phone,
            occupancyType: submission.occupancyType,
            vehicleType: v.vehicleType,
            modelAndColor: v.modelAndColor || prev.modelAndColor,
            plateText: v.plateText,
            parkingType: v.parkingType,
            parkingNumber: v.parkingNumber,
            parkingFloorOrZone: v.parkingFloorOrZone,
            hasParkingProof: Boolean(v.parkingProofDataUrl || v.parkingProofName || v.parkingType === 'اختصاصی سنددار'),
            parkingProofDataUrl: v.parkingProofDataUrl || prev.parkingProofDataUrl,
            gateAccessEnabled: true,
            approvedByName: actor.displayName,
            approvedAtMs: now,
          }));
        } else {
          nosql.insert('approved_vehicles', {
            id: `aveh_${now}_${i}`,
            blockId: submission.blockId,
            unitCode: submission.unitCode,
            residentName: submission.fullName,
            residentPhone: submission.phone,
            occupancyType: submission.occupancyType,
            vehicleType: v.vehicleType,
            modelAndColor: v.modelAndColor || 'ثبت‌شده توسط ساکن',
            plateText: v.plateText,
            normalizedPlate: norm,
            parkingType: v.parkingType,
            parkingNumber: v.parkingNumber,
            parkingFloorOrZone: v.parkingFloorOrZone,
            hasParkingProof: Boolean(v.parkingProofDataUrl || v.parkingProofName || v.parkingType === 'اختصاصی سنددار'),
            parkingProofDataUrl: v.parkingProofDataUrl,
            gateAccessEnabled: true,
            sourceSubmissionId: submission.id,
            approvedByName: actor.displayName,
            approvedAtMs: now,
          });
        }
        approvedVehiclesCount += 1;
      }

      // 4. Send automatic welcome notice to the unit
      nosql.insert('block_notices', {
        id: `ntc_onb_${now}`,
        blockId: submission.blockId,
        targetUnitCode: submission.unitCode,
        title: `تایید پرونده سکونت و فعال‌سازی پلاک خودرو (${submission.unitCode})`,
        body: `اطلاعات سکونت ${submission.fullName} توسط ${actor.displayName} تایید شد و ${approvedVehiclesCount.toLocaleString('fa-IR')} پلاک خودرو در لیست مجاز انتظامات و گیت ورودی ثبت گردید.`,
        severity: 'info',
        senderUserId: actor.id,
        senderName: actor.displayName,
        senderRoleTitle: ROLE_DEFINITIONS[actor.role].title,
        createdAtMs: now,
      });
    } else {
      // Rejected -> reactivate the unit invite code so the resident can fix & resubmit!
      const inv = nosql
        .list('unit_invite_codes')
        .find((c) => normalizeInviteCode(c.code) === normalizeInviteCode(submission.inviteCode));
      if (inv) {
        nosql.updateById('unit_invite_codes', inv.id, (prev) => ({
          ...prev,
          status: 'active',
        }));
      }
    }

    const updated = nosql.updateById('resident_submissions', submission.id, (prev) => ({
      ...prev,
      status: decision,
      reviewNote: body.reviewNote ? String(body.reviewNote).trim() : prev.reviewNote,
      reviewedByUserId: actor.id,
      reviewedByName: actor.displayName,
      updatedAtMs: now,
    }));

    res.json({
      ok: true,
      submission: updated,
      approvedVehiclesCount,
    });
  });

  // 18. Approved Resident Vehicles Registry (Readable by Gate Guard, Complex Manager & Block Managers)
  app.get('/api/v1/rbac/approved-vehicles', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const reqBlockId = typeof req.query.blockId === 'string' ? req.query.blockId.trim().toUpperCase() : '';
    const items = nosql.find('approved_vehicles', (v) => {
      if (actor.role === 'gate_guard' || ROLE_DEFINITIONS[actor.role].scopeLevel === 'complex') {
        if (reqBlockId && reqBlockId !== 'ALL') return v.blockId === reqBlockId;
        return true;
      }
      if (actor.role === 'resident') {
        return v.unitCode === actor.unitCode;
      }
      return canAccessBlock(actor, v.blockId);
    });
    res.json({ ok: true, items });
  });

  app.patch('/api/v1/rbac/approved-vehicles/:id', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (!['complex_manager', 'block_manager', 'gate_guard'].includes(actor.role)) {
      res.status(403).json({ error: { message: 'مجوز تغییر وضعیت خودرو ندارید.' } });
      return;
    }
    const existing = nosql.findById('approved_vehicles', req.params.id);
    if (!existing) {
      res.status(404).json({ error: { message: 'خودروی مجاز یافت نشد.' } });
      return;
    }
    if (actor.role === 'block_manager' && !canAccessBlock(actor, existing.blockId)) {
      res.status(403).json({ error: { message: 'این خودرو متعلق به بلوک دیگری است.' } });
      return;
    }
    const body = (req.body || {}) as { gateAccessEnabled?: boolean };
    const updated = nosql.updateById('approved_vehicles', existing.id, (prev) => ({
      ...prev,
      gateAccessEnabled:
        typeof body.gateAccessEnabled === 'boolean' ? body.gateAccessEnabled : prev.gateAccessEnabled,
    }));
    res.json({ ok: true, vehicle: updated });
  });
}
