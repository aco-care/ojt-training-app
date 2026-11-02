import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { FEEDBACK_CATEGORY_LABELS, OJT_STEPS } from '../src/lib/types.ts';

// Replays the repository's real migrations on a throwaway Postgres, with the
// Supabase platform stubbed, then checks what each role can do through RLS.

const root = new URL('../', import.meta.url);
const migrationsDir = new URL('supabase/migrations/', root);
const LOCKDOWN = '20261101000000_emergency_lockdown.sql';
const SCOPE = '20261102000000_scope_reads_and_limit_writes.sql';
const BUCKET = '20261102000100_feedback_images_bucket_private.sql';
const STORAGE_POLICIES = '20261102000200_feedback_images_storage_policies.sql';
const rollbackOf = (migration) =>
  readFile(new URL(`supabase/rollbacks/${migration.replace('.sql', '.rollback.sql')}`, root), 'utf8');

const PREFLIGHT = new URL('supabase/preflight/20261102000000_preflight.sql', root);

const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

const FACILITY_A = uuid(1);
const FACILITY_B = uuid(2);

const ADMIN = uuid(10);
const EXECUTIVE = uuid(11);
const SUPERVISOR_A = uuid(12);
const SUPERVISOR_B = uuid(13);
const SUPERVISOR_AB = uuid(14);
const SUPERVISOR_LEGACY_B = uuid(15);
const TRAINER_A = uuid(16);
const TRAINER_A2 = uuid(17);
const TRAINER_B = uuid(18);
const WORKER_A = uuid(19);
const WORKER_A2 = uuid(20);
const WORKER_B = uuid(21);

const FW_A = uuid(30);
const FW_A2 = uuid(31);
const FW_B = uuid(32);
const FW_B_ALSO_A = uuid(33);

const ITEM = uuid(40);
const OJT_USER_A = uuid(41);
const OJT_USER_A2 = uuid(42);
const OJT_USER_B = uuid(43);

const PLAN_A = uuid(50);
const PLAN_A_OTHER_TRAINER = uuid(51);
const PLAN_A2 = uuid(52);
const PLAN_B = uuid(53);
const PLAN_ALSO_A = uuid(54);
const PLAN_ACROSS_FACILITIES = uuid(57);
const OJT_PLAN_A = uuid(55);
const OJT_PLAN_B = uuid(56);
const NOTIFICATION_WORKER_A = uuid(60);
const NOTIFICATION_WORKER_A2 = uuid(61);
const FEEDBACK_WORKER_A = uuid(62);
const FEEDBACK_WORKER_A2 = uuid(63);

const PLATFORM = `
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text, name text
  );
  create function storage.foldername(name text) returns text[] language sql immutable
    as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant execute on function storage.foldername(text) to anon, authenticated, service_role;
  grant select, insert on storage.objects to authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

// The production policies are not all in the repo: these are open ones the
// migration can only find by searching pg_policies.
const PRODUCTION_DRIFT = `
  create policy tp_r on training_plans for select using (true);
  create policy tp_w on training_plans for all using (true);
  create policy op_w on ojt_plans for all using (true);
  create policy n_r on notifications for select using (true);
  create policy n_w on notifications for all using (true);
  create policy fb_w on feedbacks for all using (true);
  create policy stray_read on foreign_workers for select using (true);
  create policy stray_supervisor_all on ojt_records for all using (get_user_role() = 'supervisor');
`;

const STORAGE_DRIFT = `
  insert into storage.buckets (id, name, public) values ('feedback-images', 'feedback-images', true);
  create policy "public read images" on storage.objects for select using (bucket_id = 'feedback-images');
  create policy "anyone upload images" on storage.objects for insert with check (bucket_id = 'feedback-images');
