-- OJTアプリ 緊急修正 第1段階（2026-11-01 に本番で実行済み）
-- 目的: ログインなしの読み書きを止める。利用者が自分の役割を変えられないようにする。

-- 1. ログインなし（anon）の権限をすべて外す
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- 2. 誰でも職員情報を作れる設定を消す（職員作成はサーバー側で行うので影響なし）
drop policy if exists "profiles_insert" on public.profiles;

-- 3. ログイン済みの利用者が profiles で変更できる列を、画面で使う2列だけにする
revoke insert, update, delete on public.profiles from authenticated;
grant update (is_archived, archived_at) on public.profiles to authenticated;

-- 4. アプリが使わない強い権限を外す
revoke truncate, trigger, references on all tables in schema public from authenticated;
