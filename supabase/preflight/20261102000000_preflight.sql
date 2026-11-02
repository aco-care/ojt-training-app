-- 第2段階を本番へ適用する前に確かめる。読み取りだけで、何も変更しない。
-- 結果には実データが含まれるので、PRやチャットへ貼らないこと。
-- 判断の基準は PR 本文の「適用前に本番で確かめること」を参照。

-- 1. 適用時に新しく追加される列（本番とコードの差）。0行が想定。
WITH expected(table_name, column_name) AS (
  VALUES
    ('training_subtopics', 'group_label'),
    ('training_sessions', 'facility_id'),
    ('worker_facilities', 'is_primary'),
    ('profile_facilities', 'is_primary'),
    ('training_plans', 'planned_subtopics'),
    ('training_plans', 'method'),
    ('training_plans', 'break_minutes'),
    ('training_plans', 'trainer_completed_at'),
    ('training_plans', 'trainer_checked_subtopics'),
    ('training_plans', 'trainer_eval'),
    ('training_plans', 'trainer_comment'),
    ('training_plans', 'trainer_custom_content'),
    ('training_plans', 'worker_completed_at'),
    ('training_plans', 'worker_checked_subtopics'),
    ('training_plans', 'worker_eval'),
    ('training_plans', 'worker_comment'),
    ('training_plans', 'worker_custom_content'),
    ('training_plans', 'supervisor_comment_to_trainer'),
    ('training_plans', 'supervisor_comment_to_worker'),
    ('training_plans', 'supervisor_completed_at'),
    ('training_plans', 'supervisor_id'),
    ('training_plans', 'cancel_reason'),
    ('training_plans', 'cancel_history'),
    ('ojt_plans', 'break_minutes'),
    ('ojt_plans', 'trainer_completed_at'),
    ('ojt_plans', 'trainer_checked_items'),
    ('ojt_plans', 'trainer_eval'),
    ('ojt_plans', 'trainer_comment'),
    ('ojt_plans', 'trainer_custom_content'),
    ('ojt_plans', 'worker_completed_at'),
    ('ojt_plans', 'worker_checked_items'),
    ('ojt_plans', 'worker_eval'),
    ('ojt_plans', 'worker_comment'),
    ('ojt_plans', 'worker_custom_content'),
    ('ojt_plans', 'supervisor_comment_to_trainer'),
    ('ojt_plans', 'supervisor_comment_to_worker'),
    ('ojt_plans', 'supervisor_completed_at'),
    ('ojt_plans', 'supervisor_id'),
    ('ojt_plans', 'result'),
    ('ojt_plans', 'cancel_reason'),
    ('ojt_plans', 'cancel_history'),
    ('feedbacks', 'sender_id'),
    ('feedbacks', 'admin_response'),
    ('feedbacks', 'image_url'),
    ('feedbacks', 'resolved_by'),
    ('feedbacks', 'resolved_at'),
    ('notifications', 'message')
)
SELECT e.table_name, e.column_name
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = e.table_name AND c.column_name = e.column_name
WHERE c.column_name IS NULL;

-- 2. 予定の状態の既定値。'scheduled' が想定
SELECT table_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('training_plans', 'ojt_plans') AND column_name = 'status';

-- 3. 今のポリシー全件。書き込みが true のまま残る表が無いかを見る
--    FOR ALL は3つに分けて同じ条件を引き継ぐ。対象外の表は書き込み条件を変えない
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
   OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY schemaname, tablename, cmd, policyname;

-- 4. RLS の状態。全表が有効で、FORCE は無しが想定（関数が RLS を越えて読むため）
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- 5. このマイグレーションと名前がぶつかるもの。0行が想定
SELECT n.nspname, p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'is_corporate_viewer', 'scoped_facility_ids', 'readable_worker_ids',
    'scoped_facility_profile_ids', 'readable_profile_ids', 'enforce_plan_update_columns',
    'notify_plan_ready_for_review', 'notify_feedback_received'
  );

-- 6. 所属拠点が無く、適用後に何も読めなくなる指導者・指導責任者。0行が想定
SELECT p.id, p.role, p.is_archived
FROM public.profiles p
WHERE p.role IN ('supervisor', 'trainer')
  AND p.facility_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.profile_facilities pf WHERE pf.profile_id = p.id);

-- 7. profiles.facility_id と profile_facilities が食い違う職員（適用後は profile_facilities が優先）
SELECT p.id, p.role
FROM public.profiles p
WHERE p.role IN ('supervisor', 'trainer')
  AND p.facility_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.profile_facilities pf WHERE pf.profile_id = p.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.profile_facilities pf
    WHERE pf.profile_id = p.id AND pf.facility_id = p.facility_id
  );

-- 8. 外国人アカウントが紐づいていない worker（適用後は自分の記録も見えない）
SELECT p.id, p.is_archived
FROM public.profiles p
WHERE p.role = 'worker'
  AND NOT EXISTS (SELECT 1 FROM public.foreign_workers fw WHERE fw.profile_id = p.id);

-- 9. 担当者の所属拠点の外にある、完了前の予定（適用後は担当者が開けなくなる）。件数だけ
WITH staff_facility AS (
  SELECT pf.profile_id, pf.facility_id FROM public.profile_facilities pf
  UNION
  SELECT p.id, p.facility_id FROM public.profiles p
  WHERE p.facility_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.profile_facilities pf WHERE pf.profile_id = p.id)
),
worker_facility AS (
  SELECT fw.id AS worker_id, fw.facility_id FROM public.foreign_workers fw
  UNION
  SELECT wf.worker_id, wf.facility_id FROM public.worker_facilities wf
),
plans AS (
  SELECT 'training_plans' AS source, worker_id, trainer_id AS assignee_id, status, is_archived FROM public.training_plans
  UNION ALL
  SELECT 'ojt_plans', worker_id, companion_id, status, is_archived FROM public.ojt_plans
)
SELECT pl.source, count(*) AS plans_outside_facility
FROM plans pl
JOIN public.profiles p ON p.id = pl.assignee_id AND p.role IN ('supervisor', 'trainer')
WHERE pl.status NOT IN ('completed', 'cancelled')
  AND pl.is_archived IS NOT TRUE
  AND NOT EXISTS (
    SELECT 1 FROM staff_facility sf
    JOIN worker_facility wf ON wf.facility_id = sf.facility_id
    WHERE sf.profile_id = pl.assignee_id AND wf.worker_id = pl.worker_id
  )
GROUP BY pl.source;

-- 10. feedback-images の今の設定と、保存済み画像の件数
SELECT id, public FROM storage.buckets WHERE id = 'feedback-images';
SELECT count(*) AS stored_images FROM storage.objects WHERE bucket_id = 'feedback-images';
SELECT count(*) AS feedbacks_with_image FROM public.feedbacks WHERE image_url IS NOT NULL;

-- 11. マイグレーション履歴。無ければ supabase db push ではなく手順どおりに流す
SELECT to_regclass('supabase_migrations.schema_migrations') AS migration_history_table;

-- 12. 適用する接続が storage.objects のポリシーを変更できるか。true が想定
--     false なら feedback-images の手順が失敗する（全体を1トランザクションで流すので途中までは残らない）
SELECT pg_has_role(current_user, c.relowner, 'MEMBER') AS can_manage_storage_policies
FROM pg_class c
WHERE c.oid = 'storage.objects'::regclass;
