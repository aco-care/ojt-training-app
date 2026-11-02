-- feedback-images の公開設定を元に戻す。画像が誰でも読める状態へ戻る。
-- 記録が無いときは適用時に作ったバケットなので消さず、公開設定も変えない
BEGIN;

UPDATE storage.buckets b
SET public = s.public
FROM private.feedback_bucket_snapshot_20261102 s
WHERE b.id = s.id;

DROP TABLE private.feedback_bucket_snapshot_20261102;

COMMIT;
