import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('trainers are matched by ID, never by display name', async () => {
  const [page, calendar] = await Promise.all([
    read('src/app/(authenticated)/schedule/page.tsx'),
    read('src/app/(authenticated)/schedule/schedule-calendar.tsx'),
  ]);

  assert.doesNotMatch(page, /e\.trainerName === profile\.name/);
  assert.match(page, /trainerId: p\.trainer_id/);
  assert.match(page, /trainerId: p\.companion_id/);

  assert.doesNotMatch(calendar, /filterTrainerName/);
  assert.match(calendar, /e\.trainerId !== filterTrainerId/);
  assert.match(calendar, /<option key=\{id\} value=\{id\}>\{name\}<\/option>/);
});

test('the calendar opens on your own plans and can switch to everyone', async () => {
  const calendar = await read('src/app/(authenticated)/schedule/schedule-calendar.tsx');

  assert.match(calendar, /!events\.some\(\(e\) => e\.trainerId === currentUserId\)/);
  assert.match(calendar, /!showAllEvents && e\.trainerId !== currentUserId/);
  assert.match(calendar, /label: '自分の予定'/);
  assert.match(calendar, /label: '全員'/);
  assert.equal(calendar.match(/\{eventScopeToggle\}/g)?.length, 2, 'both mobile and desktop controls');
});

test('archiving is only offered on plans the database lets you change', async () => {
  const calendar = await read('src/app/(authenticated)/schedule/schedule-calendar.tsx');

  assert.match(calendar, /event\.trainerId === currentUserId \|\| event\.createdBy === currentUserId/);
  assert.doesNotMatch(calendar, /\{canCreate && \(\s*<button\s+type="button"\s+onClick=\{\(e\) => \{ e\.stopPropagation\(\); handleArchivePlan/);
});

test('review and feedback notices go through the database, not the staff list', async () => {
  const [plan, ojtPlan, button] = await Promise.all([
    read('src/app/(authenticated)/training-plans/[planId]/plan-detail.tsx'),
    read('src/app/(authenticated)/ojt-plans/[planId]/ojt-plan-detail.tsx'),
    read('src/components/feedback-button.tsx'),
  ]);

  for (const source of [plan, ojtPlan, button]) {
    assert.doesNotMatch(source, /from\('notifications'\)/);
  }
  assert.equal(plan.match(/rpc\('notify_plan_ready_for_review', \{ p_plan_type: 'training'/g)?.length, 2);
  assert.equal(ojtPlan.match(/rpc\('notify_plan_ready_for_review', \{ p_plan_type: 'ojt'/g)?.length, 2);
  assert.match(button, /rpc\('notify_feedback_received'/);
});

test('feedback images are stored by path and shown through signed URLs', async () => {
  const [button, page] = await Promise.all([
    read('src/components/feedback-button.tsx'),
    read('src/app/(authenticated)/admin/feedbacks/page.tsx'),
  ]);

  assert.doesNotMatch(button, /getPublicUrl/);
  assert.match(page, /createSignedUrls\(imagePaths, 3600\)/);
  assert.match(page, /feedbackImagePath\(f\.image_url\)/);
});
