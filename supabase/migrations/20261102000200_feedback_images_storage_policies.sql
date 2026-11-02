-- feedback-images の storage.objects ポリシーを置き換える。
-- 置き場所は送信者のフォルダだけ、読めるのは送信者本人と admin だけ。
-- 画面は保存したURLではなく、都度発行する署名付きURLで表示する。
--
-- storage.objects の所有者でない役割では失敗することがある。本体の
-- 20261102000000 はこのファイルに依存しないので、別のトランザクションで流す。
-- 本番には名前の分からないポリシーがあるため、バケット名を含むものを探して置き換える。
-- 元の定義は private.storage_rls_snapshot_20261102 に残し、
-- supabase/rollbacks/20261102000200_feedback_images_storage_policies.rollback.sql で戻す。
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE private.storage_rls_snapshot_20261102 AS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND concat(qual, with_check) LIKE '%feedback-images%';

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN SELECT policyname FROM private.storage_rls_snapshot_20261102 LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "feedback_images_insert_own_folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "feedback_images_select_own_or_admin" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.get_user_role() = 'admin'
    )
  );
