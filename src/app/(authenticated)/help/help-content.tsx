'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { UserRole } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';

// ============================================================
// Types
// ============================================================

type GuideStep = {
  title: string;
  description: string;
  path?: string; // e.g. "管理 → スタッフ管理"
};

type RoleGuide = {
  role: UserRole;
  summary: string;
  steps: GuideStep[];
};

type FaqSection = {
  title: string;
  roles: UserRole[];
  items: { q: string; a: string }[];
};

// ============================================================
// Role-specific guides
// ============================================================

const ROLE_GUIDES: RoleGuide[] = [
  {
    role: 'admin',
    summary: '全データの閲覧・編集、スタッフ管理、施設管理、PDF出力、フィードバック管理ができます。',
    steps: [
      { title: 'スタッフを追加する', description: '氏名・メールアドレス・役割を入力して作成します。本人のメールに招待リンクが届き、パスワードを設定するとログインできます。', path: '管理 → スタッフ管理 → 新しいスタッフを追加' },
      { title: '事業所を登録する', description: '事業所名・住所・種別を入力して登録します。スタッフや外国人を紐付ける先になります。', path: '管理 → 施設管理 → 施設を追加' },
      { title: '特定技能外国人を登録する', description: '氏名・国籍・所属事業所などを入力して登録します。研修・OJTの対象者になります。', path: '外国人一覧 → 新規登録' },
      { title: '研修・OJTの予定を作成する', description: 'カレンダーで研修予定やOJT予定を作成します。月・週・日表示に切り替え可能です。', path: '予定管理 → ＋ 予定追加' },
      { title: '研修記録を入力・承認する', description: '研修セッションの追加と、全細目完了後の承認を行います。', path: '研修記録 → 外国人選択 → 項目選択' },
      { title: 'OJT記録を管理する', description: 'OJT利用者の追加と、ステップ①〜⑦の記録を管理します。', path: 'OJT記録 → 外国人選択 → 利用者選択' },
      { title: '最終評価を行う', description: '8項目の到達目標評価（本人・指導者）を入力し、承認します。', path: '外国人一覧 → 対象者 → 最終評価' },
      { title: 'PDFを出力する', description: '巡回訪問用の研修記録票・OJT記録票・最終評価票をPDF出力します。', path: '外国人一覧 → 対象者 → PDF出力' },
      { title: 'フィードバックを確認する', description: 'スタッフからの要望・不具合報告を確認し、対応状況を更新します。', path: '管理 → フィードバック管理' },
    ],
  },
  {
    role: 'supervisor',
    summary: '研修・OJTの承認、最終評価、スタッフ管理、PDF出力ができます。',
    steps: [
      { title: '予定を作成・確認する', description: 'カレンダーで研修予定やOJT予定を作成・管理します。', path: '予定管理' },
      { title: '研修記録を確認・承認する', description: '研修セッションの確認と、全細目完了後の承認を行います。', path: '研修記録 → 外国人選択 → 項目選択 → 承認' },
      { title: 'OJT記録を確認する', description: 'OJTステップ①〜⑦の記録を確認します。', path: 'OJT記録 → 外国人選択 → 利用者選択' },
      { title: '最終評価を入力・承認する', description: '8項目の到達目標評価を入力し、承認します。', path: '外国人一覧 → 対象者 → 最終評価' },
      { title: 'PDFを出力する', description: '巡回訪問用の帳票をPDFで出力します。', path: '外国人一覧 → 対象者 → PDF出力' },
      { title: 'スタッフを管理する', description: 'スタッフの追加・編集・パスワードリセット・退職処理を行います。', path: '管理 → スタッフ管理' },
    ],
  },
  {
    role: 'trainer',
    summary: '担当する外国人の研修・OJT記録の入力と、予定の確認・作成ができます。',
    steps: [
      { title: 'ダッシュボードで担当を確認する', description: '自分が担当している外国人の研修進捗・未指導の細目が一覧で確認できます。', path: 'ダッシュボード' },
      { title: '研修記録を入力する', description: '日付・時間・実施した細目を選択してセッションを追加します。', path: '研修記録 → 外国人選択 → 項目選択 → セッション追加' },
      { title: 'OJT記録を入力する', description: 'OJTの実施日・同行者・到達目標チェックシートを入力します。', path: 'OJT記録 → 外国人選択 → 利用者選択 → 記録追加' },
      { title: '予定を確認・作成する', description: 'カレンダーで自分の予定を確認し、新しい予定を作成できます。', path: '予定管理' },
    ],
  },
  {
    role: 'worker',
    summary: '自分の研修・OJTの進捗確認と、自己評価の入力ができます。',
    steps: [
      { title: 'ダッシュボードで進捗を確認する', description: '研修5大項目の進捗率と、OJTのステップ状況が確認できます。', path: 'ダッシュボード' },
      { title: 'OJTの自己評価を入力する', description: 'OJT記録の到達目標チェックシートで自己評価（○△×）とコメントを入力します。', path: 'ダッシュボード → OJT利用者名をタップ' },
      { title: '最終評価の本人評価を入力する', description: '8項目の到達目標について本人評価（○△×）を入力します。', path: 'ダッシュボード → 最終評価' },
    ],
  },
  {
    role: 'executive',
    summary: '全事業所を横断した進捗ダッシュボードを閲覧できます（読み取り専用）。',
    steps: [
      { title: 'ダッシュボードで全体の進捗を確認する', description: '全事業所の研修完了率・OJT完了率がサマリーカードで表示されます。', path: 'ダッシュボード' },
      { title: '事業所別の進捗を比較する', description: '各事業所の研修・OJT進捗率が一覧で比較できます。', path: 'ダッシュボード → 事業所別セクション' },
      { title: 'PDFを出力する', description: '外国人ごとの研修記録票・OJT記録票・最終評価票をPDF出力できます。', path: '外国人一覧 → 対象者 → PDF出力' },
    ],
  },
];

