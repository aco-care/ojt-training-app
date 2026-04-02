'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ApprovalActionProps {
  workerId: string;
  itemId: string;
  approvedBy: string;
}

export default function ApprovalAction({
  workerId,
  itemId,
  approvedBy,
}: ApprovalActionProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleApprove = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: upsertError } = await supabase
        .from('training_approvals')
        .upsert(
          {
            worker_id: workerId,
            item_id: itemId,
            status: 'completed' as const,
            approved_by: approvedBy,
            approved_at: new Date().toISOString(),
          },
          {
            onConflict: 'worker_id,item_id',
          }
        );

      if (upsertError) {
        setError(`承認に失敗しました: ${upsertError.message}`);
        return;
      }

      setShowConfirm(false);
      router.refresh();
    } catch {
      setError('予期しないエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showConfirm) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-green-800">
            研修完了承認
          </h3>
          <p className="mt-1 text-xs text-green-700">
            全てのサブトピックが完了し、目標時間を達成しました。この研修項目を完了として承認できます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          完了を承認する
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-yellow-800">
          承認の確認
        </h3>
        <p className="mt-1 text-xs text-yellow-700">
          この研修項目を完了として承認します。この操作は取り消せません。よろしいですか？
        </p>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setShowConfirm(false)}
          disabled={isSubmitting}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? '承認中...' : '承認する'}
        </button>
      </div>
    </div>
  );
}
