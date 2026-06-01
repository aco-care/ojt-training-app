'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AuditLog {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target_table: string;
  target_id: string;
  target_label: string;
  description: string;
  created_at: string;
}

const TABLE_LABELS: Record<string, string> = {
  training_plans: '研修予定',
  ojt_plans: 'OJT予定',
  profiles: 'スタッフ',
  facilities: '施設',
  training_sessions: '研修記録',
  foreign_workers: '特定技能外国人',
};

const TABLE_COLORS: Record<string, string> = {
  training_plans: 'bg-blue-100 text-blue-700',
  ojt_plans: 'bg-green-100 text-green-700',
  profiles: 'bg-purple-100 text-purple-700',
  facilities: 'bg-amber-100 text-amber-700',
  training_sessions: 'bg-indigo-100 text-indigo-700',
  foreign_workers: 'bg-pink-100 text-pink-700',
};

const ACTION_LABELS: Record<string, string> = {
  insert: '追加',
  update: '編集',
  delete: '削除',
  cancel: 'キャンセル',
  archive: 'アーカイブ',
};

const FILTER_TABS: { label: string; value: string }[] = [
  { label: 'すべて', value: 'all' },
  { label: '研修予定', value: 'training_plans' },
  { label: 'OJT予定', value: 'ojt_plans' },
  { label: 'スタッフ', value: 'profiles' },
  { label: '施設', value: 'facilities' },
  { label: '研修記録', value: 'training_sessions' },
];

interface AuditLogListProps {
  initialLogs: AuditLog[];
}

export default function AuditLogList({ initialLogs }: AuditLogListProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialLogs.length >= 100);

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.target_table === filter);

  const loadMore = async () => {
    if (logs.length === 0) return;
    setLoading(true);
    const supabase = createClient();
    const lastCreatedAt = logs[logs.length - 1].created_at;
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .lt('created_at', lastCreatedAt)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data && data.length > 0) {
      setLogs((prev) => [...prev, ...(data as AuditLog[])]);
      setHasMore(data.length >= 100);
    } else {
      setHasMore(false);
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.value === 'all'
              ? logs.length
              : logs.filter((l) => l.target_table === tab.value).length;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={`flex-shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                filter === tab.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className="ml-1 text-xs text-gray-400">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Log entries */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">操作履歴はありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400">{formatDate(log.created_at)}</span>
                <span className="text-sm font-semibold text-gray-900">{log.actor_name}</span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    TABLE_COLORS[log.target_table] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {TABLE_LABELS[log.target_table] ?? log.target_table}
                </span>
                <span className="text-xs text-gray-500">
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{log.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && filtered.length > 0 && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? '読み込み中...' : 'もっと読み込む'}
          </button>
        </div>
      )}
    </>
  );
}
