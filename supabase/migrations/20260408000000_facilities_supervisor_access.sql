-- 施設テーブルのRLSポリシーをsupervisorにも許可
DROP POLICY "facilities_modify" ON facilities;
CREATE POLICY "facilities_modify" ON facilities FOR ALL USING (
  get_user_role() IN ('admin', 'supervisor')
);