`;

const profile = (id, name, role, facility = null) =>
  `('${id}', '${name}@example.test', '${name}', '${role}', ${facility ? `'${facility}'` : 'null'})`;

const SEED = `
  insert into auth.users (id) select unnest(array[
    '${ADMIN}', '${EXECUTIVE}', '${SUPERVISOR_A}', '${SUPERVISOR_B}', '${SUPERVISOR_AB}', '${SUPERVISOR_LEGACY_B}',
    '${TRAINER_A}', '${TRAINER_A2}', '${TRAINER_B}', '${WORKER_A}', '${WORKER_A2}', '${WORKER_B}'
  ]::uuid[]);
  insert into facilities (id, name) values ('${FACILITY_A}', 'A'), ('${FACILITY_B}', 'B');
  insert into profiles (id, email, name, role, facility_id) values
    ${profile(ADMIN, 'admin', 'admin')},
    ${profile(EXECUTIVE, 'executive', 'executive')},
    ${profile(SUPERVISOR_A, 'supervisor-a', 'supervisor', FACILITY_A)},
    ${profile(SUPERVISOR_B, 'supervisor-b', 'supervisor', FACILITY_B)},
    ${profile(SUPERVISOR_AB, 'supervisor-ab', 'supervisor', FACILITY_A)},
    ${profile(SUPERVISOR_LEGACY_B, 'supervisor-legacy', 'supervisor', FACILITY_B)},
    ${profile(TRAINER_A, 'trainer-a', 'trainer', FACILITY_A)},
    ${profile(TRAINER_A2, 'trainer-a2', 'trainer', FACILITY_A)},
    ${profile(TRAINER_B, 'trainer-b', 'trainer', FACILITY_B)},
    ${profile(WORKER_A, 'worker-a', 'worker', FACILITY_A)},
    ${profile(WORKER_A2, 'worker-a2', 'worker', FACILITY_A)},
    ${profile(WORKER_B, 'worker-b', 'worker', FACILITY_B)};
  insert into profile_facilities (profile_id, facility_id) values
    ('${SUPERVISOR_A}', '${FACILITY_A}'),
    ('${SUPERVISOR_B}', '${FACILITY_B}'),
    ('${SUPERVISOR_AB}', '${FACILITY_A}'),
    ('${SUPERVISOR_AB}', '${FACILITY_B}'),
    ('${TRAINER_A}', '${FACILITY_A}'),
    ('${TRAINER_A2}', '${FACILITY_B}'),
    ('${TRAINER_A2}', '${FACILITY_A}'),
    ('${TRAINER_B}', '${FACILITY_B}'),
    ('${WORKER_A}', '${FACILITY_A}'),
    ('${WORKER_A2}', '${FACILITY_A}'),
    ('${WORKER_B}', '${FACILITY_B}');
  insert into foreign_workers (id, name, facility_id, profile_id) values
    ('${FW_A}', 'worker-a', '${FACILITY_A}', '${WORKER_A}'),
    ('${FW_A2}', 'worker-a2', '${FACILITY_A}', '${WORKER_A2}'),
    ('${FW_B}', 'worker-b', '${FACILITY_B}', '${WORKER_B}'),
    ('${FW_B_ALSO_A}', 'worker-multi', '${FACILITY_B}', null);
  insert into worker_facilities (worker_id, facility_id) values
    ('${FW_A}', '${FACILITY_A}'),
    ('${FW_A2}', '${FACILITY_A}'),
    ('${FW_B}', '${FACILITY_B}'),
    ('${FW_B_ALSO_A}', '${FACILITY_B}'),
    ('${FW_B_ALSO_A}', '${FACILITY_A}');
  insert into training_items (id, item_number, title, target_hours, sort_order)
    values ('${ITEM}', 9, 'item', 1, 9);
  insert into ojt_users (id, worker_id, facility_id, user_initial) values
    ('${OJT_USER_A}', '${FW_A}', '${FACILITY_A}', 'A'),
    ('${OJT_USER_A2}', '${FW_A2}', '${FACILITY_A}', 'B'),
    ('${OJT_USER_B}', '${FW_B}', '${FACILITY_B}', 'C');
  insert into training_plans (id, worker_id, item_id, planned_date, trainer_id, created_by) values
    ('${PLAN_A}', '${FW_A}', '${ITEM}', '2026-11-10', '${TRAINER_A}', '${SUPERVISOR_A}'),
    ('${PLAN_A_OTHER_TRAINER}', '${FW_A}', '${ITEM}', '2026-11-10', '${TRAINER_A2}', '${SUPERVISOR_A}'),
    ('${PLAN_A2}', '${FW_A2}', '${ITEM}', '2026-11-10', '${TRAINER_A2}', '${SUPERVISOR_A}'),
    ('${PLAN_B}', '${FW_B}', '${ITEM}', '2026-11-10', '${TRAINER_B}', '${SUPERVISOR_B}'),
    ('${PLAN_ALSO_A}', '${FW_B_ALSO_A}', '${ITEM}', '2026-11-10', '${TRAINER_B}', '${SUPERVISOR_B}'),
    ('${PLAN_ACROSS_FACILITIES}', '${FW_A2}', '${ITEM}', '2026-11-10', '${TRAINER_B}', '${SUPERVISOR_A}');
  insert into ojt_plans (id, worker_id, ojt_user_id, planned_date, step, companion_id, created_by) values
    ('${OJT_PLAN_A}', '${FW_A}', '${OJT_USER_A}', '2026-11-10', 'main', '${TRAINER_A}', '${SUPERVISOR_A}'),
    ('${OJT_PLAN_B}', '${FW_B}', '${OJT_USER_B}', '2026-11-10', 'main', '${TRAINER_B}', '${SUPERVISOR_B}');
  insert into training_sessions (worker_id, item_id, date, start_time, end_time, trainer_id) values
    ('${FW_A}', '${ITEM}', '2026-11-10', '09:00', '10:00', '${TRAINER_A}'),
    ('${FW_B}', '${ITEM}', '2026-11-10', '09:00', '10:00', '${TRAINER_B}');
  insert into training_approvals (worker_id, item_id, status, approved_by) values
    ('${FW_A}', '${ITEM}', 'completed', '${SUPERVISOR_A}'),
    ('${FW_B}', '${ITEM}', 'completed', '${SUPERVISOR_B}');
  insert into ojt_records (worker_id, ojt_user_id, step, date, companion_id) values
    ('${FW_A}', '${OJT_USER_A}', 'main', '2026-11-10', '${TRAINER_A}'),
    ('${FW_A2}', '${OJT_USER_A2}', 'main', '2026-11-10', '${TRAINER_A2}'),
    ('${FW_B}', '${OJT_USER_B}', 'main', '2026-11-10', '${TRAINER_B}');
  insert into final_evaluations (worker_id, eval_date, approved_by) values
    ('${FW_A}', '2026-11-10', '${SUPERVISOR_A}'),
    ('${FW_A2}', '2026-11-10', '${SUPERVISOR_A}'),
    ('${FW_B}', '2026-11-10', '${SUPERVISOR_B}');
  insert into notifications (id, user_id, title) values
    ('${NOTIFICATION_WORKER_A}', '${WORKER_A}', 'n'),
    ('${NOTIFICATION_WORKER_A2}', '${WORKER_A2}', 'n');
  insert into feedbacks (id, sender_id, content, category, status) values
    ('${FEEDBACK_WORKER_A}', '${WORKER_A}', 'c', 'bug', 'pending'),
    ('${FEEDBACK_WORKER_A2}', '${WORKER_A2}', 'c', 'bug', 'pending');
  insert into audit_logs (actor_id, actor_name, action, target_table, target_id, target_label, description) values
    ('${TRAINER_A}', 'a', 'insert', 'training_plans', '${PLAN_A}', 'l', 'd'),
    ('${TRAINER_B}', 'b', 'insert', 'training_plans', '${PLAN_B}', 'l', 'd');
  insert into storage.objects (bucket_id, name) values
    ('feedback-images', '${WORKER_A}/1.png'),
    ('feedback-images', '${WORKER_A2}/1.png');
