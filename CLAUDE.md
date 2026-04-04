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

## 納品前に必須
1. テストデータの削除（ラジュ・タパ、テスト3、ダミーアカウント）
2. 本番管理者アカウントの作成（実メールアドレスで） → あーちゃんに確認中
3. Vercel環境変数の最終確認
4. マニュアルの最新機能追記（カレンダー・フィードバック・ヘルプ等）

## あーちゃんへの確認事項（回答待ち）
- A: 本番管理者のメールアドレス
- B: テストデータ全削除OK？
- C: カスタムドメインは必要？
- D: 納品方法（GitHub移管 / Vercel移管 / URL納品）

## UI改善メモ
- **削除ボタンの誤操作防止**: カレンダーの予定カードで「詳細」「編集」「複製」「削除」が横並びになっている。スマホでは誤って削除を押す可能性がある。削除ボタンは他のアクションから離して配置するか、別の行に分離する。対象: schedule-calendar.tsx の renderEventCard 内のアクションボタン。同様のパターンがある他の画面（スタッフ管理等）も確認すること。

## 既知の懸念点
- Supabase Free planの制限（23名運用なら当面OK）
- パスワード変更を本人ができない（管理者経由のみ）
- 通知ベルの30秒ポーリング（大量ユーザー時に要検討）
- PDF出力がPhase2機能（3者フロー等）を未反映
