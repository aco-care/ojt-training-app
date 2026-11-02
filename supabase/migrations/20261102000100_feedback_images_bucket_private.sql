-- feedback-images を非公開にする（公開設定だけを変える）。
-- 本体の 20261102000000 とは別のトランザクションで流す。
-- 元の値は private.feedback_bucket_snapshot_20261102 に残し、
-- supabase/rollbacks/20261102000100_feedback_images_bucket_private.rollback.sql で戻す。
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE private.feedback_bucket_snapshot_20261102 AS
SELECT id, public
FROM storage.buckets
WHERE id = 'feedback-images';

-- バケットがあれば UPDATE だけで済むよう、INSERT は無いときにしか実行しない
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'feedback-images') THEN
    UPDATE storage.buckets SET public = false WHERE id = 'feedback-images';
  ELSE
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('feedback-images', 'feedback-images', false);
  END IF;
END $$;
