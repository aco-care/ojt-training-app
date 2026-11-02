-- feedback-images の storage.objects ポリシーを、記録しておいた定義へ戻す。
-- 適用に失敗したときは何も残っていないので、これを流す必要はない。
BEGIN;

DROP POLICY IF EXISTS "feedback_images_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "feedback_images_select_own_or_admin" ON storage.objects;

DO $$
DECLARE
  p record;
  roles_sql text;
BEGIN
  FOR p IN SELECT * FROM private.storage_rls_snapshot_20261102 LOOP
    SELECT string_agg(CASE WHEN r = 'public' THEN 'public' ELSE quote_ident(r) END, ', ')
    INTO roles_sql
    FROM unnest(p.roles) AS r;

    EXECUTE format(
      'CREATE POLICY %I ON storage.objects AS %s FOR %s TO %s%s%s',
      p.policyname, p.permissive, p.cmd, roles_sql,
      CASE WHEN p.qual IS NULL THEN '' ELSE format(' USING (%s)', p.qual) END,
      CASE WHEN p.with_check IS NULL THEN '' ELSE format(' WITH CHECK (%s)', p.with_check) END
    );
  END LOOP;
END $$;

DROP TABLE private.storage_rls_snapshot_20261102;

COMMIT;
