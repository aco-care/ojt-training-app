'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { todayKey } from '@/lib/date-utils';
import type { TrainingItem } from '@/lib/types';

interface CreatePlanFormProps {
  workers: { id: string; name: string }[];
  items: (TrainingItem & { subtopics: { id: string; title: string }[] })[];
  trainers: { id: string; name: string; role: string; qualification: string }[];
  currentUserId: string;
  onClose: () => void;
}

export default function CreatePlanForm({
  workers,
  items,
  trainers,
  currentUserId,
  onClose,
}: CreatePlanFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [workerId, setWorkerId] = useState('');
  const [itemId, setItemId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [plannedDate, setPlannedDate] = useState(todayKey());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [method, setMethod] = useState('対面');
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);

  const sortedTrainers = [...trainers].sort((a, b) => {
    const order: Record<string, number> = { kaigofukushishi: 0, shoninsya: 1, none: 2 };
    return (order[a.qualification] ?? 2) - (order[b.qualification] ?? 2);
  });

  const selectedItem = items.find((i) => i.id === itemId);

  const toggleSubtopic = (stId: string) => {
    setSelectedSubtopics((prev) =>
      prev.includes(stId) ? prev.filter((id) => id !== stId) : [...prev, stId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId || !itemId || !trainerId || !plannedDate) {
      setError('必須項目を入力してください');
      return;
    }

    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: insertError } = await supabase.from('training_plans').insert({
      worker_id: workerId,
      item_id: itemId,
      trainer_id: trainerId,
      created_by: currentUserId,
      planned_date: plannedDate,
      planned_subtopics: selectedSubtopics,
      start_time: startTime || null,
      end_time: endTime || null,
      method: method || null,
      break_minutes: breakMinutes,
    });

    setLoading(false);

    if (insertError) {
      setError(`作成に失敗しました: ${insertError.message}`);
      return;
    }

    router.refresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">研修予定を作成</h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              対象外国人 <span className="text-red-500">*</span>
            </label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            >
              <option value="" className="text-gray-400">選択してください</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              研修項目 <span className="text-red-500">*</span>
            </label>
            <select
              value={itemId}
              onChange={(e) => { setItemId(e.target.value); setSelectedSubtopics([]); }}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            >
              <option value="" className="text-gray-400">選択してください</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              指導者 <span className="text-red-500">*</span>
            </label>
            <select
              value={trainerId}
              onChange={(e) => setTrainerId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            >
              <option value="" className="text-gray-400">選択してください</option>
              {sortedTrainers.map((t) => {
                const badge = t.qualification === 'kaigofukushishi' ? '介福' : t.qualification === 'shoninsya' ? '初任' : '';
                return (
                  <option key={t.id} value={t.id}>{t.name}{badge ? ` [${badge}]` : ''}</option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                予定日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">開始</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">終了</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </div>
          </div>

          {/* Break time */}
          <div>
            <label className="block text-sm font-medium text-gray-700">休憩時間（分）</label>
            <input
              type="number"
              min="0"
              step="5"
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(Math.max(0, parseInt(e.target.value) || 0))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">実施形式</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            >
              <option>対面</option>
              <option>OJT</option>
              <option>ロールプレイ</option>
              <option>シミュレーション</option>
              <option>オンライン</option>
            </select>
          </div>

          {/* Subtopic selection */}
          {selectedItem && selectedItem.subtopics && selectedItem.subtopics.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">予定サブトピック</p>
              <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-2 space-y-1">
                {selectedItem.subtopics.map((st) => (
                  <label key={st.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={selectedSubtopics.includes(st.id)}
                      onChange={() => toggleSubtopic(st.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-xs text-gray-700">{st.title}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubtopics(selectedItem.subtopics.map((st) => st.id))}
                className="mt-1 text-xs text-blue-600 hover:text-blue-800"
              >
                すべて選択
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '作成中...' : '研修予定を作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
