import Link from 'next/link';
import type { ReviewEntry, ReviewKind } from '@/lib/review-queue';

const KIND_LABELS: Record<ReviewKind, string> = {
  training_plan: '研修記録の確認',
  ojt_plan: 'OJT記録の確認',
  training_item: '研修項目の承認',
};

const KIND_COLORS: Record<ReviewKind, string> = {
  training_plan: 'bg-blue-100 text-blue-800',
  ojt_plan: 'bg-purple-100 text-purple-800',
  training_item: 'bg-amber-100 text-amber-800',
};

interface ReviewQueueProps {
  entries: ReviewEntry[];
  loadFailed: boolean;
}

export default function ReviewQueue({ entries, loadFailed }: ReviewQueueProps) {
  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm" aria-labelledby="review-queue-title">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <h2 id="review-queue-title" className="text-sm font-semibold text-gray-900">確認・承認待ち</h2>
        {!loadFailed && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              entries.length > 0 ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {entries.length}件
          </span>
        )}
      </div>

      {loadFailed ? (
        <p className="px-4 py-3 text-sm text-red-600">一覧を読み込めませんでした。画面を再読み込みしてください。</p>
      ) : entries.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">確認・承認待ちの記録はありません</p>
      ) : (
        <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
          {entries.map((entry) => (
            <li key={entry.key}>
              <Link href={entry.href} className="block px-4 py-3 transition-colors hover:bg-gray-50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${KIND_COLORS[entry.kind]}`}>
                    {KIND_LABELS[entry.kind]}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{entry.workerName}</span>
                </div>
                <p className="mt-1 text-sm text-gray-700">{entry.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {[entry.date?.replaceAll('-', '/'), entry.facilityName].filter(Boolean).join(' / ')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
