import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSessionHours,
  isItemEligibleForApproval,
  isPlanAwaitingConfirmation,
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

test('a plan waits for confirmation once trainer and worker have both finished', () => {
  assert.equal(isPlanAwaitingConfirmation(plan()), true);
  assert.equal(isPlanAwaitingConfirmation(plan({ trainer_completed_at: null })), false);
  assert.equal(isPlanAwaitingConfirmation(plan({ worker_completed_at: null })), false);
});

test('confirmed, cancelled and archived plans leave the queue', () => {
  assert.equal(isPlanAwaitingConfirmation(plan({ supervisor_completed_at: '2026-10-02T00:00:00Z' })), false);
  assert.equal(isPlanAwaitingConfirmation(plan({ status: 'cancelled' })), false);
  assert.equal(isPlanAwaitingConfirmation(plan({ is_archived: true })), false);
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
