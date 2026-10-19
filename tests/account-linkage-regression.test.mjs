import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('staff updates keep Supabase Auth and profiles in sync', async () => {
  const [manager, updateRoute] = await Promise.all([
    read('src/app/(authenticated)/admin/staff/staff-manager.tsx'),
    read('src/app/api/admin/update-user/route.ts'),
  ]);

  assert.match(manager, /fetch\('\/api\/admin\/update-user'/);
  assert.match(updateRoute, /auth\.admin\.updateUserById\(profileId/);
  assert.match(updateRoute, /\.from\('profiles'\)[\s\S]*?\.update\(/);
  assert.match(updateRoute, /duplicateAuth/);
});

test('invite resend never creates an unlinked Auth user', async () => {
  const resendRoute = await read('src/app/api/admin/resend-invite/route.ts');

  assert.doesNotMatch(resendRoute, /inviteUserByEmail/);
  assert.match(resendRoute, /getUserById\(profileId\)/);
  assert.match(resendRoute, /resetPasswordForEmail\(targetProfile\.email/);
});

test('missing profiles are not silently classified as workers', async () => {
  const layout = await read('src/app/(authenticated)/layout.tsx');

  assert.doesNotMatch(layout, /profile\?\.role \?\? 'worker'/);
  assert.match(layout, /if \(!profile\)/);
  assert.match(layout, /特定技能外国人としては処理されていません/);
});
