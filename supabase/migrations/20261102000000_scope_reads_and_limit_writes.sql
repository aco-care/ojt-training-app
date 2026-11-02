-- ============================================================
-- OJTアプリ 第2段階: 閲覧範囲の限定と書き込みの限定
--
-- 閲覧範囲
--   admin / executive    : 全拠点
--   supervisor / trainer : 自分の拠点だけ（profile_facilities の所属すべて）
--   worker               : 自分の記録と、そこに名前が載る職員だけ
-- 書き込みの限定: training_plans / ojt_plans / feedbacks / notifications
-- feedback-images は非公開にする
--
-- 本番には名前の分からないポリシーがあるため、名前を指定せず pg_policies から
-- 探して置き換える。元の定義は private.rls_snapshot_20261102 に残し、
-- supabase/rollbacks/20261102000000_scope_reads_and_limit_writes.rollback.sql で戻す。
-- ============================================================

-- ------------------------------------------------------------
-- 元に戻すための記録（2回流すと create table で止まる）
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE private.rls_snapshot_20261102 AS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE (
    schemaname = 'public'
    AND tablename IN (
      'profiles', 'foreign_workers', 'worker_facilities', 'profile_facilities',
      'training_sessions', 'training_approvals', 'ojt_users', 'ojt_records',
      'final_evaluations', 'audit_logs',
      'training_plans', 'ojt_plans', 'feedbacks', 'notifications'
    )
  ) OR (
    schemaname = 'storage'
    AND tablename = 'objects'
    AND concat(qual, with_check) LIKE '%feedback-images%'
  );

CREATE TABLE private.feedback_bucket_snapshot_20261102 AS
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'feedback-images';

-- ------------------------------------------------------------
-- 閲覧範囲の判定
-- ポリシーからは `IN (SELECT ...)` で呼び、クエリごとに1回だけ評価させる。
-- search_path を空にするので、中から get_user_role() は呼ばない
-- （get_user_role は profiles を修飾せずに参照している）。
-- ------------------------------------------------------------

-- 全拠点を見る役割か
CREATE FUNCTION public.is_corporate_viewer()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'executive')
  )
$$;

-- 拠点で範囲が決まる役割の所属拠点。profile_facilities が無い人だけ profiles.facility_id を使う
CREATE FUNCTION public.scoped_facility_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT pf.facility_id
  FROM public.profile_facilities pf
  JOIN public.profiles p ON p.id = pf.profile_id
  WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'trainer')
  UNION
  SELECT p.facility_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.role IN ('supervisor', 'trainer')
    AND p.facility_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.profile_facilities pf WHERE pf.profile_id = p.id)
$$;

-- 読める外国人。記録と予定はすべてこの範囲で絞る
CREATE FUNCTION public.readable_worker_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT fw.id FROM public.foreign_workers fw WHERE fw.profile_id = auth.uid()
  UNION
  SELECT fw.id FROM public.foreign_workers fw WHERE public.is_corporate_viewer()
  UNION
  SELECT fw.id FROM public.foreign_workers fw
  WHERE fw.facility_id IN (SELECT public.scoped_facility_ids())
  UNION
  SELECT wf.worker_id FROM public.worker_facilities wf
  WHERE wf.facility_id IN (SELECT public.scoped_facility_ids())
$$;

-- 自分の拠点に所属する職員・外国人のアカウント
CREATE FUNCTION public.scoped_facility_profile_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT pf.profile_id FROM public.profile_facilities pf
  WHERE pf.facility_id IN (SELECT public.scoped_facility_ids())
  UNION
  SELECT p.id FROM public.profiles p
  WHERE p.facility_id IN (SELECT public.scoped_facility_ids())
    AND NOT EXISTS (SELECT 1 FROM public.profile_facilities pf WHERE pf.profile_id = p.id)
$$;

