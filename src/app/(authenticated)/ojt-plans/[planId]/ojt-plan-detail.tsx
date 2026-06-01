'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { OjtPlan, EvalRating } from '@/lib/types';
import { OJT_STEPS, CHECKLIST_ITEMS } from '@/lib/types';
import CancelPlanModal from '@/components/cancel-plan-modal';
import { writeAuditLog, formatDateShort } from '@/lib/audit-log';

interface OjtPlanDetailProps {
  plan: OjtPlan & {
    worker: { id: string; name: string; profile_id: string | null };
    ojt_user: { id: string; user_initial: string; ojt_status: string } | null;
    companion: { id: string; name: string };
    creator: { id: string; name: string };
  };
  planRole: 'supervisor' | 'trainer' | 'worker' | 'viewer';
  currentUserId: string;
  currentUserName: string;
  isAlsoTrainer: boolean;
  staffList: { id: string; name: string }[];
}

const EVAL_OPTIONS: { value: EvalRating; label: string }[] = [
  { value: 'good', label: '○' },
  { value: 'fair', label: '△' },
  { value: 'poor', label: '×' },
];

function getStepLabel(step: string) {
  const found = OJT_STEPS.find((s) => s.step === step);
  return found ? `${found.number} ${found.label}` : step;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
}

