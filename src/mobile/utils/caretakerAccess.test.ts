import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCaretakerBlockGrants,
  getCaretakerBlockIds,
  normalizeCaretakerBlockIds,
  validateCaretakerAccountInput,
} from './caretakerAccess';

test('validateCaretakerAccountInput accepts valid create payload', () => {
  const res = validateCaretakerAccountInput(
    {
      displayName: 'حسین کریمی',
      username: 'Caretaker_AC',
      password: 'pass2026',
      phone: '09123334455',
      role: 'block_caretaker',
      blockIds: ['A', 'C', 'A'],
    },
    'create',
  );
  assert.equal(res.ok, true);
  assert.equal(res.cleaned?.username, 'caretaker_ac');
  assert.deepEqual(res.cleaned?.blockIds, ['A', 'C']);
});

test('validateCaretakerAccountInput rejects weak password on create and invalid username', () => {
  const res = validateCaretakerAccountInput(
    {
      displayName: 'ع',
      username: 'سرایدار',
      password: '12',
      role: 'temp_caretaker',
      blockIds: [],
    },
    'create',
  );
  assert.equal(res.ok, false);
  assert.ok(res.errors.length >= 4);
});

test('validateCaretakerAccountInput allows empty password on edit mode (keep existing)', () => {
  const res = validateCaretakerAccountInput(
    {
      displayName: 'رضا محمدی',
      username: 'reza_ct',
      password: '',
      role: 'block_caretaker',
      blockIds: ['B'],
    },
    'edit',
  );
  assert.equal(res.ok, true);
  assert.equal(res.cleaned?.password, undefined);
});

test('normalizeCaretakerBlockIds lets complex_manager assign any subset of valid blocks', () => {
  const res = normalizeCaretakerBlockIds({
    requestedBlockIds: ['C', 'A'],
    validBlockIds: ['A', 'B', 'C'],
    actorRole: 'complex_manager',
    actorBlockId: null,
  });
  assert.equal(res.ok, true);
  assert.deepEqual(res.blockIds, ['C', 'A']);
});

test('normalizeCaretakerBlockIds rejects unknown blocks and unauthorized cross-block grants by block_manager', () => {
  const unknown = normalizeCaretakerBlockIds({
    requestedBlockIds: ['Z'],
    validBlockIds: ['A', 'B', 'C'],
    actorRole: 'complex_manager',
    actorBlockId: null,
  });
  assert.equal(unknown.ok, false);

  const crossBlock = normalizeCaretakerBlockIds({
    requestedBlockIds: ['B', 'A'],
    validBlockIds: ['A', 'B', 'C'],
    actorRole: 'block_manager',
    actorBlockId: 'B',
    existingBlockIds: ['B'],
  });
  assert.equal(crossBlock.ok, false);
});

test('normalizeCaretakerBlockIds preserves complex-granted blocks when block_manager edits own block', () => {
  const res = normalizeCaretakerBlockIds({
    requestedBlockIds: ['B', 'C'],
    validBlockIds: ['A', 'B', 'C'],
    actorRole: 'block_manager',
    actorBlockId: 'B',
    existingBlockIds: ['B', 'C'],
  });
  assert.equal(res.ok, true);
  assert.deepEqual(res.blockIds, ['B', 'C']);
});

test('buildCaretakerBlockGrants and getCaretakerBlockIds stay in sync', () => {
  const built = buildCaretakerBlockGrants(
    ['A', 'C', 'B'],
    { id: 'u_mgr', displayName: 'مهندس رضایی' },
    1700000000000,
  );
  assert.equal(built.primaryBlockId, 'A');
  assert.deepEqual(built.caretakerBlockIds, ['A', 'C', 'B']);
  assert.equal(built.assignedBlocks.length, 2);
  assert.deepEqual(
    built.assignedBlocks.map((g) => g.blockId),
    ['C', 'B'],
  );

  const extracted = getCaretakerBlockIds({
    blockId: built.primaryBlockId,
    caretakerBlockIds: built.caretakerBlockIds,
    assignedBlocks: built.assignedBlocks,
  });
  assert.deepEqual(extracted, ['A', 'C', 'B']);
});
