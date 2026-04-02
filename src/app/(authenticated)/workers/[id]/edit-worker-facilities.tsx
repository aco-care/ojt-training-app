'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { FacilityMultiSelect } from '@/components/facility-multi-select';
import AddFacilityDialog from '../../admin/staff/add-facility-dialog';

interface EditWorkerFacilitiesProps {
  workerId: string;
  allFacilities: { id: string; name: string }[];
  currentFacilities: { id: string; name: string; is_primary: boolean }[];
}

export default function EditWorkerFacilities({
  workerId,
  allFacilities,
  currentFacilities,
}: EditWorkerFacilitiesProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [facilityIds, setFacilityIds] = useState<string[]>(
    currentFacilities.map((f) => f.id)
  );
  const [primaryId, setPrimaryId] = useState(
    currentFacilities.find((f) => f.is_primary)?.id ?? currentFacilities[0]?.id ?? ''
  );

  const handleChange = (selectedIds: string[], newPrimaryId: string) => {
    setFacilityIds(selectedIds);
    setPrimaryId(newPrimaryId);
  };

  const handleFacilityCreated = (id: string) => {
    setFacilityIds((prev) => [...prev, id]);
    if (facilityIds.length === 0) setPrimaryId(id);
    router.refresh();
  };

  const handleSave = async () => {
    if (facilityIds.length === 0) {
      setError('少なくとも1つの事業所を選択してください');
      return;
    }

    setLoading(true);
    setError('');
    const supabase = createClient();

    // 1. Update foreign_workers.facility_id (backward compat)
    const { error: updateError } = await supabase
      .from('foreign_workers')
      .update({ facility_id: primaryId })
      .eq('id', workerId);

    if (updateError) {
      setLoading(false);
      setError(`更新に失敗しました: ${updateError.message}`);
      return;
    }

    // 2. Delete old worker_facilities
    const { error: deleteError } = await supabase
      .from('worker_facilities')
      .delete()
      .eq('worker_id', workerId);

    if (deleteError) {
      setLoading(false);
      setError(`施設情報の削除に失敗しました: ${deleteError.message}`);
      return;
    }

    // 3. Insert new worker_facilities
    const rows = facilityIds.map((fid) => ({
      worker_id: workerId,
      facility_id: fid,
      is_primary: fid === primaryId,
    }));

    const { error: insertError } = await supabase
      .from('worker_facilities')
      .insert(rows);

    if (insertError) {
      setLoading(false);
      setError(`施設情報の保存に失敗しました: ${insertError.message}`);
      return;
    }

    setLoading(false);
    setEditing(false);
    router.refresh();
  };

  const handleCancel = () => {
    setEditing(false);
    setError('');
    setFacilityIds(currentFacilities.map((f) => f.id));
    setPrimaryId(
      currentFacilities.find((f) => f.is_primary)?.id ?? currentFacilities[0]?.id ?? ''
    );
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-800"
      >
        編集
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {error && (
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</div>
      )}

      <div className="flex items-center justify-between mb-1">
        <AddFacilityDialog onCreated={handleFacilityCreated} />
      </div>

      <FacilityMultiSelect
        facilities={allFacilities}
        selectedIds={facilityIds}
        primaryId={primaryId}
        onChange={handleChange}
      />

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
