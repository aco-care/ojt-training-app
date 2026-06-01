-- 3者フロー完了時の自動レコード作成用：重複防止カラム
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS training_plan_id UUID REFERENCES training_plans(id);
ALTER TABLE ojt_records ADD COLUMN IF NOT EXISTS ojt_plan_id UUID REFERENCES ojt_plans(id);
