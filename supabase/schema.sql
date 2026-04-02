-- ============================================================
-- ACO 研修・OJT マネージャー — Database Schema
-- 厚労省「訪問系サービスの要件に係る報告書」準拠
-- ============================================================

-- Enum types
CREATE TYPE user_role AS ENUM ('admin', 'trainer', 'supervisor', 'worker', 'executive');
CREATE TYPE training_format AS ENUM ('classroom', 'ojt', 'roleplay', 'simulation');
CREATE TYPE training_status AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE ojt_step AS ENUM ('explanation', 'pre_training', 'observation', 'main', 'independent', 'completion');
CREATE TYPE ojt_result AS ENUM ('pass', 'redo', 'rollback');
CREATE TYPE ojt_status AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE eval_rating AS ENUM ('good', 'fair', 'poor'); -- ○ △ ×

-- ============================================================
-- 事業所マスタ
-- ============================================================
CREATE TABLE facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  type TEXT, -- 訪問介護 / 居宅介護 etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ユーザー / スタッフ
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'trainer',
  facility_id UUID REFERENCES facilities(id),
  certifications TEXT[], -- 保有資格
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 特定技能外国人
-- ============================================================
CREATE TABLE foreign_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nationality TEXT,
  birth_date DATE,
  facility_id UUID NOT NULL REFERENCES facilities(id),
  experience_years INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 研修項目マスタ（5大項目）
-- ============================================================
CREATE TABLE training_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_number INTEGER NOT NULL, -- 1-5
  title TEXT NOT NULL,
  target_hours NUMERIC(5,1) NOT NULL, -- 目標時間
  target_sessions INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 研修細目マスタ
-- ============================================================
CREATE TABLE training_subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES training_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 研修セッション記録
-- ============================================================
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES foreign_workers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES training_items(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  trainer_id UUID NOT NULL REFERENCES profiles(id),
  format training_format NOT NULL DEFAULT 'classroom',
  completed_subtopics UUID[] DEFAULT '{}', -- array of subtopic IDs
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 研修項目 × 外国人 の承認状況
-- ============================================================
CREATE TABLE training_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES foreign_workers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES training_items(id),
  status training_status NOT NULL DEFAULT 'not_started',
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(worker_id, item_id)
);

-- ============================================================
-- OJT 対象利用者
-- ============================================================
CREATE TABLE ojt_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES foreign_workers(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id),
  user_initial TEXT NOT NULL, -- イニシャルまたはID
  visit_frequency INTEGER NOT NULL DEFAULT 1, -- 週の訪問回数
  ojt_start_date DATE,
  ojt_status ojt_status NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- OJT 記録
-- ============================================================
CREATE TABLE ojt_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES foreign_workers(id) ON DELETE CASCADE,
  ojt_user_id UUID NOT NULL REFERENCES ojt_users(id) ON DELETE CASCADE,
  step ojt_step NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1, -- 何回目の実施か
  date DATE NOT NULL,
  companion_id UUID REFERENCES profiles(id), -- 同行者
  content TEXT, -- 実施内容
  -- 到達目標チェックシート（8項目 × 本人/指導者）
  checklist_self eval_rating[] DEFAULT '{}',
  checklist_trainer eval_rating[] DEFAULT '{}',
  result ojt_result, -- 判定結果
  manager_comment TEXT,
  approved_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 最終評価
-- ============================================================
CREATE TABLE final_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES foreign_workers(id) ON DELETE CASCADE,
  eval_date DATE NOT NULL,
  scores_self eval_rating[] NOT NULL DEFAULT '{}',
  scores_trainer eval_rating[] NOT NULL DEFAULT '{}',
  supervisor_comment TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE foreign_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ojt_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ojt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_evaluations ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user facility
CREATE OR REPLACE FUNCTION get_user_facility_id()
RETURNS UUID AS $$
  SELECT facility_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: users can read all, update own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid() OR get_user_role() = 'admin');
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);

-- Facilities: read all, admin can modify
CREATE POLICY "facilities_select" ON facilities FOR SELECT USING (true);
CREATE POLICY "facilities_modify" ON facilities FOR ALL USING (get_user_role() = 'admin');

-- Training items/subtopics: read only (master data)
CREATE POLICY "training_items_select" ON training_items FOR SELECT USING (true);
CREATE POLICY "training_subtopics_select" ON training_subtopics FOR SELECT USING (true);

-- Foreign workers: facility-scoped read, admin modify
CREATE POLICY "workers_select" ON foreign_workers FOR SELECT USING (true);
CREATE POLICY "workers_modify" ON foreign_workers FOR ALL USING (get_user_role() IN ('admin', 'supervisor'));

-- Training sessions: facility-scoped
CREATE POLICY "sessions_select" ON training_sessions FOR SELECT USING (true);
CREATE POLICY "sessions_insert" ON training_sessions FOR INSERT WITH CHECK (
  get_user_role() IN ('admin', 'trainer', 'supervisor')
);
CREATE POLICY "sessions_update" ON training_sessions FOR UPDATE USING (
  trainer_id = auth.uid() OR get_user_role() = 'admin'
);

-- Training approvals
CREATE POLICY "approvals_select" ON training_approvals FOR SELECT USING (true);
CREATE POLICY "approvals_modify" ON training_approvals FOR ALL USING (
  get_user_role() IN ('admin', 'supervisor')
);

