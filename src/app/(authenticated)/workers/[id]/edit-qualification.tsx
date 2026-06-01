'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Qualification } from '@/lib/types';
import { QUALIFICATION_LABELS } from '@/lib/types';
import { writeAuditLog, qualificationLabel } from '@/lib/audit-log';

interface EditQualificationProps {
  workerId: string;
  currentQualification: Qualification;
  currentUserId: string;
  currentUserName: string;
  workerName: string;
}

function qualificationBadgeColor(q: Qualification): string {
  switch (q) {
    case 'kaigofukushishi': return 'bg-green-100 text-green-700';
    case 'shoninsya': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

export default function EditQualification({ workerId, currentQualification, currentUserId, currentUserName, workerName }: EditQualificationProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [qualification, setQualification] = useState<Qualification>(currentQualification);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('foreign_workers')
      .update({ qualification })
      .eq('id', workerId);

    setLoading(false);
    if (updateError) {
      setError(`更新に失敗しました: ${updateError.message}`);
      return;
    }
    if (qualification !== currentQualification) {
      writeAuditLog({
        actorId: currentUserId,
        actorName: currentUserName,
        action: 'update',
        targetTable: 'foreign_workers',
        targetId: workerId,
        targetLabel: workerName,
        description: `${workerName}の資格を ${qualificationLabel(currentQualification)} → ${qualificationLabel(qualification)} に変更しました`,
      });
    }
    setEditing(false);
    router.refresh();
  };

  if (editing) {
    return (
      <div>
        <dt className="text-xs font-medium text-gray-500">資格情報</dt>
        <dd className="mt-1 flex items-center gap-2">
          <select
            value={qualification}
            onChange={(e) => setQualification(e.target.value as Qualification)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {(Object.keys(QUALIFICATION_LABELS) as Qualification[]).map((q) => (
              <option key={q} value={q}>{QUALIFICATION_LABELS[q]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setQualification(currentQualification); }}
            className="text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            取消
          </button>
        </dd>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">資格情報</dt>
      <dd className="mt-1 flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${qualificationBadgeColor(currentQualification)}`}>
          {QUALIFICATION_LABELS[currentQualification]}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          変更
        </button>
      </dd>
    </div>
  );
}
