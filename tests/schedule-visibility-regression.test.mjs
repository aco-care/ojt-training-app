import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canArchiveEvent,
  filterCalendarEvents,
  initialCalendarFilters,
  trainerFilterOptions,
  withScope,
  withTrainerFilter,
  withWorkerFilter,
} from '../src/lib/calendar-filters.ts';
import { feedbackImagePath } from '../src/lib/feedback-images.ts';

const ME = 'me';

const event = (id, trainerId, workerId, extra = {}) => ({
  id,
  trainerId,
  workerId,
  trainerName: `name-${trainerId}`,
  createdBy: 'someone',
  ...extra,
});

const MINE = event('mine', ME, 'worker-1');
const OTHER = event('other', 'trainer-2', 'worker-2');
const EVENTS = [MINE, OTHER];

const shown = (filters, events = EVENTS) =>
  filterCalendarEvents(events, filters, ME).map((e) => e.id);

test('the calendar opens on your own plans and can switch to everyone', () => {
  const opened = initialCalendarFilters(EVENTS, ME);
  assert.deepEqual(shown(opened), ['mine']);
  assert.deepEqual(shown(withScope(opened, true)), ['mine', 'other']);
});

test('someone with no plans of their own opens on everyone', () => {
  assert.deepEqual(shown(initialCalendarFilters([OTHER], ME), [OTHER]), ['other']);
});

test('trainers are matched by ID, so same-name staff stay separate', () => {
  const twin = event('twin', 'trainer-3', 'worker-2', { trainerName: 'name-trainer-2' });
  const events = [MINE, OTHER, twin];

  const filters = withTrainerFilter(initialCalendarFilters(events, ME), 'trainer-2', ME);
  assert.deepEqual(shown(filters, events), ['other']);
  assert.deepEqual(trainerFilterOptions(events), [
    [ME, 'name-me'],
    ['trainer-2', 'name-trainer-2'],
    ['trainer-3', 'name-trainer-2'],
  ]);
});

test('choosing another trainer switches to everyone; choosing yourself does not', () => {
  const opened = initialCalendarFilters(EVENTS, ME);
  assert.equal(withTrainerFilter(opened, 'trainer-2', ME).showAll, true);
  assert.equal(withTrainerFilter(opened, ME, ME).showAll, false);
});

test('choosing a worker switches to everyone and shows that worker\'s plans', () => {
  const filters = withWorkerFilter(initialCalendarFilters(EVENTS, ME), 'worker-2');
  assert.equal(filters.showAll, true);
  assert.deepEqual(shown(filters), ['other']);
});

test('clearing a filter leaves the current view alone', () => {
  const opened = initialCalendarFilters(EVENTS, ME);
  assert.equal(withWorkerFilter(opened, '').showAll, false);
  assert.equal(withTrainerFilter(opened, '', ME).showAll, false);

  const everyone = withWorkerFilter(opened, 'worker-2');
  assert.equal(withWorkerFilter(everyone, '').showAll, true);
});

test('going back to your own plans clears both filters', () => {
  const picked = withTrainerFilter(withWorkerFilter(initialCalendarFilters(EVENTS, ME), 'worker-2'), 'trainer-2', ME);
  assert.deepEqual(withScope(picked, false), { showAll: false, workerId: '', trainerId: '' });
  assert.deepEqual(shown(withScope(picked, false)), ['mine']);
});

test('archiving is only offered on plans the database lets you change', () => {
  const viewer = (role, canCreate = true) => ({ userId: ME, role, canCreate });

  for (const role of ['admin', 'supervisor']) {
    assert.equal(canArchiveEvent(OTHER, viewer(role)), true, role);
  }
  assert.equal(canArchiveEvent(MINE, viewer('trainer')), true, 'assigned trainer');
  assert.equal(canArchiveEvent(event('created', 'trainer-2', 'worker-2', { createdBy: ME }), viewer('trainer')), true, 'creator');
  assert.equal(canArchiveEvent(OTHER, viewer('trainer')), false, 'someone else\'s plan');
  assert.equal(canArchiveEvent(MINE, viewer('executive', false)), false, 'read-only role');
});

test('stored feedback images resolve to a storage path, old public URLs included', () => {
  assert.equal(feedbackImagePath('user-1/1.png'), 'user-1/1.png');
  assert.equal(
    feedbackImagePath('https://x.supabase.co/storage/v1/object/public/feedback-images/user-1/1.png'),
    'user-1/1.png',
  );
  assert.equal(
    feedbackImagePath('https://x.supabase.co/storage/v1/object/public/feedback-images/user-1/a%20b.png?t=1'),
    'user-1/a b.png',
  );
});

test('a malformed stored image URL keeps its raw path instead of throwing', () => {
  assert.equal(
    feedbackImagePath('https://x.supabase.co/storage/v1/object/public/feedback-images/%E0%A4'),
    '%E0%A4',
  );
  assert.equal(
    feedbackImagePath('https://x.supabase.co/storage/v1/object/public/feedback-images/user-1/100%.png?t=1'),
    'user-1/100%.png',
  );
});