-- 読める profiles。外国人が他の外国人のアカウントを読むことはない
CREATE FUNCTION public.readable_profile_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH viewer AS (
    SELECT role FROM public.profiles WHERE id = auth.uid()
  ),
  workers AS (
    SELECT public.readable_worker_ids() AS id
  ),
  candidates AS (
    SELECT auth.uid() AS id
    UNION
    SELECT p.id FROM public.profiles p WHERE public.is_corporate_viewer()
    UNION
    SELECT public.scoped_facility_profile_ids()
    UNION
    -- 指導者の選択肢と通知のため、拠点の職員からは admin も見える
    SELECT p.id FROM public.profiles p, viewer v
    WHERE p.role = 'admin' AND v.role IN ('supervisor', 'trainer')
    UNION
    SELECT fw.profile_id FROM public.foreign_workers fw WHERE fw.id IN (SELECT id FROM workers)
    -- 読める記録に名前が載る人
    UNION
    SELECT unnest(ARRAY[tp.trainer_id, tp.created_by, tp.supervisor_id])
    FROM public.training_plans tp WHERE tp.worker_id IN (SELECT id FROM workers)
    UNION
    SELECT unnest(ARRAY[op.companion_id, op.created_by, op.supervisor_id])
    FROM public.ojt_plans op WHERE op.worker_id IN (SELECT id FROM workers)
    UNION
    SELECT ts.trainer_id FROM public.training_sessions ts WHERE ts.worker_id IN (SELECT id FROM workers)
    UNION
    SELECT ta.approved_by FROM public.training_approvals ta WHERE ta.worker_id IN (SELECT id FROM workers)
    UNION
    SELECT unnest(ARRAY[orec.companion_id, orec.approved_by])
    FROM public.ojt_records orec WHERE orec.worker_id IN (SELECT id FROM workers)
    UNION
    SELECT fe.approved_by FROM public.final_evaluations fe WHERE fe.worker_id IN (SELECT id FROM workers)
  )
  SELECT p.id
  FROM public.profiles p
  JOIN candidates c ON c.id = p.id
  WHERE p.id = auth.uid()
    OR p.role <> 'worker'
    OR (SELECT role FROM viewer) <> 'worker'
$$;

REVOKE ALL ON FUNCTION public.is_corporate_viewer() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.scoped_facility_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.readable_worker_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.scoped_facility_profile_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.readable_profile_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_corporate_viewer() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.scoped_facility_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.readable_worker_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.scoped_facility_profile_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.readable_profile_ids() TO authenticated, service_role;

-- ------------------------------------------------------------
-- 既存ポリシーの整理
-- FOR ALL は読み取りも許可してしまうので、書き込みの3つに分けて同じ条件を引き継ぐ。
-- 書き込みを限定する4表は、すべて消してこの下で作り直す。
-- ------------------------------------------------------------
DO $$
DECLARE
  p record;
  roles_sql text;
  limited_tables CONSTANT text[] := ARRAY['training_plans', 'ojt_plans', 'feedbacks', 'notifications'];
  read_scoped_tables CONSTANT text[] := ARRAY[
    'profiles', 'foreign_workers', 'worker_facilities', 'profile_facilities',
    'training_sessions', 'training_approvals', 'ojt_users', 'ojt_records',
    'final_evaluations', 'audit_logs'
  ];
BEGIN
  FOR p IN
    SELECT * FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        tablename = ANY (limited_tables)
        OR (tablename = ANY (read_scoped_tables) AND cmd IN ('SELECT', 'ALL'))
      )
  LOOP
    IF p.cmd = 'ALL' AND p.tablename = ANY (read_scoped_tables) THEN
      SELECT string_agg(CASE WHEN r = 'public' THEN 'public' ELSE quote_ident(r) END, ', ')
      INTO roles_sql
      FROM unnest(p.roles) AS r;

      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS %s FOR INSERT TO %s WITH CHECK (%s)',
        p.policyname || '_insert', p.tablename, p.permissive, roles_sql,
        coalesce(p.with_check, p.qual)
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS %s FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',
        p.policyname || '_update', p.tablename, p.permissive, roles_sql,
        p.qual, coalesce(p.with_check, p.qual)
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS %s FOR DELETE TO %s USING (%s)',
        p.policyname || '_delete', p.tablename, p.permissive, roles_sql,
        p.qual
      );
    END IF;

    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;

  FOR p IN
    SELECT policyname FROM private.rls_snapshot_20261102 WHERE schemaname = 'storage'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 閲覧
-- ------------------------------------------------------------
CREATE POLICY "profiles_select_scoped" ON profiles FOR SELECT TO authenticated
  USING (id IN (SELECT public.readable_profile_ids()));

-- 新規登録の insert().select() では、関数から挿入直後の行が見えない。
-- その行を読めるように、列を直接見る条件も並べる
CREATE POLICY "workers_select_scoped" ON foreign_workers FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.is_corporate_viewer()
    OR facility_id IN (SELECT public.scoped_facility_ids())
    OR id IN (SELECT public.readable_worker_ids())
  );

CREATE POLICY "worker_facilities_select_scoped" ON worker_facilities FOR SELECT TO authenticated
  USING (worker_id IN (SELECT public.readable_worker_ids()));