-- OJT users
CREATE POLICY "ojt_users_select" ON ojt_users FOR SELECT USING (true);
CREATE POLICY "ojt_users_modify" ON ojt_users FOR ALL USING (
  get_user_role() IN ('admin', 'trainer', 'supervisor')
);

-- OJT records
CREATE POLICY "ojt_records_select" ON ojt_records FOR SELECT USING (true);
CREATE POLICY "ojt_records_modify" ON ojt_records FOR ALL USING (
  get_user_role() IN ('admin', 'trainer', 'supervisor')
);

-- Final evaluations
CREATE POLICY "evaluations_select" ON final_evaluations FOR SELECT USING (true);
CREATE POLICY "evaluations_modify" ON final_evaluations FOR ALL USING (
  get_user_role() IN ('admin', 'supervisor')
);

-- ============================================================
-- Seed: 研修項目マスタ + 細目
-- ============================================================

-- ① 訪問系サービスの基本事項（1時間）
INSERT INTO training_items (item_number, title, target_hours, target_sessions, sort_order)
VALUES (1, '訪問系サービスの基本事項', 1.0, 1, 1);

WITH item AS (SELECT id FROM training_items WHERE item_number = 1)
INSERT INTO training_subtopics (item_id, title, sort_order) VALUES
  ((SELECT id FROM item), '訪問介護の一連の流れ', 1),
  ((SELECT id FROM item), '業務における基本動作', 2),
  ((SELECT id FROM item), '個別支援計画の理解', 3),
  ((SELECT id FROM item), '個別援助計画の理解', 4),
  ((SELECT id FROM item), 'プライバシーの保護', 5),
  ((SELECT id FROM item), '法令遵守（介護保険法適用範囲）', 6),
  ((SELECT id FROM item), 'ハラスメント対策（利用者・家族から）', 7),
  ((SELECT id FROM item), '虐待防止', 8);

-- ② 生活支援技術（各8時間 × 6回 = 48時間）
INSERT INTO training_items (item_number, title, target_hours, target_sessions, sort_order)
VALUES (2, '生活支援技術', 48.0, 6, 2);

WITH item AS (SELECT id FROM training_items WHERE item_number = 2)
INSERT INTO training_subtopics (item_id, title, sort_order) VALUES
  ((SELECT id FROM item), '高齢期の食生活（食事介助・調理）', 1),
  ((SELECT id FROM item), '住生活（整理整頓・住環境整備）', 2),
  ((SELECT id FROM item), '調理（食材管理・衛生管理）', 3),
  ((SELECT id FROM item), '掃除（各場所の掃除方法）', 4),
  ((SELECT id FROM item), 'ゴミ出し（分別ルール・曜日確認）', 5),
  ((SELECT id FROM item), '買い物同行', 6),
  ((SELECT id FROM item), '洗濯・衣服管理', 7);

-- ③ 利用者・家族・近隣とのコミュニケーション（30分）
INSERT INTO training_items (item_number, title, target_hours, target_sessions, sort_order)
VALUES (3, '利用者・家族・近隣とのコミュニケーション', 0.5, 1, 3);

WITH item AS (SELECT id FROM training_items WHERE item_number = 3)
INSERT INTO training_subtopics (item_id, title, sort_order) VALUES
  ((SELECT id FROM item), '傾聴の基本', 1),
  ((SELECT id FROM item), '受容・共感の姿勢', 2),
  ((SELECT id FROM item), 'コミュニケーションスキル', 3),
  ((SELECT id FROM item), '地域の方々との関わり方', 4),
  ((SELECT id FROM item), '自治会・近隣への配慮', 5),
  ((SELECT id FROM item), '苦情・クレームの対応', 6);

-- ④ 日本の生活様式（30分）
INSERT INTO training_items (item_number, title, target_hours, target_sessions, sort_order)
VALUES (4, '日本の生活様式', 0.5, 1, 4);

WITH item AS (SELECT id FROM training_items WHERE item_number = 4)
INSERT INTO training_subtopics (item_id, title, sort_order) VALUES
  ((SELECT id FROM item), '日本の文化・風習', 1),
  ((SELECT id FROM item), '年中行事（正月・お盆・節句等）', 2),
  ((SELECT id FROM item), '冠婚葬祭のマナー', 3),
  ((SELECT id FROM item), '近隣付き合いの慣習', 4),
  ((SELECT id FROM item), '接遇マナー（敬語・挨拶）', 5);

-- ⑤ 緊急時の対応（30分）
INSERT INTO training_items (item_number, title, target_hours, target_sessions, sort_order)
VALUES (5, '緊急時の対応', 0.5, 1, 5);

WITH item AS (SELECT id FROM training_items WHERE item_number = 5)
INSERT INTO training_subtopics (item_id, title, sort_order) VALUES
  ((SELECT id FROM item), '利用者急変時の対応ルール', 1),
  ((SELECT id FROM item), '緊急連絡先一覧の確認', 2),
  ((SELECT id FROM item), '緊急連絡網の使い方', 3),
  ((SELECT id FROM item), '使用機器（ピッチ・スマホ）の操作', 4),
  ((SELECT id FROM item), '事故発生時の報告フロー', 5),
  ((SELECT id FROM item), '119番・医療機関への連絡方法', 6);
