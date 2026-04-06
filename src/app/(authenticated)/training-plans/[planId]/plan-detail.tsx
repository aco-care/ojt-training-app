'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { TrainingItem, TrainingPlan } from '@/lib/types';
import CancelPlanModal from '@/components/cancel-plan-modal';

interface PlanDetailProps {
  plan: TrainingPlan & {
    worker: { id: string; name: string; profile_id: string | null };
    item: TrainingItem & { subtopics: { id: string; title: string }[] };
    trainer: { id: string; name: string };
    creator: { id: string; name: string };
  };
  planRole: 'supervisor' | 'trainer' | 'worker' | 'viewer';
  currentUserId: string;
}



function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
}

export default function PlanDetail({ plan, planRole, currentUserId }: PlanDetailProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(plan.planned_date);
  const [editStartTime, setEditStartTime] = useState(plan.start_time ?? '');
  const [editEndTime, setEditEndTime] = useState(plan.end_time ?? '');
  const [editMethod, setEditMethod] = useState(plan.method ?? '');
  const [editBreak, setEditBreak] = useState(plan.break_minutes ?? 0);

  const saveEdit = async () => {
    setLoading(true); setError('');
    const supabase = createClient();
    const { error: e } = await supabase.from('training_plans').update({
      planned_date: editDate,
      start_time: editStartTime || null,
      end_time: editEndTime || null,
      method: editMethod || null,
      break_minutes: editBreak,
    }).eq('id', plan.id);
    setLoading(false);
    if (e) { setError(e.message); return; }
    setEditing(false);
    setSuccess('予定を更新しました');
    router.refresh();
  };

  const subtopics = plan.item.subtopics ?? [];

  // Trainer input state
  const [trainerSubtopics, setTrainerSubtopics] = useState<string[]>(plan.trainer_checked_subtopics ?? []);
  const [trainerComment, setTrainerComment] = useState(plan.trainer_comment ?? '');
  const [trainerCustom, setTrainerCustom] = useState(plan.trainer_custom_content ?? '');

  // Worker input state
  const [workerSubtopics, setWorkerSubtopics] = useState<string[]>(plan.worker_checked_subtopics ?? []);
  const [workerComment, setWorkerComment] = useState(plan.worker_comment ?? '');
  const [workerCustom, setWorkerCustom] = useState(plan.worker_custom_content ?? '');

  // Supervisor feedback
  const [feedbackToTrainer, setFeedbackToTrainer] = useState(plan.supervisor_comment_to_trainer ?? '');
  const [feedbackToWorker, setFeedbackToWorker] = useState(plan.supervisor_comment_to_worker ?? '');

  const trainerDone = !!plan.trainer_completed_at;
  const workerDone = !!plan.worker_completed_at;
  const supervisorDone = !!plan.supervisor_completed_at;
  const bothDone = trainerDone && workerDone;

  const toggleSubtopic = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  // Save trainer input
  const saveTrainer = async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: e } = await supabase
      .from('training_plans')
      .update({
        trainer_checked_subtopics: trainerSubtopics,
        trainer_comment: trainerComment.trim() || null,
        trainer_custom_content: trainerCustom.trim() || null,
        trainer_completed_at: new Date().toISOString(),
        status: plan.worker_completed_at ? 'completed' : 'in_progress',
      })
      .eq('id', plan.id);
    setLoading(false);
    if (e) { setError(e.message); return; }
    setSuccess('指導者の入力を保存しました');
    router.refresh();
  };

  // Save worker input
  const saveWorker = async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: e } = await supabase
      .from('training_plans')
      .update({
        worker_checked_subtopics: workerSubtopics,
        worker_comment: workerComment.trim() || null,
        worker_custom_content: workerCustom.trim() || null,
        worker_completed_at: new Date().toISOString(),
        status: plan.trainer_completed_at ? 'completed' : 'in_progress',
      })
      .eq('id', plan.id);
    setLoading(false);
    if (e) { setError(e.message); return; }
    setSuccess('本人の入力を保存しました');
    router.refresh();
  };

  // Save supervisor feedback
  const saveSupervisor = async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: e } = await supabase
      .from('training_plans')
      .update({
        supervisor_comment_to_trainer: feedbackToTrainer.trim() || null,
        supervisor_comment_to_worker: feedbackToWorker.trim() || null,
        supervisor_completed_at: new Date().toISOString(),
        supervisor_id: currentUserId,
        status: 'completed',
      })
      .eq('id', plan.id);
    setLoading(false);
    if (e) { setError(e.message); return; }
    setSuccess('フィードバックを保存しました');
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {/* Plan info */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {!editing ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-xs text-gray-500">予定日</span><p className="font-medium">{formatDate(plan.planned_date)}</p></div>
            <div><span className="text-xs text-gray-500">指導者</span><p className="font-medium">{plan.trainer.name}</p></div>
            <div><span className="text-xs text-gray-500">時間</span><p className="font-medium">{plan.start_time ?? '—'} 〜 {plan.end_time ?? '—'}</p></div>
            <div><span className="text-xs text-gray-500">形式</span><p className="font-medium">{plan.method ?? '—'}</p></div>
            {(plan.break_minutes ?? 0) > 0 && (
              <div><span className="text-xs text-gray-500">休憩時間</span><p className="font-medium">{plan.break_minutes}分</p></div>
            )}
            {planRole === 'supervisor' && plan.status === 'scheduled' && (
              <div className="col-span-2">
                <button onClick={() => setEditing(true)} className="text-xs font-medium text-blue-600 hover:text-blue-800">
                  予定を編集
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-700">予定を編集</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">予定日</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">形式</label>
                <select value={editMethod} onChange={(e) => setEditMethod(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                  <option>対面</option><option>OJT</option><option>ロールプレイ</option><option>シミュレーション</option><option>オンライン</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">開始</label>
                <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">終了</label>
                <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">休憩（分）</label>
                <input type="number" min="0" step="5" value={editBreak} onChange={(e) => setEditBreak(Math.max(0, parseInt(e.target.value) || 0))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100">キャンセル</button>
              <button onClick={saveEdit} disabled={loading} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}

        {/* 3-step progress */}
        <div className="mt-4 flex items-center gap-1">
          <div className={`flex-1 h-2 rounded-full ${trainerDone ? 'bg-green-400' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-2 rounded-full ${workerDone ? 'bg-green-400' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-2 rounded-full ${supervisorDone ? 'bg-green-400' : 'bg-gray-200'}`} />
        </div>
        <div className="mt-1 flex text-[10px] text-gray-400">
          <span className="flex-1 text-center">{trainerDone ? '✓ 指導者入力済' : '指導者未入力'}</span>
          <span className="flex-1 text-center">{workerDone ? '✓ 本人入力済' : '本人未入力'}</span>
          <span className="flex-1 text-center">{supervisorDone ? '✓ FB済' : 'FB未'}</span>
        </div>
        {/* Cancel/Postpone button */}
        {planRole === 'supervisor' && plan.status !== 'cancelled' && plan.status !== 'completed' && (
          <div className="mt-3">
            <button
              onClick={() => setShowCancel(true)}
              className="text-xs font-medium text-red-500 hover:text-red-700"
            >
              取り消し・延期
            </button>
          </div>
        )}

        {plan.status === 'cancelled' && plan.cancel_reason && (
          <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-2">
            <p className="text-xs font-medium text-red-700">取り消し理由: {plan.cancel_reason}</p>
          </div>
        )}

        {/* Cancel history */}
        {plan.cancel_history && plan.cancel_history.length > 0 && (
          <div className="mt-2">
            <p className="text-[10px] font-medium text-gray-500 mb-1">変更履歴</p>
            {plan.cancel_history.map((h, i) => (
              <p key={i} className="text-[10px] text-gray-400">
                {new Date(h.date).toLocaleDateString('ja-JP')} {h.action === 'cancel' ? '取消' : '延期'}: {h.reason} ({h.byName})
              </p>
            ))}
          </div>
        )}
      </div>

      {showCancel && (
        <CancelPlanModal
          planId={plan.id}
          tableName="training_plans"
          currentHistory={plan.cancel_history ?? []}
          currentUserId={currentUserId}
          currentUserName="管理者"
          currentDate={plan.planned_date}
          onClose={() => setShowCancel(false)}
        />
      )}

      {/* ===== STEP 2: 当日入力 ===== */}

      {/* Trainer input form */}
      {planRole === 'trainer' && !trainerDone && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-blue-800">指導者入力</h3>
          <p className="mb-3 text-xs text-blue-600">実施した項目にチェックし、コメントを入力してください。</p>

          <div className="space-y-1 mb-3">
            {subtopics.map((st) => (
              <label key={st.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-blue-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trainerSubtopics.includes(st.id)}
                  onChange={() => toggleSubtopic(trainerSubtopics, setTrainerSubtopics, st.id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-xs text-gray-700">{st.title}</span>
              </label>
            ))}
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">その他（自由記入）</label>
            <textarea
              value={trainerCustom}
              onChange={(e) => setTrainerCustom(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="予定外に実施した内容など"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">指導者コメント</label>
            <textarea
              value={trainerComment}
              onChange={(e) => setTrainerComment(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="指導の所感・気づきを記入"
            />
          </div>

          <button
            onClick={saveTrainer}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '保存中...' : '入力を完了する'}
          </button>
        </div>
      )}

      {/* Worker input form */}
      {planRole === 'worker' && !workerDone && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-green-800">本人入力</h3>
          <p className="mb-3 text-xs text-green-600">受けたと思う項目にチェックし、コメントを入力してください。</p>

          <div className="space-y-1 mb-3">
            {subtopics.map((st) => (
              <label key={st.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-green-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={workerSubtopics.includes(st.id)}
                  onChange={() => toggleSubtopic(workerSubtopics, setWorkerSubtopics, st.id)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600"
                />
                <span className="text-xs text-gray-700">{st.title}</span>
              </label>
            ))}
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">その他（自由記入）</label>
            <textarea
              value={workerCustom}
              onChange={(e) => setWorkerCustom(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="その他受けた内容や気づき"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">本人コメント</label>
            <textarea
              value={workerComment}
              onChange={(e) => setWorkerComment(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="研修の振り返り・理解度の自己評価"
            />
          </div>

          <button
            onClick={saveWorker}
            disabled={loading}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? '保存中...' : '入力を完了する'}
          </button>
        </div>
      )}

      {/* Already submitted message */}
      {planRole === 'trainer' && trainerDone && !bothDone && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-sm text-gray-500">指導者の入力は完了しています。本人の入力を待っています。</p>
        </div>
      )}
      {planRole === 'worker' && workerDone && !bothDone && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-sm text-gray-500">本人の入力は完了しています。指導者の入力を待っています。</p>
        </div>
      )}

      {/* ===== STEP 3: Supervisor comparison & feedback ===== */}
      {bothDone && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">入力比較</h3>
            <p className="text-xs text-gray-500">指導者と本人の入力を比較できます</p>
          </div>

          <div className="p-4">
            {/* Subtopics comparison */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-gray-700">チェックした項目</p>
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="text-xs font-medium text-gray-500">項目</span>
                  <span className="w-14 text-center text-xs font-medium text-blue-600">指導者</span>
                  <span className="w-14 text-center text-xs font-medium text-green-600">本人</span>
                </div>
                {subtopics.map((st) => {
                  const trainerChecked = (plan.trainer_checked_subtopics ?? []).includes(st.id);
                  const workerChecked = (plan.worker_checked_subtopics ?? []).includes(st.id);
                  const mismatch = trainerChecked !== workerChecked;
                  return (
                    <div
                      key={st.id}
                      className={`grid grid-cols-[1fr_auto_auto] gap-2 border-b border-gray-100 px-3 py-1.5 ${
                        mismatch ? 'bg-amber-50' : ''
                      }`}
                    >
                      <span className="text-xs text-gray-700">{st.title}</span>
                      <span className="w-14 text-center text-xs">{trainerChecked ? '✓' : '—'}</span>
                      <span className="w-14 text-center text-xs">{workerChecked ? '✓' : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom content comparison */}
            {(plan.trainer_custom_content || plan.worker_custom_content) && (
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-blue-600 mb-1">指導者: その他記入</p>
                  <p className="text-xs text-gray-700 bg-blue-50 rounded p-2">{plan.trainer_custom_content || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-green-600 mb-1">本人: その他記入</p>
                  <p className="text-xs text-gray-700 bg-green-50 rounded p-2">{plan.worker_custom_content || '—'}</p>
                </div>
              </div>
            )}

            {/* Comment comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-blue-600 mb-1">指導者コメント</p>
                <p className="text-xs text-gray-700 bg-blue-50 rounded p-2">{plan.trainer_comment || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-green-600 mb-1">本人コメント</p>
                <p className="text-xs text-gray-700 bg-green-50 rounded p-2">{plan.worker_comment || '—'}</p>
              </div>
            </div>
          </div>

          {/* Supervisor feedback form */}
          {planRole === 'supervisor' && !supervisorDone && (
            <div className="border-t border-gray-200 p-4 bg-purple-50">
              <h4 className="mb-3 text-sm font-semibold text-purple-800">フィードバック入力</h4>

              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  指導者へのフィードバック <span className="text-xs text-gray-400">（指導者のみ閲覧可）</span>
                </label>
                <textarea
                  value={feedbackToTrainer}
                  onChange={(e) => setFeedbackToTrainer(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="指導方法や改善点について"
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  外国人へのフィードバック <span className="text-xs text-gray-400">（外国人・指導者が閲覧可）</span>
                </label>
                <textarea
                  value={feedbackToWorker}
                  onChange={(e) => setFeedbackToWorker(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="学習の進捗や次回の課題について"
                />
              </div>

              <button
                onClick={saveSupervisor}
                disabled={loading}
                className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? '保存中...' : 'フィードバックを送信'}
              </button>
            </div>
          )}

          {/* Show feedback when done */}
          {supervisorDone && (
            <div className="border-t border-gray-200 p-4">
              <h4 className="mb-2 text-sm font-semibold text-gray-900">フィードバック</h4>

              {/* Trainer feedback - visible to trainer and supervisor */}
              {(planRole === 'supervisor' || planRole === 'trainer') && plan.supervisor_comment_to_trainer && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-purple-600 mb-1">指導者へ</p>
                  <p className="text-xs text-gray-700 bg-purple-50 rounded p-2">{plan.supervisor_comment_to_trainer}</p>
                </div>
              )}

              {/* Worker feedback - visible to all */}
              {plan.supervisor_comment_to_worker && (
                <div>
                  <p className="text-xs font-medium text-purple-600 mb-1">外国人へ</p>
                  <p className="text-xs text-gray-700 bg-purple-50 rounded p-2">{plan.supervisor_comment_to_worker}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
