'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { todayKey, toDateKey, addDays } from '@/lib/date-utils';
import type { TrainingItem } from '@/lib/types';

type WorkerOption = { id: string; name: string; facility_id: string };
type ItemOption = TrainingItem & { subtopics: { id: string; title: string }[] };
type TrainerOption = {
  id: string;
  name: string;
  role: string;
  qualification: string;
  facility_id: string | null;
  profile_facilities: { facility_id: string }[];
};

interface CreatePlanFormProps {
  workers: WorkerOption[];
  items: ItemOption[];
  trainers: TrainerOption[];
  currentUserId: string;
  onClose: () => void;
}

interface SessionRow {
  date: string;
  startTime: string;
  endTime: string;
}

function defaultSessionsFor(item: ItemOption | undefined): SessionRow[] {
  const count = Math.max(1, item?.target_sessions ?? 1);
  const perSessionHours = item && item.target_sessions > 0 ? item.target_hours / item.target_sessions : 1;
  const startHour = 9;
  const endHour = startHour + perSessionHours;
  const endH = Math.min(23, Math.floor(endHour));
  const endM = Math.round((endHour - Math.floor(endHour)) * 60);
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  const base = new Date(todayKey());

  return Array.from({ length: count }, (_, i) => ({
    date: toDateKey(addDays(base, i)),
    startTime: '09:00',
    endTime,
  }));
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
  const [method, setMethod] = useState('対面');
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([
    { date: todayKey(), startTime: '09:00', endTime: '10:00' },
  ]);

  const selectedWorker = workers.find((w) => w.id === workerId);

  // 対象者の拠点専用の項目があればそれを優先し、なければ拠点共通デフォルトを使う
  const availableItems = useMemo(() => {
    const byNumber = new Map<number, ItemOption[]>();
    for (const item of items) {
      const arr = byNumber.get(item.item_number) ?? [];
      arr.push(item);
      byNumber.set(item.item_number, arr);
    }
    return Array.from(byNumber.entries())
      .sort(([a], [b]) => a - b)
      .map(([, variants]) => {
        const forFacility = selectedWorker
          ? variants.find((v) => v.facility_id === selectedWorker.facility_id)
          : undefined;
        return forFacility ?? variants.find((v) => v.facility_id === null) ?? variants[0];
      })
      .filter((v): v is ItemOption => !!v);
  }, [items, selectedWorker]);

  const availableTrainers = useMemo(() => {
    if (!selectedWorker) return trainers;
    return trainers.filter(
      (t) =>
        t.facility_id === selectedWorker.facility_id ||
        t.profile_facilities.some((pf) => pf.facility_id === selectedWorker.facility_id)
    );
  }, [trainers, selectedWorker]);

  const sortedTrainers = [...availableTrainers].sort((a, b) => {
    const order: Record<string, number> = { kaigofukushishi: 0, shoninsya: 1, none: 2 };
    return (order[a.qualification] ?? 2) - (order[b.qualification] ?? 2);
  });

  const selectedItem = availableItems.find((i) => i.id === itemId);

  const handleWorkerChange = (id: string) => {
    setWorkerId(id);
    setItemId('');
    setTrainerId('');
    setSelectedSubtopics([]);
    setSessions([{ date: todayKey(), startTime: '09:00', endTime: '10:00' }]);
  };

  const handleItemChange = (id: string) => {
    setItemId(id);
    setSelectedSubtopics([]);
    const item = availableItems.find((i) => i.id === id);
    setSessions(defaultSessionsFor(item));
  };

  const toggleSubtopic = (stId: string) => {
    setSelectedSubtopics((prev) =>
      prev.includes(stId) ? prev.filter((id) => id !== stId) : [...prev, stId]
    );
  };

  const updateSession = (index: number, field: keyof SessionRow, value: string) => {
    setSessions((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addSessionRow = () => {
    setSessions((prev) => {
      const last = prev[prev.length - 1];
      const nextDate = last ? toDateKey(addDays(new Date(last.date), 1)) : todayKey();
      return [...prev, { date: nextDate, startTime: last?.startTime ?? '09:00', endTime: last?.endTime ?? '10:00' }];
    });
  };

  const removeSessionRow = (index: number) => {
    setSessions((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId || !itemId || !trainerId || sessions.length === 0) {
      setError('必須項目を入力してください');
      return;
    }
    if (sessions.some((s) => !s.date)) {
      setError('すべての回に日付を入力してください');
      return;
    }

    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: insertError } = await supabase.from('training_plans').insert(
      sessions.map((s) => ({
        worker_id: workerId,
        item_id: itemId,
        trainer_id: trainerId,
        created_by: currentUserId,
        planned_date: s.date,
        planned_subtopics: selectedSubtopics,
        start_time: s.startTime || null,
        end_time: s.endTime || null,
        method: method || null,
        break_minutes: breakMinutes,
      }))
    );

    setLoading(false);

    if (insertError) {
      setError(`作成に失敗しました: ${insertError.message}`);
      return;
    }

    router.refresh();
    onClose();
  };

  const targetSessions = selectedItem?.target_sessions ?? null;
  const sessionCountMismatch = targetSessions !== null && sessions.length !== targetSessions;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
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
              onChange={(e) => handleWorkerChange(e.target.value)}
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
              onChange={(e) => handleItemChange(e.target.value)}
              required
              disabled={!workerId}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="" className="text-gray-400">
                {workerId ? '選択してください' : '先に対象外国人を選択してください'}
              </option>
              {availableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}（1回あたり約{(item.target_hours / item.target_sessions).toFixed(1)}時間 × 全{item.target_sessions}回）
                </option>
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
              disabled={!workerId}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="" className="text-gray-400">
                {workerId ? '選択してください' : '先に対象外国人を選択してください'}
              </option>
              {sortedTrainers.map((t) => {
                const badge = t.qualification === 'kaigofukushishi' ? '介福' : t.qualification === 'shoninsya' ? '初任' : '';
                return (
                  <option key={t.id} value={t.id}>{t.name}{badge ? ` [${badge}]` : ''}</option>
                );
              })}
            </select>
            {workerId && sortedTrainers.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">この対象者の拠点に所属する指導者が見つかりません。</p>
            )}
          </div>

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

          {/* Bulk session schedule */}
          <div className="border-t border-gray-200 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                実施予定日
                {targetSessions !== null && (
                  <span className={`ml-2 text-xs ${sessionCountMismatch ? 'text-amber-600' : 'text-gray-400'}`}>
                    全{targetSessions}回中 {sessions.length}件を入力中
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={addSessionRow}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                + 回を追加
              </button>
            </div>

            <div className="space-y-2">
              {sessions.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-gray-200 p-2">
                  <span className="w-10 shrink-0 text-xs text-gray-500">{i + 1}回目</span>
                  <input
                    type="date"
                    value={s.date}
                    onChange={(e) => updateSession(i, 'date', e.target.value)}
                    required
                    className="block w-36 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  />
                  <input
                    type="time"
                    value={s.startTime}
                    onChange={(e) => updateSession(i, 'startTime', e.target.value)}
                    className="block w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  />
                  <span className="text-xs text-gray-400">〜</span>
                  <input
                    type="time"
                    value={s.endTime}
                    onChange={(e) => updateSession(i, 'endTime', e.target.value)}
                    className="block w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => removeSessionRow(i)}
                    disabled={sessions.length <= 1}
                    className="ml-auto shrink-0 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

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
              {loading ? '作成中...' : `研修予定を作成（${sessions.length}件）`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
