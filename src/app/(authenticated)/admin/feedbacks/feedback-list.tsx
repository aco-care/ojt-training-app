'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Feedback, FeedbackStatus, FeedbackCategory } from '@/lib/types';
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
} from '@/lib/types';

type FeedbackWithSender = Feedback & {
  sender: { id: string; name: string } | null;
};

interface FeedbackListProps {
  feedbacks: FeedbackWithSender[];
  currentUserId: string;
}

const TABS: { label: string; value: FeedbackStatus | 'all' }[] = [
  { label: 'すべて', value: 'all' },
  { label: '未対応', value: 'pending' },
  { label: '対応中', value: 'in_progress' },
  { label: '対応済み', value: 'resolved' },
];

const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  ui: 'bg-purple-100 text-purple-700',
  feature: 'bg-blue-100 text-blue-700',
  bug: 'bg-red-100 text-red-700',
  other: 'bg-gray-100 text-gray-700',
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
};

export default function FeedbackList({
  feedbacks: initialFeedbacks,
  currentUserId,
}: FeedbackListProps) {
  const [feedbacks, setFeedbacks] =
    useState<FeedbackWithSender[]>(initialFeedbacks);
  const [activeTab, setActiveTab] = useState<FeedbackStatus | 'all'>('all');
  const [modalFeedback, setModalFeedback] =
    useState<FeedbackWithSender | null>(null);
  const [modalStatus, setModalStatus] = useState<FeedbackStatus>('in_progress');
  const [adminResponse, setAdminResponse] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered =
    activeTab === 'all'
      ? feedbacks
      : feedbacks.filter((f) => f.status === activeTab);

  const handleOpenModal = (fb: FeedbackWithSender) => {
    setModalFeedback(fb);
    setModalStatus(fb.status === 'pending' ? 'in_progress' : fb.status);
    setAdminResponse(fb.admin_response ?? '');
  };

  const handleSave = async () => {
    if (!modalFeedback) return;
    setSaving(true);

    try {
      const supabase = createClient();

      const updateData: Record<string, unknown> = {
        status: modalStatus,
        admin_response: adminResponse.trim() || null,
      };
      if (modalStatus === 'resolved') {
        updateData.resolved_by = currentUserId;
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('feedbacks')
        .update(updateData)
        .eq('id', modalFeedback.id);
      if (error) throw error;

      // Notify the feedback sender
      const statusText = `あなたの${FEEDBACK_CATEGORY_LABELS[modalFeedback.category]}フィードバックのステータスが「${FEEDBACK_STATUS_LABELS[modalStatus]}」に変更されました`;
      const responseText = adminResponse.trim()
        ? `\n【対応内容】${adminResponse.trim()}`
        : '';
      await supabase.from('notifications').insert({
        user_id: modalFeedback.sender_id,
        title: 'フィードバックが更新されました',
        message: statusText + responseText,
        is_read: false,
        link: null,
      });

      // Update local state
      setFeedbacks((prev) =>
        prev.map((f) =>
          f.id === modalFeedback.id
            ? {
                ...f,
                status: modalStatus,
                admin_response: adminResponse.trim() || null,
                resolved_by:
                  modalStatus === 'resolved' ? currentUserId : f.resolved_by,
                resolved_at:
                  modalStatus === 'resolved'
                    ? new Date().toISOString()
                    : f.resolved_at,
              }
            : f,
        ),
      );

      setModalFeedback(null);
    } catch {
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
        {TABS.map((tab) => {
          const count =
            tab.value === 'all'
              ? feedbacks.length
              : feedbacks.filter((f) => f.status === tab.value).length;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`flex-shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs text-gray-400">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Feedback cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">フィードバックはありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((fb) => (
            <div
              key={fb.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {fb.sender?.name ?? '不明'}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[fb.category]}`}
                    >
                      {FEEDBACK_CATEGORY_LABELS[fb.category]}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[fb.status]}`}
                    >
                      {FEEDBACK_STATUS_LABELS[fb.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                    {fb.content}
                  </p>
                  {fb.image_url && (
                    <a href={fb.image_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                      <img src={fb.image_url} alt="添付画像" className="max-h-40 rounded-lg border border-gray-200 object-cover hover:opacity-80 transition-opacity" />
                    </a>
                  )}
                  {fb.admin_response && (
                    <div className="mt-2 rounded bg-blue-50 p-2">
                      <p className="text-xs font-medium text-blue-800">
                        管理者回答:
                      </p>
                      <p className="text-sm text-blue-900 whitespace-pre-wrap">
                        {fb.admin_response}
                      </p>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    {new Date(fb.created_at).toLocaleString('ja-JP')}
                  </p>
                </div>
                {fb.status !== 'resolved' && (
                  <button
                    type="button"
                    onClick={() => handleOpenModal(fb)}
                    className="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    対応する
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Response modal */}
      {modalFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                フィードバック対応
              </h2>
              <button
                type="button"
                onClick={() => setModalFeedback(null)}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
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

            <div className="mb-4 rounded bg-gray-50 p-3">
              <p className="text-xs text-gray-500">
                {modalFeedback.sender?.name ?? '不明'} /{' '}
                {FEEDBACK_CATEGORY_LABELS[modalFeedback.category]}
              </p>
              <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                {modalFeedback.content}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="response-status"
                  className="block text-sm font-medium text-gray-700"
                >
                  ステータス
                </label>
                <select
                  id="response-status"
                  value={modalStatus}
                  onChange={(e) =>
                    setModalStatus(e.target.value as FeedbackStatus)
                  }
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="pending">未対応</option>
                  <option value="in_progress">対応中</option>
                  <option value="resolved">対応済み</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="admin-response"
                  className="block text-sm font-medium text-gray-700"
                >
                  回答
                </label>
                <textarea
                  id="admin-response"
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  rows={4}
                  placeholder="対応内容を入力してください..."
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalFeedback(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