CREATE POLICY "profile_facilities_select_scoped" ON profile_facilities FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.is_corporate_viewer()
    OR facility_id IN (SELECT public.scoped_facility_ids())
  );

CREATE POLICY "sessions_select_scoped" ON training_sessions FOR SELECT TO authenticated
  USING (worker_id IN (SELECT public.readable_worker_ids()));

CREATE POLICY "approvals_select_scoped" ON training_approvals FOR SELECT TO authenticated
  USING (worker_id IN (SELECT public.readable_worker_ids()));

CREATE POLICY "ojt_users_select_scoped" ON ojt_users FOR SELECT TO authenticated
  USING (worker_id IN (SELECT public.readable_worker_ids()));

CREATE POLICY "ojt_records_select_scoped" ON ojt_records FOR SELECT TO authenticated
  USING (worker_id IN (SELECT public.readable_worker_ids()));

CREATE POLICY "evaluations_select_scoped" ON final_evaluations FOR SELECT TO authenticated
  USING (worker_id IN (SELECT public.readable_worker_ids()));

-- 指導責任者は自分の拠点の職員の操作だけ。admin は全件
CREATE POLICY "audit_logs_select_scoped" ON audit_logs FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR (
      public.get_user_role() = 'supervisor'
      AND (
        actor_id = auth.uid()
        OR actor_id IN (SELECT public.scoped_facility_profile_ids())
      )
    )
  );

-- ------------------------------------------------------------
-- 研修予定 / OJT予定
-- 予定の重複判定は同じ外国人の他の予定を読むので、閲覧は担当者で絞らない。
-- ------------------------------------------------------------
CREATE POLICY "training_plans_select_scoped" ON training_plans FOR SELECT TO authenticated
  USING (worker_id IN (SELECT public.readable_worker_ids()));

CREATE POLICY "training_plans_insert_scoped" ON training_plans FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.get_user_role() IN ('admin', 'supervisor', 'trainer')
    AND worker_id IN (SELECT public.readable_worker_ids())
  );

CREATE POLICY "training_plans_update_scoped" ON training_plans FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR (
      worker_id IN (SELECT public.readable_worker_ids())
      AND (
        public.get_user_role() IN ('supervisor', 'worker')
        OR (public.get_user_role() = 'trainer' AND (trainer_id = auth.uid() OR created_by = auth.uid()))
      )
    )
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
    OR (
      worker_id IN (SELECT public.readable_worker_ids())
      AND public.get_user_role() IN ('supervisor', 'worker', 'trainer')
    )
  );

CREATE POLICY "training_plans_delete_scoped" ON training_plans FOR DELETE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR (public.get_user_role() = 'supervisor' AND worker_id IN (SELECT public.readable_worker_ids()))
  );

CREATE POLICY "ojt_plans_select_scoped" ON ojt_plans FOR SELECT TO authenticated
  USING (worker_id IN (SELECT public.readable_worker_ids()));

CREATE POLICY "ojt_plans_insert_scoped" ON ojt_plans FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.get_user_role() IN ('admin', 'supervisor', 'trainer')
    AND worker_id IN (SELECT public.readable_worker_ids())
  );

CREATE POLICY "ojt_plans_update_scoped" ON ojt_plans FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR (
      worker_id IN (SELECT public.readable_worker_ids())
      AND (
        public.get_user_role() IN ('supervisor', 'worker')
        OR (public.get_user_role() = 'trainer' AND (companion_id = auth.uid() OR created_by = auth.uid()))
      )
    )
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
    OR (
      worker_id IN (SELECT public.readable_worker_ids())
      AND public.get_user_role() IN ('supervisor', 'worker', 'trainer')
    )
  );

CREATE POLICY "ojt_plans_delete_scoped" ON ojt_plans FOR DELETE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR (public.get_user_role() = 'supervisor' AND worker_id IN (SELECT public.readable_worker_ids()))
  );