export default function OjtPlanDetail({ plan, planRole, currentUserId, currentUserName, isAlsoTrainer, staffList }: OjtPlanDetailProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(plan.planned_date);
  const [editStartTime, setEditStartTime] = useState(plan.start_time ?? '');
  const [editEndTime, setEditEndTime] = useState(plan.end_time ?? '');
  const [editBreak, setEditBreak] = useState(plan.break_minutes ?? 0);
  const [editCompanionId, setEditCompanionId] = useState(plan.companion_id);
  const [editStep, setEditStep] = useState(plan.step ?? '');

  const saveEdit = async () => {
    setLoading(true); setError('');
    const supabase = createClient();
    const { error: e } = await supabase.from('ojt_plans').update({
      planned_date: editDate,
      start_time: editStartTime || null,
      end_time: editEndTime || null,
      break_minutes: editBreak,
      companion_id: editCompanionId,
      step: editStep || null,
    }).eq('id', plan.id);
    setLoading(false);
    if (e) { setError(e.message); return; }
    const stepLabel = getStepLabel(plan.step ?? '');
    const changes: string[] = [];
    if (editDate !== plan.planned_date) changes.push(`予定日を ${formatDateShort(plan.planned_date)} → ${formatDateShort(editDate)} に変更`);
    if (editStartTime !== (plan.start_time ?? '')) changes.push(`開始時間を変更`);
    if (editEndTime !== (plan.end_time ?? '')) changes.push(`終了時間を変更`);
    if (editCompanionId !== plan.companion_id) {
      const newName = staffList.find((s) => s.id === editCompanionId)?.name ?? '';
      changes.push(`同行者を ${plan.companion.name} → ${newName} に変更`);
    }
    if (editStep !== (plan.step ?? '')) changes.push(`ステップを ${stepLabel} → ${getStepLabel(editStep)} に変更`);
    if (changes.length > 0) {
      writeAuditLog({
        actorId: currentUserId, actorName: currentUserName,
        action: 'update', targetTable: 'ojt_plans', targetId: plan.id,
        targetLabel: plan.worker.name,
        description: `${plan.worker.name}のOJT予定（${stepLabel}）を編集: ${changes.join('、')}`,
      });
    }
    setEditing(false);
    setSuccess('予定を更新しました');
    router.refresh();
  };

  // Trainer state
  const [trainerEvals, setTrainerEvals] = useState<Record<number, EvalRating>>(
    (plan.trainer_eval as Record<string, EvalRating>)
      ? Object.fromEntries(Object.entries(plan.trainer_eval as Record<string, EvalRating>).map(([k, v]) => [Number(k), v]))
      : {}
  );
  const [trainerComment, setTrainerComment] = useState(plan.trainer_comment ?? '');
  const [trainerCustom, setTrainerCustom] = useState(plan.trainer_custom_content ?? '');
  const [trainerResult, setTrainerResult] = useState(plan.result ?? 'pass');

  // Worker state
  const [workerEvals, setWorkerEvals] = useState<Record<number, EvalRating>>(
    (plan.worker_eval as Record<string, EvalRating>)
      ? Object.fromEntries(Object.entries(plan.worker_eval as Record<string, EvalRating>).map(([k, v]) => [Number(k), v]))
      : {}
  );
  const [workerComment, setWorkerComment] = useState(plan.worker_comment ?? '');
  const [workerCustom, setWorkerCustom] = useState(plan.worker_custom_content ?? '');

  // Supervisor state
  const [fbTrainer, setFbTrainer] = useState(plan.supervisor_comment_to_trainer ?? '');
  const [fbWorker, setFbWorker] = useState(plan.supervisor_comment_to_worker ?? '');

  const trainerDone = !!plan.trainer_completed_at;
  const workerDone = !!plan.worker_completed_at;
  const supervisorDone = !!plan.supervisor_completed_at;
  const bothDone = trainerDone && workerDone;

  // Check if current time is before planned end time
  const isBeforeEndTime = () => {
    if (!plan.end_time || !plan.planned_date) return false;
    const now = new Date();
    const endDateTime = new Date(`${plan.planned_date}T${plan.end_time}`);
    return now < endDateTime;
  };

  const saveTrainer = async () => {
    if (isBeforeEndTime()) {
      setError(`研修終了時間（${plan.end_time?.slice(0, 5)}）以降に入力してください`);
      return;
    }
    setLoading(true); setError('');
    const supabase = createClient();
    const { error: e } = await supabase.from('ojt_plans').update({
      trainer_eval: trainerEvals,
      trainer_comment: trainerComment.trim() || null,
      trainer_custom_content: trainerCustom.trim() || null,
      trainer_completed_at: new Date().toISOString(),
      result: trainerResult,
      status: 'in_progress',
    }).eq('id', plan.id);
    setLoading(false);
    if (e) { setError(e.message); return; }
    writeAuditLog({
      actorId: currentUserId, actorName: currentUserName,
      action: 'update', targetTable: 'ojt_plans', targetId: plan.id,
      targetLabel: plan.worker.name,
      description: `${plan.worker.name}のOJT予定（${getStepLabel(plan.step ?? '')}）に同行者入力を完了`,
    });
    if (plan.worker_completed_at) {
      const { data: supervisors } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'supervisor'])
        .eq('is_archived', false);
      if (supervisors && supervisors.length > 0) {
        await supabase.from('notifications').insert(
          supervisors.map((s) => ({
            user_id: s.id,
            title: 'OJT記録の確認依頼',
            message: `${plan.worker.name}のOJT（${getStepLabel(plan.step ?? '')}）の同行者・本人入力が完了しました。確認・承認をお願いします。`,
            is_read: false,
            link: `/ojt-plans/${plan.id}`,
          }))
        );
      }
    }
    setSuccess('同行者の入力を保存しました');
    router.refresh();
  };

  const saveWorker = async () => {
    if (isBeforeEndTime()) {
      setError(`研修終了時間（${plan.end_time?.slice(0, 5)}）以降に入力してください`);
      return;
    }
    setLoading(true); setError('');
    const supabase = createClient();
    const { error: e } = await supabase.from('ojt_plans').update({
      worker_eval: workerEvals,
      worker_comment: workerComment.trim() || null,
      worker_custom_content: workerCustom.trim() || null,
      worker_completed_at: new Date().toISOString(),
      status: 'in_progress',
    }).eq('id', plan.id);
    setLoading(false);
    if (e) { setError(e.message); return; }
    writeAuditLog({
      actorId: currentUserId, actorName: currentUserName,
      action: 'update', targetTable: 'ojt_plans', targetId: plan.id,
      targetLabel: plan.worker.name,
      description: `${plan.worker.name}のOJT予定（${getStepLabel(plan.step ?? '')}）に本人入力を完了`,
    });
    if (plan.trainer_completed_at) {
      const { data: supervisors } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'supervisor'])
        .eq('is_archived', false);
      if (supervisors && supervisors.length > 0) {
        await supabase.from('notifications').insert(
          supervisors.map((s) => ({
            user_id: s.id,
            title: 'OJT記録の確認依頼',
            message: `${plan.worker.name}のOJT（${getStepLabel(plan.step ?? '')}）の同行者・本人入力が完了しました。確認・承認をお願いします。`,
            is_read: false,
            link: `/ojt-plans/${plan.id}`,
          }))
        );
      }
    }
    setSuccess('本人の入力を保存しました');
    router.refresh();
  };

  const saveSupervisor = async () => {
    setLoading(true); setError('');
    const supabase = createClient();
    const { error: e } = await supabase.from('ojt_plans').update({
      supervisor_comment_to_trainer: fbTrainer.trim() || null,
      supervisor_comment_to_worker: fbWorker.trim() || null,
      supervisor_completed_at: new Date().toISOString(),
      supervisor_id: currentUserId,
      status: 'completed',
    }).eq('id', plan.id);
    setLoading(false);
    if (e) { setError(e.message); return; }
    // Auto-create ojt_record from 3-step flow
    if (plan.ojt_user_id) {
      const { data: existingRecord } = await supabase
        .from('ojt_records')
        .select('id')
        .eq('ojt_plan_id', plan.id)
        .maybeSingle();
      if (!existingRecord) {
        // Calculate attempt number
        const { count } = await supabase
          .from('ojt_records')
          .select('id', { count: 'exact', head: true })
          .eq('ojt_user_id', plan.ojt_user_id)
          .eq('step', plan.step);
        await supabase.from('ojt_records').insert({
          worker_id: plan.worker_id,
          ojt_user_id: plan.ojt_user_id,
          step: plan.step,
          attempt_number: (count ?? 0) + 1,
          date: plan.planned_date,
          companion_id: plan.companion_id,
          content: plan.trainer_custom_content ?? '',
          checklist_self: plan.worker_eval ? Object.values(plan.worker_eval as Record<string, string>) : [],
          checklist_trainer: plan.trainer_eval ? Object.values(plan.trainer_eval as Record<string, string>) : [],
          result: plan.result ?? 'pass',
          manager_comment: plan.supervisor_comment_to_worker ?? null,
          worker_comment: plan.worker_comment ?? null,
          notes: '3者フローより自動登録',
          ojt_plan_id: plan.id,
        });
      }
    }

    writeAuditLog({
      actorId: currentUserId, actorName: currentUserName,
      action: 'update', targetTable: 'ojt_plans', targetId: plan.id,
      targetLabel: plan.worker.name,
      description: `${plan.worker.name}のOJT予定（${getStepLabel(plan.step ?? '')}）に指導責任者フィードバックを完了`,
    });
    setSuccess('フィードバックを保存しました');
    router.refresh();
  };

  // Format completion datetime
  const fmtDateTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // Check early completion
  const isEarlyCompletion = (completedAt: string | null) => {
    if (!completedAt || !plan.end_time || !plan.planned_date) return false;
    const completed = new Date(completedAt);
    const endDateTime = new Date(`${plan.planned_date}T${plan.end_time}`);
    return completed < endDateTime;
  };

  // Undo trainer (companion) completion
  const undoTrainerCompletion = async () => {
    if (!confirm('同行者の入力を取り消しますか？入力内容はリセットされます。')) return;
    setLoading(true);
    const supabase = createClient();
    const newHistory1 = [
      ...(plan.cancel_history ?? []),
      { date: new Date().toISOString(), action: 'undo_trainer', reason: '同行者の記録入力を取り消し', by: currentUserId, byName: currentUserName },
    ];
    const { error: e } = await supabase.from('ojt_plans').update({
      trainer_completed_at: null,
      trainer_eval: null,
      trainer_comment: null,
      trainer_custom_content: null,
      result: null,
      status: 'scheduled',
      cancel_history: newHistory1,
    }).eq('id', plan.id);
    setLoading(false);
    if (e) { setError(e.message); return; }
    writeAuditLog({
      actorId: currentUserId, actorName: currentUserName,
      action: 'update', targetTable: 'ojt_plans', targetId: plan.id,
      targetLabel: plan.worker.name,
      description: `${plan.worker.name}のOJT予定（${getStepLabel(plan.step ?? '')}）の同行者記録入力を取り消し`,
    });
    setSuccess('同行者の入力を取り消しました');
    window.location.reload();
  };

  // Undo worker completion
  const undoWorkerCompletion = async () => {
    if (!confirm('本人の入力を取り消しますか？入力内容はリセットされます。')) return;
    setLoading(true);
    const supabase = createClient();
    const newHistory2 = [
      ...(plan.cancel_history ?? []),
      { date: new Date().toISOString(), action: 'undo_worker', reason: '本人の記録入力を取り消し', by: currentUserId, byName: currentUserName },
    ];
    const { error: e } = await supabase.from('ojt_plans').update({
      worker_completed_at: null,
      worker_eval: null,
      worker_comment: null,
      worker_custom_content: null,
      status: plan.trainer_completed_at ? 'in_progress' : 'scheduled',
      cancel_history: newHistory2,
    }).eq('id', plan.id);
    setLoading(false);
    if (e) { setError(e.message); return; }
    writeAuditLog({
      actorId: currentUserId, actorName: currentUserName,
      action: 'update', targetTable: 'ojt_plans', targetId: plan.id,
      targetLabel: plan.worker.name,
      description: `${plan.worker.name}のOJT予定（${getStepLabel(plan.step ?? '')}）の本人記録入力を取り消し`,
    });
    setSuccess('本人の入力を取り消しました');
    window.location.reload();
  };

  function EvalSelector({ value, onChange }: { value: EvalRating | undefined; onChange: (v: EvalRating) => void }) {
    return (
      <div className="flex gap-1">
        {EVAL_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`h-7 w-7 rounded-full text-xs font-bold transition-colors ${
              value === opt.value
                ? opt.value === 'good' ? 'bg-green-500 text-white'
                  : opt.value === 'fair' ? 'bg-yellow-500 text-white'
                  : 'bg-red-500 text-white'
                : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      {/* Plan info */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {!editing ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-xs text-gray-500">ステップ</span><p className="font-medium">{getStepLabel(plan.step)}</p></div>
            <div><span className="text-xs text-gray-500">予定日</span><p className="font-medium">{formatDate(plan.planned_date)}</p></div>
            <div><span className="text-xs text-gray-500">同行者</span><p className="font-medium">{plan.companion.name}</p></div>
            <div><span className="text-xs text-gray-500">時間</span><p className="font-medium">{plan.start_time ?? '—'} 〜 {plan.end_time ?? '—'}</p></div>
            {(plan.break_minutes ?? 0) > 0 && (
              <div><span className="text-xs text-gray-500">休憩時間</span><p className="font-medium">{plan.break_minutes}分</p></div>
            )}
            {planRole === 'supervisor' && plan.status === 'scheduled' && (
              <div className="col-span-2">
                <button onClick={() => setEditing(true)} className="text-xs font-medium text-blue-600 hover:text-blue-800">予定を編集</button>
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
            {/* Companion selector */}
            <div>
              <label className="text-xs text-gray-500">同行者</label>
              <select value={editCompanionId} onChange={(e) => setEditCompanionId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {/* Step selector */}
            <div>
              <label className="text-xs text-gray-500">OJTステップ</label>
              <select value={editStep} onChange={(e) => setEditStep(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                {OJT_STEPS.map((s) => (
                  <option key={s.step} value={s.step}>{s.number} {s.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100">キャンセル</button>
              <button onClick={saveEdit} disabled={loading} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-1">
          <div className={`flex-1 h-2 rounded-full ${plan.status === 'cancelled' ? 'bg-gray-200' : trainerDone ? 'bg-green-400' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-2 rounded-full ${plan.status === 'cancelled' ? 'bg-gray-200' : workerDone ? 'bg-green-400' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-2 rounded-full ${plan.status === 'cancelled' ? 'bg-gray-200' : supervisorDone ? 'bg-green-400' : 'bg-gray-200'}`} />
        </div>
        {plan.status === 'cancelled' ? (
          <p className="mt-1 text-center text-[10px] text-gray-400">この予定は取り消されました</p>
        ) : (
          <div className="mt-1 flex text-[10px] text-gray-400">
            <span className="flex-1 text-center">{trainerDone ? '✓ 同行者' : '同行者未入力'}</span>
            <span className="flex-1 text-center">{workerDone ? '✓ 本人' : '本人未入力'}</span>
            <span className="flex-1 text-center">{supervisorDone ? '✓ 責任者確認済' : '責任者確認待ち'}</span>
          </div>
        )}

        {/* Supervisor: completion details + undo + early warning (not shown for cancelled plans) */}
        {planRole === 'supervisor' && plan.status !== 'cancelled' && (
          <div className="mt-3 space-y-1.5 rounded-md border border-gray-100 bg-gray-50 p-2.5">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] ${trainerDone ? 'text-green-700' : 'text-gray-400'}`}>
                {trainerDone ? `✓ 同行者: ${fmtDateTime(plan.trainer_completed_at)}` : '同行者: 未入力'}
              </span>
              {trainerDone && !supervisorDone && (
                <button onClick={undoTrainerCompletion} disabled={loading} className="text-[10px] font-medium text-red-500 hover:text-red-700 disabled:opacity-50">取り消す</button>
              )}
            </div>
            {trainerDone && isEarlyCompletion(plan.trainer_completed_at) && (
              <p className="text-[10px] text-amber-600">⚠ 予定終了時間（{plan.end_time?.slice(0, 5)}）より前に入力完了</p>
            )}
            <div className="flex items-center justify-between">
              <span className={`text-[11px] ${workerDone ? 'text-green-700' : 'text-gray-400'}`}>
                {workerDone ? `✓ 本人: ${fmtDateTime(plan.worker_completed_at)}` : '本人: 未入力'}
              </span>
              {workerDone && !supervisorDone && (
                <button onClick={undoWorkerCompletion} disabled={loading} className="text-[10px] font-medium text-red-500 hover:text-red-700 disabled:opacity-50">取り消す</button>
              )}
            </div>
            {workerDone && isEarlyCompletion(plan.worker_completed_at) && (
              <p className="text-[10px] text-amber-600">⚠ 予定終了時間（{plan.end_time?.slice(0, 5)}）より前に入力完了</p>
            )}
            <div>
              <span className={`text-[11px] ${supervisorDone ? 'text-green-700' : 'text-gray-400'}`}>
                {supervisorDone ? `✓ 責任者確認: ${fmtDateTime(plan.supervisor_completed_at)}` : '責任者確認: 未'}
              </span>
            </div>
          </div>
        )}

        {planRole === 'supervisor' && plan.status !== 'cancelled' && plan.status !== 'completed' && (
          <div className="mt-3">
            <button onClick={() => setShowCancel(true)} className="text-xs font-medium text-red-500 hover:text-red-700">
              取り消し・延期
            </button>
          </div>
        )}

        {plan.status === 'cancelled' && (
          <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-2">
            <p className="text-xs font-medium text-red-700">この予定は取り消されました</p>
          </div>
        )}
      </div>

      {showCancel && (
        <CancelPlanModal
          planId={plan.id}
          tableName="ojt_plans"
          currentHistory={[]}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          workerName={plan.worker.name}
          currentDate={plan.planned_date}
          onClose={() => setShowCancel(false)}
        />
      )}

      {/* Trainer input */}
      {(planRole === 'trainer' || (planRole === 'supervisor' && isAlsoTrainer)) && !trainerDone && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-blue-800">同行者入力</h3>
          <p className="mb-3 text-xs text-blue-600">到達目標チェックシートに評価を入力してください。</p>

          <div className="space-y-2 mb-4">
            {CHECKLIST_ITEMS.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 rounded bg-white/60 px-3 py-2">
                <span className="text-xs text-gray-700 flex-1">{item}</span>
                <EvalSelector value={trainerEvals[idx]} onChange={(v) => setTrainerEvals({ ...trainerEvals, [idx]: v })} />
              </div>
            ))}
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">その他（自由記入）</label>
            <textarea value={trainerCustom} onChange={(e) => setTrainerCustom(e.target.value)} rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="予定外の実施内容など" />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">同行者コメント</label>
            <textarea value={trainerComment} onChange={(e) => setTrainerComment(e.target.value)} rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="指導の所感・気づき" />
          </div>

          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-gray-700">判定</p>
            <div className="flex gap-2">
              {[{ v: 'pass', l: '次へ進む', c: 'border-green-500 bg-green-50 text-green-700' },
                { v: 'redo', l: '再実施', c: 'border-yellow-500 bg-yellow-50 text-yellow-700' },
                { v: 'rollback', l: '差し戻し', c: 'border-red-500 bg-red-50 text-red-700' },
              ].map((opt) => (
                <button key={opt.v} type="button" onClick={() => setTrainerResult(opt.v)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    trainerResult === opt.v ? opt.c : 'border-gray-200 bg-white text-gray-500'
                  }`}
                >{opt.l}</button>
              ))}
            </div>
          </div>

          <button onClick={saveTrainer} disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? '保存中...' : '入力を完了する'}
          </button>
        </div>
      )}

      {/* Worker input */}
      {planRole === 'worker' && !workerDone && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-green-800">本人入力</h3>
          <p className="mb-3 text-xs text-green-600">自己評価を入力してください。</p>

          <div className="space-y-2 mb-4">
            {CHECKLIST_ITEMS.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 rounded bg-white/60 px-3 py-2">
                <span className="text-xs text-gray-700 flex-1">{item}</span>
                <EvalSelector value={workerEvals[idx]} onChange={(v) => setWorkerEvals({ ...workerEvals, [idx]: v })} />
              </div>
            ))}
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">その他（自由記入）</label>
            <textarea value={workerCustom} onChange={(e) => setWorkerCustom(e.target.value)} rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="気づきや感想" />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">本人コメント</label>
            <textarea value={workerComment} onChange={(e) => setWorkerComment(e.target.value)} rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="振り返り・理解度の自己評価" />
          </div>

          <button onClick={saveWorker} disabled={loading}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            {loading ? '保存中...' : '入力を完了する'}
          </button>
        </div>
      )}

      {/* Waiting messages */}
      {(planRole === 'trainer' || (planRole === 'supervisor' && isAlsoTrainer)) && trainerDone && !bothDone && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-sm text-gray-500">同行者の入力は完了しています。本人の入力を待っています。</p>
        </div>
      )}
      {planRole === 'worker' && workerDone && !bothDone && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-sm text-gray-500">本人の入力は完了しています。同行者の入力を待っています。</p>
        </div>
      )}

      {/* Comparison view */}
      {bothDone && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">到達目標チェックシート比較</h3>
          </div>

          <div className="p-4">
            <div className="rounded-md border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-xs font-medium text-gray-500">項目</span>
                <span className="w-16 text-center text-xs font-medium text-blue-600">同行者</span>
                <span className="w-16 text-center text-xs font-medium text-green-600">本人</span>
              </div>
              {CHECKLIST_ITEMS.map((item, idx) => {
                const tVal = (plan.trainer_eval as Record<string, string>)?.[String(idx)];
                const wVal = (plan.worker_eval as Record<string, string>)?.[String(idx)];
                const mismatch = tVal && wVal && tVal !== wVal;
                const evalLabel = (v: string | undefined) => v === 'good' ? '○' : v === 'fair' ? '△' : v === 'poor' ? '×' : '—';
                return (
                  <div key={idx} className={`grid grid-cols-[1fr_auto_auto] gap-2 border-b border-gray-100 px-3 py-1.5 ${mismatch ? 'bg-amber-50' : ''}`}>
                    <span className="text-xs text-gray-700">{item}</span>
                    <span className="w-16 text-center text-xs font-medium">{evalLabel(tVal)}</span>
                    <span className="w-16 text-center text-xs font-medium">{evalLabel(wVal)}</span>
                  </div>
                );
              })}
            </div>

            {/* Comments comparison */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-blue-600 mb-1">同行者コメント</p>
                <p className="text-xs text-gray-700 bg-blue-50 rounded p-2">{plan.trainer_comment || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-green-600 mb-1">本人コメント</p>
                <p className="text-xs text-gray-700 bg-green-50 rounded p-2">{plan.worker_comment || '—'}</p>
              </div>
            </div>

            {plan.result && (
              <div className="mt-3">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                  plan.result === 'pass' ? 'bg-green-100 text-green-700' : plan.result === 'redo' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                }`}>
                  判定: {plan.result === 'pass' ? '次へ進む' : plan.result === 'redo' ? '再実施' : '差し戻し'}
                </span>
              </div>
            )}
          </div>

          {/* Supervisor feedback */}
          {planRole === 'supervisor' && !supervisorDone && (
            <div className="border-t border-gray-200 p-4 bg-purple-50">
              <h4 className="mb-3 text-sm font-semibold text-purple-800">フィードバック入力</h4>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  同行者へのフィードバック <span className="text-xs text-gray-400">（同行者のみ閲覧可）</span>
                </label>
                <textarea value={fbTrainer} onChange={(e) => setFbTrainer(e.target.value)} rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="指導方法や改善点" />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  外国人へのフィードバック <span className="text-xs text-gray-400">（外国人・同行者が閲覧可）</span>
                </label>
                <textarea value={fbWorker} onChange={(e) => setFbWorker(e.target.value)} rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="学習の進捗や課題" />
              </div>
              <button onClick={saveSupervisor} disabled={loading}
                className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                {loading ? '保存中...' : 'フィードバックを送信'}
              </button>
            </div>
          )}

          {supervisorDone && (
            <div className="border-t border-gray-200 p-4">
              <h4 className="mb-2 text-sm font-semibold text-gray-900">フィードバック</h4>
              {(planRole === 'supervisor' || planRole === 'trainer') && plan.supervisor_comment_to_trainer && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-purple-600 mb-1">同行者へ</p>
                  <p className="text-xs text-gray-700 bg-purple-50 rounded p-2">{plan.supervisor_comment_to_trainer}</p>
                </div>
              )}
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