// ============================================================
// Role-filtered FAQ sections
// ============================================================

const FAQ_SECTIONS: FaqSection[] = [
  {
    title: 'ログイン・アカウント',
    roles: ['admin', 'supervisor', 'trainer', 'worker', 'executive'],
    items: [
      { q: 'ログインできません', a: 'メールアドレスまたはパスワードが間違っています。ログイン画面の「パスワードを忘れた方」からリセットメールを送信するか、管理者にパスワードリセットを依頼してください。' },
      { q: 'パスワードを変更したい', a: 'ログイン画面の「パスワードを忘れた方」からリセットメールを送信します。メール内のリンクから新しいパスワードを設定できます。' },
      { q: '初回ログインの方法は？', a: '管理者がアカウントを作成すると、登録したメールアドレスに招待メールが届きます。メール内の「パスワードを設定する」リンクからパスワードを設定し、ログインしてください。' },
    ],
  },
  {
    title: '研修記録',
    roles: ['admin', 'supervisor', 'trainer'],
    items: [
      { q: '研修記録を入力するには？', a: '研修記録 → 外国人を選択 → 研修項目を選択 → 「セッション追加」ボタンから入力できます。日付・時間・指導者・サブトピックを選択して保存してください。' },
      { q: '研修が「完了」にならない', a: '完了条件は「全サブトピックに1回以上チェック」かつ「目標回数を達成」の両方です。研修項目の詳細画面で進捗を確認できます。' },
      { q: 'サブトピックを再度チェックできますか？', a: 'はい。完了済みのサブトピックも毎回チェックできます。「過去に完了」と表示されますが再チェックは可能です。' },
      { q: '休憩時間はどう入力しますか？', a: 'セッション追加フォームの「休憩時間（分）」欄に入力します。休憩分は研修時間から自動で差し引かれます。' },
    ],
  },
  {
    title: 'OJT記録',
    roles: ['admin', 'supervisor', 'trainer'],
    items: [
      { q: 'OJT対象利用者を追加するには？', a: 'OJT記録 → 外国人を選択 → 「利用者追加」ボタンからイニシャル・訪問頻度・開始日を入力して登録します。' },
      { q: 'OJTのステップは何段階ですか？', a: '①利用者の選定 → ②利用者・家族への説明 → ③事前研修 → ④見学 → ⑤メイン → ⑥独立 → ⑦完了判定の7段階です。' },
      { q: '判定の「差し戻し」とは？', a: '前のステップからやり直すことです。履歴は全て保存され、何回目の実施かも自動で記録されます。' },
    ],
  },
  {
    title: '自己評価の入力',
    roles: ['worker'],
    items: [
      { q: 'OJTの自己評価はどこで入力しますか？', a: 'ダッシュボードからOJT利用者名をタップし、各記録の「自己評価を入力」から○△×とコメントを入力します。' },
      { q: '最終評価の本人評価はどこで入力しますか？', a: 'ダッシュボードの「最終評価」リンクから、8項目の到達目標について本人評価を入力します。' },
      { q: '一度入力した自己評価を修正できますか？', a: 'はい。承認されるまでは何度でも修正できます。承認後は変更できません。' },
    ],
  },
  {
    title: '予定管理（カレンダー）',
    roles: ['admin', 'supervisor', 'trainer'],
    items: [
      { q: '予定を作成するには？', a: '予定管理 → 「＋ 予定追加」ボタンから作成できます。研修予定とOJT予定を選択できます。' },
      { q: '予定を取り消し・延期するには？', a: '予定の詳細画面 → 「取り消し・延期」ボタンから理由を入力して実行します。履歴は保存されます。' },
      { q: '同じ時間帯に予定を入れたらエラーになった', a: '同一外国人の時間帯重複は禁止されています。空き時間が提案されるので、別の時間帯を選択してください。' },
    ],
  },
  {
    title: '最終評価・PDF出力',
    roles: ['admin', 'supervisor'],
    items: [
      { q: '最終評価を入力するには？', a: '外国人一覧 → 対象者 → 「最終評価」ボタンから入力できます。管理者・指導責任者のみ入力・承認が可能です。' },
      { q: 'PDFはどこから出力しますか？', a: '外国人一覧 → 対象者 → 「PDF出力」ボタンから研修記録票・OJT記録票・最終評価票を出力できます。' },
    ],
  },
  {
    title: 'ダッシュボードの見方',
    roles: ['executive'],
    items: [
      { q: '経営ダッシュボードとは？', a: '全事業所を横断した研修・OJTの進捗率が一画面で確認できます。事業所別の比較も可能です。' },
      { q: 'PDFを出力するには？', a: '外国人一覧 → 対象者 → 「PDF出力」ボタンから各帳票をPDF出力できます。' },
    ],
  },
  {
    title: 'スタッフ・事業所管理',
    roles: ['admin', 'supervisor'],
    items: [
      { q: 'スタッフを追加するには？', a: '管理 → スタッフ管理 → 「新しいスタッフを追加」から氏名・メール・役割を入力して作成します。招待メールが自動送信されます。' },
      { q: 'スタッフが退職した場合は？', a: 'スタッフ管理画面の「退職処理」ボタンからアーカイブできます。研修記録は消えません。' },
      { q: '事業所を追加するには？', a: '管理 → 施設管理 → 「施設を追加」から事業所名・住所・種別を入力して登録します。' },
    ],
  },
  {
    title: 'フィードバック・通知',
    roles: ['admin', 'supervisor', 'trainer', 'worker', 'executive'],
    items: [
      { q: '改善要望を送るには？', a: '画面右下の青い丸ボタンからカテゴリ（UI改善・機能追加・バグ報告・その他）を選択して送信します。' },
      { q: '通知はどこで確認できますか？', a: '画面右上のベルアイコンをタップすると通知一覧が表示されます。未読のものは赤いバッジで数が表示されます。' },
    ],
  },
];

