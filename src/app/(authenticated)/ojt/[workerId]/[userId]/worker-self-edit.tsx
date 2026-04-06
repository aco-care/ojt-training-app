'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { EvalRating } from '@/lib/types';
import { CHECKLIST_ITEMS } from '@/lib/types';

interface WorkerSelfEditProps {
  recordId: string;
  checklistSelf: EvalRating[];
  workerComment: string | null;
}

const EVAL_OPTIONS: { value: EvalRating; label: string }[] = [
  { value: 'good', label: '○' },
  { value: 'fair', label: '△' },
  { value: 'poor', label: '×' },
];

export default function WorkerSelfEdit({ recordId, checklistSelf, workerComment }: WorkerSelfEditProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [selfRatings, setSelfRatings] = useState<EvalRating[]>(
    checklistSelf.length === CHECKLIST_ITEMS.length
      ? [...checklistSelf]
      : Array(CHECKLIST_ITEMS.length).fill('good')
  );
  const [comment, setComment] = useState(workerComment ?? '');

  const updateRating = (index: number, value: EvalRating) => {
    const next = [...selfRatings];
    next[index] = value;
    setSelfRatings(next);
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('ojt_records')
      .update({
        checklist_self: selfRatings,
        worker_comment: comment.trim() || null,
      })
      .eq('id', recordId);

    setLoading(false);

    if (updateError) {
      setError(`保存に失敗しました: ${updateError.message}`);
      return;
    }

    setSuccess(true);
    setEditing(false);
    router.refresh();
    setTimeout(() => setSuccess(false), 2000);
  };

  if (!editing) {
    return (
      <div className="mt-2">
        <button
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          本人評価・コメントを編集
        </button>
        {success && (
          <span className="ml-2 text-xs text-green-600">保存しました</span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <p className="mb-2 text-xs font-semibold text-blue-700">本人評価を編集</p>

      {error && (
        <div className="mb-2 rounded bg-red-50 p-2 text-xs text-red-600">{error}</div>
      )}

      <div className="space-y-1.5">
        {CHECKLIST_ITEMS.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="flex-1 text-[10px] text-gray-700">{item}</span>
            <div className="flex gap-1">
              {EVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateRating(index, opt.value)}
                  className={`h-5 w-5 rounded-full text-[10px] font-medium transition-colors ${
                    selfRatings[index] === opt.value
                      ? opt.value === 'good'
                        ? 'bg-green-500 text-white'
                        : opt.value === 'fair'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <label className="block text-xs font-medium text-gray-700">本人コメント</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="振り返りや気づきを記入してください"
        />
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <button
          onClick={() => {
            setEditing(false);
            setSelfRatings(checklistSelf.length === CHECKLIST_ITEMS.length ? [...checklistSelf] : Array(CHECKLIST_ITEMS.length).fill('good'));
            setComment(workerComment ?? '');
          }}
          className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
