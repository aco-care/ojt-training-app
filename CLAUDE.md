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
- Region: Northeast Asia (Tokyo)

---

## 運用上の注意点
- Supabase Free planの制限（23名程度の運用なら当面OK）
- 通知ベルの30秒ポーリング（大量ユーザー時に要検討）
- 招待メール送信はSupabase Free planで1時間に4通まで（一斉登録時は分散が必要）

## 他社展開メモ
- 会社ごとに別インスタンス方式で展開予定
- 同じコードを複製し、会社ごとにSupabaseプロジェクト+Vercelデプロイを作成
- アプリ名のハードコード箇所を環境変数化する作業が必要（未着手）
