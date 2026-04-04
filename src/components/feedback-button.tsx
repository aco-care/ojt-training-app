'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { FeedbackCategory } from '@/lib/types';
import { FEEDBACK_CATEGORY_LABELS } from '@/lib/types';

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>('feature');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('内容を入力してください');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('ログインが必要です');
        setSubmitting(false);
        return;
      }

      // Insert feedback
      const { error: insertError } = await supabase.from('feedbacks').insert({
        sender_id: user.id,
        category,
        content: content.trim(),
        status: 'pending',
      });
      if (insertError) throw insertError;

      // Get sender name for notification
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();
      const senderName = senderProfile?.name ?? 'ユーザー';

      // Fetch all admin users to notify them
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin) => ({
          user_id: admin.id,
          title: '新しいフィードバック',
          message: `${senderName}さんから${FEEDBACK_CATEGORY_LABELS[category]}のフィードバックが届きました`,
          is_read: false,
          link: '/admin/feedbacks',
        }));
        await supabase.from('notifications').insert(notifications);
      }

      setSuccess(true);
      setContent('');
      setCategory('feature');
      setTimeout(() => {
        setSuccess(false);
        setIsOpen(false);
      }, 2000);
    } catch (err) {
      setError('送信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors md:bottom-6"
        title="改善要望を送る"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
          />
        </svg>
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">改善要望を送る</h2>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setError(null);
                  setSuccess(false);
                }}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {success ? (
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <p className="text-sm font-medium text-green-700">
                  フィードバックを送信しました。ありがとうございます！
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="feedback-category"
                      className="block text-sm font-medium text-gray-700"
                    >
                      カテゴリ
                    </label>
                    <select
                      id="feedback-category"
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as FeedbackCategory)
                      }
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {(
                        Object.entries(FEEDBACK_CATEGORY_LABELS) as [
                          FeedbackCategory,
                          string,
                        ][]
                      ).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="feedback-content"
                      className="block text-sm font-medium text-gray-700"
                    >
                      内容
                    </label>
                    <textarea
                      id="feedback-content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={4}
                      placeholder="改善してほしい点や要望を入力してください..."
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setError(null);
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? '送信中...' : '送信'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
