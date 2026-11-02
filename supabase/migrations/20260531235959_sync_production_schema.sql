-- ============================================================
-- 本番にあるのにリポジトリのマイグレーションに無かった定義を戻す
--
-- アプリのコード（src/lib/types.ts と各画面のクエリ）から確認できる列・型だけを
-- 書いている。本番ではすべて適用済みの想定で、何度流しても同じ結果になる。
-- 本番に無い定義が1つでもあれば適用時に追加されるので、適用前に
-- supabase/preflight/20261102000000_preflight.sql の結果を確認すること。
--
-- 20260601000000 の補完が参照する列を先に用意するため、この時刻に置いている。
-- ============================================================

-- OJTステップ（src/lib/types.ts の OJT_STEPS）
ALTER TYPE ojt_step ADD VALUE IF NOT EXISTS 'matching' BEFORE 'explanation';

-- 研修細目のグループ見出し
ALTER TABLE training_subtopics ADD COLUMN IF NOT EXISTS group_label TEXT;

-- 手入力の研修記録が持つ事業所
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES facilities(id);

-- 主所属
ALTER TABLE worker_facilities ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
ALTER TABLE profile_facilities ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- 研修予定: 3者フローの入力欄
ALTER TABLE training_plans ALTER COLUMN status SET DEFAULT 'scheduled';
ALTER TABLE training_plans
  ADD COLUMN IF NOT EXISTS planned_subtopics UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS method TEXT,
  ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trainer_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trainer_checked_subtopics UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trainer_eval JSONB,
  ADD COLUMN IF NOT EXISTS trainer_comment TEXT,
  ADD COLUMN IF NOT EXISTS trainer_custom_content TEXT,
  ADD COLUMN IF NOT EXISTS worker_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_checked_subtopics UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS worker_eval JSONB,
  ADD COLUMN IF NOT EXISTS worker_comment TEXT,
  ADD COLUMN IF NOT EXISTS worker_custom_content TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_comment_to_trainer TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_comment_to_worker TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancel_history JSONB DEFAULT '[]';

-- OJT予定: 3者フローの入力欄
ALTER TABLE ojt_plans ALTER COLUMN status SET DEFAULT 'scheduled';
ALTER TABLE ojt_plans
  ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trainer_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trainer_checked_items TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trainer_eval JSONB,
  ADD COLUMN IF NOT EXISTS trainer_comment TEXT,
  ADD COLUMN IF NOT EXISTS trainer_custom_content TEXT,
  ADD COLUMN IF NOT EXISTS worker_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_checked_items TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS worker_eval JSONB,
  ADD COLUMN IF NOT EXISTS worker_comment TEXT,
  ADD COLUMN IF NOT EXISTS worker_custom_content TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_comment_to_trainer TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_comment_to_worker TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS result TEXT,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancel_history JSONB DEFAULT '[]';

-- フィードバック: 送信者は sender_id（feedbacks_sender_id_fkey で結合している）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feedbacks' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feedbacks' AND column_name = 'sender_id'
  ) THEN
    ALTER TABLE feedbacks RENAME COLUMN user_id TO sender_id;
    ALTER TABLE feedbacks RENAME CONSTRAINT feedbacks_user_id_fkey TO feedbacks_sender_id_fkey;
  END IF;
END $$;
ALTER TABLE feedbacks
  ADD COLUMN IF NOT EXISTS admin_response TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 通知: 本文は message
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'body'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'message'
  ) THEN
    ALTER TABLE notifications RENAME COLUMN body TO message;
  END IF;
END $$;

-- 20260814000000 が参照する事業所。新しいDBで順に流しても失敗しないようにする
INSERT INTO facilities (id, name)
VALUES ('40f5c074-89ba-4d08-ad70-462589803753', '複合型サービス ふきのはなれ')
ON CONFLICT (id) DO NOTHING;