`;

let db;

const sql = (name) => readFile(new URL(name, migrationsDir), 'utf8');

// Runs one statement as a role inside a transaction that is always rolled back.
async function run(role, uid, statement, setup = '') {
  await db.exec(`begin; ${setup}; select set_config('app.uid', '${uid ?? ''}', true); set local role ${role};`);
  try {
    const result = await db.query(statement);
    return { ok: true, rows: result.rows, affected: result.affectedRows ?? 0 };
  } catch (error) {
    return { ok: false, error: error.message, rows: [], affected: 0 };
  } finally {
    await db.exec('rollback');
  }
}

const as = (uid, statement) => run('authenticated', uid, statement);

const ids = async (uid, table, column = 'id') =>
  (await as(uid, `select ${column} as id from ${table}`)).rows.map((r) => r.id).sort();

const policySnapshot = async () =>
  (
    await db.query(`
      select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects')
      order by schemaname, tablename, policyname
    `)
  ).rows;

let openBefore;
let policiesBefore;

before(async () => {
  db = new PGlite();
  await db.exec(PLATFORM);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files.filter((f) => f < LOCKDOWN)) {
    await db.exec(await sql(file));
  }
  await db.exec(PRODUCTION_DRIFT);
  await db.exec(STORAGE_DRIFT);
  await db.exec(SEED);

  openBefore = {
    workers: await ids(WORKER_A, 'foreign_workers'),
    plans: await ids(TRAINER_B, 'training_plans'),
  };

  await db.exec(await sql(LOCKDOWN));
  policiesBefore = await policySnapshot();
  await db.exec(await sql(SCOPE));
  await db.exec(await sql(BUCKET));
  await db.exec(await sql(STORAGE_POLICIES));
});

test('every migration in the repo is covered by the replay', async () => {
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  assert.equal(files.at(-1), STORAGE_POLICIES);
  for (const file of [LOCKDOWN, SCOPE, BUCKET]) assert.ok(files.includes(file), file);
});

test('the production-like starting point really was open', () => {
  assert.equal(openBefore.workers.length, 4);
  assert.equal(openBefore.plans.length, 6);
});

test('a worker reads only their own worker row and records', async () => {
  assert.deepEqual(await ids(WORKER_A, 'foreign_workers'), [FW_A]);
  assert.deepEqual(await ids(WORKER_A, 'worker_facilities', 'worker_id'), [FW_A]);
  for (const table of ['training_plans', 'ojt_plans', 'training_sessions', 'training_approvals', 'ojt_users', 'ojt_records', 'final_evaluations']) {
    const seen = await ids(WORKER_A, table, 'worker_id');
    assert.ok(seen.length > 0, `${table}: own rows are readable`);
    assert.ok(seen.every((id) => id === FW_A), `${table}: only own rows`);
  }
});

test('a worker reads staff named on their own records, and no other worker', async () => {
  const seen = await ids(WORKER_A, 'profiles');
  for (const named of [WORKER_A, TRAINER_A, TRAINER_A2, SUPERVISOR_A]) {
    assert.ok(seen.includes(named), `${named} should be readable`);
  }
  for (const hidden of [WORKER_A2, WORKER_B, TRAINER_B, SUPERVISOR_B, ADMIN, EXECUTIVE]) {
    assert.ok(!seen.includes(hidden), `${hidden} should be hidden`);
  }
  // Same worker-to-worker rule through the facility tables
  assert.deepEqual(await ids(WORKER_A, 'profile_facilities', 'profile_id'), [WORKER_A]);
});

test('a worker sees the trainer name on their own plan', async () => {
  const { rows } = await as(
    WORKER_A,
    `select p.name from training_plans tp join profiles p on p.id = tp.trainer_id where tp.id = '${PLAN_A}'`,
  );
  assert.deepEqual(rows, [{ name: 'trainer-a' }]);
});

test('supervisors and trainers read every facility', async () => {
  const everyWorker = [FW_A, FW_A2, FW_B, FW_B_ALSO_A].sort();
  for (const uid of [SUPERVISOR_A, SUPERVISOR_B, SUPERVISOR_AB, TRAINER_A, TRAINER_B]) {
    assert.deepEqual(await ids(uid, 'foreign_workers'), everyWorker, `${uid}: workers`);
    assert.equal((await ids(uid, 'training_plans')).length, 6, `${uid}: training plans`);
    assert.equal((await ids(uid, 'ojt_plans')).length, 2, `${uid}: OJT plans`);
    assert.equal((await ids(uid, 'ojt_records', 'worker_id')).length, 3, `${uid}: OJT records`);
    assert.equal((await ids(uid, 'final_evaluations', 'worker_id')).length, 3, `${uid}: evaluations`);
    assert.equal((await ids(uid, 'training_sessions', 'worker_id')).length, 2, `${uid}: sessions`);
    assert.equal((await ids(uid, 'worker_facilities', 'worker_id')).length, 5, `${uid}: worker facilities`);
  }
});

test('reading does not depend on having a facility on file', async () => {
  await db.exec(`update profiles set facility_id = null where id = '${SUPERVISOR_LEGACY_B}'`);
  try {
    assert.equal((await ids(SUPERVISOR_LEGACY_B, 'foreign_workers')).length, 4);
  } finally {
    await db.exec(`update profiles set facility_id = '${FACILITY_B}' where id = '${SUPERVISOR_LEGACY_B}'`);
  }
});

test('staff read every membership, so a staff edit cannot drop one', async () => {
  const facilitiesOf = async (viewer, profileId) =>
    (await as(viewer, `select facility_id from profile_facilities where profile_id = '${profileId}'`)).rows
      .map((r) => r.facility_id)
      .sort();

  for (const viewer of [SUPERVISOR_A, SUPERVISOR_B, TRAINER_A, ADMIN, EXECUTIVE]) {
    assert.deepEqual(await facilitiesOf(viewer, TRAINER_A2), [FACILITY_A, FACILITY_B], `${viewer}: staff in A and B`);
  }
  assert.deepEqual(await facilitiesOf(WORKER_A, WORKER_A2), [], 'workers cannot read each other');
  assert.deepEqual(await facilitiesOf(WORKER_A, TRAINER_A), [], 'workers see only their own membership');
  assert.deepEqual(await facilitiesOf(WORKER_A, WORKER_A), [FACILITY_A]);
});

test('admin and executive read every facility', async () => {
  for (const uid of [ADMIN, EXECUTIVE]) {
    assert.equal((await ids(uid, 'foreign_workers')).length, 4);
    assert.equal((await ids(uid, 'training_plans')).length, 6);
    assert.equal((await ids(uid, 'ojt_records', 'worker_id')).length, 3);
    assert.equal((await ids(uid, 'profiles')).length, 12);
  }
});

test('the overlap check can still read other trainers plans for the same worker', async () => {
  const { rows } = await as(
    TRAINER_A,
    `select id from training_plans where worker_id = '${FW_A}' and planned_date = '2026-11-10'
       and is_archived is not true and status <> 'cancelled' order by id`,
  );
  assert.deepEqual(rows.map((r) => r.id), [PLAN_A, PLAN_A_OTHER_TRAINER]);
});

test('staff read every profile', async () => {
  for (const uid of [SUPERVISOR_A, TRAINER_A]) {
    assert.equal((await ids(uid, 'profiles')).length, 12, uid);
  }
});

test('audit logs are for admins and supervisors, across facilities', async () => {
  for (const uid of [ADMIN, SUPERVISOR_A, SUPERVISOR_B]) {
    assert.equal((await ids(uid, 'audit_logs', 'actor_id')).length, 2, uid);
  }
  for (const uid of [EXECUTIVE, TRAINER_A, WORKER_A]) {
    assert.deepEqual(await ids(uid, 'audit_logs', 'actor_id'), [], uid);
  }
});

test('FOR ALL write rules keep working once they stop granting reads', async () => {
  const insert = await as(
    SUPERVISOR_A,
    `insert into foreign_workers (name, facility_id) values ('new', '${FACILITY_A}') returning id`,
  );
  assert.ok(insert.ok, insert.error);
  assert.ok(
    (await as(ADMIN, `insert into foreign_workers (name, facility_id) values ('new', '${FACILITY_B}') returning id`)).ok,
    'the worker form reads the new row back',
  );

  const update = await as(SUPERVISOR_A, `update foreign_workers set notes = 'n' where id = '${FW_A}'`);
  assert.equal(update.affected, 1);

  const trainer = await as(TRAINER_A, `update foreign_workers set notes = 'n' where id = '${FW_A}'`);
  assert.equal(trainer.affected, 0, 'the role rule on the split policy still applies');

  const record = await as(TRAINER_A, `update ojt_records set notes = 'n' where worker_id = '${FW_A}'`);
  assert.equal(record.affected, 1);
});

test('plans: who can create', async () => {
  const insert = (worker, createdBy) =>
    `insert into training_plans (worker_id, item_id, planned_date, trainer_id, created_by)
     values ('${worker}', '${ITEM}', '2026-12-01', '${TRAINER_A}', '${createdBy}') returning id`;

  assert.ok((await as(TRAINER_A, insert(FW_A, TRAINER_A))).ok);
  assert.ok((await as(SUPERVISOR_A, insert(FW_A, SUPERVISOR_A))).ok);
  assert.ok((await as(ADMIN, insert(FW_B, ADMIN))).ok);
  assert.ok((await as(TRAINER_A, insert(FW_B, TRAINER_A))).ok, 'a worker in another facility');
  assert.ok(!(await as(TRAINER_A, insert(FW_A, TRAINER_A2))).ok, 'forged creator');
  assert.ok(!(await as(WORKER_A, insert(FW_A, WORKER_A))).ok, 'worker');
  assert.ok(!(await as(EXECUTIVE, insert(FW_A, EXECUTIVE))).ok, 'read-only role');
  const ojt = await as(
    SUPERVISOR_A,
    `insert into ojt_plans (worker_id, planned_date, step, companion_id, created_by)
     values ('${FW_B}', '2026-12-01', 'main', '${TRAINER_A}', '${SUPERVISOR_A}')`,
  );
  assert.ok(ojt.ok, ojt.error);
});

test('plans: the three-party flow still saves', async () => {
  const trainer = await as(
    TRAINER_A,
    `update training_plans set trainer_comment = 'c', trainer_eval = '{"overall":"good"}',
       trainer_completed_at = now(), status = 'in_progress' where id = '${PLAN_A}'`,
  );
  assert.equal(trainer.affected, 1, trainer.error);

  const worker = await as(
    WORKER_A,
    `update training_plans set worker_comment = 'c', worker_eval = '{"overall":"good"}',
       worker_completed_at = now(), status = 'in_progress' where id = '${PLAN_A}'`,
  );
  assert.equal(worker.affected, 1, worker.error);

  const companion = await as(
    TRAINER_A,
    `update ojt_plans set trainer_comment = 'c', result = 'pass', trainer_completed_at = now(),
       status = 'in_progress' where id = '${OJT_PLAN_A}'`,
  );
  assert.equal(companion.affected, 1, companion.error);

  const supervisor = await as(
    SUPERVISOR_A,
    `update training_plans set supervisor_comment_to_worker = 'c', supervisor_completed_at = now(),
       supervisor_id = '${SUPERVISOR_A}', status = 'completed', planned_date = '2026-12-02' where id = '${PLAN_A}'`,
  );
  assert.equal(supervisor.affected, 1, supervisor.error);

  const archive = await as(TRAINER_A, `update training_plans set is_archived = true where id = '${PLAN_A}'`);
  assert.equal(archive.affected, 1, archive.error);
});

test('plans: the flow works when the trainer and worker are in different facilities', async () => {
  const trainer = await as(
    TRAINER_B,
    `update training_plans set trainer_comment = 'c', trainer_completed_at = now(), status = 'in_progress'
     where id = '${PLAN_ACROSS_FACILITIES}'`,
  );
  assert.equal(trainer.affected, 1, trainer.error);

  const supervisor = await as(
    SUPERVISOR_B,
    `update training_plans set supervisor_comment_to_worker = 'c', status = 'completed' where id = '${PLAN_A}'`,
  );
  assert.equal(supervisor.affected, 1, supervisor.error);
});

test('plans: nobody writes outside their part', async () => {
  const denied = async (uid, statement, label) => {
    const result = await as(uid, statement);
    assert.ok(!result.ok || result.affected === 0, label);
  };

  await denied(WORKER_A, `update training_plans set planned_date = '2030-01-01' where id = '${PLAN_A}'`, 'worker moves date');
  await denied(WORKER_A, `update training_plans set trainer_comment = 'x' where id = '${PLAN_A}'`, 'worker writes trainer part');
  await denied(WORKER_A, `update training_plans set supervisor_comment_to_worker = 'x' where id = '${PLAN_A}'`, 'worker writes supervisor part');
  await denied(WORKER_A, `update training_plans set status = 'completed' where id = '${PLAN_A}'`, 'worker completes');
  await denied(WORKER_A, `update training_plans set is_archived = true where id = '${PLAN_A}'`, 'worker archives');
  await denied(WORKER_A, `update training_plans set worker_comment = 'x' where id = '${PLAN_A2}'`, 'other worker');
  await denied(WORKER_A, `update ojt_plans set trainer_comment = 'x' where id = '${OJT_PLAN_A}'`, 'worker writes companion part');

  await denied(TRAINER_A, `update training_plans set supervisor_comment_to_worker = 'x' where id = '${PLAN_A}'`, 'trainer writes supervisor part');
  await denied(TRAINER_A, `update training_plans set worker_comment = 'x' where id = '${PLAN_A}'`, 'trainer writes worker part');
  await denied(TRAINER_A, `update training_plans set trainer_id = '${TRAINER_A2}' where id = '${PLAN_A}'`, 'trainer reassigns');
  await denied(TRAINER_A, `update training_plans set status = 'completed' where id = '${PLAN_A}'`, 'trainer completes');
  await denied(TRAINER_A, `update training_plans set trainer_comment = 'x' where id = '${PLAN_A_OTHER_TRAINER}'`, 'not the assignee');
  await denied(TRAINER_A, `update training_plans set trainer_comment = 'x' where id = '${PLAN_B}'`, 'not the assignee in another facility');
  await denied(TRAINER_B, `update ojt_plans set trainer_comment = 'x' where id = '${OJT_PLAN_A}'`, 'not the companion');

  await denied(EXECUTIVE, `update training_plans set notes = 'x' where id = '${PLAN_A}'`, 'read-only role');
  await denied(TRAINER_A, `delete from training_plans where id = '${PLAN_A}'`, 'trainer deletes');
  await denied(WORKER_A, `delete from training_plans where id = '${PLAN_A}'`, 'worker deletes');
  assert.equal((await as(SUPERVISOR_A, `delete from training_plans where id = '${PLAN_A2}'`)).affected, 1);
});

test('plans: a trainer can only create an empty plan', async () => {
  const training = (columns, values, uid = TRAINER_A) =>
    `insert into training_plans (worker_id, item_id, planned_date, trainer_id, created_by${columns})
     values ('${FW_A}', '${ITEM}', '2026-12-01', '${TRAINER_A}', '${uid}'${values})`;
  const ojt = (columns, values, uid = TRAINER_A) =>
    `insert into ojt_plans (worker_id, planned_date, step, companion_id, created_by${columns})
     values ('${FW_A}', '2026-12-01', 'main', '${TRAINER_A}', '${uid}'${values})`;

  const forged = [
    [training, ', status', `, 'completed'`],
    [training, ', status', `, 'in_progress'`],
    [training, ', status', `, 'cancelled'`],
    [training, ', supervisor_completed_at', ', now()'],
    [training, ', supervisor_id', `, '${SUPERVISOR_A}'`],
    [training, ', supervisor_comment_to_worker', `, 'x'`],
    [training, ', supervisor_comment_to_trainer', `, 'x'`],
    [training, ', worker_eval', `, '{"overall":"good"}'`],
    [training, ', worker_comment', `, 'x'`],
    [training, ', worker_completed_at', ', now()'],
    [training, ', trainer_eval', `, '{"overall":"good"}'`],
    [training, ', trainer_completed_at', ', now()'],
    [training, ', trainer_checked_subtopics', `, '{${ITEM}}'`],
    [training, ', cancel_reason', `, 'x'`],
    [training, ', cancel_history', `, '[{"action":"x"}]'`],
    [training, ', is_archived', ', true'],
    [ojt, ', status', `, 'completed'`],
    [ojt, ', result', `, 'pass'`],
    [ojt, ', supervisor_completed_at', ', now()'],
    [ojt, ', worker_checked_items', `, '{x}'`],
    [ojt, ', trainer_checked_items', `, '{x}'`],
  ];
  for (const [insert, columns, values] of forged) {
    const result = await as(TRAINER_A, insert(columns, values));
    assert.match(result.error ?? '', /入力済みの予定を作成する権限がありません/, `${insert === ojt ? 'ojt' : 'training'}${columns}${values}`);
  }

  const planned = await as(
    TRAINER_A,
    training(', planned_subtopics, start_time, end_time, method, break_minutes', `, '{${ITEM}}', '09:00', '10:00', 'x', 10`),
  );
  assert.ok(planned.ok, planned.error);
  const plannedOjt = await as(TRAINER_A, ojt(', start_time, end_time, break_minutes', `, '09:00', '10:00', 10`));
  assert.ok(plannedOjt.ok, plannedOjt.error);

  for (const uid of [ADMIN, SUPERVISOR_A]) {
    const filled = await as(uid, training(', status, supervisor_comment_to_worker', `, 'completed', 'x'`, uid));
    assert.ok(filled.ok, filled.error);
  }
  const server = await run('service_role', null, training(', status, worker_comment', `, 'completed', 'x'`));
  assert.ok(server.ok, server.error);
});

test('plans: completed and cancelled plans stay closed, except for archiving', async () => {
  for (const status of ['completed', 'cancelled']) {
    const closed = `update training_plans set status = '${status}' where id = '${PLAN_A}';
      update ojt_plans set status = '${status}' where id = '${OJT_PLAN_A}'`;
    const denied = async (uid, statement, label) => {
      const result = await run('authenticated', uid, statement, closed);
      assert.match(result.error ?? '', /完了・中止した予定は変更できません|予定の状態を変更する権限がありません/, `${status}: ${label}`);
    };
    const allowed = async (role, uid, statement, label) => {
      const result = await run(role, uid, statement, closed);
      assert.equal(result.affected, 1, `${status}: ${label}: ${result.error}`);
    };

    await denied(WORKER_A, `update training_plans set status = 'in_progress', worker_comment = 'x' where id = '${PLAN_A}'`, 'worker reopens');
    await denied(WORKER_A, `update training_plans set worker_comment = 'x' where id = '${PLAN_A}'`, 'worker rewrites');
    await denied(WORKER_A, `update ojt_plans set worker_comment = 'x' where id = '${OJT_PLAN_A}'`, 'worker rewrites OJT');
    await denied(TRAINER_A, `update training_plans set status = 'in_progress', trainer_comment = 'x' where id = '${PLAN_A}'`, 'trainer reopens');
    await denied(TRAINER_A, `update training_plans set trainer_comment = 'x' where id = '${PLAN_A}'`, 'trainer rewrites');
    await denied(TRAINER_A, `update ojt_plans set result = 'pass' where id = '${OJT_PLAN_A}'`, 'trainer rewrites OJT result');
    await denied(TRAINER_A, `update training_plans set is_archived = true, trainer_comment = 'x' where id = '${PLAN_A}'`, 'archive with an edit');

    await allowed('authenticated', TRAINER_A, `update training_plans set is_archived = true where id = '${PLAN_A}'`, 'trainer archives');
    await allowed('authenticated', TRAINER_A, `update ojt_plans set is_archived = true where id = '${OJT_PLAN_A}'`, 'trainer archives OJT');
    await allowed('authenticated', SUPERVISOR_A, `update training_plans set status = 'in_progress', supervisor_comment_to_worker = 'x' where id = '${PLAN_A}'`, 'supervisor reopens');
    await allowed('authenticated', ADMIN, `update training_plans set status = 'in_progress', notes = 'x' where id = '${PLAN_A}'`, 'admin reopens');
    await allowed('service_role', null, `update training_plans set status = 'in_progress' where id = '${PLAN_A}'`, 'server reopens');
  }

  const inProgress = `update training_plans set status = 'in_progress' where id = '${PLAN_A}'`;
  const open = await run('authenticated', WORKER_A, `update training_plans set worker_comment = 'x' where id = '${PLAN_A}'`, inProgress);
  assert.equal(open.affected, 1, open.error);
});

test('notifications: own only, and only the read flag', async () => {
  assert.deepEqual(await ids(WORKER_A, 'notifications'), [NOTIFICATION_WORKER_A]);
  assert.deepEqual(await ids(ADMIN, 'notifications'), []);

  const read = await as(WORKER_A, `update notifications set is_read = true where id = '${NOTIFICATION_WORKER_A}'`);
  assert.equal(read.affected, 1, read.error);

  assert.ok(!(await as(WORKER_A, `update notifications set title = 'x' where id = '${NOTIFICATION_WORKER_A}'`)).ok);
  assert.equal((await as(WORKER_A, `update notifications set is_read = true where id = '${NOTIFICATION_WORKER_A2}'`)).affected, 0);
  assert.equal((await as(WORKER_A, `delete from notifications where id = '${NOTIFICATION_WORKER_A}'`)).affected, 0);
  assert.equal((await as(ADMIN, `delete from notifications`)).affected, 0);

  for (const uid of [WORKER_A, TRAINER_A, SUPERVISOR_A, EXECUTIVE]) {
    const forged = await as(uid, `insert into notifications (user_id, title) values ('${ADMIN}', 'x')`);
    assert.ok(!forged.ok, `${uid} cannot write directly`);
  }
  assert.ok((await as(ADMIN, `insert into notifications (user_id, title) values ('${WORKER_A}', 'reply')`)).ok);
});

// Runs the whole statement list in one rolled-back transaction under one user
async function asSession(uid, statements) {
  await db.exec(`begin; select set_config('app.uid', '${uid}', true); set local role authenticated;`);
  try {
    const results = [];
    for (const statement of statements) results.push(await db.query(statement));
    await db.exec('reset role');
    return { results, notices: (await db.query('select user_id, title, message, link from notifications')).rows };
  } finally {
    await db.exec('rollback');
  }
}

test('plan review notice reaches every active supervisor and admin', async () => {
  const { results, notices } = await asSession(WORKER_A, [
    `select public.notify_plan_ready_for_review('training', '${PLAN_A}') as sent`,
  ]);
  assert.equal(results[0].rows[0].sent, 0, 'nothing until both inputs are in');
  assert.equal(notices.filter((n) => n.title === '研修記録の確認依頼').length, 0);

  await db.exec(`update training_plans set trainer_completed_at = now(), worker_completed_at = now() where id in ('${PLAN_A}', '${PLAN_ALSO_A}')`);
  await db.exec(`update ojt_plans set trainer_completed_at = now(), worker_completed_at = now() where id = '${OJT_PLAN_A}'`);
  await db.exec(`update profiles set is_archived = true where id = '${SUPERVISOR_LEGACY_B}'`);
  try {
    const worker = await asSession(WORKER_A, [
      `select public.notify_plan_ready_for_review('training', '${PLAN_A}') as sent`,
      `select public.notify_plan_ready_for_review('training', '${PLAN_A}') as sent`,
      `select public.notify_plan_ready_for_review('ojt', '${OJT_PLAN_A}') as sent`,
    ]);
    const recipients = worker.notices.filter((n) => n.link === `/training-plans/${PLAN_A}`).map((n) => n.user_id).sort();
    assert.deepEqual(recipients, [ADMIN, SUPERVISOR_A, SUPERVISOR_AB, SUPERVISOR_B].sort(), 'archived staff are left out');
    assert.equal(worker.results[1].rows[0].sent, 0, 'a repeat does not notify twice');
    const ojt = worker.notices.find((n) => n.link === `/ojt-plans/${OJT_PLAN_A}`);
    assert.equal(ojt.title, 'OJT記録の確認依頼');
    assert.match(ojt.message, /worker-aのOJT（⑤ OJT 2回目（メイン））の同行者・本人入力が完了しました/);

    const stranger = await as(WORKER_A2, `select public.notify_plan_ready_for_review('training', '${PLAN_A}')`);
    assert.ok(!stranger.ok, 'another worker cannot trigger it');
    const notAssigned = await as(TRAINER_B, `select public.notify_plan_ready_for_review('ojt', '${OJT_PLAN_A}')`);
    assert.ok(!notAssigned.ok, 'a trainer who is not on the plan cannot trigger it');
    const anySupervisor = await as(SUPERVISOR_B, `select public.notify_plan_ready_for_review('ojt', '${OJT_PLAN_A}')`);
    assert.ok(anySupervisor.ok, anySupervisor.error);
  } finally {
    await db.exec(`update training_plans set trainer_completed_at = null, worker_completed_at = null where id in ('${PLAN_A}', '${PLAN_ALSO_A}')`);
    await db.exec(`update ojt_plans set trainer_completed_at = null, worker_completed_at = null where id = '${OJT_PLAN_A}'`);
    await db.exec(`update profiles set is_archived = false where id = '${SUPERVISOR_LEGACY_B}'`);
  }
});

test('step and category labels in the notices match the app', async () => {
  for (const { step, number, label } of OJT_STEPS) {
    const { notices } = await asSession(SUPERVISOR_A, [
      `update ojt_plans set step = '${step}', trainer_completed_at = now(), worker_completed_at = now() where id = '${OJT_PLAN_A}'`,
      `select public.notify_plan_ready_for_review('ojt', '${OJT_PLAN_A}')`,
    ]);
    const notice = notices.find((n) => n.link === `/ojt-plans/${OJT_PLAN_A}`);
    assert.ok(notice.message.includes(`（${number} ${label}）`), `${step}: ${notice.message}`);
  }

  for (const [category, label] of Object.entries(FEEDBACK_CATEGORY_LABELS)) {
    const id = uuid(70);
    const { notices } = await asSession(WORKER_A, [
      `insert into feedbacks (id, sender_id, content, category, status) values ('${id}', '${WORKER_A}', 'c', '${category}', 'pending')`,
      `select public.notify_feedback_received('${id}')`,
    ]);
    const notice = notices.find((n) => n.title === '新しいフィードバック');
    assert.equal(notice.message, `worker-aさんから${label}のフィードバックが届きました`);
  }
});

test('feedbacks: senders write their own, only admin reads all and responds', async () => {
  assert.deepEqual(await ids(WORKER_A, 'feedbacks'), [FEEDBACK_WORKER_A]);
  assert.deepEqual(await ids(SUPERVISOR_A, 'feedbacks'), []);
  assert.equal((await ids(ADMIN, 'feedbacks')).length, 2);

  const insert = (sender, status = 'pending', extra = '') =>
    `insert into feedbacks (sender_id, content, category, status${extra ? ', admin_response' : ''})
     values ('${sender}', 'c', 'bug', '${status}'${extra ? `, '${extra}'` : ''}) returning id`;
  assert.ok((await as(WORKER_A, insert(WORKER_A))).ok);
  assert.ok(!(await as(WORKER_A, insert(WORKER_A2))).ok, 'forged sender');
  assert.ok(!(await as(WORKER_A, insert(WORKER_A, 'resolved'))).ok, 'forged status');
  assert.ok(!(await as(WORKER_A, insert(WORKER_A, 'pending', 'x'))).ok, 'forged response');

  const respond = `update feedbacks set status = 'resolved', admin_response = 'r' where id = '${FEEDBACK_WORKER_A}'`;
  assert.equal((await as(ADMIN, respond)).affected, 1);
  for (const uid of [WORKER_A, SUPERVISOR_A, TRAINER_A, EXECUTIVE]) {
    assert.equal((await as(uid, respond)).affected, 0, `${uid} cannot respond`);
  }
  assert.equal((await as(WORKER_A, `delete from feedbacks where id = '${FEEDBACK_WORKER_A}'`)).affected, 0);
});

test('feedback notice goes to admins and only the sender can trigger it', async () => {
  const { results, notices } = await asSession(WORKER_A, [
    `select public.notify_feedback_received('${FEEDBACK_WORKER_A}') as sent`,
    `select public.notify_feedback_received('${FEEDBACK_WORKER_A}') as sent`,
  ]);
  assert.equal(results[0].rows[0].sent, 1);
  assert.equal(results[1].rows[0].sent, 0);
  const notice = notices.find((n) => n.title === '新しいフィードバック');
  assert.equal(notice.user_id, ADMIN);
  assert.equal(notice.message, 'worker-aさんからバグ報告のフィードバックが届きました');

  assert.ok(!(await as(WORKER_A2, `select public.notify_feedback_received('${FEEDBACK_WORKER_A}')`)).ok);
});

test('feedback-images is private and folder-scoped', async () => {
  const { rows } = await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'feedback-images'`);
  assert.deepEqual(rows, [{ public: false, file_size_limit: null, allowed_mime_types: null }]);

  const names = async (uid) =>
    (await as(uid, `select name from storage.objects where bucket_id = 'feedback-images' order by name`)).rows.map((r) => r.name);
  assert.deepEqual(await names(WORKER_A), [`${WORKER_A}/1.png`]);
  assert.equal((await names(ADMIN)).length, 2);
  assert.deepEqual(await names(SUPERVISOR_A), []);
  assert.deepEqual(await names(TRAINER_A), []);
  assert.deepEqual((await run('anon', null, `select name from storage.objects`)).rows, []);

  const upload = (folder) => `insert into storage.objects (bucket_id, name) values ('feedback-images', '${folder}/2.png')`;
  assert.ok((await as(WORKER_A, upload(WORKER_A))).ok);
  assert.ok(!(await as(WORKER_A, upload(WORKER_A2))).ok, 'someone else\'s folder');
});

