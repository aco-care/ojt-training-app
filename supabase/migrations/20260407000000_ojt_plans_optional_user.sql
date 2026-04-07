-- ojt_plans.ojt_user_id を nullable に変更
-- OJT利用者が未登録でもOJT予定を作成できるようにする
ALTER TABLE ojt_plans ALTER COLUMN ojt_user_id DROP NOT NULL;
