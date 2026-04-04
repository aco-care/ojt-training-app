'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { TrainingSubtopic, TrainingFormat, Profile } from '@/lib/types';
import { FORMAT_LABELS } from '@/lib/types';

interface SessionFormProps {
  workerId: string;
  itemId: string;
  subtopics: TrainingSubtopic[];
  trainers: Pick<Profile, 'id' | 'name' | 'email' | 'role'>[];
  completedSubtopicIds: string[];
  facilities: { id: string; name: string }[];
}

const FORMAT_OPTIONS: { value: TrainingFormat; label: string }[] = [
  { value: 'classroom', label: FORMAT_LABELS.classroom },
  { value: 'ojt', label: FORMAT_LABELS.ojt },
  { value: 'roleplay', label: FORMAT_LABELS.roleplay },
  { value: 'simulation', label: FORMAT_LABELS.simulation },
];

function getTodayString(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export default function SessionForm({
  workerId,
  itemId,
  subtopics,
  trainers,
  completedSubtopicIds,
  facilities,
}: SessionFormProps) {
  const router = useRouter();

  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? '');
  const [date, setDate] = useState(getTodayString());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [trainerId, setTrainerId] = useState(trainers[0]?.id ?? '');
  const [format, setFormat] = useState<TrainingFormat>('classroom');
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [customContent, setCustomContent] = useState('');
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duration = useMemo(() => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return null;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes, totalHours: diffMs / (1000 * 60 * 60) };
  }, [startTime, endTime]);

  const handleSubtopicToggle = (subtopicId: string) => {
    setSelectedSubtopics((prev) =>
      prev.includes(subtopicId)
        ? prev.filter((id) => id !== subtopicId)
        : [...prev, subtopicId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!duration || duration.totalHours <= 0) {
      setError('終了時間は開始時間より後にしてください');
      return;
    }

    if (!trainerId) {
      setError('指導者を選択してください');
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      // Check for time overlap with existing sessions for the same worker on the same date
      const { data: existingSessions } = await supabase
        .from('training_sessions')
        .select('id, start_time, end_time')
        .eq('worker_id', workerId)
        .eq('date', date);

      if (existingSessions && existingSessions.length > 0) {
        const newStart = new Date(`2000-01-01T${startTime}`).getTime();
        const newEnd = new Date(`2000-01-01T${endTime}`).getTime();
        const overlap = existingSessions.find((s) => {
          if (!s.start_time || !s.end_time) return false;
          const sStart = new Date(`2000-01-01T${s.start_time}`).getTime();
          const sEnd = new Date(`2000-01-01T${s.end_time}`).getTime();
          return newStart < sEnd && newEnd > sStart;
        });
        if (overlap) {
          setError(`この外国人は${date}の${overlap.start_time}〜${overlap.end_time}に既に研修が登録されています。時間帯が重複しています。`);
          setIsSubmitting(false);
          return;
        }
      }

      const { error: insertError } = await supabase
        .from('training_sessions')
        .insert({
          worker_id: workerId,
          item_id: itemId,
          facility_id: facilityId,
          date,
          start_time: startTime,
          end_time: endTime,
          trainer_id: trainerId,
          format,
          completed_subtopics: selectedSubtopics,
          custom_content: customContent.trim() || null,
          notes: notes.trim() || null,
          break_minutes: breakMinutes,
        });

      if (insertError) {
        setError(`保存に失敗しました: ${insertError.message}`);
        return;
      }

      // Reset form
      setDate(getTodayString());
      setStartTime('09:00');
      setEndTime('10:00');
      setSelectedSubtopics([]);
      setCustomContent('');
      setNotes('');
      setBreakMinutes(0);

      router.refresh();
    } catch {
      setError('予期しないエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Facility */}
      <div>
        <label htmlFor="session-facility" className="block text-sm font-medium text-gray-700">
          研修実施事業所
        </label>
        <select
          id="session-facility"
          value={facilityId}
          onChange={(e) => setFacilityId(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="" disabled>
            選択してください
          </option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <label htmlFor="session-date" className="block text-sm font-medium text-gray-700">
          日付
        </label>
        <input
          type="date"
          id="session-date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Time Range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="start-time" className="block text-sm font-medium text-gray-700">
            開始時間
          </label>
          <input
            type="time"
            id="start-time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="end-time" className="block text-sm font-medium text-gray-700">
            終了時間
          </label>
          <input
            type="time"
            id="end-time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Break Time */}
      <div>
        <label htmlFor="break-minutes" className="block text-sm font-medium text-gray-700">
          休憩時間（分）
        </label>
        <input
          type="number"
          id="break-minutes"
          min="0"
          step="5"
          value={breakMinutes}
          onChange={(e) => setBreakMinutes(Math.max(0, parseInt(e.target.value) || 0))}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Duration Display */}
      {duration && (
        <p className="text-xs text-gray-500">
          {breakMinutes > 0
            ? `所要時間: ${duration.totalHours.toFixed(1)}h（休憩${breakMinutes}分除く → 実質${(duration.totalHours - breakMinutes / 60).toFixed(1)}h）`
            : `所要時間: ${duration.hours > 0 ? `${duration.hours}時間` : ''}${duration.minutes > 0 ? `${duration.minutes}分` : ''} (${duration.totalHours.toFixed(1)}h)`
          }
        </p>
      )}
      {!duration && startTime && endTime && (
        <p className="text-xs text-red-500">
          終了時間は開始時間より後にしてください
        </p>
      )}

      {/* Trainer */}
      <div>
        <label htmlFor="trainer" className="block text-sm font-medium text-gray-700">
          指導者
        </label>
        <select
          id="trainer"
          value={trainerId}
          onChange={(e) => setTrainerId(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="" disabled>
            選択してください
          </option>
          {trainers.map((trainer) => (
            <option key={trainer.id} value={trainer.id}>
              {trainer.name}
            </option>
          ))}
        </select>
      </div>

      {/* Format */}
      <div>
        <label htmlFor="format" className="block text-sm font-medium text-gray-700">
          研修形式
        </label>
        <select
          id="format"
          value={format}
          onChange={(e) => setFormat(e.target.value as TrainingFormat)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Subtopics */}
      {subtopics.length > 0 && (
        <fieldset>
          <legend className="block text-sm font-medium text-gray-700">
            実施サブトピック
          </legend>
          <p className="mt-1 text-xs text-gray-500">この回で実施した項目にチェックを入れてください（完了済み項目も再度チェック可能）</p>
          <div className="mt-2 space-y-2">
            {subtopics.map((st) => {
              const alreadyCompleted = completedSubtopicIds.includes(st.id);
              const isChecked = selectedSubtopics.includes(st.id);
              return (
                <label
                  key={st.id}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors cursor-pointer ${
                    isChecked
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : alreadyCompleted
                        ? 'border-green-200 bg-green-50/50 text-gray-700'
                        : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleSubtopicToggle(st.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{st.title}</span>
                  {alreadyCompleted && (
                    <span className="ml-auto text-[10px] text-green-600 bg-green-100 rounded-full px-1.5 py-0.5">過去に完了</span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Custom content */}
      <div>
        <label htmlFor="custom-content" className="block text-sm font-medium text-gray-700">
          その他（自由記入）
        </label>
        <textarea
          id="custom-content"
          value={customContent}
          onChange={(e) => setCustomContent(e.target.value)}
          rows={2}
          placeholder="サブトピック以外に実施した内容があれば記入..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          備考
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="セッションに関するメモを入力..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || !duration}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? '保存中...' : 'セッションを保存'}
      </button>
    </form>
  );
}
