-- 操作履歴テーブル
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID NOT NULL,
  target_label TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_target_table ON audit_logs(target_table);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 全認証ユーザーがINSERT可能（trainer/workerも操作記録が必要）
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- admin/supervisorのみ閲覧可能
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT USING (
  get_user_role() IN ('admin', 'supervisor')
);
