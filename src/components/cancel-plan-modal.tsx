'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { CancelHistoryEntry } from '@/lib/types';
import { writeAuditLog, formatDateShort } from '@/lib/audit-log';
import { todayKey } from '@/lib/date-utils';

interface CancelPlanModalProps {
  planId: string;
  tableName: 'training_plans' | 'ojt_plans';
  currentHistory: CancelHistoryEntry[];
  currentUserId: string;
  currentUserName: string;
  workerName: string;
  currentDate: string;
  onClose: () => void;
}

export default function CancelPlanModal({
  planId,
  tableName,
  currentHistory,
  currentUserId,
  currentUserName,
  workerName,
  currentDate,
  onClose,
}: CancelPlanModalProps) {
  const router = useRouter();
  const [action, setAction] = useState<'cancel' | 'postpone'>('cancel');
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('理由を入力してください');
      return;
    }
    if (action === 'postpone' && !newDate) {
      setError('延期先の日付を選択してください');
      return;
    }

    setLoading(true);
    setError('');

    const entry: CancelHistoryEntry = {
      date: new Date().toISOString(),
      action,
      reason: reason.trim(),
      by: currentUserId,
      byName: currentUserName,
      previousDate: currentDate,
      ...(action === 'postpone' ? { newDate } : {}),
    };

    const supabase = createClient();
    const updateData: Record<string, unknown> = {
      cancel_history: [...currentHistory, entry],
      cancel_reason: reason.trim(),
    };

    if (action === 'cancel') {
      updateData.status = 'cancelled';
    } else {
      updateData.planned_date = newDate;
      // Keep status as scheduled
    }

    const { error: e } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', planId);

    setLoading(false);
    if (e) {
      setError(`保存に失敗しました: ${e.message}`);
      return;
    }

    if (action === 'cancel') {
      writeAuditLog({
        actorId: currentUserId,
        actorName: currentUserName,
        action: 'cancel',
        targetTable: tableName,
        targetId: planId,
        targetLabel: workerName,
        description: `${workerName}の予定をキャンセルしました（理由: ${reason.trim()}）`,
      });
    } else {
      writeAuditLog({
        actorId: currentUserId,
        actorName: currentUserName,
        action: 'update',
        targetTable: tableName,
        targetId: planId,
        targetLabel: workerName,
        description: `${workerName}の予定を ${formatDateShort(currentDate)} → ${formatDateShort(newDate)} に延期しました`,
      });
    }

    onClose();
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900 mb-4">予定の取り消し・延期</h3>

        {error && <div className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</div>}

        {/* Action select */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setAction('cancel')}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              action === 'cancel' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            取り消し
          </button>
          <button
            onClick={() => setAction('postpone')}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              action === 'postpone' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            延期
          </button>
        </div>

        {/* Reason */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            理由 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder={action === 'cancel' ? '取り消しの理由を入力してください' : '延期の理由を入力してください'}
          />
        </div>

        {/* New date for postpone */}
        {action === 'postpone' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              延期先の日付 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
              min={todayKey()}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            戻る
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${
              action === 'cancel' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {loading ? '処理中...' : action === 'cancel' ? '取り消す' : '延期する'}
          </button>
        </div>
      </div>
    </div>
  );
}
