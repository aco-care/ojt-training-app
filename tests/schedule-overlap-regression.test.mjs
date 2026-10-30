import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('archived plans do not block replacement schedules', async () => {
  const modal = await read('src/app/(authenticated)/schedule/create-plan-modal.tsx');
  const overlapCheck = modal.match(
    /const checkOverlap = async[\s\S]*?return null;\n  };/,
  )?.[0];

  assert.ok(overlapCheck, 'checkOverlap implementation should exist');

  const activePlanFilters = overlapCheck.match(/\.neq\('is_archived', true\)/g) ?? [];
  assert.equal(
    activePlanFilters.length,
    2,
    'both training_plans and ojt_plans must ignore archived rows',
  );
});