// ============================================================
// Components
// ============================================================

function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-900">{q}</span>
        <ChevronDown size={16} className={`ml-2 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

function GuideStepCard({ step, index }: { step: GuideStep; index: number }) {
  return (
    <div className="flex gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
        {index + 1}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{step.title}</p>
        <p className="mt-1 text-xs text-gray-600 leading-relaxed">{step.description}</p>
        {step.path && (
          <p className="mt-1.5 text-xs text-blue-600 font-medium">{step.path}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export default function HelpContent({ userRole }: { userRole: UserRole }) {
  const [tab, setTab] = useState<'guide' | 'faq'>('guide');
  const [search, setSearch] = useState('');

  const guide = ROLE_GUIDES.find((g) => g.role === userRole);
  const filteredFaq = FAQ_SECTIONS
    .filter((s) => s.roles.includes(userRole))
    .map((s) => ({
      ...s,
      items: search.trim()
        ? s.items.filter((i) => i.q.includes(search) || i.a.includes(search))
        : s.items,
    }))
    .filter((s) => s.items.length > 0);

  const roleColorMap: Record<UserRole, string> = {
    admin: 'bg-red-100 text-red-700',
    supervisor: 'bg-purple-100 text-purple-700',
    trainer: 'bg-blue-100 text-blue-700',
    worker: 'bg-green-100 text-green-700',
    executive: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="space-y-4">
      {/* Role badge */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${roleColorMap[userRole]}`}>
          {ROLE_LABELS[userRole]}
        </span>
        <span className="text-xs text-gray-500">としてログイン中</span>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        <button
          onClick={() => setTab('guide')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'guide'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          使い方ガイド
        </button>
        <button
          onClick={() => setTab('faq')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'faq'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          よくある質問
        </button>
      </div>

      {/* Guide tab */}
      {tab === 'guide' && guide && (
        <div className="space-y-4">
          {/* Role summary */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">あなたができること</p>
            <p className="mt-1 text-xs text-blue-700 leading-relaxed">{guide.summary}</p>
          </div>

          {/* Step-by-step guide */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">はじめてガイド</h2>
            <div className="space-y-3">
              {guide.steps.map((step, idx) => (
                <GuideStepCard key={idx} step={step} index={idx} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FAQ tab */}
      {tab === 'faq' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="質問を検索..."
              className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* FAQ sections */}
          {filteredFaq.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <p className="text-sm text-gray-500">
                {search ? `「${search}」に一致する質問が見つかりませんでした` : '表示できる質問がありません'}
              </p>
            </div>
          ) : (
            filteredFaq.map((section) => (
              <div key={section.title} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-900">{section.title}</h2>
                </div>
                {section.items.map((item, idx) => (
                  <AccordionItem key={idx} q={item.q} a={item.a} />
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* Contact */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
        <p className="text-sm font-medium text-blue-800">解決しない場合</p>
        <p className="mt-1 text-xs text-blue-600">画面右下の青い丸ボタンからお問い合わせください。</p>
      </div>
    </div>
  );
}
