-- Fix RLS policies to allow workers to update their own self-evaluation fields
-- on OJT records and final evaluations.

-- 1. Drop the existing restrictive policies
DROP POLICY IF EXISTS "ojt_records_modify" ON ojt_records;
DROP POLICY IF EXISTS "evaluations_modify" ON final_evaluations;

-- 2. OJT records: admin/trainer/supervisor can do everything, worker can UPDATE only
CREATE POLICY "ojt_records_insert" ON ojt_records FOR INSERT WITH CHECK (
  get_user_role() IN ('admin', 'trainer', 'supervisor')
);

CREATE POLICY "ojt_records_update" ON ojt_records FOR UPDATE USING (
  get_user_role() IN ('admin', 'trainer', 'supervisor')
  OR (
    -- Worker can update only their own OJT records (linked via foreign_workers.profile_id)
    get_user_role() = 'worker'
    AND worker_id IN (
      SELECT id FROM foreign_workers WHERE profile_id = auth.uid()
    )
  )
);

CREATE POLICY "ojt_records_delete" ON ojt_records FOR DELETE USING (
  get_user_role() IN ('admin', 'supervisor')
);

-- 3. Final evaluations: admin/supervisor can do everything, worker can UPDATE own self-evaluation
CREATE POLICY "evaluations_insert" ON final_evaluations FOR INSERT WITH CHECK (
  get_user_role() IN ('admin', 'supervisor')
);

CREATE POLICY "evaluations_update" ON final_evaluations FOR UPDATE USING (
  get_user_role() IN ('admin', 'supervisor')
  OR (
    -- Worker can update only their own evaluation (linked via foreign_workers.profile_id)
    get_user_role() = 'worker'
    AND worker_id IN (
      SELECT id FROM foreign_workers WHERE profile_id = auth.uid()
    )
  )
);

CREATE POLICY "evaluations_delete" ON final_evaluations FOR DELETE USING (
  get_user_role() IN ('admin', 'supervisor')
);
