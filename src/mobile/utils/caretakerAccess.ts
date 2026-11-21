import type { BlockAccessGrant, RbacUserRecord, UserRoleId } from '../rbac/roles.ts';

export type CaretakerRoleId = 'block_caretaker' | 'temp_caretaker';

export interface CaretakerAccountInput {
  displayName: string;
  username: string;
  password?: string;
  phone?: string;
  role: CaretakerRoleId;
  blockIds: string[];
}

export interface CaretakerValidationResult {
  ok: boolean;
  errors: string[];
  cleaned?: {
    displayName: string;
    username: string;
    password?: string;
    phone: string;
    role: CaretakerRoleId;
    blockIds: string[];
  };
}

export function isCaretakerRole(role: UserRoleId): role is CaretakerRoleId {
  return role === 'block_caretaker' || role === 'temp_caretaker';
}

/**
 * Extracts the complete, deduplicated list of block IDs assigned to a caretaker
 * across primary blockId, explicit caretakerBlockIds, and assignedBlocks grants.
 */
export function getCaretakerBlockIds(
  user: Pick<RbacUserRecord, 'blockId' | 'assignedBlocks'> & { caretakerBlockIds?: string[] },
): string[] {
  const ordered: string[] = [];
  const pushUnique = (id?: string | null) => {
    const clean = typeof id === 'string' ? id.trim() : '';
    if (clean && !ordered.includes(clean)) {
      ordered.push(clean);
    }
  };
  pushUnique(user.blockId);
  for (const id of user.caretakerBlockIds ?? []) {
    pushUnique(id);
  }
  for (const grant of user.assignedBlocks ?? []) {
    pushUnique(grant.blockId);
  }
  return ordered;
}

/**
 * Normalizes and authorizes requested block IDs for a caretaker account.
 * - complex_manager: can assign any non-empty subset of valid complex blocks.
 * - block_manager: scoped strictly to their own managed block (preserving other blocks
 *   already assigned by complex_manager when editing an existing multi-block caretaker).
 */
export function normalizeCaretakerBlockIds(params: {
  requestedBlockIds: string[];
  validBlockIds: string[];
  actorRole: UserRoleId;
  actorBlockId: string | null;
  existingBlockIds?: string[];
}): { ok: boolean; blockIds: string[]; reason?: string } {
  const validSet = new Set(params.validBlockIds.map((b) => b.trim()).filter(Boolean));
  const cleanedRequested = Array.from(
    new Set(
      (params.requestedBlockIds || [])
        .map((b) => String(b || '').trim())
        .filter((b) => b.length > 0),
    ),
  );

  for (const id of cleanedRequested) {
    if (!validSet.has(id)) {
      return {
        ok: false,
        blockIds: [],
        reason: `بلوک «${id}» در فهرست بلوک‌های معتبر شهرک وجود ندارد.`,
      };
    }
  }

  if (params.actorRole === 'complex_manager') {
    if (cleanedRequested.length === 0) {
      return {
        ok: false,
        blockIds: [],
        reason: 'حداقل یک بلوک باید برای دسترسی سرایدار انتخاب شود.',
      };
    }
    return { ok: true, blockIds: cleanedRequested };
  }

  if (params.actorRole === 'block_manager') {
    const ownBlock = params.actorBlockId?.trim() || '';
    if (!ownBlock || !validSet.has(ownBlock)) {
      return {
        ok: false,
        blockIds: [],
        reason: 'بلوک تحت مدیریت شما مشخص نیست.',
      };
    }
    const existingSet = new Set((params.existingBlockIds || []).filter((b) => validSet.has(b)));
    // Block manager cannot add foreign blocks they do not manage
    const illegalAdditions = cleanedRequested.filter(
      (id) => id !== ownBlock && !existingSet.has(id),
    );
    if (illegalAdditions.length > 0) {
      return {
        ok: false,
        blockIds: [],
        reason: `مدیر بلوک ${ownBlock} مجاز به اعطای دسترسی به بلوک‌های دیگر (${illegalAdditions.join('، ')}) نیست.`,
      };
    }
    // Preserve any existing foreign blocks granted by complex_manager, and apply ownBlock toggle
    const preservedForeign = (params.existingBlockIds || []).filter(
      (id) => id !== ownBlock && validSet.has(id),
    );
    const includeOwn = cleanedRequested.includes(ownBlock);
    const merged = includeOwn
      ? [ownBlock, ...preservedForeign]
      : preservedForeign;

    if (merged.length === 0) {
      return {
        ok: false,
        blockIds: [],
        reason: `سرایدار باید حداقل به بلوک ${ownBlock} دسترسی داشته باشد.`,
      };
    }
    return { ok: true, blockIds: merged };
  }

  return {
    ok: false,
    blockIds: [],
    reason: 'فقط مدیر کل ساختمان/شهرک یا مدیر بلوک مجاز به مدیریت دسترسی سرایداران است.',
  };
}