test('phase 1 stays closed', async () => {
  for (const table of ['profiles', 'foreign_workers', 'training_plans', 'notifications', 'ojt_records']) {
    const result = await run('anon', null, `select * from ${table}`);
    assert.ok(!result.ok, `anon reads ${table}`);
  }
  assert.ok(!(await as(WORKER_A, `update profiles set role = 'admin' where id = '${WORKER_A}'`)).ok);
  assert.ok(!(await as(WORKER_A, `insert into profiles (id, email, name, role) values ('${uuid(99)}', 'e', 'n', 'admin')`)).ok);
  assert.ok(!(await as(WORKER_A, `select public.readable_worker_ids()`)).rows.some((r) => r.readable_worker_ids === FW_B));
  assert.ok(!(await run('anon', null, `select public.readable_worker_ids()`)).ok, 'anon has no helper access');
});

test('the server role still bypasses the limits', async () => {
  const update = await run('service_role', null, `update training_plans set planned_date = '2030-01-01', status = 'completed' where id = '${PLAN_A}'`);
  assert.equal(update.affected, 1, update.error);
  const read = await run('service_role', null, `select id from foreign_workers`);
  assert.equal(read.rows.length, 4);
});

test('the preflight queries run and change nothing', async () => {
  const before = await policySnapshot();
  const results = await db.exec(await readFile(PREFLIGHT, 'utf8'));
  assert.deepEqual(results[0].rows, [], 'no code-referenced column is missing');
  assert.deepEqual(results.at(-2).rows, [], 'no plan has an unexpected status');
  const defaults = results.at(-1).rows;
  assert.equal(defaults.length, 35, 'every column the insert check reads, on both tables');
  assert.deepEqual(
    [...new Set(defaults.map((row) => row.column_default))].sort(),
    [null, "'[]'::jsonb", "'{}'::text[]", "'{}'::uuid[]", 'false'].sort(),
  );
  assert.deepEqual(await policySnapshot(), before);
});

