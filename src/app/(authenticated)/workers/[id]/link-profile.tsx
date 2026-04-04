'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface LinkProfileProps {
  workerId: string;
  currentProfileId: string | null;
  currentProfileName: string | null;
  workerProfiles: { id: string; name: string; email: string }[];
}

export default function LinkProfile({
  workerId,
  currentProfileId,
  currentProfileName,
  workerProfiles,
}: LinkProfileProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(currentProfileId ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from('foreign_workers')
      .update({ profile_id: selectedId || null })
      .eq('id', workerId);

    setLoading(false);
    if (updateError) {
      setError(`保存に失敗しました: ${updateError.message}`);
      return;
    }

    setEditing(false);
    router.refresh();
  };

  if (!editing) {
    return (
      <div>
        <dt className="text-xs font-medium text-gray-500">本人アカウント</dt>
        <dd className="mt-1 flex items-center gap-2">
          {currentProfileId ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              {currentProfileName ?? 'リンク済み'}
            </span>
          ) : (
            <span className="text-xs text-gray-400">未紐付け</span>
          )}
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            {currentProfileId ? '変更' : '紐付ける'}
          </button>
        </dd>
      </div>
    );
  }

  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">本人アカウント</dt>
      <dd className="mt-1">
        {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">紐付けなし</option>
          {workerProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}（{p.email}）
            </option>
          ))}
        </select>
        <div className="mt-1.5 flex gap-2">
          <button
            onClick={() => { setEditing(false); setSelectedId(currentProfileId ?? ''); }}
            className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </dd>
    </div>
  );
}