-- 行は上のポリシーで絞り、列は役割ごとにここで絞る。
-- 指導者は担当の予定の指導者欄、外国人は自分の予定の本人欄だけ変更できる。
CREATE FUNCTION public.enforce_plan_update_columns()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  viewer_role public.user_role;
  assignee_column CONSTANT text := CASE TG_TABLE_NAME WHEN 'training_plans' THEN 'trainer_id' ELSE 'companion_id' END;
  allowed text[] := ARRAY['updated_at'];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO viewer_role FROM public.profiles WHERE id = auth.uid();
  IF viewer_role IN ('admin', 'supervisor') THEN
    RETURN NEW;
  END IF;

  IF viewer_role = 'trainer' THEN
    allowed := allowed || ARRAY['is_archived'];
    IF to_jsonb(OLD) ->> assignee_column = auth.uid()::text THEN
      allowed := allowed || ARRAY[
        'trainer_completed_at', 'trainer_checked_subtopics', 'trainer_checked_items',
        'trainer_eval', 'trainer_comment', 'trainer_custom_content', 'result', 'status'
      ];
    END IF;
  ELSIF viewer_role = 'worker' THEN
    allowed := allowed || ARRAY[
      'worker_completed_at', 'worker_checked_subtopics', 'worker_checked_items',
      'worker_eval', 'worker_comment', 'worker_custom_content', 'status'
    ];
  END IF;

  IF (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
    RAISE EXCEPTION '予定のこの項目を変更する権限がありません' USING ERRCODE = '42501';
  END IF;

  -- 指導者・本人が動かせる状態は「入力中」だけ。完了は指導責任者が行う
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'in_progress' THEN
    RAISE EXCEPTION '予定の状態を変更する権限がありません' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_plan_update_columns() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_training_plan_update_columns
  BEFORE UPDATE ON training_plans
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_update_columns();

CREATE TRIGGER enforce_ojt_plan_update_columns
  BEFORE UPDATE ON ojt_plans
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_update_columns();

-- ------------------------------------------------------------
-- フィードバック: 送信は本人名義で未対応のまま。対応は admin だけ
-- ------------------------------------------------------------
CREATE POLICY "feedbacks_select_own_or_admin" ON feedbacks FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR public.get_user_role() = 'admin');

CREATE POLICY "feedbacks_insert_own" ON feedbacks FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND status = 'pending'
    AND admin_response IS NULL
    AND resolved_by IS NULL
    AND resolved_at IS NULL
  );

CREATE POLICY "feedbacks_update_admin" ON feedbacks FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ------------------------------------------------------------
-- 通知: 読めるのは自分宛てだけ。本人が変更できるのは既読だけ。
-- 直接作れるのは admin だけで、他は下の2つの関数を通す。
-- ------------------------------------------------------------
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_insert_admin" ON notifications FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'admin');

REVOKE UPDATE ON notifications FROM authenticated;
GRANT UPDATE (is_read) ON notifications TO authenticated;

