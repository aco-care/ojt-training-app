'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface EvaluationApprovalProps {
  evaluationId: string;
  approvedBy: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function EvaluationApproval({
  evaluationId,
  approvedBy,
  approvedAt,
  approvedByName,
}: EvaluationApprovalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const isApproved = !!approvedBy;

  const handleApprove = async () => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage({ type: 'error', text: 'ユーザー情報を取得できません。' });
        return;
      }

      const { error } = await supabase
        .from('final_evaluations')
        .update({
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', evaluationId);

      if (error) throw error;

      setMessage({ type: 'success', text: '承認しました。' });
      router.refresh();
    } catch (err) {
      console.error('Approval failed:', err);
      setMessage({ type: 'error', text: '承認に失敗しました。' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-base font-semibold text-gray-900">承認</h2>
      </div>

      <div className="px-4 py-4">
        {isApproved ? (
          <div className="rounded-lg bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm font-medium text-green-800">承認済み</p>
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-green-700">
                承認者: {approvedByName ?? '不明'}
              </p>
              <p className="text-sm text-green-700">
                承認日: {formatDate(approvedAt)}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              この評価を承認しますか？承認後は評価内容の編集ができなくなります。
            </p>

            {message && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="button"
              onClick={handleApprove}
              disabled={isSubmitting}
              className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '処理中...' : '承認'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
