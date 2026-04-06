@AGENTS.md

# プロジェクト情報

## アプリ名
吉兆 研修・OJT管理システム

## 開発元
CHAOS合同会社 / ACO_careブランド

## 技術スタック
Next.js 16 (App Router) + TypeScript + Supabase + Vercel + Tailwind CSS 4

## 本番URL
https://ojt-training-app.vercel.app

## Supabaseプロジェクト
- Project ref: epbgdjifnglbeehapahv
- Region: Northeast Asia (Tokyo)

---

# 次回作業メモ（未完了タスク）

## 完了済み（2026-04-06）
1. ~~テストデータの削除~~ → 全削除完了（外国人労働者2名、テストスタッフ4名、テスト施設1つ）
2. ~~本番管理者アカウント作成~~ → aco.paradise@gmail.com (admin, パスワード: AcoCare2026!)
3. ~~yamaguchi-ayuko をadminに昇格~~
4. ~~Vercel環境変数の最終確認~~ → 3変数設定済み
5. ~~削除ボタン誤操作防止UI改善~~ → カレンダー・施設管理・スタッフ管理の3画面修正済み
6. ~~マニュアル全面更新~~ → カレンダー・通知・フィードバック・ヘルプ・スタッフ管理のアプリ内操作を追記

## 本番アカウント情報
- 管理者1: aco.paradise@gmail.com / AcoCare2026! (admin)
- 管理者2: a.yma0615@gmail.com (admin) ※パスワードは既存のもの
- 施設: ACOケア訪問介護事業所（主）、定期巡回・随時対応型訪問介護看護コロボックル

## あーちゃんへの確認事項（回答待ち）
- C: カスタムドメインは必要？
- D: 納品方法（GitHub移管 / Vercel移管 / URL納品）

## 既知の懸念点
- Supabase Free planの制限（23名運用なら当面OK）
- パスワード変更を本人ができない（管理者経由のみ）
- 通知ベルの30秒ポーリング（大量ユーザー時に要検討）
- PDF出力がPhase2機能（3者フロー等）を未反映