-- 指導者と本人の入力がそろった予定を、確認する人へ知らせる。
-- 外国人は職員一覧を読めないので、宛先と本文はこちらで決める。
CREATE FUNCTION public.notify_plan_ready_for_review(p_plan_type text, p_plan_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller_role public.user_role;
  plan_worker_id uuid;
  plan_assignee uuid;
  plan_worker_profile uuid;
  plan_worker_name text;
  plan_trainer_done timestamptz;
  plan_worker_done timestamptz;
  notice_title text;
  notice_message text;
  notice_link text;
  sent integer;
BEGIN
  IF p_plan_type = 'training' THEN
    SELECT tp.worker_id, tp.trainer_id, fw.profile_id, fw.name, tp.trainer_completed_at, tp.worker_completed_at,
           '研修記録の確認依頼',
           fw.name || 'の研修（' || coalesce(ti.title, '') || '）の指導者・本人入力が完了しました。確認・承認をお願いします。',
           '/training-plans/' || tp.id
    INTO plan_worker_id, plan_assignee, plan_worker_profile, plan_worker_name, plan_trainer_done, plan_worker_done,
         notice_title, notice_message, notice_link
    FROM public.training_plans tp
    JOIN public.foreign_workers fw ON fw.id = tp.worker_id
    LEFT JOIN public.training_items ti ON ti.id = tp.item_id
    WHERE tp.id = p_plan_id;
  ELSIF p_plan_type = 'ojt' THEN
    SELECT op.worker_id, op.companion_id, fw.profile_id, fw.name, op.trainer_completed_at, op.worker_completed_at,
           'OJT記録の確認依頼',
           fw.name || 'のOJT（' ||
             CASE op.step::text
               WHEN 'matching' THEN '① 利用者の選定・マッチング'
               WHEN 'explanation' THEN '② 利用者・家族への説明'
               WHEN 'pre_training' THEN '③ 事前研修'
               WHEN 'observation' THEN '④ OJT 1回目（見学）'
               WHEN 'main' THEN '⑤ OJT 2回目（メイン）'
               WHEN 'independent' THEN '⑥ OJT 3回目（独立）'
               WHEN 'completion' THEN '⑦ OJT完了判定'
               ELSE coalesce(op.step::text, '')
             END || '）の同行者・本人入力が完了しました。確認・承認をお願いします。',
           '/ojt-plans/' || op.id
    INTO plan_worker_id, plan_assignee, plan_worker_profile, plan_worker_name, plan_trainer_done, plan_worker_done,
         notice_title, notice_message, notice_link
    FROM public.ojt_plans op
    JOIN public.foreign_workers fw ON fw.id = op.worker_id
    WHERE op.id = p_plan_id;
  ELSE
    RAISE EXCEPTION '予定の種類が正しくありません' USING ERRCODE = '22023';
  END IF;

  IF plan_worker_id IS NULL THEN
    RAISE EXCEPTION '予定が見つかりません' USING ERRCODE = 'P0002';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF NOT (
    auth.uid() IN (plan_assignee, plan_worker_profile)
    OR caller_role = 'admin'
    OR (caller_role = 'supervisor' AND plan_worker_id IN (SELECT public.readable_worker_ids()))
  ) THEN
    RAISE EXCEPTION 'この予定の通知を送る権限がありません' USING ERRCODE = '42501';
  END IF;

  IF plan_trainer_done IS NULL OR plan_worker_done IS NULL THEN
    RETURN 0;
  END IF;

  WITH worker_facility AS (
    SELECT fw.facility_id FROM public.foreign_workers fw WHERE fw.id = plan_worker_id
    UNION
    SELECT wf.facility_id FROM public.worker_facilities wf WHERE wf.worker_id = plan_worker_id
  ),
  recipients AS (
    SELECT p.id FROM public.profiles p
    WHERE p.is_archived IS NOT TRUE
      AND (
        p.role = 'admin'
        OR (
          p.role = 'supervisor'
          AND (
            EXISTS (
              SELECT 1 FROM public.profile_facilities pf
              WHERE pf.profile_id = p.id AND pf.facility_id IN (SELECT facility_id FROM worker_facility)
            )
            OR (
              p.facility_id IN (SELECT facility_id FROM worker_facility)
              AND NOT EXISTS (SELECT 1 FROM public.profile_facilities pf WHERE pf.profile_id = p.id)
            )
          )
        )
      )
  )
  INSERT INTO public.notifications (user_id, title, message, is_read, link)
  SELECT r.id, notice_title, notice_message, false, notice_link
  FROM recipients r
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = r.id AND n.title = notice_title AND n.link = notice_link AND n.is_read = false
  );

  GET DIAGNOSTICS sent = ROW_COUNT;
  RETURN sent;
END;
$$;

-- 届いたフィードバックを admin へ知らせる。送信者本人だけが呼べる
CREATE FUNCTION public.notify_feedback_received(p_feedback_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  feedback_sender uuid;
  notice_message text;
  sent integer;
BEGIN
  SELECT f.sender_id,
         coalesce(p.name, 'ユーザー') || 'さんから' ||
           CASE f.category
             WHEN 'ui' THEN 'UI改善'
             WHEN 'feature' THEN '機能追加'
             WHEN 'bug' THEN 'バグ報告'
             ELSE 'その他'
           END || 'のフィードバックが届きました' ||
           CASE WHEN f.image_url IS NULL THEN '' ELSE '（画像付き）' END
  INTO feedback_sender, notice_message
  FROM public.feedbacks f
  LEFT JOIN public.profiles p ON p.id = f.sender_id
  WHERE f.id = p_feedback_id;

  IF feedback_sender IS NULL OR feedback_sender <> auth.uid() THEN
    RAISE EXCEPTION 'このフィードバックの通知を送る権限がありません' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, is_read, link)
  SELECT p.id, '新しいフィードバック', notice_message, false, '/admin/feedbacks'
  FROM public.profiles p
  WHERE p.role = 'admin'
    AND p.is_archived IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = p.id
        AND n.title = '新しいフィードバック'
        AND n.message = notice_message
        AND n.is_read = false
    );

  GET DIAGNOSTICS sent = ROW_COUNT;
  RETURN sent;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_plan_ready_for_review(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_feedback_received(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_plan_ready_for_review(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_feedback_received(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- feedback-images を非公開にする。
-- 置き場所は送信者のフォルダだけ、読めるのは送信者本人と admin だけ。
-- 画面は保存したURLではなく、都度発行する署名付きURLで表示する。
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-images', 'feedback-images', false, 5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "feedback_images_insert_own_folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "feedback_images_select_own_or_admin" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.get_user_role() = 'admin'
    )
  );
