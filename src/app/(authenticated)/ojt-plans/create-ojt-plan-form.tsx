'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { OJT_STEPS } from '@/lib/types';

interface CreateOjtPlanFormProps {
  workers: { id: string; name: string }[];
  ojtUsers: { id: string; worker_id: string; user_initial: string; ojt_status: string }[];
  staff: { id: string; name: string; role: string }[];
  currentUserId: string;
  onClose: () => void;
}

export default function CreateOjtPlanForm({
  workers,
  ojtUsers,
  staff,
  currentUserId,
  onClose,
}: CreateOjtPlanFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [workerId, setWorkerId] = useState('');
  const [ojtUserId, setOjtUserId] = useState('');
  const [step, setStep] = useState('');
  const [companionId, setCompanionId] = useState('');
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [breakMinutes, setBreakMinutes] = useState(0);

  // Filter OJT users by selected worker
  const filteredOjtUsers = ojtUsers.filter((u) => u.worker_id === workerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId || !ojtUserId || !step || !companionId || !plannedDate) {
      setError('必須項目を入力してください');
      return;
    }

    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: insertError } = await supabase.from('ojt_plans').insert({
      worker_id: workerId,
      ojt_user_id: ojtUserId,
      step,
      companion_id: companionId,
      created_by: currentUserId,
      planned_date: plannedDate,
      start_time: startTime || null,
      end_time: endTime || null,
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
          <h3 className="text-lg font-semibold text-gray-900">OJT予定を作成</h3>
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
              onChange={(e) => { setWorkerId(e.target.value); setOjtUserId(''); }}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            >
              <option value="" className="text-gray-400">選択してください</option>
              {workers.filter((w) => ojtUsers.some((u) => u.worker_id === w.id)).map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {workerId && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                対象利用者 <span className="text-red-500">*</span>
              </label>
              <select
                value={ojtUserId}
                onChange={(e) => setOjtUserId(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              >
                <option value="" className="text-gray-400">選択してください</option>
                {filteredOjtUsers.map((u) => (
                  <option key={u.id} value={u.id}>利用者 {u.user_initial}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              OJTステップ <span className="text-red-500">*</span>
            </label>
            <select
              value={step}
              onChange={(e) => setStep(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            >
              <option value="" className="text-gray-400">選択してください</option>
              {OJT_STEPS.map((s) => (
                <option key={s.step} value={s.step}>{s.number} {s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              同行者 <span className="text-red-500">*</span>
            </label>
            <select
              value={companionId}
              onChange={(e) => setCompanionId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            >
              <option value="" className="text-gray-400">選択してください</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
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

          {step && (
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-700">ステップの説明</p>
              <p className="mt-1 text-xs text-gray-500">
                {OJT_STEPS.find((s) => s.step === step)?.description ?? ''}
              </p>
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
              {loading ? '作成中...' : 'OJT予定を作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
