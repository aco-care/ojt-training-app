-- Backfill: completed training_plans that never created training_sessions
-- due to facility_id bug (column didn't exist on training_sessions table)
INSERT INTO training_sessions (
  worker_id, item_id, date, start_time, end_time,
  trainer_id, format, completed_subtopics, custom_content,
  notes, break_minutes, training_plan_id
)
SELECT
  tp.worker_id,
  tp.item_id,
  tp.planned_date,
  COALESCE(tp.start_time, '09:00'),
  COALESCE(tp.end_time, '10:00'),
  tp.trainer_id,
  CASE COALESCE(tp.method, '対面')
    WHEN '対面' THEN 'classroom'
    WHEN 'OJT' THEN 'ojt'
    WHEN 'ロールプレイ' THEN 'roleplay'
    WHEN 'シミュレーション' THEN 'simulation'
    ELSE 'classroom'
  END::training_format,
  COALESCE(tp.trainer_checked_subtopics, '{}')::uuid[],
  tp.trainer_custom_content,
  '3者フローより自動登録（復旧）',
  COALESCE(tp.break_minutes, 0),
  tp.id
FROM training_plans tp
WHERE tp.status = 'completed'
  AND tp.supervisor_completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM training_sessions ts
    WHERE ts.training_plan_id = tp.id
  );
