import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSessionHours,
  isItemEligibleForApproval,
  readAllRows,
  selectPlansAwaitingConfirmation,
  sortReviewEntries,
} from '../src/lib/review-queue.ts';

const plan = (extra = {}) => ({
  status: 'in_progress',
  is_archived: false,
  trainer_completed_at: '2026-10-01T10:00:00Z',
  worker_completed_at: '2026-10-01T11:00:00Z',
  supervisor_completed_at: null,
  ...extra,
});

// Stands in for the query builder, applying each filter to rows the way SQL does
const rowsQuery = (rows) => ({
  rows,
  not: (column, operator, value) => {
    assert.equal(operator, 'is');
    return rowsQuery(rows.filter((row) => row[column] !== value));
  },
  is: (column, value) => rowsQuery(rows.filter((row) => row[column] === value)),
  neq: (column, value) => rowsQuery(rows.filter((row) => row[column] !== null && row[column] !== value)),
});
const isAwaitingConfirmation = (row) => {
  const supabase = { from: () => ({ select: () => rowsQuery([row]) }) };
  return selectPlansAwaitingConfirmation(supabase, 'training_plans', 'id').rows.length === 1;
};

test('a plan waits for confirmation once trainer and worker have both finished', () => {
  assert.equal(isAwaitingConfirmation(plan()), true);
  assert.equal(isAwaitingConfirmation(plan({ trainer_completed_at: null })), false);
  assert.equal(isAwaitingConfirmation(plan({ worker_completed_at: null })), false);
});

test('confirmed, cancelled and archived plans leave the queue', () => {
  assert.equal(isAwaitingConfirmation(plan({ supervisor_completed_at: '2026-10-02T00:00:00Z' })), false);
  assert.equal(isAwaitingConfirmation(plan({ status: 'cancelled' })), false);
  assert.equal(isAwaitingConfirmation(plan({ is_archived: true })), false);
});

test('a plan whose archive flag was never set still waits for confirmation', () => {
  assert.equal(isAwaitingConfirmation(plan({ is_archived: null })), true);
});

const session = (subtopics, start = '09:00:00', end = '11:00:00', breakMinutes = 0) => ({
  start_time: start,
  end_time: end,
  break_minutes: breakMinutes,
  completed_subtopics: subtopics,
});
const SUBTOPICS = [{ id: 'a' }, { id: 'b' }];

test('an item needs every subtopic and the target hours across its sessions', () => {
  const both = [session(['a']), session(['b'])];
  assert.equal(isItemEligibleForApproval(both, SUBTOPICS, 4, undefined), true);
  assert.equal(isItemEligibleForApproval([session(['a'])], SUBTOPICS, 2, undefined), false);
  assert.equal(isItemEligibleForApproval(both, SUBTOPICS, 5, undefined), false);
});

test('an approved item or one without subtopics is not offered for approval', () => {
  const both = [session(['a', 'b'])];
  assert.equal(isItemEligibleForApproval(both, SUBTOPICS, 2, 'completed'), false);
  assert.equal(isItemEligibleForApproval(both, [], 2, undefined), false);
});

test('breaks do not count toward the hours', () => {
  assert.equal(calculateSessionHours(session([], '09:00:00', '11:00:00', 30)), 1.5);
});

test('the longest-waiting record comes first', () => {
  const entries = [{ key: 'new', date: '2026-10-02' }, { key: 'old', date: '2026-09-01' }];
  assert.deepEqual(sortReviewEntries(entries).map((e) => e.key), ['old', 'new']);
});

const ALL_ROWS = Array.from({ length: 2500 }, (_, i) => i);
const cappedPage = (cap) => async (from, to) => ({
  data: ALL_ROWS.slice(from, Math.min(to + 1, from + cap)),
  error: null,
});

test('every row is read when the server caps each response', async () => {
  for (const cap of [1000, 300]) {
    assert.deepEqual(await readAllRows(cappedPage(cap)), { rows: ALL_ROWS, failed: false });
  }
});

test('an error on any page marks the read as failed', async () => {
  const fetchPage = async (from, to) =>
    from === 0 ? cappedPage(1000)(from, to) : { data: null, error: new Error('boom') };
  assert.equal((await readAllRows(fetchPage)).failed, true);
});

test('an empty table reads as no rows without failing', async () => {
  assert.deepEqual(await readAllRows(async () => ({ data: [], error: null })), { rows: [], failed: false });
});
