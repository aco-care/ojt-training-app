'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type Section = {
  title: string;
  items: { q: string; a: string }[];
};

const SECTIONS: Section[] = [
  {
    title: 'ログイン・アカウント',
    items: [
      { q: 'ログインできません', a: 'メールアドレスまたはパスワードが間違っています。管理者にパスワードリセットを依頼してください。管理画面 → スタッフ管理 → PW変更 から変更できます。' },
      { q: 'パスワードを変更したい', a: '管理者がスタッフ管理画面からパスワードをリセットできます。本人が変更する機能は現在準備中です。' },
      { q: 'アカウントの種類は？', a: '管理者(admin)・指導責任者(supervisor)・指導者(trainer)・特定技能外国人(worker)・経営側(executive)の5種類があります。' },
    ],
  },
  {
    title: '研修記録',
    items: [
      { q: '研修記録を入力するには？', a: '研修記録 → 外国人を選択 → 研修項目を選択 → 「セッション追加」ボタンから入力できます。日付・時間・指導者・サブトピックを選択して保存してください。' },
      { q: '研修が「完了」にならない', a: '完了条件は「全サブトピックに1回以上チェック」かつ「目標回数を達成」の両方です。研修項目の詳細画面で進捗を確認できます。' },
      { q: 'サブトピックを再度チェックできますか？', a: 'はい。完了済みのサブトピックも毎回チェックできます。「過去に完了」と表示されますが再チェックは可能です。' },
      { q: '休憩時間はどう入力しますか？', a: 'セッション追加フォームの「休憩時間（分）」欄に入力します。休憩分は研修時間から自動で差し引かれます。' },
    ],
  },
  {
    title: 'OJT記録',
    items: [
      { q: 'OJT対象利用者を追加するには？', a: 'OJT記録 → 外国人を選択 → 「利用者追加」ボタンからイニシャル・訪問頻度・開始日を入力して登録します。' },
      { q: 'OJTのステップは何段階ですか？', a: '①利用者の選定 → ②利用者・家族への説明 → ③事前研修 → ④見学 → ⑤メイン → ⑥独立 → ⑦完了判定の7段階です。' },
      { q: '判定の「差し戻し」とは？', a: '前のステップからやり直すことです。履歴は全て保存され、何回目の実施かも自動で記録されます。' },
    ],
  },
  {
    title: '予定管理（カレンダー）',
    items: [
      { q: '予定を作成するには？', a: '予定管理 → カレンダーの日付をタップ → 「追加」ボタン、または右上の「予定追加」ボタンから作成できます。研修予定とOJT予定を選択できます。' },
      { q: '3者フローとは？', a: '①指導責任者が予定作成 → ②当日に指導者と外国人が独立して入力 → ③指導責任者がフィードバック、の3段階のフローです。' },
      { q: '予定を取り消し・延期するには？', a: '予定の詳細画面 → 「取り消し・延期」ボタンから理由を入力して実行します。履歴は全て保存されます。' },
      { q: '同じ時間帯に予定を入れたらエラーになった', a: '同一外国人の時間帯重複は禁止されています。空き時間が提案されるので、別の時間帯を選択してください。' },
    ],
  },
  {
    title: '最終評価・PDF出力',
    items: [
      { q: '最終評価を入力するには？', a: '外国人詳細 → 「最終評価」ボタンから入力できます。管理者・指導責任者のみ入力・承認が可能です。' },
      { q: 'PDFはどこから出力しますか？', a: '外国人詳細 → 「PDF出力」ボタンから研修記録票・OJT記録票・最終評価票を出力できます。巡回訪問時にそのまま提出できる体裁です。' },
    ],
  },
  {
    title: 'スタッフ・事業所管理',
    items: [
      { q: 'スタッフを追加するには？', a: '管理 → スタッフ管理 → 「新しいスタッフを追加」から氏名・メール・パスワード・役割・所属施設を入力して作成します。' },
      { q: 'スタッフが退職した場合は？', a: 'スタッフ管理画面の「退職処理」ボタンからアーカイブできます。研修記録は消えません。名前の横に「退職済み」と表示されます。' },
      { q: '事業所を追加するには？', a: '管理 → 施設管理 → 「新規追加」から事業所名・住所・種別を入力して登録します。' },
    ],
  },
  {
    title: 'フィードバック・通知',
    items: [
      { q: '改善要望を送るには？', a: '画面右下の「改善要望を送る」ボタンからカテゴリ（UI改善・機能追加・バグ報告・その他）を選択して送信します。' },
      { q: '通知はどこで確認できますか？', a: '画面右上のベルアイコンをクリックすると通知一覧が表示されます。未読のものは赤いバッジで数が表示されます。' },
    ],
  },
];

function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-900">{q}</span>
        <ChevronDown size={16} className={`flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-3">
          <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function HelpContent() {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? SECTIONS.map((s) => ({
        ...s,
        items: s.items.filter(
          (i) => i.q.includes(search) || i.a.includes(search)
        ),
      })).filter((s) => s.items.length > 0)
    : SECTIONS;

  return (
    <div className="space-y-6">
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

      {/* Sections */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">「{search}」に一致する質問が見つかりませんでした</p>
        </div>
      ) : (
        filtered.map((section) => (
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

      {/* Contact */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
        <p className="text-sm font-medium text-blue-800">解決しない場合</p>
        <p className="mt-1 text-xs text-blue-600">画面右下の「改善要望を送る」ボタンからお問い合わせください。</p>
      </div>
    </div>
  );
}
