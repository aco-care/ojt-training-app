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
- Supabase Access Token (Management API): [環境変数で管理]

## メール送信
- カスタムSMTP: Resend (smtp.resend.com:465)
- 送信元: noreply@chaos-llc.com
- ドメイン: chaos-llc.com（ムームードメインで取得、Resendで認証済み）
- 招待/リセットメールテンプレート: 日本語設定済み
- リンク有効期限: 24時間（mailer_otp_exp: 86400）

## 本番アカウント
- 管理者: aco.paradise@gmail.com (admin)
- 管理者: a.yma0615@gmail.com (admin)
- 施設: ACOケア訪問介護事業所、定期巡回・随時対応型訪問介護看護コロボックル、定期巡回・随時対応型訪問介護看護ちっこりーの

## 登録済みスタッフ（kiccho.org）
- yamaguchi-ayuko@kiccho.org — 指導責任者 ✅ パスワード設定済み・ログイン確認済み
- tsutsumi-yukiko@kiccho.org — 指導責任者（パスワード設定待ち）
- yamashita-kanami@kiccho.org — 指導責任者（パスワード設定待ち）
- sabina-magar@kiccho.org — 特定技能外国人（パスワード設定待ち）
- sastika-rai@kiccho.org — 特定技能外国人（パスワード設定待ち）

## 運用上の注意点
- カスタムSMTP（Resend）設定済みのため、メール送信のrate limit問題は解消済み
- 通知ベルの30秒ポーリング（大量ユーザー時に要検討）
- 退職処理済みスタッフを同じメールで再登録しようとするとエラーになる（復元を案内する仕様に修正済み）
- workerロールでスタッフ作成時にforeign_workersテーブルにも自動登録される

## 他社展開メモ
- 会社ごとに別インスタンス方式で展開予定
- 同じコードを複製し、会社ごとにSupabaseプロジェクト+Vercelデプロイを作成
- アプリ名のハードコード箇所を環境変数化する作業が必要（未着手）

## 納品物
- ロール別案内ガイド: docs/guides/guide-supervisor.html, guide-trainer.html, guide-worker.html, guide-executive.html
- 権限表: docs/guides/permission-matrix.html
- マニュアル: docs/user-manual.md, docs/user-manual.html, public/user-manual.html
- PWA対応: manifest.json, icon-192.png, icon-512.png