test('the preflight lists the storage policies that reach feedback-images', async () => {
  const listed = async () => {
    const results = await db.exec(await readFile(PREFLIGHT, 'utf8'));
    return results.find((result) => result.fields.some((field) => field.name === 'policyname') && !result.fields.some((field) => field.name === 'schemaname'))
      .rows.map((row) => row.policyname);
  };
  assert.deepEqual(await listed(), ['feedback_images_insert_own_folder', 'feedback_images_select_own_or_admin']);

  await db.exec(`
    create policy "any bucket read" on storage.objects for select using (true);
    create policy "other bucket read" on storage.objects for select using (bucket_id = 'other');
  `);
  try {
    assert.deepEqual(await listed(), ['feedback_images_insert_own_folder', 'any bucket read', 'feedback_images_select_own_or_admin']);
  } finally {
    await db.exec(`
      drop policy "any bucket read" on storage.objects;
      drop policy "other bucket read" on storage.objects;
    `);
  }
});

test('rollback restores the previous policies, then the migration applies again', async () => {
  await db.exec(await rollbackOf(STORAGE_POLICIES));
  await db.exec(await rollbackOf(BUCKET));
  await db.exec(await rollbackOf(SCOPE));

  assert.deepEqual(await policySnapshot(), policiesBefore);
  const { rows: bucket } = await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'feedback-images'`);
  assert.deepEqual(bucket, [{ public: true, file_size_limit: null, allowed_mime_types: null }]);
  const { rows: leftovers } = await db.query(`
    select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and proname in (
      'is_staff_viewer', 'readable_worker_ids', 'readable_profile_ids', 'enforce_plan_write_limits', 'notify_plan_ready_for_review', 'notify_feedback_received'
    )`);
  assert.deepEqual(leftovers, []);
  const { rows: triggers } = await db.query(`select tgname from pg_trigger where tgname like 'enforce_%'`);
  assert.deepEqual(triggers, []);

  assert.equal((await ids(WORKER_A, 'foreign_workers')).length, 4, 'the hole is back, as the rollback warns');
  assert.equal((await as(WORKER_A, `update notifications set title = 'x'`)).affected, 2, 'all notification columns are writable again');

  await db.exec(await sql(SCOPE));
  await db.exec(await sql(BUCKET));
  await db.exec(await sql(STORAGE_POLICIES));
  assert.deepEqual(await ids(WORKER_A, 'foreign_workers'), [FW_A]);
});

// Production's SQL role does not own storage.objects, so the main fix has to
// apply without it and the storage steps have to fail without leaving anything.
test('applying as a role that does not own storage', async (t) => {
  const main = db;
  const restricted = new PGlite();
  db = restricted;
  t.after(() => {
    db = main;
  });

  const storagePolicies = async () =>
    (await db.query(`select policyname from pg_policies where schemaname = 'storage' order by policyname`)).rows
      .map((r) => r.policyname);
  const isPublic = async () =>
    (await db.query(`select public from storage.buckets where id = 'feedback-images'`)).rows[0].public;

  await db.exec(PLATFORM);
  await db.exec(`
    create role sql_editor;
    grant create on schema public to sql_editor;
    grant create on database postgres to sql_editor;
    grant usage on schema public, auth, storage to sql_editor;
    grant execute on function auth.uid() to sql_editor;
    grant execute on function storage.foldername(text) to sql_editor;
    grant references, select on auth.users to sql_editor;
    grant select on storage.buckets, storage.objects to sql_editor;
    grant authenticated, anon, service_role to sql_editor;
    alter default privileges for role sql_editor in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges for role sql_editor in schema public grant execute on functions to anon, authenticated, service_role;
    set role sql_editor;
  `);
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files.filter((f) => f < LOCKDOWN)) {
    await db.exec(await sql(file));
  }
  await db.exec(PRODUCTION_DRIFT);
  await db.exec('reset role');
  await db.exec(STORAGE_DRIFT);
  await db.exec(SEED);
  const storageBefore = await storagePolicies();

  await db.exec('set role sql_editor');
  await db.exec(await sql(LOCKDOWN));
  await db.exec(await sql(SCOPE));
  await db.exec('reset role');

  assert.deepEqual(await ids(WORKER_A, 'foreign_workers'), [FW_A], 'the main fix is in place');
  assert.deepEqual(await storagePolicies(), storageBefore, 'the main fix leaves storage alone');
  assert.equal(await isPublic(), true);

  await db.exec('set role sql_editor');
  await assert.rejects(db.exec(await sql(BUCKET)), /permission denied/, 'no update right on the bucket yet');
  await db.exec('reset role');
  assert.equal(await isPublic(), true);

  await db.exec('grant update on storage.buckets to sql_editor; set role sql_editor;');
  await db.exec(await sql(BUCKET));
  await db.exec('reset role');
  assert.equal(await isPublic(), false, 'an update right is all the bucket step needs');

  await db.exec('set role sql_editor');
  await assert.rejects(db.exec(await sql(STORAGE_POLICIES)), /must be owner/);
  await db.exec('reset role');
  assert.deepEqual(await storagePolicies(), storageBefore, 'a refused policy step leaves nothing behind');
  const { rows } = await db.query(`select to_regclass('private.storage_rls_snapshot_20261102') as snapshot`);
  assert.equal(rows[0].snapshot, null);
  assert.deepEqual(await ids(WORKER_A, 'foreign_workers'), [FW_A], 'the main fix survives');

  await db.exec('set role sql_editor');
  await db.exec(await rollbackOf(SCOPE));
  await db.exec('reset role');
  assert.deepEqual(await storagePolicies(), storageBefore, 'the main rollback leaves storage alone');
  assert.equal(await isPublic(), false);
  assert.equal((await ids(WORKER_A, 'foreign_workers')).length, 4);
});
