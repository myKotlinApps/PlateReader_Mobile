import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessBlock,
  canCreateRole,
  computeTempWindow,
  formatRemainingDurationFa,
  isUserAccessActive,
  ROLE_DEFINITIONS,
  ROLE_ORDER,
} from './roles';

test('all 10 roles are defined with dock tabs and allowed sections', () => {
  assert.equal(ROLE_ORDER.length, 10);
  for (const id of ROLE_ORDER) {
    const def = ROLE_DEFINITIONS[id];
    assert.ok(def, `missing role ${id}`);
    assert.ok(def.dockTabs.length >= 3, `${id} should have >=3 dock tabs`);
    assert.ok(def.allowedSections.length >= 2, `${id} should allow sections`);
  }
});

test('hierarchical role creation enforces complex vs block boundaries', () => {
  // Complex manager can create block manager, complex accountant, temp caretaker
  assert.equal(canCreateRole('complex_manager', 'block_manager', null, 'B').ok, true);
  assert.equal(canCreateRole('complex_manager', 'complex_accountant', null, null).ok, true);
  assert.equal(canCreateRole('complex_manager', 'temp_caretaker', null, 'B').ok, true);

  // Block manager B can create caretakers, block accountant, block facilities, resident in block B
  assert.equal(canCreateRole('block_manager', 'block_caretaker', 'B', 'B').ok, true);
  assert.equal(canCreateRole('block_manager', 'temp_caretaker', 'B', 'B').ok, true);
  assert.equal(canCreateRole('block_manager', 'block_accountant', 'B', 'B').ok, true);
  assert.equal(canCreateRole('block_manager', 'resident', 'B', 'B').ok, true);

  // Block manager B CANNOT create another block manager, complex accountant, or users in block A
  assert.equal(canCreateRole('block_manager', 'block_manager', 'B', 'A').ok, false);
  assert.equal(canCreateRole('block_manager', 'complex_accountant', 'B', null).ok, false);
  assert.equal(canCreateRole('block_manager', 'block_caretaker', 'B', 'A').ok, false);

  // Resident and caretaker cannot create any accounts
  assert.equal(canCreateRole('resident', 'temp_caretaker', 'B', 'B').ok, false);
  assert.equal(canCreateRole('block_caretaker', 'temp_caretaker', 'B', 'B').ok, false);
});

test('temporary access window presets and expiry enforcement work accurately', () => {
  const now = 1_700_000_000_000;
  const half = computeTempWindow('half_day', now);
  assert.equal(half.validUntilMs - half.validFromMs, 12 * 3600_000);

  const twoDays = computeTempWindow('two_days', now);
  assert.equal(twoDays.validUntilMs - twoDays.validFromMs, 48 * 3600_000);

  // Active inside window
  const midCheck = isUserAccessActive(
    { active: true, isTemporary: true, validFromMs: half.validFromMs, validUntilMs: half.validUntilMs },
    now + 3 * 3600_000,
  );
  assert.equal(midCheck.active, true);
  assert.equal(midCheck.remainingMs, 9 * 3600_000);
  assert.ok(formatRemainingDurationFa(midCheck.remainingMs!).includes('ساعت'));

  // Expired after window
  const expiredCheck = isUserAccessActive(
    { active: true, isTemporary: true, validFromMs: half.validFromMs, validUntilMs: half.validUntilMs },
    now + 13 * 3600_000,
  );
  assert.equal(expiredCheck.active, false);
  assert.equal(expiredCheck.remainingMs, 0);

  // Suspended permanent user
  const suspendedCheck = isUserAccessActive(
    { active: false, isTemporary: false, validFromMs: null, validUntilMs: null },
    now,
  );
  assert.equal(suspendedCheck.active, false);
});

test('block access boundaries isolate block roles from other blocks', () => {
  assert.equal(canAccessBlock({ role: 'complex_manager', blockId: null }, 'A'), true);
  assert.equal(canAccessBlock({ role: 'block_manager', blockId: 'B' }, 'B'), true);
  assert.equal(canAccessBlock({ role: 'block_manager', blockId: 'B' }, 'A'), false);
  assert.equal(canAccessBlock({ role: 'resident', blockId: 'B' }, 'B'), true);
  assert.equal(canAccessBlock({ role: 'resident', blockId: 'B' }, 'C'), false);

  // Multi-block shared accountant (e.g., Mr. Mousavi granted Blocks A & B by their managers, not C)
  const sharedAccountant = {
    role: 'block_accountant' as const,
    blockId: 'B',
    assignedBlocks: [
      {
        blockId: 'A',
        grantedByUserId: 'usr_bm_a',
        grantedByName: 'مدیر بلوک A',
        grantedAtMs: Date.now(),
        permissions: ['finance' as const, 'excel_import' as const],
      },
      {
        blockId: 'B',
        grantedByUserId: 'usr_bm_b',
        grantedByName: 'مدیر بلوک B',
        grantedAtMs: Date.now(),
        permissions: ['finance' as const, 'excel_import' as const],
      },
    ],
  };
  assert.equal(canAccessBlock(sharedAccountant, 'A'), true);
  assert.equal(canAccessBlock(sharedAccountant, 'B'), true);
  assert.equal(canAccessBlock(sharedAccountant, 'C'), false);
});
