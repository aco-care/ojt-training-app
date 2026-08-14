-- ============================================================
-- training_items に facility_id を追加し、拠点ごとに異なる
-- 目標時間・目標回数を持てるようにする
--
-- 背景: 「複合型サービス ふきのはなれ」の特定技能外国人向け
-- 研修計画は、既存拠点(コロボックル等)と同じ5項目名だが
-- 目標時間・回数が異なる(訪問系サービスの要件に係る報告書に準拠)。
-- facility_id が NULL の行は「拠点共通のデフォルト」として扱う。
-- ============================================================

ALTER TABLE training_items
  ADD COLUMN facility_id UUID REFERENCES facilities(id);

COMMENT ON COLUMN training_items.facility_id IS
  '特定拠点専用の目標値を持つ場合に設定。NULLの場合は全拠点共通のデフォルト項目。';

-- ふきのはなれ(複合型サービス ふきのはなれ)専用の5項目
-- id: 40f5c074-89ba-4d08-ad70-462589803753

INSERT INTO training_items (id, item_number, title, target_hours, target_sessions, sort_order, facility_id) VALUES
  ('17915701-4ed9-47a4-b50f-bb15c5d7864c', 1, '訪問系サービスの基本事項', 3.0, 3, 1, '40f5c074-89ba-4d08-ad70-462589803753'),
  ('fd6637b3-fd8e-49e2-8f97-6ef25bfb4fbb', 2, '技術',                    3.0, 1, 2, '40f5c074-89ba-4d08-ad70-462589803753'),
  ('268047d6-7e48-4295-ac6c-3c4b006c20a5', 3, '利用者・家族・近隣とのコミュニケーション', 1.0, 1, 3, '40f5c074-89ba-4d08-ad70-462589803753'),
  ('e0e8d142-476a-4f21-9c6e-08d57147971b', 4, '日本の生活様式',           1.0, 1, 4, '40f5c074-89ba-4d08-ad70-462589803753'),
  ('78c755da-bf1a-4d99-a4e7-701de7c045a6', 5, '緊急時の対応',             2.0, 1, 5, '40f5c074-89ba-4d08-ad70-462589803753');

-- 対応する研修細目を、拠点共通デフォルト項目からコピーする
INSERT INTO training_subtopics (item_id, title, sort_order)
SELECT '17915701-4ed9-47a4-b50f-bb15c5d7864c', title, sort_order
FROM training_subtopics WHERE item_id = '89f2fdbd-050e-41bd-b704-1114355acc7b';

INSERT INTO training_subtopics (item_id, title, sort_order)
SELECT 'fd6637b3-fd8e-49e2-8f97-6ef25bfb4fbb', title, sort_order
FROM training_subtopics WHERE item_id = 'd620d901-ad4b-461a-beb6-fdc293abd51b';

INSERT INTO training_subtopics (item_id, title, sort_order)
SELECT '268047d6-7e48-4295-ac6c-3c4b006c20a5', title, sort_order
FROM training_subtopics WHERE item_id = '5388fd9c-c572-4346-869a-30d894b9f7a0';

INSERT INTO training_subtopics (item_id, title, sort_order)
SELECT 'e0e8d142-476a-4f21-9c6e-08d57147971b', title, sort_order
FROM training_subtopics WHERE item_id = '175c48d9-20ef-49f0-847b-349dbe9df47c';

INSERT INTO training_subtopics (item_id, title, sort_order)
SELECT '78c755da-bf1a-4d99-a4e7-701de7c045a6', title, sort_order
FROM training_subtopics WHERE item_id = 'b875f5df-2ba1-4be7-9271-e123d45bdb19';
