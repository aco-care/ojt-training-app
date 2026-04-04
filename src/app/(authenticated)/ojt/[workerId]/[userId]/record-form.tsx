'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { OjtStep, OjtResult, EvalRating, OjtStatus, Profile } from '@/lib/types';
import { OJT_STEPS, CHECKLIST_ITEMS, EVAL_LABELS } from '@/lib/types';

interface RecordFormProps {
  workerId: string;
  userId: string;
  currentStep: string;
  staff: Pick<Profile, 'id' | 'name' | 'role'>[];
  isManager: boolean;
  ojtStatus: OjtStatus;
}

const EVAL_OPTIONS: { value: EvalRating; label: string }[] = [
  { value: 'good', label: '○' },
  { value: 'fair', label: '△' },
  { value: 'poor', label: '×' },
];

const RESULT_OPTIONS: { value: OjtResult; label: string; description: string }[] = [
  { value: 'pass', label: '次へ進む', description: 'pass' },
  { value: 'redo', label: '再実施', description: 'redo' },
  { value: 'rollback', label: '差し戻し', description: 'rollback' },
];

export default function RecordForm({
  workerId,
  userId,
  currentStep,
  staff,
  isManager,
  ojtStatus,
}: RecordFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<OjtStep>(currentStep as OjtStep);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [companionId, setCompanionId] = useState('');
  const [content, setContent] = useState('');
  const [checklistSelf, setChecklistSelf] = useState<EvalRating[]>(
    Array(CHECKLIST_ITEMS.length).fill('good')
  );
  const [checklistTrainer, setChecklistTrainer] = useState<EvalRating[]>(
    Array(CHECKLIST_ITEMS.length).fill('good')
  );
  const [result, setResult] = useState<OjtResult>('pass');
  const [managerComment, setManagerComment] = useState('');
  const [notes, setNotes] = useState('');
  const [workerComment, setWorkerComment] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const resetForm = () => {
    setStep(currentStep as OjtStep);
    setDate(new Date().toISOString().split('T')[0]);
    setCompanionId('');
    setContent('');
    setChecklistSelf(Array(CHECKLIST_ITEMS.length).fill('good'));
    setChecklistTrainer(Array(CHECKLIST_ITEMS.length).fill('good'));
    setResult('pass');
    setManagerComment('');
    setWorkerComment('');
    setNotes('');
    setError(null);
    setValidationErrors([]);
  };

  const updateChecklistSelf = (index: number, value: EvalRating) => {
    const next = [...checklistSelf];
    next[index] = value;
    setChecklistSelf(next);
  };

  const updateChecklistTrainer = (index: number, value: EvalRating) => {
    const next = [...checklistTrainer];
    next[index] = value;
    setChecklistTrainer(next);
  };

  const validate = (): string[] => {
    const errors: string[] = [];
    if (!step) errors.push('ステップを選択してください');
    if (!date) errors.push('実施日を入力してください');
    if (!companionId) errors.push('同行者を選択してください');
    if (!content.trim()) errors.push('実施内容を入力してください');
    if (!result) errors.push('判定を選択してください');
    if (isManager && !managerComment.trim()) errors.push('管理者コメントを入力してください');
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    setError(null);

    const errors = validate();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setLoading(true);

    const supabase = createClient();

    // Count existing records for this step to determine attempt_number
    const { data: existingRecords } = await supabase
      .from('ojt_records')
      .select('id')
      .eq('ojt_user_id', userId)
      .eq('worker_id', workerId)
      .eq('step', step);

    const attemptNumber = (existingRecords?.length ?? 0) + 1;

    // Insert the record
    const { error: insertError } = await supabase.from('ojt_records').insert({
      worker_id: workerId,
      ojt_user_id: userId,
      step,
      attempt_number: attemptNumber,
      date,
      companion_id: companionId || null,
      content: content.trim() || null,
      checklist_self: checklistSelf,
      checklist_trainer: checklistTrainer,
      result,
      manager_comment: managerComment.trim() || null,
      worker_comment: workerComment.trim() || null,
      notes: notes.trim() || null,
    });

    if (insertError) {
      setLoading(false);
      setError(`記録の保存に失敗しました: ${insertError.message}`);
      return;
    }

    // Update ojt_users status based on result
    if (result === 'pass') {
      if (step === 'completion') {
        // Completion step passed -> mark OJT as completed
        await supabase
          .from('ojt_users')
          .update({ ojt_status: 'completed' })
          .eq('id', userId);
      } else if (ojtStatus === 'not_started') {
        // First pass -> mark as in_progress
        await supabase
          .from('ojt_users')
          .update({ ojt_status: 'in_progress' })
          .eq('id', userId);
      }
    }

    setLoading(false);
    resetForm();
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors sm:w-auto"
      >
        記録追加
      </button>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                OJT記録 追加
              </h3>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {validationErrors.length > 0 && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm font-medium text-red-700 mb-1">入力エラー</p>
                <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
                  {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Step */}
              <div>
                <label
                  htmlFor="record-step"
                  className="block text-sm font-medium text-gray-700"
                >
                  ステップ
                </label>
                <select
                  id="record-step"
                  value={step}
                  onChange={(e) => setStep(e.target.value as OjtStep)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {OJT_STEPS.map((s) => (
                    <option key={s.step} value={s.step}>
                      {s.number} {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label
                  htmlFor="record-date"
                  className="block text-sm font-medium text-gray-700"
                >
                  実施日
                </label>
                <input
                  id="record-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Companion */}
              <div>
                <label
                  htmlFor="record-companion"
                  className="block text-sm font-medium text-gray-700"
                >
                  同行者 <span className="text-red-500">*</span>
                </label>
                <select
                  id="record-companion"
                  value={companionId}
                  onChange={(e) => setCompanionId(e.target.value)}
                  required
                  className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    validationErrors.length > 0 && !companionId ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                >
                  <option value="">選択してください</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Content */}
              <div>
                <label
                  htmlFor="record-content"
                  className="block text-sm font-medium text-gray-700"
                >
                  実施内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="record-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                  required
                  className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    validationErrors.length > 0 && !content.trim() ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="実施した内容を記載してください"
                />
              </div>

              {/* Checklist */}
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  到達目標チェックシート
                </p>
                <div className="rounded-md border border-gray-200 bg-gray-50">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-gray-200 px-3 py-2">
                    <span className="text-xs font-medium text-gray-500">
                      項目
                    </span>
                    <span className="w-20 text-center text-xs font-medium text-gray-500">
                      本人
                    </span>
                    <span className="w-20 text-center text-xs font-medium text-gray-500">
                      指導者
                    </span>
                  </div>

                  {/* Items */}
                  {CHECKLIST_ITEMS.map((item, index) => (
                    <div
                      key={index}
                      className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2 ${
                        index < CHECKLIST_ITEMS.length - 1
                          ? 'border-b border-gray-100'
                          : ''
                      }`}
                    >
                      <span className="text-xs text-gray-700">{item}</span>

                      {/* Self eval */}
                      <div className="flex w-20 justify-center gap-1">
                        {EVAL_OPTIONS.map((opt) => (
                          <label
                            key={`self-${index}-${opt.value}`}
                            className="cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={`self-${index}`}
                              value={opt.value}
                              checked={checklistSelf[index] === opt.value}
                              onChange={() =>
                                updateChecklistSelf(index, opt.value)
                              }
                              className="sr-only"
                            />
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                                checklistSelf[index] === opt.value
                                  ? opt.value === 'good'
                                    ? 'bg-green-500 text-white'
                                    : opt.value === 'fair'
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-red-500 text-white'
                                  : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                              }`}
                            >
                              {opt.label}
                            </span>
                          </label>
                        ))}
                      </div>

                      {/* Trainer eval */}
                      <div className="flex w-20 justify-center gap-1">
                        {EVAL_OPTIONS.map((opt) => (
                          <label
                            key={`trainer-${index}-${opt.value}`}
                            className="cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={`trainer-${index}`}
                              value={opt.value}
                              checked={checklistTrainer[index] === opt.value}
                              onChange={() =>
                                updateChecklistTrainer(index, opt.value)
                              }
                              className="sr-only"
                            />
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                                checklistTrainer[index] === opt.value
                                  ? opt.value === 'good'
                                    ? 'bg-green-500 text-white'
                                    : opt.value === 'fair'
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-red-500 text-white'
                                  : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                              }`}
                            >
                              {opt.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Result */}
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">判定</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                  {RESULT_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                        result === opt.value
                          ? opt.value === 'pass'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : opt.value === 'redo'
                            ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                            : 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="result"
                        value={opt.value}
                        checked={result === opt.value}
                        onChange={() => setResult(opt.value)}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Manager comment (only for admin/supervisor) */}
              {isManager && (
                <div>
                  <label
                    htmlFor="record-manager-comment"
                    className="block text-sm font-medium text-gray-700"
                  >
                    管理者コメント <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="record-manager-comment"
                    value={managerComment}
                    onChange={(e) => setManagerComment(e.target.value)}
                    rows={2}
                    required
                    className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      validationErrors.length > 0 && isManager && !managerComment.trim() ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="管理者としてのコメントを記載してください"
                  />
                </div>
              )}

              {/* Worker comment */}
              <div>
                <label
                  htmlFor="record-worker-comment"
                  className="block text-sm font-medium text-gray-700"
                >
                  本人コメント
                </label>
                <textarea
                  id="record-worker-comment"
                  value={workerComment}
                  onChange={(e) => setWorkerComment(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="本人からのコメント（振り返り・気づき等）"
                />
              </div>

              {/* Notes */}
              <div>
                <label
                  htmlFor="record-notes"
                  className="block text-sm font-medium text-gray-700"
                >
                  備考
                </label>
                <textarea
                  id="record-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="その他特記事項があれば記載してください"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? '保存中...' : '記録を保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
