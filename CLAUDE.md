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

## 登録済みスタッフ（2026-08-15 DB確認・全員メール確認済み）
アカウントの正確な状況は都度DBで確認すること（このリストは静的なため陳腐化しやすい）。

- **コロボックル**: 山口愛優子@supervisor(yamaguchi-ayuko)・堤有輝子(tsutsumi-yukiko)・山下華美(yamashita-kanami)・福田純也(fukuda-jyunya)=supervisor、永尾賢斗(nagao-kento)・山下隼(yamashita-shun)=trainer、Magar Sabina(sabina-magar)・Rai Sastika(sastika-rai)=worker
- **ふきのはなれ**: 古賀遥(koga-haruka)=supervisor、宮原幸美(miyahara-yukimi)・松倉由美子(matsukura-yumiko)=trainer、Akash Tamang・Rupesh Budha・MAHAT KHEM RAJ・SHRESTHA ANJANA・MAGAR YAMUNA KUMARI・ADHIKARI DIJINA・LAMSAL LAXMI=worker（全員@kiccho.orgまたは個人アドレス）
- **ふきのとう/コロボックルの学校**: BUCHA KHIMA・REGMI SOMA・SHRESTHA PRAMILA・YADAV JHUBAN KUMARI・CHEMJONG DILASHA・RANA MAGAR BUDHATHOKI BANDANA・PUN MAGAR KHIM KUMARI・RESHMI MAMITA=worker
- QAテスト用: qa-test-fukinohanare@ojt-training-app.internal（supervisor、ふきのはなれ所属、実装確認専用アカウント。docs/roadmap.md参照）

## 運用上の注意点
- カスタムSMTP（Resend）設定済みのため、メール送信のrate limit問題は解消済み
- 通知ベルの30秒ポーリング（大量ユーザー時に要検討）
- 退職処理済みスタッフを同じメールで再登録しようとするとエラーになる（復元を案内する仕様に修正済み）
- workerロールでスタッフ作成時にforeign_workersテーブルにも自動登録される

## 他社展開メモ
- 会社ごとに別インスタンス方式で展開予定
- 同じコードを複製し、会社ごとにSupabaseプロジェクト+Vercelデプロイを作成
- アプリ名のハードコード箇所を環境変数化する作業が必要（未着手）

## 改善ロードマップ
現在進行中のタスクと既知の課題は docs/roadmap.md に一覧化している。新しい依頼をする前に必ず確認し、完了した項目はチェックを付け、新たに見つかった課題は追記すること。

## 納品物
- ロール別案内ガイド: docs/guides/guide-supervisor.html, guide-trainer.html, guide-worker.html, guide-executive.html
- 権限表: docs/guides/permission-matrix.html
- マニュアル: docs/user-manual.md, docs/user-manual.html, public/user-manual.html
- PWA対応: manifest.json, icon-192.png, icon-512.png
