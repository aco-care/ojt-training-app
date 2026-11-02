-- 第2段階を元に戻す。アプリが動かない場合だけ使う。穴も元に戻る。
-- 記録しておいた本番の定義へ、ポリシーとバケットの設定を戻す。
-- 通知の関数も消すので、戻したあとは通知を送るアプリ側の変更も戻すこと。
-- 20260531235959 で足した列と 20261101000000 の第1段階はそのまま残す。
BEGIN;

DO $$
DECLARE
  p record;
  roles_sql text;
BEGIN
  IF to_regclass('private.rls_snapshot_20261102') IS NULL THEN
    RAISE EXCEPTION '第2段階の記録がありません。適用されていないか、すでに戻しています';
  END IF;

  -- 第2段階の後の状態をいったん消す
  FOR p IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'foreign_workers', 'worker_facilities', 'profile_facilities',
        'training_sessions', 'training_approvals', 'ojt_users', 'ojt_records',
        'final_evaluations', 'audit_logs',
        'training_plans', 'ojt_plans', 'feedbacks', 'notifications'
      )
    UNION ALL
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname IN ('feedback_images_insert_own_folder', 'feedback_images_select_own_or_admin')
    UNION ALL
    SELECT s.schemaname, s.tablename, s.policyname FROM private.rls_snapshot_20261102 s
    JOIN pg_policies c
      ON c.schemaname = s.schemaname AND c.tablename = s.tablename AND c.policyname = s.policyname
    WHERE s.schemaname = 'storage'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;

  -- 記録した定義を作り直す
  FOR p IN SELECT * FROM private.rls_snapshot_20261102 LOOP
    SELECT string_agg(CASE WHEN r = 'public' THEN 'public' ELSE quote_ident(r) END, ', ')
    INTO roles_sql
    FROM unnest(p.roles) AS r;

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd, roles_sql,
      CASE WHEN p.qual IS NULL THEN '' ELSE format(' USING (%s)', p.qual) END,
      CASE WHEN p.with_check IS NULL THEN '' ELSE format(' WITH CHECK (%s)', p.with_check) END
    );
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS enforce_training_plan_writes ON public.training_plans;
DROP TRIGGER IF EXISTS enforce_ojt_plan_writes ON public.ojt_plans;
DROP FUNCTION IF EXISTS public.enforce_plan_write_limits();
DROP FUNCTION IF EXISTS public.notify_plan_ready_for_review(text, uuid);
DROP FUNCTION IF EXISTS public.notify_feedback_received(uuid);
DROP FUNCTION IF EXISTS public.readable_profile_ids();
DROP FUNCTION IF EXISTS public.readable_worker_ids();
DROP FUNCTION IF EXISTS public.is_staff_viewer();

REVOKE UPDATE (is_read) ON public.notifications FROM authenticated;
GRANT UPDATE ON public.notifications TO authenticated;

-- 記録が無いときは第2段階で作ったバケットなので消さず、公開設定も変えない
UPDATE storage.buckets b
SET public = s.public
FROM private.feedback_bucket_snapshot_20261102 s
WHERE b.id = s.id;

DROP TABLE private.feedback_bucket_snapshot_20261102;
DROP TABLE private.rls_snapshot_20261102;

COMMIT;