/**
 * Validates caretaker account credentials and profile fields before saving to NoSQL.
 */
export function validateCaretakerAccountInput(
  input: CaretakerAccountInput,
  mode: 'create' | 'edit',
): CaretakerValidationResult {
  const errors: string[] = [];
  const displayName = String(input.displayName || '').trim();
  const username = String(input.username || '').trim().toLowerCase();
  const rawPass = typeof input.password === 'string' ? input.password.trim() : '';
  const phone = String(input.phone || '').trim();
  const blockIds = Array.from(
    new Set((input.blockIds || []).map((b) => String(b || '').trim()).filter(Boolean)),
  );

  if (!isCaretakerRole(input.role)) {
    errors.push('نوع حساب سرایدار معتبر نیست.');
  }
  if (displayName.length < 2) {
    errors.push('نام و نام خانوادگی سرایدار باید حداقل ۲ کاراکتر باشد.');
  }
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    errors.push('نام کاربری باید ۳ تا ۳۲ کاراکتر لاتین، عدد، نقطه، خط‌تیره یا زیرخط (_) باشد.');
  }
  if (mode === 'create' && rawPass.length < 4) {
    errors.push('رمز عبور اولیه سرایدار باید حداقل ۴ کاراکتر باشد.');
  }
  if (mode === 'edit' && rawPass.length > 0 && rawPass.length < 4) {
    errors.push('رمز عبور جدید باید حداقل ۴ کاراکتر باشد.');
  }
  if (blockIds.length === 0) {
    errors.push('حداقل یک بلوک باید برای دسترسی سرایدار انتخاب شود.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    cleaned: {
      displayName,
      username,
      password: rawPass || undefined,
      phone,
      role: input.role,
      blockIds,
    },
  };
}

/**
 * Builds deterministic NoSQL storage fields (`blockId`, `caretakerBlockIds`, `assignedBlocks`)
 * so primary block and multi-block access grants stay completely synchronized.
 */
export function buildCaretakerBlockGrants(
  blockIds: string[],
  actor: { id: string; displayName: string },
  nowMs: number = Date.now(),
): {
  primaryBlockId: string;
  caretakerBlockIds: string[];
  assignedBlocks: BlockAccessGrant[];
} {
  const unique = Array.from(new Set(blockIds.map((b) => b.trim()).filter(Boolean)));
  const primaryBlockId = unique[0] || 'B';
  const secondaryIds = unique.slice(1);
  const assignedBlocks: BlockAccessGrant[] = secondaryIds.map((blockId) => ({
    blockId,
    grantedByUserId: actor.id,
    grantedByName: actor.displayName,
    grantedAtMs: nowMs,
    permissions: ['caretaker'],
  }));
  return {
    primaryBlockId,
    caretakerBlockIds: unique,
    assignedBlocks,
  };
}
