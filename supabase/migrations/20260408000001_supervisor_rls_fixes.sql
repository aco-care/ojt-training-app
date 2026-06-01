-- profiles: supervisorもスタッフ情報を編集可能に
DROP POLICY "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (
  id = auth.uid() OR get_user_role() IN ('admin', 'supervisor')
);

-- training_sessions: supervisorも研修記録を編集可能に
DROP POLICY "sessions_update" ON training_sessions;
CREATE POLICY "sessions_update" ON training_sessions FOR UPDATE USING (
  trainer_id = auth.uid() OR get_user_role() IN ('admin', 'supervisor')
);
