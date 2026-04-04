'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CHECKLIST_ITEMS, EVAL_LABELS, type EvalRating } from '@/lib/types';

interface ExistingEvaluation {
  id: string;
  eval_date: string;
  scores_self: EvalRating[];
  scores_trainer: EvalRating[];
  supervisor_comment: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
}

interface EvaluationFormProps {
  workerId: string;
  existingEvaluation: ExistingEvaluation | null;
  prefilledSelf: EvalRating[];
  prefilledTrainer: EvalRating[];
  userRole?: string;
}

const RATING_OPTIONS: { value: EvalRating; label: string }[] = [
  { value: 'good', label: EVAL_LABELS.good },
  { value: 'fair', label: EVAL_LABELS.fair },
  { value: 'poor', label: EVAL_LABELS.poor },
];

export default function EvaluationForm({
  workerId,
  existingEvaluation,
  prefilledSelf,
  prefilledTrainer,
  userRole,
}: EvaluationFormProps) {
  const router = useRouter();
  const isApproved = !!existingEvaluation?.approved_by;
  const isWorker = userRole === 'worker';
  const isAdminOrSupervisor = userRole === 'admin' || userRole === 'supervisor';
  // Worker can only edit self-evaluation; admin/supervisor can edit both
  const canEditSelf = !isApproved;
  const canEditTrainer = !isApproved && isAdminOrSupervisor;
  const canSubmit = isAdminOrSupervisor; // Only admin/supervisor can submit the form

  const [scoresSelf, setScoresSelf] = useState<EvalRating[]>(
    existingEvaluation?.scores_self ?? prefilledSelf,
  );
  const [scoresTrainer, setScoresTrainer] = useState<EvalRating[]>(
    existingEvaluation?.scores_trainer ?? prefilledTrainer,
  );
  const [supervisorComment, setSupervisorComment] = useState(
    existingEvaluation?.supervisor_comment ?? '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSelfChange = (index: number, value: EvalRating) => {
    setScoresSelf((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleTrainerChange = (index: number, value: EvalRating) => {
    setScoresTrainer((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];

      if (existingEvaluation) {
        // Update existing evaluation
        const { error } = await supabase
          .from('final_evaluations')
          .update({
            eval_date: today,
            scores_self: scoresSelf,
            scores_trainer: scoresTrainer,
            supervisor_comment: supervisorComment || null,
          })
          .eq('id', existingEvaluation.id);

        if (error) throw error;
      } else {
        // Insert new evaluation
        const { error } = await supabase.from('final_evaluations').insert({
          worker_id: workerId,
          eval_date: today,
          scores_self: scoresSelf,
          scores_trainer: scoresTrainer,
          supervisor_comment: supervisorComment || null,
        });

        if (error) throw error;
      }

      setMessage({ type: 'success', text: '評価を保存しました。' });
      router.refresh();
    } catch (err) {
      console.error('Failed to save evaluation:', err);
      setMessage({ type: 'error', text: '保存に失敗しました。' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">
            到達目標評価
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            ○：良好　△：おおむね良好　×：不十分
          </p>
        </div>

        {/* Checklist items */}
        <div className="divide-y divide-gray-100">
          {CHECKLIST_ITEMS.map((itemText, idx) => (
            <div key={idx} className="px-4 py-3">
              <p className="mb-2 text-sm font-medium text-gray-900">
                <span className="mr-1.5 text-gray-400">{idx + 1}.</span>
                {itemText}
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Self evaluation */}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-gray-500">
                    本人評価
                  </p>
                  <div className="flex gap-2">
                    {RATING_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                          scoresSelf[idx] === opt.value
                            ? opt.value === 'good'
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : opt.value === 'fair'
                                ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                                : 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                        } ${isApproved ? 'pointer-events-none opacity-60' : ''}`}
                      >
                        <input
                          type="radio"
                          name={`self-${idx}`}
                          value={opt.value}
                          checked={scoresSelf[idx] === opt.value}
                          onChange={() => handleSelfChange(idx, opt.value)}
                          disabled={!canEditSelf}
                          className="sr-only"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Trainer evaluation */}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-gray-500">
                    指導者評価
                  </p>
                  <div className="flex gap-2">
                    {RATING_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                          scoresTrainer[idx] === opt.value
                            ? opt.value === 'good'
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : opt.value === 'fair'
                                ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                                : 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                        } ${!canEditTrainer ? 'pointer-events-none opacity-60' : ''}`}
                      >
                        <input
                          type="radio"
                          name={`trainer-${idx}`}
                          value={opt.value}
                          checked={scoresTrainer[idx] === opt.value}
                          onChange={() => handleTrainerChange(idx, opt.value)}
                          disabled={!canEditTrainer}
                          className="sr-only"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Supervisor comment */}
        <div className="border-t border-gray-200 px-4 py-4">
          <label
            htmlFor="supervisor-comment"
            className="mb-1.5 block text-sm font-medium text-gray-900"
          >
            総合コメント
          </label>
          <textarea
            id="supervisor-comment"
            rows={4}
            value={supervisorComment}
            onChange={(e) => setSupervisorComment(e.target.value)}
            disabled={isApproved || isWorker}
            placeholder="指導責任者のコメントを入力してください"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mx-4 mb-4 rounded-lg px-3 py-2 text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Submit button */}
        {!isApproved && canSubmit && (
          <div className="border-t border-gray-200 px-4 py-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? '保存中...'
                : existingEvaluation
                  ? '評価を更新'
                  : '評価を保存'}
            </button>
          </div>
        )}

        {/* Worker-only: save self evaluation */}
        {isWorker && !isApproved && existingEvaluation && (
          <div className="border-t border-gray-200 px-4 py-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                setMessage(null);
                const supabase = createClient();
                const { error } = await supabase
                  .from('final_evaluations')
                  .update({ scores_self: scoresSelf })
                  .eq('id', existingEvaluation.id);
                setIsSubmitting(false);
                if (error) {
                  setMessage({ type: 'error', text: `保存に失敗しました: ${error.message}` });
                } else {
                  setMessage({ type: 'success', text: '本人評価を保存しました' });
                  router.refresh();
                }
              }}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? '保存中...' : '本人評価を保存'}
            </button>
            <p className="mt-1 text-center text-xs text-gray-400">
              本人評価のみ編集・保存できます
            </p>
          </div>
        )}

        {isApproved && (
          <div className="border-t border-gray-200 px-4 py-3">
            <p className="text-center text-sm text-gray-500">
              この評価は承認済みのため編集できません
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
