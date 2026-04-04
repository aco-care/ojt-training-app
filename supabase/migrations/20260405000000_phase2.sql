-- ============================================================
-- Phase 2 Migration: 3者フロー・通知・フィードバック対応
-- ============================================================

-- ============================================================
-- ALTER TABLE: 既存テーブルへのカラム追加
-- ============================================================

-- profiles: アーカイブ・資格
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS qualification TEXT DEFAULT 'none';

-- foreign_workers: プロフィール紐付け・資格
ALTER TABLE foreign_workers ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id);
ALTER TABLE foreign_workers ADD COLUMN IF NOT EXISTS qualification TEXT DEFAULT 'none';

-- ojt_records: 本人コメント
ALTER TABLE ojt_records ADD COLUMN IF NOT EXISTS worker_comment TEXT;

-- training_sessions: カスタムコンテンツ・休憩時間
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS custom_content TEXT;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 0;

-- final_evaluations: 本人コメント
ALTER TABLE final_evaluations ADD COLUMN IF NOT EXISTS worker_comment TEXT;

-- ============================================================
-- 研修予定（3者フロー）
-- ============================================================
CREATE TABLE training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES foreign_workers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES training_items(id),
  planned_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  trainer_id UUID REFERENCES profiles(id),
  facility_id UUID REFERENCES facilities(id),
  status TEXT NOT NULL DEFAULT 'planned', -- planned / completed / cancelled
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- OJT予定（3者フロー）
-- ============================================================
CREATE TABLE ojt_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES foreign_workers(id) ON DELETE CASCADE,
  ojt_user_id UUID NOT NULL REFERENCES ojt_users(id) ON DELETE CASCADE,
  planned_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  companion_id UUID REFERENCES profiles(id),
  step ojt_step,
  facility_id UUID REFERENCES facilities(id),
  status TEXT NOT NULL DEFAULT 'planned', -- planned / completed / cancelled
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 外国人×事業所 中間テーブル
-- ============================================================
CREATE TABLE worker_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES foreign_workers(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(worker_id, facility_id)
);

-- ============================================================
-- プロフィール×事業所 中間テーブル
-- ============================================================
CREATE TABLE profile_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, facility_id)
);

-- ============================================================
-- フィードバック
-- ============================================================
CREATE TABLE feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general', -- general / bug / feature / other
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open / reviewed / resolved
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 通知
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'info', -- info / warning / action / reminder
  is_read BOOLEAN DEFAULT false,
  link TEXT, -- アプリ内遷移先
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_training_plans_worker_id ON training_plans(worker_id);
CREATE INDEX idx_training_plans_planned_date ON training_plans(planned_date);
CREATE INDEX idx_training_plans_trainer_id ON training_plans(trainer_id);

CREATE INDEX idx_ojt_plans_worker_id ON ojt_plans(worker_id);
CREATE INDEX idx_ojt_plans_planned_date ON ojt_plans(planned_date);
CREATE INDEX idx_ojt_plans_companion_id ON ojt_plans(companion_id);

CREATE INDEX idx_worker_facilities_worker_id ON worker_facilities(worker_id);
CREATE INDEX idx_worker_facilities_facility_id ON worker_facilities(facility_id);

CREATE INDEX idx_profile_facilities_profile_id ON profile_facilities(profile_id);
CREATE INDEX idx_profile_facilities_facility_id ON profile_facilities(facility_id);

CREATE INDEX idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX idx_feedbacks_status ON feedbacks(status);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

CREATE INDEX idx_foreign_workers_profile_id ON foreign_workers(profile_id);
CREATE INDEX idx_profiles_is_archived ON profiles(is_archived);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ojt_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- training_plans
CREATE POLICY "training_plans_select" ON training_plans FOR SELECT USING (true);
CREATE POLICY "training_plans_insert" ON training_plans FOR INSERT WITH CHECK (
  get_user_role() IN ('admin', 'trainer', 'supervisor')
);
CREATE POLICY "training_plans_update" ON training_plans FOR UPDATE USING (
  created_by = auth.uid() OR get_user_role() IN ('admin', 'supervisor')
);
CREATE POLICY "training_plans_delete" ON training_plans FOR DELETE USING (
  get_user_role() IN ('admin', 'supervisor')
);

-- ojt_plans
CREATE POLICY "ojt_plans_select" ON ojt_plans FOR SELECT USING (true);
CREATE POLICY "ojt_plans_insert" ON ojt_plans FOR INSERT WITH CHECK (
  get_user_role() IN ('admin', 'trainer', 'supervisor')
);
CREATE POLICY "ojt_plans_update" ON ojt_plans FOR UPDATE USING (
  created_by = auth.uid() OR get_user_role() IN ('admin', 'supervisor')
);
CREATE POLICY "ojt_plans_delete" ON ojt_plans FOR DELETE USING (
  get_user_role() IN ('admin', 'supervisor')
);

-- worker_facilities
CREATE POLICY "worker_facilities_select" ON worker_facilities FOR SELECT USING (true);
CREATE POLICY "worker_facilities_modify" ON worker_facilities FOR ALL USING (
  get_user_role() IN ('admin', 'supervisor')
);

-- profile_facilities
CREATE POLICY "profile_facilities_select" ON profile_facilities FOR SELECT USING (true);
CREATE POLICY "profile_facilities_modify" ON profile_facilities FOR ALL USING (
  get_user_role() IN ('admin', 'supervisor')
);

-- feedbacks: ユーザーは自分のフィードバックを作成・閲覧、管理者は全件閲覧・更新
CREATE POLICY "feedbacks_select" ON feedbacks FOR SELECT USING (
  user_id = auth.uid() OR get_user_role() IN ('admin', 'supervisor')
);
CREATE POLICY "feedbacks_insert" ON feedbacks FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
CREATE POLICY "feedbacks_update" ON feedbacks FOR UPDATE USING (
  get_user_role() IN ('admin', 'supervisor')
);

-- notifications: ユーザーは自分の通知のみ
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (
  get_user_role() IN ('admin', 'supervisor')
);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (
  user_id = auth.uid() OR get_user_role() = 'admin'
);
