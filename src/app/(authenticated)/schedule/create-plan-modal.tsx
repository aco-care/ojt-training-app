'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { OJT_STEPS } from '@/lib/types';
import type { CalendarEvent } from '@/lib/types';

interface CreatePlanModalProps {
  workers: { id: string; name: string }[];
  trainingItems: { id: string; title: string; target_sessions: number; target_hours: number; subtopics: { id: string; title: string }[] }[];
  ojtUsers: { id: string; worker_id: string; user_initial: string; ojt_status: string }[];
  staff: { id: string; name: string }[];
  completedSubtopicsByWorker: Record<string, string[]>;
  sessionCountByWorkerItem: Record<string, number>;
  hoursByWorkerItem: Record<string, number>;
  currentUserId: string;
  initialDate: string;
  duplicateSource?: CalendarEvent | null;
  onClose: () => void;
}

type PlanType = 'training' | 'ojt' | null;

export default function CreatePlanModal({
  workers,
  trainingItems,
  ojtUsers,
  staff,
  completedSubtopicsByWorker,
  sessionCountByWorkerItem,
  hoursByWorkerItem,
  currentUserId,
  initialDate,
  duplicateSource,
  onClose,
}: CreatePlanModalProps) {
  const router = useRouter();

  // Pre-fill from duplicateSource
  const dupType = duplicateSource?.type ?? null;
  const dupWorkerId = duplicateSource?.workerId ?? '';

  const [planType, setPlanType] = useState<PlanType>(dupType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Training form state
  const [workerId, setWorkerId] = useState(dupWorkerId);
  const [itemId, setItemId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [plannedDate, setPlannedDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(duplicateSource?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(duplicateSource?.endTime ?? '10:00');
  const [method, setMethod] = useState('対面');
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);

  // OJT form state
  const [ojtUserId, setOjtUserId] = useState('');
  const [step, setStep] = useState('');
  const [companionId, setCompanionId] = useState('');

  const selectedItem = trainingItems.find((i) => i.id === itemId);
  const filteredOjtUsers = ojtUsers.filter((u) => u.worker_id === workerId);
  const completedForWorker = completedSubtopicsByWorker[workerId] ?? [];

  const toggleSubtopic = (stId: string) => {
    setSelectedSubtopics((prev) =>
      prev.includes(stId) ? prev.filter((id) => id !== stId) : [...prev, stId]
    );
  };

  const handleWorkerChange = (wid: string) => {
    setWorkerId(wid);
    setItemId('');
    setSelectedSubtopics([]);
    setOjtUserId('');
    setStep('');
  };

  // Check time overlap for the same worker on the same date
  // Returns error message with suggestion, or null if no overlap
  const checkOverlap = async (wid: string, pDate: string, sTime: string, eTime: string): Promise<string | null> => {
    // If no time is set, skip overlap check (time-unspecified plan is allowed)
    if (!sTime || !eTime) return null;
    const supabase = createClient();
    const newStart = new Date(`2000-01-01T${sTime}`).getTime();
    const newEnd = new Date(`2000-01-01T${eTime}`).getTime();

    // Collect all occupied time slots for this worker on this date
    const occupied: { start: string; end: string; label: string }[] = [];

    const { data: plans } = await supabase
      .from('training_plans')
      .select('id, start_time, end_time')
      .eq('worker_id', wid)
      .eq('planned_date', pDate)
      .neq('status', 'cancelled');

    for (const p of plans ?? []) {
      if (p.start_time && p.end_time) {
        occupied.push({ start: p.start_time, end: p.end_time, label: '研修予定' });
      }
    }

    const { data: oPlans } = await supabase
      .from('ojt_plans')
      .select('id, start_time, end_time')
      .eq('worker_id', wid)
      .eq('planned_date', pDate)
      .neq('status', 'cancelled');

    for (const p of oPlans ?? []) {
      if (p.start_time && p.end_time) {
        occupied.push({ start: p.start_time, end: p.end_time, label: 'OJT予定' });
      }
    }

    const { data: sessions } = await supabase
      .from('training_sessions')
      .select('id, start_time, end_time')
      .eq('worker_id', wid)
      .eq('date', pDate);

    for (const s of sessions ?? []) {
      if (s.start_time && s.end_time) {
        occupied.push({ start: s.start_time, end: s.end_time, label: '研修記録' });
      }
    }

    // Check for overlaps
    for (const o of occupied) {
      const oStart = new Date(`2000-01-01T${o.start}`).getTime();
      const oEnd = new Date(`2000-01-01T${o.end}`).getTime();
      if (newStart < oEnd && newEnd > oStart) {
        // Find next available slot
        const sortedEnds = occupied
          .map((x) => new Date(`2000-01-01T${x.end}`).getTime())
          .sort((a, b) => a - b);
        const latestEnd = sortedEnds[sortedEnds.length - 1];
        const suggestedStart = new Date(latestEnd);
        const hh = String(suggestedStart.getHours()).padStart(2, '0');
        const mm = String(suggestedStart.getMinutes()).padStart(2, '0');

        return `${o.start}〜${o.end}に${o.label}があり重複しています。空き: ${hh}:${mm}以降`;
      }
    }

    return null;
  };

  const handleSubmitTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId || !itemId || !trainerId || !plannedDate) {
      setError('必須項目を入力してください');
      return;
    }
    setLoading(true);
    setError('');

    // Overlap check
    const overlap = await checkOverlap(workerId, plannedDate, startTime, endTime);
    if (overlap) {
      setError(`この外国人の時間帯が重複しています: ${overlap}`);
      setLoading(false);
      return;
    }

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

  const handleSubmitOjt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId || !ojtUserId || !step || !companionId || !plannedDate) {
      setError('必須項目を入力してください');
      return;
    }
    setLoading(true);
    setError('');

    // Overlap check
    const overlap = await checkOverlap(workerId, plannedDate, startTime, endTime);
    if (overlap) {
      setError(`この外国人の時間帯が重複しています: ${overlap}`);
      setLoading(false);
      return;
    }

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
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {planType === null
              ? '予定を作成'
              : planType === 'training'
                ? `研修予定を${duplicateSource ? '複製' : '作成'}`
                : `OJT予定を${duplicateSource ? '複製' : '作成'}`}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Phase 1: Type selection */}
        {planType === null && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setPlanType('training')}
              className="flex-1 rounded-xl border-2 border-blue-200 bg-blue-50 p-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-100"
            >
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-blue-800">研修予定を作成</span>
            </button>
            <button
              type="button"
              onClick={() => setPlanType('ojt')}
              className="flex-1 rounded-xl border-2 border-green-200 bg-green-50 p-6 text-center transition-colors hover:border-green-400 hover:bg-green-100"
            >
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-green-800">OJT予定を作成</span>
            </button>
          </div>
        )}

        {/* Phase 2: Training form */}
        {planType === 'training' && (
          <form onSubmit={handleSubmitTraining} className="space-y-4">
            {/* Worker selector */}
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

            {/* Auto-suggest panel */}
            {workerId && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                <p className="mb-2 text-xs font-semibold text-blue-800">未完了の研修項目</p>
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {trainingItems.map((item) => {
                    const totalSubs = item.subtopics.length;
                    if (totalSubs === 0) return null;
                    const doneCount = item.subtopics.filter((st) =>
                      completedForWorker.includes(st.id)
                    ).length;
                    const key = `${workerId}:${item.id}`;
                    const sessionCount = sessionCountByWorkerItem[key] ?? 0;
                    const doneHours = hoursByWorkerItem[key] ?? 0;
                    const remainingHours = Math.max(0, item.target_hours - doneHours);
                    const allSubtopicsDone = doneCount >= totalSubs;
                    const sessionsMetTarget = item.target_sessions > 0
                      ? sessionCount >= item.target_sessions
                      : true;
                    if (allSubtopicsDone && sessionsMetTarget) return null;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setItemId(item.id);
                          const incomplete = item.subtopics
                            .filter((st) => !completedForWorker.includes(st.id))
                            .map((st) => st.id);
                          setSelectedSubtopics(incomplete);
                        }}
                        className={`flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-xs transition-colors ${
                          itemId === item.id
                            ? 'bg-blue-200 text-blue-900'
                            : 'text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="truncate font-medium">{item.title}</span>
                          {doneCount === 0 && (
                            <span className="ml-1 rounded bg-orange-100 px-1 py-0.5 text-[10px] font-medium text-orange-700">
                              未実施
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 w-full text-[10px] opacity-80">
                          <span>項目: {doneCount}/{totalSubs}</span>
                          <span>|</span>
                          <span>回数: {sessionCount}/{item.target_sessions}回</span>
                          <span>|</span>
                          <span>時間: {doneHours.toFixed(1)}/{item.target_hours}h</span>
                          {remainingHours > 0 && (
                            <span className="ml-auto font-medium text-red-600">残{remainingHours.toFixed(1)}h</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Training item selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                研修項目 <span className="text-red-500">*</span>
              </label>
              <select
                value={itemId}
                onChange={(e) => {
                  setItemId(e.target.value);
                  setSelectedSubtopics([]);
                }}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              >
                <option value="" className="text-gray-400">選択してください</option>
                {trainingItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.title}</option>
                ))}
              </select>
            </div>

            {/* Trainer selector */}
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
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Date / time row */}
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

            {/* Method */}
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
                    <label
                      key={st.id}
                      className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSubtopics.includes(st.id)}
                        onChange={() => toggleSubtopic(st.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-xs text-gray-700">{st.title}</span>
                      {completedForWorker.includes(st.id) && (
                        <span className="ml-auto text-[10px] text-green-600">完了済</span>
                      )}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedSubtopics(selectedItem.subtopics.map((st) => st.id))
                  }
                  className="mt-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  すべて選択
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setPlanType(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                戻る
              </button>
              <div className="flex gap-3">
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
            </div>
          </form>
        )}

        {/* Phase 2: OJT form */}
        {planType === 'ojt' && (
          <form onSubmit={handleSubmitOjt} className="space-y-4">
            {/* Worker selector */}
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
                {workers
                  .filter((w) => ojtUsers.some((u) => u.worker_id === w.id))
                  .map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
              </select>
            </div>

            {/* Auto-suggest panel for OJT */}
            {workerId && filteredOjtUsers.length > 0 && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3">
                <p className="mb-2 text-xs font-semibold text-green-800">OJT利用者の現在ステップ</p>
                <div className="space-y-1">
                  {filteredOjtUsers.map((ou) => {
                    const currentStep = OJT_STEPS.find((s) => s.step === ou.ojt_status);
                    return (
                      <button
                        key={ou.id}
                        type="button"
                        onClick={() => {
                          setOjtUserId(ou.id);
                          if (currentStep) setStep(currentStep.step);
                        }}
                        className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs transition-colors ${
                          ojtUserId === ou.id
                            ? 'bg-green-200 text-green-900'
                            : 'text-green-700 hover:bg-green-100'
                        }`}
                      >
                        <span>利用者 {ou.user_initial}</span>
                        <span>{currentStep?.label ?? ou.ojt_status}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* OJT user selector */}
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

            {/* OJT step */}
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

            {/* Companion selector */}
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

            {/* Date / time row */}
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

            {/* Break time (OJT) */}
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

            {/* Step description */}
            {step && (
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-700">ステップの説明</p>
                <p className="mt-1 text-xs text-gray-500">
                  {OJT_STEPS.find((s) => s.step === step)?.description ?? ''}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setPlanType(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                戻る
              </button>
              <div className="flex gap-3">
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
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? '作成中...' : 'OJT予定を作成'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
