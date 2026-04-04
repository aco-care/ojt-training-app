# 吉兆 研修・OJT管理システム

訪問系特定技能外国人向けの研修・OJT管理Webアプリケーション。
厚労省「訪問系サービスの要件に係る報告書」に完全準拠。

## 技術スタック
- Next.js 16 (App Router) + TypeScript
- Supabase (PostgreSQL + Auth + RLS)
- Tailwind CSS 4
- Vercel

## セットアップ

### 1. 依存パッケージのインストール
npm install

### 2. 環境変数の設定
cp .env.local.example .env.local
# .env.localを編集してSupabaseの接続情報を設定

### 3. データベースのセットアップ
# Supabaseプロジェクトを作成し、マイグレーションを実行
npx supabase db push

### 4. 開発サーバーの起動
npm run dev

## 主な機能
- 研修5大項目の記録・進捗管理
- OJT（同行訪問）の7ステップ管理
- 3者フロー（予定→当日入力→フィードバック）
- カレンダーベースの予定管理
- 到達目標8項目のチェックシート
- PDF帳票出力（研修記録票・OJT記録票・最終評価票）
- 5種類のロール（管理者・指導責任者・指導者・外国人・経営側）
- フィードバック・通知システム

## デプロイ
Vercelにデプロイ済み。環境変数はVercelの設定画面で管理。

## 開発元
CHAOS合同会社 / ACO_careブランド
